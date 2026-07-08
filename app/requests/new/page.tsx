import { Button, Card, Input } from '@/components/ui';
import { createJobSeekerRequestAction } from './actions';

type NewRequestPageProps = { searchParams?: { error?: string; saved?: string } };

export default function NewRequestPage({ searchParams }: NewRequestPageProps) {
  const errorMessage = searchParams?.error;
  const successMessage =
    searchParams?.saved === '1' ? 'Request created. A steward can review it for matching.' : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card className="bg-cream">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Job seeker intake
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Request trusted introductions</h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Share the minimum context helpers need to understand what kind of support would be useful.
        </p>

        <form action={createJobSeekerRequestAction} className="mt-6 space-y-5">
          {errorMessage ? (
            <p className="rounded-2xl bg-rust/10 px-4 py-3 text-sm font-medium text-rust">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-2xl bg-trust/10 px-4 py-3 text-sm font-medium text-trust">
              {successMessage}
            </p>
          ) : null}

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="headline">
            Request headline
            <Input
              id="headline"
              name="headline"
              required
              maxLength={140}
              placeholder="Seeking product roles with mission-driven teams"
            />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="targetRole">
            Target role
            <Input
              id="targetRole"
              name="targetRole"
              required
              maxLength={120}
              placeholder="Product manager"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="targetCompanies">
              Target companies
              <Input id="targetCompanies" name="targetCompanies" placeholder="Comma-separated" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="targetLocations">
              Target locations
              <Input id="targetLocations" name="targetLocations" placeholder="Comma-separated" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="remotePreference">
              Remote preference
              <Input
                id="remotePreference"
                name="remotePreference"
                maxLength={160}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="resumeUrl">
              Resume URL
              <Input
                id="resumeUrl"
                name="resumeUrl"
                maxLength={640}
                placeholder="Optional private context"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="salaryExpectation">
              Salary expectation
              <Input
                id="salaryExpectation"
                name="salaryExpectation"
                maxLength={160}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="workAuthorization">
              Work authorization
              <Input
                id="workAuthorization"
                name="workAuthorization"
                maxLength={160}
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="notes">
            Private notes
            <textarea
              id="notes"
              name="notes"
              maxLength={2000}
              rows={5}
              className="w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              placeholder="Optional details for stewards before matching."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Create request</Button>
            <p className="text-sm text-ink/60">No matching review UI is included in this step.</p>
          </div>
        </form>
      </Card>
    </main>
  );
}
