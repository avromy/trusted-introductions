import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  AffiliationInputShell,
  CommunitySelectorShell,
  PrivacyToggleGroup,
  ProfileSummaryCard,
  RoleSelector,
} from '@/components/onboarding';

describe('onboarding components', () => {
  it('renders role choices with multi-select pressed state', () => {
    const markup = renderToStaticMarkup(
      <RoleSelector
        onChange={vi.fn()}
        options={[
          { value: 'seeker', label: 'Job seeker' },
          { value: 'helper', label: 'Helper' },
        ]}
        selectedValues={['helper']}
      />,
    );

    expect(markup).toContain('Job seeker');
    expect(markup).toContain('Helper');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('renders privacy choices as an accessible radio group', () => {
    const markup = renderToStaticMarkup(
      <PrivacyToggleGroup
        onChange={vi.fn()}
        options={[
          { value: 'private', label: 'Private' },
          { value: 'trusted', label: 'Trusted circle' },
        ]}
        value="private"
      />,
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-checked="true"');
  });

  it('renders shell, input, and summary content without business logic', () => {
    const shellMarkup = renderToStaticMarkup(
      <CommunitySelectorShell selectedCount={2}>
        <p>Community list slot</p>
      </CommunitySelectorShell>,
    );
    const inputMarkup = renderToStaticMarkup(<AffiliationInputShell id="affiliation" onChange={vi.fn()} value="" />);
    const summaryMarkup = renderToStaticMarkup(
      <ProfileSummaryCard
        items={[{ label: 'Community', value: 'Local network' }]}
        name="Example Member"
        privacyLabel="Trusted helpers only"
        roles={['Helper']}
      />,
    );

    expect(shellMarkup).toContain('2 selected');
    expect(shellMarkup).toContain('Community list slot');
    expect(inputMarkup).toContain('id="affiliation"');
    expect(inputMarkup).toContain('aria-describedby="affiliation-description"');
    expect(summaryMarkup).toContain('Example Member');
    expect(summaryMarkup).toContain('Trusted helpers only');
  });
});
