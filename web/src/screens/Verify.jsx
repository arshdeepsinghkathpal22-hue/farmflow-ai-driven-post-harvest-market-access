import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, HelpCircle, ScanLine, ShieldCheck } from 'lucide-react'
import { getCrop, getStorage } from '../data/seed'
import { SCHEME, VERDICT, resetServerVerification, verifyAnywhere } from '../lib/receipt'
import { api } from '../lib/api'
import { useApp } from '../store/context'
import { kg } from '../lib/format'
import { Bilingual, Card, Chip, SectionTitle } from '../components/ui'
import BRAND from '../brand'

const TONE = {
  [VERDICT.VALID]: {
    accent: 'green',
    chip: 'green',
    icon: CheckCircle2,
    badge: 'bg-primary text-on-primary',
    title: 'Receipt is genuine',
    titleHi: 'रसीद असली है',
  },
  [VERDICT.TAMPERED]: {
    accent: 'red',
    chip: 'red',
    icon: AlertTriangle,
    badge: 'bg-error text-on-error',
    title: 'Receipt has been altered',
    titleHi: 'रसीद बदली गई है',
  },
  [VERDICT.MALFORMED]: {
    accent: 'amber',
    chip: 'amber',
    icon: HelpCircle,
    badge: 'bg-secondary-container text-on-secondary-container',
    title: 'Not a readable receipt',
    titleHi: 'रसीद पढ़ी नहीं जा सकी',
  },
}

export default function Verify() {
  const [params] = useSearchParams()
  const { online } = useApp()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)

  // The network coming back is a reason to try the stronger check again.
  useEffect(() => {
    if (online) resetServerVerification()
  }, [online])

  // A check can take a moment when the server is asked first, and in that time
  // the code in the box can change. Without this, a slow answer for the previous
  // code lands after the new one and the screen shows the wrong verdict for what
  // is on screen - "genuine" over a receipt that was just altered. Only the
  // newest request is allowed to write a result.
  const latest = useRef(0)

  const run = async (value) => {
    const ticket = (latest.current += 1)
    setChecking(true)
    // With no network there is nothing to ask, and asking anyway would make a
    // farmer wait out a timeout before seeing the answer their phone already has.
    const outcome = await verifyAnywhere(value, online ? api : null)
    if (ticket !== latest.current) return
    setResult(outcome)
    setChecking(false)
  }

  // A code arriving in the URL is what a scanned QR would produce.
  useEffect(() => {
    const incoming = params.get('code')
    if (incoming) run(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tone = result ? TONE[result.verdict] : null
  const Icon = tone?.icon

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionTitle
        en="Verify a Receipt"
        hi="रसीद जाँचें"
        sub={`Anyone - a lender, a buyer, the gate clerk - can check a ${BRAND.name} warehouse receipt here.`}
      />

      <Card accent="blue" className="p-5">
        <label htmlFor="cc-code" className="text-sm font-semibold">
          Paste the receipt code, or scan the QR on the receipt
        </label>
        <textarea
          id="cc-code"
          rows={4}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck="false"
          placeholder="FFWR1|FF-9822|FRM-1042|tomato|75|ST-01|..."
          className="mt-2 w-full resize-y rounded-sm border-2 border-transparent bg-surface-container-low p-3 font-mono text-xs leading-relaxed text-on-surface focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          className="cc-btn-primary mt-3 w-full"
          onClick={() => run(code)}
          disabled={checking}
        >
          <ScanLine size={20} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en={checking ? 'Checking…' : 'Check this receipt'} hi="जाँच करें" />
        </button>
      </Card>

      {result && (
        <Card accent={tone.accent} className="animate-slide-up p-5">
          <div className="flex items-start gap-4">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone.badge}`}>
              <Icon size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight">{tone.title}</h2>
              <p className="text-sm font-semibold text-on-surface-variant">{tone.titleHi}</p>
              {result.reason && (
                <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
                  {result.reason}
                </p>
              )}
              {result.verdict === VERDICT.VALID && (
                <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
                  The signature matches the contents exactly, so nothing in this receipt has changed
                  since it was issued.
                </p>
              )}
            </div>
          </div>

          {result.fields && (
            <dl className="mt-5 divide-y divide-outline-variant/50 text-base">
              <Row label="Receipt" value={`#${result.fields.receiptId}`} />
              <Row label="Farmer ID" value={result.fields.farmerId} />
              <Row
                label="Crop"
                value={`${getCrop(result.fields.cropId).name} (${kg(result.fields.quantityKg)})`}
              />
              <Row label="Storage" value={getStorage(result.fields.storageId).name} />
              <Row label="Checked in" value={result.fields.checkin} />
              <Row label="Expires" value={result.fields.expiry} />
            </dl>
          )}

          {result.verdict === VERDICT.VALID && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="green" icon={ShieldCheck}>
                {result.scheme === SCHEME.SERVER
                  ? `${result.algorithm ?? 'Ed25519'} verified by the server`
                  : result.strong
                    ? 'HMAC-SHA256 verified on this phone'
                    : 'Checksum verified'}
              </Chip>
              <Chip tone="neutral">Seal {result.short}</Chip>
            </div>
          )}
        </Card>
      )}

      <Card accent="amber" className="p-5">
        <h2 className="text-lg font-semibold">Try to break it</h2>
        <p className="mt-1.5 text-base leading-relaxed text-on-surface-variant">
          Change a single character in the box above - swap the quantity, or one digit of the
          receipt number - and check it again. The seal stops matching immediately, which is the
          whole point: a warehouse receipt is only worth lending against if tampering is obvious.
        </p>
        <p className="mt-3 rounded-sm bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <strong className="text-on-surface">Two seals, and the chip says which one checked:</strong>{' '}
          receipts issued by the server are signed with <strong>Ed25519</strong>. That private key
          never leaves the server, the matching public key is published openly, and the check needs
          no account - a lender has to be able to verify a receipt without joining this platform.
          Receipts a farmer creates with no signal are sealed with HMAC-SHA256 on the phone instead;
          the demo key is in this page, so that seal proves the receipt is unaltered rather than who
          issued it. In production that weaker key belongs to the facility or the e-NWR registry.
        </p>
      </Card>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  )
}
