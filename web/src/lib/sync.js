/**
 * Pushing local bookings to the backend.
 *
 * The app is local-first, so a booking exists and is usable on the device
 * before the server has ever heard of it. This module is the one-way door it
 * goes through afterwards.
 *
 * Two properties matter more than anything else here:
 *
 * **A retry must not double-book.** The device generates a `clientKey` when the
 * booking is created, not when it is sent, and the backend holds a unique
 * constraint on it. So a booking pushed twice - a dropped response, a flaky
 * tunnel, a farmer who came back into signal twice - reserves the slot once and
 * returns the same record the second time.
 *
 * **A failure must be survivable.** Nothing in here throws at the caller. A
 * booking that could not be pushed stays queued and is tried again, because the
 * farmer already has a receipt in their hand and the app has no business
 * telling them their booking evaporated.
 */

import { api } from './api'

/**
 * A key the server has never seen, generated on the device.
 *
 * `randomUUID` needs a secure context, which a file:// build or an old WebView
 * will not always give us, so there is a fallback. It only has to be unique
 * among one farmer's bookings, not globally unguessable.
 */
export function newClientKey() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    /* fall through */
  }
  const rand = Math.random().toString(36).slice(2, 10)
  return `ck-${Date.now().toString(36)}-${rand}`
}

/** The local booking shape, translated into what the API expects. */
export function toApiPayload(booking) {
  return {
    facility_id: booking.storageId,
    crop_id: booking.cropId,
    quantity_kg: Number(booking.quantityKg),
    expected_days: Number(booking.holdDays) || 6,
    pooled: Boolean(booking.pooled),
    pickup_label: String(booking.pickup ?? 'Tomorrow').slice(0, 64),
    client_key: booking.clientKey,
  }
}

/**
 * Push one booking. Never throws.
 *
 * A 4xx means the server understood and refused - the facility is full, the lot
 * is below its minimum - and retrying will not change that, so the booking is
 * marked rejected and the farmer is told. Anything else is treated as transient
 * and left queued.
 */
export async function pushBooking(booking) {
  try {
    const out = await api.createBooking(toApiPayload(booking))
    return {
      ok: true,
      id: booking.id,
      reference: out.reference,
      serverStatus: out.status,
      slotsHeld: out.slots_held,
      estimatedCostPaise: out.estimated_cost_paise,
    }
  } catch (error) {
    const status = error?.status ?? 0
    return {
      ok: false,
      id: booking.id,
      permanent: status >= 400 && status < 500 && status !== 408 && status !== 429,
      status,
      reason: error?.detail || error?.message || 'The booking could not be sent.',
    }
  }
}

/** Push several, concurrently, collecting every outcome. */
export async function pushBookings(bookings) {
  return Promise.all(bookings.map(pushBooking))
}
