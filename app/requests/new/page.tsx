import { Button, Card, Input } from '@/components/ui';
import { submitJobSeekerRequest } from './actions';

const fields = [
  {
    name: 'headline',
    label: 'Request headline',
    placeholder: 'Seeking warm intros for product roles',
    required: true,
  },
  {
    name: 'targetRole',
    label: 'Target role',
    placeholder: 'Senior Product Manager',
    required: true,
  },
  { name: 'targetCompanies', label: 'Target companies', placeholder: 'Acme, Globex, Initech' },
  {
    name: 'targetLocations',
    label: 'Target locations',
    placeholder: 'Remote, New York, San Francisco',
  },
  { name: 'remotePreference', label: 'Remote preference', placeholder: 'Remote-first or hybrid' },
  { name: 'salaryExpectation', label: 'Salary expectation', placeholder: '$140k+' },
  { name: 'workAuthorization', label: 'Work authorization', placeholder: 'US citizen, H-1B, etc.' },
  { name: 'resumeUrl', label: 'Resume URL', placeholder: 'https://example.com/resume.pdf' },
];

export default function NewJobSeekerRequestPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Job seeker intake
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Request trusted introductions</h1>
        <p className="mt-4 text-ink/70">
          Share the role, companies, and context helpers need to identify high-signal introductions.
        </p>
        <form action={submitJobSeekerRequest} className="mt-8 space-y-5">
          <input type="hidden" name="status" value="open" />
          {fields.map((field) => (
            <label key={field.name} className="block text-sm font-medium text-ink">
              {field.label}
              <Input
                className="mt-2"
                name={field.name}
                placeholder={field.placeholder}
                required={field.required}
              />
            </label>
          ))}
          <label className="block text-sm font-medium text-ink">
            Notes for the steward
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              name="notes"
              placeholder="Add goals, constraints, and any sensitive context the steward should know."
            />
          </label>
          <Button type="submit">Submit seeker request</Button>
        </form>
      </Card>
    </main>
  );
}
