import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { Logo } from '@/components/marketing/Logo'

export function LandingPage() {
  return (
    <div className="mesh-bg min-h-svh">
      <header className="glass-header-marketing">
        <Container className="flex h-[4.25rem] items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/login"
              className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Sign in
            </Link>
            <Link to="/signup" className="rounded-full px-3 py-2 text-[14px] font-medium text-accent sm:hidden">Get started</Link>
            <Button asChild className="hidden sm:inline-flex" variant="primary">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </Container>
      </header>

      <Container as="section" className="py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-ink-subtle">
            Official sources first
          </p>
          <h1 className="mt-4 text-balance text-4xl font-medium tracking-[-0.03em] text-ink sm:text-5xl">
            Calm monitoring for what companies publish
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-ink-muted sm:text-lg">
            Track investor relations, press releases, and filings-linked documents.
            We surface <span className="text-ink">new material</span>, link every
            summary to the original source, and never pose as a trading terminal.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button className="min-w-[200px] px-7 py-3 text-[16px]" variant="primary" asChild>
              <Link to="/signup">Create account</Link>
            </Button>
            <Button className="min-w-[200px] px-7 py-3 text-[16px]" variant="secondary" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-8 text-[13px] leading-relaxed text-ink-subtle">
            Informational only — not investment advice. V1 focuses on a curated pilot
            universe so coverage stays honest.
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-5 sm:grid-cols-3 sm:gap-6">
          {[
            {
              title: 'Source-linked',
              body: 'Every digest points to the primary page or PDF we parsed.',
            },
            {
              title: 'Quiet by design',
              body: 'Alerts you’d actually want in your inbox — not HTML noise.',
            },
            {
              title: 'Coverage you can see',
              body: 'Per-company transparency for what’s monitored and what’s blocked.',
            },
          ].map((item) => (
            <Card
              key={item.title}
              padding="sm"
              className="text-left shadow-[0_8px_30px_rgba(12,13,17,0.06)]"
            >
              <h2 className="text-[15px] font-medium tracking-tight text-ink">
                {item.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  )
}
