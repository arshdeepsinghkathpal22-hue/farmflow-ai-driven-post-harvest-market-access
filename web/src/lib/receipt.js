// Warehouse receipt signing and verification.
//
// A receipt is only worth pledging against a loan if a lender can check it was
// not altered after issue. Each receipt is therefore serialised into a fixed
// canonical string and signed with HMAC-SHA256 via WebCrypto; the QR carries
// the payload and the signature together, and anyone can re-derive the
// signature and compare.
//
// HONEST LIMITATION: this prototype holds the demo key in the client, so the
// signature proves integrity, not authorship - anyone with the bundle could
// mint a receipt. In production the key belongs to the facility (or the e-NWR
// registry) and signing happens server side; the verification path below is
// unchanged by that move.

import BRAND from '../brand'

const DEMO_KEY = 'demo-signing-key-2026'
// Deliberately not the backend's prefix: this is the weaker offline HMAC scheme,
// and a receipt should never claim to be something it is not.
const VERSION = `${BRAND.shortCode}WR1`

let keyPromise = null

function subtle() {
  return globalThis.crypto?.subtle ?? null
}

async function getKey() {
  if (!keyPromise) {
    keyPromise = subtle().importKey(
      'raw',
      new TextEncoder().encode(DEMO_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  }
  return keyPromise
}

/**
 * Canonical form. Field order is fixed and every value is normalised, so the
 * same receipt always serialises to the same bytes on any device.
 */
export function canonicalPayload(booking, farmerId) {
  return [
    VERSION,
    booking.id,
    farmerId,
    booking.cropId,
    String(booking.quantityKg),
    booking.storageId,
    booking.checkinAt.slice(0, 10),
    booking.expiryAt.slice(0, 10),
  ].join('|')
}

/**
 * Non-cryptographic fallback, used only where WebCrypto is unavailable (an
 * insecure context, for example). Clearly weaker, and reported as such.
 */
function weakDigest(text) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i += 1) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + text.charCodeAt(i) + i, 2654435761) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase()
}

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Full signature, plus the short code a person can read out over a phone. */
export async function sign(payload) {
  if (!subtle()) {
    const digest = weakDigest(payload)
    return { signature: digest, short: digest.slice(0, 12), strong: false }
  }
  const mac = await subtle().sign('HMAC', await getKey(), new TextEncoder().encode(payload))
  const hex = toHex(mac).toUpperCase()
  return { signature: hex, short: hex.slice(0, 12), strong: true }
}

/** Everything the QR carries: payload and signature, separated by `#`. */
export async function issue(booking, farmerId) {
  const payload = canonicalPayload(booking, farmerId)
  const { signature, short, strong } = await sign(payload)
  return { payload, signature, short, strong, qr: `${payload}#${signature}` }
}

const VERDICT = {
  VALID: 'VALID',
  TAMPERED: 'TAMPERED',
  MALFORMED: 'MALFORMED',
}

/** Which of the two signing schemes actually answered. */
const SCHEME = {
  SERVER: 'SERVER', // Ed25519, key held server side, public key published
  LOCAL: 'LOCAL', // HMAC-SHA256 in the browser, for receipts issued offline
}

/**
 * Verify a scanned or pasted receipt string.
 * Returns a verdict plus the decoded fields, so the check can be shown rather
 * than merely asserted.
 */
export async function verify(raw) {
  const text = (raw ?? '').trim()
  if (!text) return { verdict: VERDICT.MALFORMED, reason: 'Nothing to check.' }

  const cut = text.lastIndexOf('#')
  if (cut < 1) {
    return {
      verdict: VERDICT.MALFORMED,
      reason: `This is not a ${BRAND.name} receipt code - the signature is missing.`,
    }
  }

  const payload = text.slice(0, cut)
  const claimed = text.slice(cut + 1).toUpperCase()
  const parts = payload.split('|')

  if (parts[0] !== VERSION || parts.length !== 8) {
    return {
      verdict: VERDICT.MALFORMED,
      reason: 'Unrecognised receipt format.',
    }
  }

  const { signature, strong } = await sign(payload)
  const fields = {
    receiptId: parts[1],
    farmerId: parts[2],
    cropId: parts[3],
    quantityKg: Number(parts[4]),
    storageId: parts[5],
    checkin: parts[6],
    expiry: parts[7],
  }

  if (signature !== claimed) {
    return {
      verdict: VERDICT.TAMPERED,
      reason: 'The signature does not match the contents. This receipt has been altered.',
      fields,
      strong,
    }
  }

  return { verdict: VERDICT.VALID, fields, strong, short: signature.slice(0, 12), scheme: SCHEME.LOCAL }
}

/**
 * Ask the server to verify, then fall back to the offline check.
 *
 * Two signing schemes exist and both are real. The server issues `…WR2`
 * receipts signed with **Ed25519**: the private key never leaves it, the public
 * key is published at `/api/receipts/public-key`, and the verify endpoint takes
 * no authentication - a lender deciding whether to advance money against a
 * receipt must be able to check it without an account on this platform. The
 * browser issues `…WR1` receipts signed with HMAC-SHA256 so that a farmer with
 * no signal still gets a receipt that cannot be edited afterwards.
 *
 * The screen used to run only the offline check, which meant a genuine
 * server-issued receipt was reported as "not a readable receipt" - the format
 * it does not know - and the stronger of the two schemes was unreachable from
 * the app at all.
 *
 * Order matters. The server is asked first because its answer is worth more:
 * it verifies against a key the client does not hold. Its "unrecognised format"
 * is not a rejection though, only a statement that the code is not one of its
 * own, so that case falls through to the offline verifier rather than calling a
 * valid offline receipt malformed.
 */
let serverAnswered = true

export async function verifyAnywhere(raw, client) {
  const text = (raw ?? '').trim()

  // One failed attempt is enough to learn the server is not there. Without this
  // every scan pays the timeout again, and a person checking a stack of
  // receipts at a warehouse gate would wait through it each time.
  if (client && text && serverAnswered) {
    try {
      const res = await client.verifyReceipt(text)
      const fields = mapServerFields(res.fields)
      if (res.valid) {
        const sig = text.slice(text.lastIndexOf('#') + 1)
        return {
          verdict: VERDICT.VALID,
          fields,
          strong: true,
          scheme: SCHEME.SERVER,
          algorithm: res.algorithm ?? 'Ed25519',
          short: sig.slice(0, 12).toUpperCase(),
        }
      }
      // A definite "this was altered" comes with the decoded fields; a mere
      // "not my format" does not, and that one is not the server's to answer.
      if (fields) {
        return {
          verdict: VERDICT.TAMPERED,
          reason: res.reason,
          fields,
          strong: true,
          scheme: SCHEME.SERVER,
          algorithm: res.algorithm ?? 'Ed25519',
        }
      }
    } catch {
      // Offline, or no backend running. Both are supported ways to use this app.
      serverAnswered = false
    }
  }

  return verify(text)
}

/** Try the server again - after a sync, or when the network comes back. */
export function resetServerVerification() {
  serverAnswered = true
}

/** The server names its fields after the receipt spec; the screen uses its own. */
function mapServerFields(f) {
  if (!f) return null
  return {
    receiptId: f.number ?? f.booking_ref ?? '',
    farmerId: f.farmer_id ?? '',
    cropId: f.crop_id ?? '',
    quantityKg: Number(f.weight_kg ?? 0),
    storageId: f.facility_id ?? '',
    checkin: f.checkin_date ?? '',
    expiry: f.expiry_date ?? '',
  }
}

export { VERDICT, SCHEME }
