import { Link } from 'react-router-dom'
import { ChevronRight, CloudOff, Inbox, Mic, Users } from 'lucide-react'
import { useApp } from '../store/context'
import { getCrop, getStorage } from '../data/seed'
import { shelfTone, spoilage } from '../lib/ai'
import { dateShort, kg } from '../lib/format'
import { DAY_LABELS } from '../lib/intent'
import { Bilingual, Card, Chip, SectionTitle } from '../components/ui'

const STATUS_TONE = {
  CONFIRMED: 'green',
  QUEUED: 'amber',
  // The server understood the booking and refused it - full facility, lot under
  // the minimum. Retrying will not help, so it reads as a refusal, not a wait.
  REJECTED: 'red',
  PENDING: 'amber',
  CANCELLED: 'red',
}

/**
 * Queued means the same thing either way - nobody but this phone has agreed to
 * it yet - but the reason differs, and so should the word. With no signal it is
 * being held; with a signal it is in flight. Saying "saved offline" to someone
 * who is plainly online reads as a bug.
 */
const statusLabel = (status, online) => {
  if (status === 'QUEUED') return online ? 'SENDING…' : 'SAVED OFFLINE'
  if (status === 'REJECTED') return 'NOT ACCEPTED'
  return status
}

export default function Bookings() {
  const { bookings, cancelBooking, notify, online, lang } = useApp()

  return (
    <div className="space-y-5">
      <SectionTitle
        en="My Bookings"
        hi="मेरी बुकिंग"
        sub="Every lot you have stored, with its live freshness window."
      />

      {bookings.length === 0 ? (
        <Card accent="green" className="p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
            <Inbox size={30} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="mt-4 text-lg font-semibold">No bookings yet</p>
          <p className="mt-1 text-on-surface-variant">
            Book your first slot by voice - it takes about ten seconds.
          </p>
          <Link to="/voice" role="button" className="cc-btn-primary mt-6 inline-flex">
            <Mic size={20} strokeWidth={2.5} aria-hidden="true" />
            <Bilingual en="Speak to Book" hi="बोलकर बुक करें" />
          </Link>
        </Card>
      ) : (
        <ul className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {bookings.map((b) => {
            const crop = getCrop(b.cropId)
            const storage = getStorage(b.storageId)
            // Freshness counts down from check-in, not from when the list rendered.
            const daysStored = Math.max(
              0,
              Math.floor((Date.now() - new Date(b.checkinAt).getTime()) / 86400000),
            )
            const decay = spoilage(b.cropId, daysStored)
            const cancelled = b.status === 'CANCELLED'

            return (
              <li key={b.id}>
                <Card accent={cancelled ? 'red' : 'blue'} className={`p-4 ${cancelled ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-container-high text-2xl"
                      aria-hidden="true"
                    >
                      {crop.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold">
                          {crop.name} · {kg(b.quantityKg)}
                        </h3>
                        {b.pooled && (
                          <Users size={16} strokeWidth={2.5} className="shrink-0 text-primary" aria-label="Pooled booking" />
                        )}
                      </div>
                      <p className="truncate text-sm text-on-surface-variant">
                        {storage.name} ·{' '}
                        {(b.pickupDayId && (DAY_LABELS[b.pickupDayId]?.[lang] ?? b.pickup)) || b.pickup}
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        #{b.id} · in on {dateShort(b.checkinAt)}
                      </p>
                    </div>
                    <Link
                      to={`/receipt/${b.id}`}
                      aria-label={`Open receipt ${b.id}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10"
                    >
                      <ChevronRight size={22} strokeWidth={2.5} />
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Chip
                      tone={STATUS_TONE[b.status] ?? 'neutral'}
                      icon={b.status === 'QUEUED' && !online ? CloudOff : undefined}
                    >
                      {statusLabel(b.status, online)}
                    </Chip>
                    {/* The server's own reference, once it has one. Proof the
                        booking exists somewhere other than this handset. */}
                    {b.serverRef && <Chip tone="green">Server ref {b.serverRef}</Chip>}
                    {b.syncError && b.status === 'REJECTED' && (
                      <Chip tone="red">{b.syncError}</Chip>
                    )}
                    {!cancelled && (
                      <Chip tone={shelfTone(decay.remaining)}>
                        Fresh for {decay.remaining} more days
                      </Chip>
                    )}
                    {!cancelled && (
                      <button
                        type="button"
                        className="ml-auto min-h-0 rounded-full px-3 py-1.5 text-xs font-semibold text-error hover:bg-error-container"
                        onClick={() => {
                          cancelBooking(b.id)
                          notify('Booking cancelled, slot released')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
