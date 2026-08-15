import { Mic, Snowflake, TrendingUp, X } from 'lucide-react'
import { useApp } from '../store/context'
import { Bilingual } from './ui'
import BRAND from '../brand'

const STEPS = [
  {
    icon: Mic,
    tone: 'bg-primary text-on-primary',
    title: 'Book by speaking',
    body: 'Tap the big microphone. A spoken Hindi order becomes a booking, and you get a scannable QR warehouse receipt.',
  },
  {
    icon: TrendingUp,
    tone: 'bg-tertiary-container text-on-tertiary',
    title: 'Watch the advisor change its mind',
    body: 'Open Prices and switch the crop to Cauliflower. STORE flips to SELL, because the model weighs price gain against storage cost.',
  },
  {
    icon: Snowflake,
    tone: 'bg-secondary-container text-on-secondary-container',
    title: 'See the other side',
    body: 'Open the Storage Owner Dashboard from Profile. The booking you just made is already in the incoming table.',
  },
]

/**
 * First-run orientation. Judges open this link cold, with no idea who they are
 * meant to be in the story - this frames the demo in about fifteen seconds.
 */
export default function DemoGuide() {
  const { guideOpen, closeGuide } = useApp()
  if (!guideOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-guide-title"
    >
      <div className="max-h-full w-full max-w-[420px] animate-slide-up overflow-y-auto rounded-lg bg-surface shadow-lifted">
        <div className="relative bg-gradient-to-br from-primary to-primary-container px-6 pb-6 pt-7 text-on-primary">
          <button
            type="button"
            onClick={closeGuide}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-on-primary/80 hover:bg-white/15"
          >
            <X size={20} strokeWidth={2.5} />
          </button>

          <p className="text-xs font-bold uppercase tracking-widest text-primary-fixed">
            {BRAND.name} prototype
          </p>
          <h2 id="cc-guide-title" className="mt-2 text-2xl font-bold leading-tight">
            For the next few minutes, you are a farmer.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-on-primary/90">
            You are <strong className="text-primary-fixed">Rajesh Kumar</strong> in Rampur, holding
            450 kg of tomatoes. Every cold storage nearby wants bulk consignments, so normally you
            would sell this week at whatever price the mandi gives you.
          </p>
        </div>

        <ul className="space-y-4 px-6 py-6">
          {STEPS.map(({ icon: Icon, tone, title, body }, i) => (
            <li key={title} className="flex gap-3.5">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>
                <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">
                  <span className="text-on-surface-variant">{i + 1}. </span>
                  {title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-6 pb-6">
          <button type="button" className="cc-btn-primary w-full !py-4" onClick={closeGuide}>
            <Bilingual en="Start the demo" hi="डेमो शुरू करें" stacked />
          </button>
          <p className="mt-3 text-center text-xs text-on-surface-variant">
            Nothing here needs a login. You can reopen this from the Profile tab.
          </p>
        </div>
      </div>
    </div>
  )
}
