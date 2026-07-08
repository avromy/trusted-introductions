import { Button, Card, Input } from '@/components/ui';
import { HELPER_CAPABILITY_CATEGORY_VALUES } from '@/lib/matching/helper-capability';
import { saveHelperCapabilityAction } from './actions';

type HelperCapabilitiesPageProps = { searchParams?: { error?: string; saved?: string } };

const CATEGORY_LABELS: Record<(typeof HELPER_CAPABILITY_CATEGORY_VALUES)[number], string> = {
  career_navigation: 'Career navigation',
  resume_review: 'Resume review',
  interview_practice: 'Interview practice',
  network_introduction: 'Network introduction',
  industry_insight: 'Industry insight',
  portfolio_review: 'Portfolio review',
  accountability: 'Accountability',
  resource_navigation: 'Resource navigation',
};

export default function HelperCapabilitiesPage({ searchParams }: HelperCapabilitiesPageProps) {
  const errorMessage = searchParams?.error;
  const successMessage = searchParams?.saved === '1' ? 'Helper capabilities saved.' : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card className="bg-cream">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Helper intake</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Set helper capabilities</h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Choose how you can help and how much introduction capacity you currently have.
        </p>

        <form action={saveHelperCapabilityAction} className="mt-6 space-y-5">
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Ways you can help</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {HELPER_CAPABILITY_CATEGORY_VALUES.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-ink ring-1 ring-trust/15"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={category}
                    className="h-4 w-4 rounded border-trust/20 text-trust focus:ring-trust"
                  />
                  {CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <label
              className="space-y-2 text-sm font-semibold text-ink"
              htmlFor="availabilityStatus"
            >
              Availability
              <select
                id="availabilityStatus"
                name="availabilityStatus"
                defaultValue="limited"
                className="h-12 w-full rounded-2xl border border-trust/15 bg-white px-4 text-sm outline-none transition focus:border-trust focus:ring-4 focus:ring-trust/10"
              >
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label
              className="space-y-2 text-sm font-semibold text-ink"
              htmlFor="weeklyIntroCapacity"
            >
              Weekly intros
              <Input
                id="weeklyIntroCapacity"
                name="weeklyIntroCapacity"
                type="number"
                min={0}
                max={20}
                defaultValue={1}
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="nextAvailableAt">
              Next available
              <Input id="nextAvailableAt" name="nextAvailableAt" type="date" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="industries">
              Industries
              <Input id="industries" name="industries" placeholder="Comma-separated" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="geographies">
              Geographies
              <Input id="geographies" name="geographies" placeholder="Comma-separated" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="languages">
              Languages
              <Input id="languages" name="languages" placeholder="Comma-separated" />
            </label>
          </div>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="privateNotes">
            Private notes
            <textarea
              id="privateNotes"
              name="privateNotes"
              rows={4}
              className="w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              placeholder="Optional internal context for stewards."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Save capabilities</Button>
            <p className="text-sm text-ink/60">Helpers always consent before outreach.</p>
          </div>
        </form>
      </Card>
    </main>
  );
}
