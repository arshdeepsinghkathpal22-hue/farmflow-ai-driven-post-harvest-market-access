import { useState } from 'react'
import { BookOpen, ChevronDown, Check } from 'lucide-react'
import { useApp } from '../store/context'
import { LANGUAGES } from '../i18n/languages'
import { t } from '../i18n/strings'
import { Card, SectionTitle } from '../components/ui'

/**
 * The in-app guide, in the farmer's own language.
 *
 * Sections are collapsible because the whole guide is long, and someone looking
 * for one answer should not have to scroll past nine others to find it.
 */
export default function Guide() {
  const { lang, setLanguage } = useApp()
  const copy = t(lang)
  const [openId, setOpenId] = useState(copy.sections[0]?.id ?? null)

  return (
    <div className="space-y-5">
      <SectionTitle en={copy.guideTitle} sub={copy.guideLead} />

      {/* Switching here switches the whole app, including the microphone. */}
      <Card accent="blue" className="p-4">
        <p className="text-sm font-semibold">{copy.languagePrompt}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLanguage(l.id)}
              aria-pressed={l.id === lang}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-3 text-sm font-semibold transition ${
                l.id === lang
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              <span className="text-base">{l.native}</span>
              <span className="text-[11px] font-medium opacity-80">{l.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-on-surface-variant">{copy.languageNote}</p>
      </Card>

      <ul className="space-y-3">
        {copy.sections.map((section, i) => {
          const open = openId === section.id
          return (
            <li key={section.id}>
              <Card accent={open ? 'green' : 'none'} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : section.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      open ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{section.title}</span>
                  <ChevronDown
                    size={20}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className={`shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div className="animate-slide-up px-4 pb-4">
                    <p className="text-base leading-relaxed text-on-surface-variant">{section.lead}</p>
                    <ul className="mt-3 space-y-2">
                      {section.points.map((point) => (
                        <li key={point} className="flex gap-2.5">
                          <Check
                            size={17}
                            strokeWidth={3}
                            aria-hidden="true"
                            className="mt-1 shrink-0 text-primary"
                          />
                          <span className="text-base leading-relaxed text-on-surface-variant">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <p className="flex items-center justify-center gap-2 pb-2 text-center text-sm text-on-surface-variant">
        <BookOpen size={16} strokeWidth={2.5} aria-hidden="true" />
        {copy.guideFooter}
      </p>
    </div>
  )
}
