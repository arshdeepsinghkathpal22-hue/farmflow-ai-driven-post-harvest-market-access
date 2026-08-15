import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Banknote,
  Download,
  Landmark,
  Leaf,
  ScanLine,
  Share2,
  ShieldCheck,
  Warehouse,
} from 'lucide-react'
import { useApp } from '../store/context'
import { getCrop, getStorage } from '../data/seed'
import { dateShort, kg, rupee } from '../lib/format'
import { issue } from '../lib/receipt'
import { Bilingual, Card, Chip } from '../components/ui'

export default function Receipt() {
  const { id } = useParams()
  const { bookings, farmer, notify } = useApp()
  const [qr, setQr] = useState('')
  const [seal, setSeal] = useState(null)

  const booking = bookings.find((b) => b.id === id)

  useEffect(() => {
    if (!booking) return
    let live = true

    // The QR carries the signed payload, so a scanner gets everything it needs
    // to verify the receipt without calling back to us.
    issue(booking, farmer.id).then((issued) => {
      if (!live) return
      setSeal(issued)
      QRCode.toDataURL(issued.qr, {
        width: 480,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#006030ff', light: '#ffffffff' },
      })
        .then((url) => live && setQr(url))
        .catch(() => live && setQr(''))
    })

    return () => {
      live = false
    }
  }, [booking, farmer.id])

  if (!booking) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">Receipt not found</p>
        <p className="mt-1 text-on-surface-variant">This booking may have been reset.</p>
        <Link to="/bookings" role="button" className="cc-btn-primary mt-6 inline-flex">
          <Bilingual en="Back to Bookings" hi="बुकिंग पर लौटें" />
        </Link>
      </div>
    )
  }

  const crop = getCrop(booking.cropId)
  const storage = getStorage(booking.storageId)
  const estCost = Math.round(storage.pricePerKgDay * booking.quantityKg * booking.holdDays)

  return (
    <div className="space-y-6">
      <h1 className="text-center text-xl font-bold text-primary">
        <Bilingual en="Digital Receipt" hi="डिजिटल रसीद" />
      </h1>

      <Card accent="green" className="p-6">
        <div className="text-center">
          <p className="text-3xl font-bold tracking-tight">#{booking.id}</p>
          <p className="mt-1 font-semibold">Warehouse Receipt</p>
          <p className="text-sm font-semibold text-secondary">गोदाम रसीद</p>
        </div>

        <div className="mt-5 grid place-items-center">
          <div className="rounded-md bg-surface-container-low p-4">
            {qr ? (
              <img src={qr} alt={`QR code for receipt ${booking.id}`} className="h-44 w-44" />
            ) : (
              <div className="grid h-44 w-44 place-items-center text-sm text-on-surface-variant">
                Generating…
              </div>
            )}
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            <Bilingual en="Scan to Verify" hi="स्कैन कर पुष्टि करें" />
          </p>
        </div>

        <dl className="mt-6 divide-y divide-outline-variant/50 text-base">
          <Row label="Farmer" labelHi="किसान" value={farmer.name} />
          <Row
            icon={Leaf}
            label="Crop"
            labelHi="फसल"
            value={`${crop.name} (${kg(booking.quantityKg)})`}
          />
          <Row icon={Warehouse} label="Storage" labelHi="गोदाम" value={storage.name} />
          <Row label="Check-in" labelHi="जमा तिथि" value={dateShort(booking.checkinAt)} />
          <Row
            label="Expiry"
            labelHi="समाप्ति"
            value={dateShort(booking.expiryAt)}
            valueClass="text-error font-bold"
          />
          <Row label="Est. cost" labelHi="अनुमानित लागत" value={rupee(estCost)} />
          {booking.pooled && <Row label="Booking type" labelHi="प्रकार" value="Pooled / समूह" />}
        </dl>

        <div className="mt-5 space-y-2">
          <Chip tone="green" icon={ShieldCheck} className="w-full !justify-start !py-2.5">
            <Bilingual en="Valid as Warehouse Receipt" hi="गोदाम रसीद" />
          </Chip>
          <Chip tone="amber" icon={Landmark} className="w-full !justify-start !py-2.5">
            <Bilingual en="Loan Collateral Eligible" hi="लोन के लिए मान्य" />
          </Chip>
        </div>

        {/* The seal is what makes the collateral claim checkable rather than asserted. */}
        {seal && (
          <div className="mt-4 rounded-md bg-surface-container-low p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Security seal
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-[0.18em] text-primary">
              {seal.short}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
              {seal.strong ? 'HMAC-SHA256' : 'Checksum'} over the receipt contents. Change any field
              and this code changes with it.
            </p>
            <Link
              to={`/verify?code=${encodeURIComponent(seal.qr)}`}
              role="button"
              className="cc-btn-outline mt-3 w-full !py-3"
            >
              <ScanLine size={18} strokeWidth={2.5} aria-hidden="true" />
              <Bilingual en="Verify this receipt" hi="रसीद जाँचें" />
            </Link>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <button
          type="button"
          className="cc-btn-primary w-full !py-5"
          onClick={() => notify('Receipt saved to your phone')}
        >
          <Download size={20} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en="Download" hi="डाउनलोड" stacked />
        </button>
        <button
          type="button"
          className="cc-btn-outline w-full"
          onClick={() => notify('Shared on WhatsApp')}
        >
          <Share2 size={20} strokeWidth={2.5} aria-hidden="true" />
          <Bilingual en="WhatsApp Share" hi="व्हाट्सएप पर भेजें" stacked />
        </button>
        <p className="flex items-center justify-center gap-2 pt-1 text-center text-xs text-on-surface-variant">
          <Banknote size={14} strokeWidth={2.5} aria-hidden="true" />
          Receipt can be pledged for a harvest loan under e-NWR rules.
        </p>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, labelHi, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-on-surface-variant">
        {Icon ? <Icon size={18} strokeWidth={2.5} className="text-primary" aria-hidden="true" /> : null}
        <span>
          {label} <span className="text-sm">/ {labelHi}</span>
        </span>
      </dt>
      <dd className={`text-right font-semibold ${valueClass}`}>{value}</dd>
    </div>
  )
}
