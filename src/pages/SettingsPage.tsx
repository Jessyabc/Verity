import { useId, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import {
  getResearchWeekendsEnabled,
  setResearchWeekendsEnabled,
} from '@/lib/research/settings'

export function SettingsPage() {
  const digestId = useId()
  const emailId = useId()
  const weekendsId = useId()
  const [digest, setDigest] = useState(true)
  const [emailOn, setEmailOn] = useState(true)
  const [weekends, setWeekends] = useState(getResearchWeekendsEnabled)

  return (
    <Container className="max-w-3xl">
      <header className="mb-10 sm:mb-12">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          Notifications & delivery
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Controls are local-only until the backend lands — structure matches the
          V1 brief: fewer, better emails.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <h2 className="text-[15px] font-medium text-ink">Email</h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            Tier-1 product risk: only send what passes the “would I want this?”
            test.
          </p>

          <div className="mt-8 space-y-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <label
                  htmlFor={emailId}
                  className="text-[14px] font-medium text-ink"
                >
                  Product emails
                </label>
                <p className="mt-1 text-[13px] text-ink-subtle">
                  New document alerts and digests.
                </p>
              </div>
              <button
                id={emailId}
                type="button"
                role="switch"
                aria-checked={emailOn}
                onClick={() => setEmailOn((v) => !v)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
                  emailOn ? 'bg-accent' : 'bg-black/10'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    emailOn ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="h-px bg-black/[0.06]" />

            <div className="flex items-start justify-between gap-6">
              <div>
                <label
                  htmlFor={digestId}
                  className="text-[14px] font-medium text-ink"
                >
                  Daily digest
                </label>
                <p className="mt-1 text-[13px] text-ink-subtle">
                  Batch updates into one calm email (recommended for V1).
                </p>
              </div>
              <button
                id={digestId}
                type="button"
                role="switch"
                aria-checked={digest}
                onClick={() => setDigest((v) => !v)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
                  digest ? 'bg-accent' : 'bg-black/10'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    digest ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-medium text-ink">Research & news (Perplexity)</h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            Your watchlist syncs to your account (Supabase). Scheduled refresh uses GitHub Actions with{' '}
            <span className="font-mono text-[12px]">WATCHLIST_FROM_DB</span> so CI refreshes the union of
            everyone’s watchlist slugs (pilot companies only). Optional secret{' '}
            <span className="font-mono text-[12px]">WATCHLIST_SLUGS</span> is a fallback when the table is
            empty. Weekdays ~08:00 UTC by default — adjust the cron in{' '}
            <span className="font-mono text-[12px]">research-weekdays.yml</span> for your morning.
          </p>

          <div className="mt-8 flex items-start justify-between gap-6">
            <div>
              <label htmlFor={weekendsId} className="text-[14px] font-medium text-ink">
                Include Saturday & Sunday
              </label>
              <p className="mt-1 text-[13px] text-ink-subtle">
                Off by default. When on, enable the weekend workflow in CI and set{' '}
                <span className="font-mono text-[12px]">WEEKEND_RESEARCH=true</span> — see BUILD.md.
              </p>
            </div>
            <button
              id={weekendsId}
              type="button"
              role="switch"
              aria-checked={weekends}
              onClick={() => {
                const next = !weekends
                setWeekends(next)
                setResearchWeekendsEnabled(next)
              }}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
                weekends ? 'bg-accent' : 'bg-black/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  weekends ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-ink-subtle">
            Manual refresh: company profile <span className="text-ink-muted">Refresh now</span> or
            dashboard <span className="text-ink-muted">Refresh research (watchlist)</span>.
          </p>
        </Card>

        <Card className="bg-white/50">
          <p className="text-[13px] leading-relaxed text-ink-subtle">
            Timezone and mute windows ship with the notification service (Phase 5).
            Unsubscribe links will be mandatory before any real email provider.
          </p>
        </Card>
      </div>
    </Container>
  )
}
