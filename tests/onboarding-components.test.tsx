import { describe, expect, it } from 'vitest';

import {
  AffiliationInputShell,
  CommunitySelectorShell,
  PrivacyToggleGroup,
  ProfileSummaryCard,
  RoleSelector,
} from '@/components/onboarding';

describe('onboarding components', () => {
  it('exports reusable onboarding form components', () => {
    expect(typeof RoleSelector).toBe('function');
    expect(typeof PrivacyToggleGroup).toBe('function');
    expect(typeof CommunitySelectorShell).toBe('function');
    expect(typeof AffiliationInputShell).toBe('function');
    expect(typeof ProfileSummaryCard).toBe('function');
  });
});
