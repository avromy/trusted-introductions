import Link from 'next/link';
import { Avatar, Badge, Button, Card, Input } from '@/components/ui';

const promises = [
  { icon: '✓', title: 'Invite-only trust', body: 'Every member enters through a human bridge and stewarded accountability.' },
  { icon: '●', title: 'Privacy first', body: 'People choose what to share, with sensitive details protected by default.' },
  { icon: '↔', title: 'Warm access', body: 'Matches focus on trusted access, context, and consent—not a public job board.' },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between rounded-full bg-white/70 px-5 py-3 shadow-soft ring-1 ring-black/5 backdrop-blur">
        <Link href="/" className="text-sm font-bold uppercase tracking-[0.24em] text-trust">Trusted Introductions</Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink/70 md:flex" aria-label="Primary navigation">
          <Link href="/community">Community</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/auth">Sign in</Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <Badge>Private community job help</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Warm introductions for people you already trust.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
            Trusted Introductions helps invite-only Jewish community members ask for help, offer access, and track outcomes with privacy and human consent at the center.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button aria-label="Request an invitation">Request an invitation</Button>
            <Link href="/helper" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-trust ring-1 ring-trust/15 hover:bg-sage/30">
              Offer to help <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <Card className="relative overflow-hidden p-7">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-sage/70" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Avatar initials="TI" />
              <div>
                <p className="font-semibold text-ink">Steward review queue</p>
                <p className="text-sm text-ink/55">Human-reviewed before any introduction</p>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <Input readOnly value="Seeking product roles with mission-driven teams" aria-label="Sample seeker request" />
              <Card className="bg-cream p-5 shadow-none">
                <Badge className="bg-white">Match reason</Badge>
                <p className="mt-3 text-sm leading-6 text-ink/70">Shared community context, relevant company access, and helper consent required before outreach.</p>
              </Card>
              <div className="grid gap-3 sm:grid-cols-3">
                {['Invite', 'Match', 'Outcome'].map((step) => (
                  <div key={step} className="rounded-2xl bg-white p-4 text-center text-sm font-semibold text-trust ring-1 ring-black/5">{step}</div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 pb-12 md:grid-cols-3">
        {promises.map(({ icon, title, body }) => (
          <Card key={title}>
            <span className="text-2xl text-clay" aria-hidden="true">{icon}</span>
            <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">{body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
