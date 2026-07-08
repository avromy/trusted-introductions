import { Button, Card, Input } from '@/components/ui';
import { HELPER_CAPABILITY_CATEGORY_VALUES } from '@/lib/matching/helper-capability';
import { submitHelperCapabilities } from './actions';

const categoryLabels: Record<(typeof HELPER_CAPABILITY_CATEGORY_VALUES)[number], string> = {
  career_navigation: 'Career navigation',
  resume_review: 'Resume review',
  interview_practice: 'Interview practice',
  network_introduction: 'Network introductions',
  industry_insight: 'Industry insight',
  portfolio_review: 'Portfolio review',
  accountability: 'Accountability',
  resource_navigation: 'Resource navigation',
};

export default function HelperCapabilitiesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Helper intake</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Describe how you can help</h1>
        <p className="mt-4 text-ink/70">
          Tell stewards where you can offer thoughtful support and how many introductions you can
          handle.
        </p>
        <form action={submitHelperCapabilities} className="mt-8 space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Capabilities</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {HELPER_CAPABILITY_CATEGORY_VALUES.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-3 rounded-2xl border border-trust/15 bg-white p-3 text-sm text-ink"
                >
                  <input
                    className="h-4 w-4 accent-trust"
                    type="checkbox"
                    name="categories"
                    value={category}
                  />
                  {categoryLabels[category]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink">
              Availability
              <select
                className="mt-2 h-12 w-full rounded-2xl border border-trust/15 bg-white px-4 text-sm outline-none focus:border-trust focus:ring-4 focus:ring-trust/10"
                name="availabilityStatus"
                defaultValue="limited"
              >
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-ink">
              Weekly intro capacity
              <Input
                className="mt-2"
                min={0}
                name="weeklyIntroCapacity"
                type="number"
                defaultValue={1}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-ink">
            Next available date
            <Input className="mt-2" name="nextAvailableAt" type="date" />
          </label>
          <label className="block text-sm font-medium text-ink">
            Industries
            <Input
              className="mt-2"
              name="industries"
              placeholder="Fintech, climate, public sector"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Geographies
            <Input className="mt-2" name="geographies" placeholder="US, Canada, Europe" />
          </label>
          <label className="block text-sm font-medium text-ink">
            Languages
            <Input className="mt-2" name="languages" placeholder="English, Spanish" />
          </label>
          <label className="block text-sm font-medium text-ink">
            Private notes
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              name="privateNotes"
              placeholder="Share any constraints or preferences only stewards should see."
            />
          </label>
          <Button type="submit">Save helper capabilities</Button>
        </form>
      </Card>
    </main>
  );
}
