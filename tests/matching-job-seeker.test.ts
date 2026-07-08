import { describe, expect, it } from 'vitest';

import {
  assertValidJobSeekerRequestInput,
  getDefaultJobSeekerRequestStatus,
  isActiveJobSeekerRequestStatus,
  isJobSeekerRequestStatus,
  isTerminalJobSeekerRequestStatus,
  normalizeJobSeekerRequestInput,
  serializeJobSeekerRequestForHelper,
  serializeJobSeekerRequestForPublic,
  validateJobSeekerRequestInput,
} from '@/lib/matching/job-seeker';

import type { JobSeekerRequest, JobSeekerRequestInput } from '@/types/matching';

const validInput: JobSeekerRequestInput = {
  identityId: 'identity-123',
  headline: 'Senior product engineer seeking warm introductions',
  targetRole: 'Senior Product Engineer',
  targetCompanies: ['OpenAI', ' Anthropic ', 'OpenAI'],
  targetLocations: ['San Francisco', 'Remote'],
  remotePreference: 'Remote or hybrid',
  salaryExpectation: '$180k+',
  workAuthorization: 'US citizen',
  notes: 'Prioritize mission-driven AI teams.',
  resumeUrl: 'https://example.com/resume.pdf',
  status: 'open',
};

const request: JobSeekerRequest = {
  id: 'request-123',
  identityId: 'identity-123',
  status: 'open',
  headline: 'Senior product engineer seeking warm introductions',
  targetRole: 'Senior Product Engineer',
  targetCompanies: ['OpenAI'],
  targetLocations: ['San Francisco'],
  remotePreference: 'Remote or hybrid',
  salaryExpectation: '$180k+',
  workAuthorization: 'US citizen',
  notes: 'Private steward notes.',
  resumeUrl: 'https://example.com/resume.pdf',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  openedAt: '2026-07-08T00:00:00.000Z',
  closedAt: null,
};

describe('job seeker request helpers', () => {
  it('models supported request statuses', () => {
    expect(getDefaultJobSeekerRequestStatus()).toBe('draft');
    expect(isJobSeekerRequestStatus('open')).toBe(true);
    expect(isJobSeekerRequestStatus('archived')).toBe(false);
    expect(isActiveJobSeekerRequestStatus('open')).toBe(true);
    expect(isActiveJobSeekerRequestStatus('closed')).toBe(false);
    expect(isTerminalJobSeekerRequestStatus('withdrawn')).toBe(true);
  });

  it('validates acceptable request input', () => {
    expect(validateJobSeekerRequestInput(validInput)).toEqual({ valid: true, errors: {} });
    expect(() => assertValidJobSeekerRequestInput(validInput)).not.toThrow();
  });

  it('returns field-specific validation errors for invalid input', () => {
    const result = validateJobSeekerRequestInput({
      identityId: '',
      headline: ' ',
      targetRole: 'x'.repeat(121),
      targetCompanies: ['Valid', '', 'x'.repeat(121)],
      status: 'archived' as JobSeekerRequestInput['status'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.identityId).toContain('Required.');
    expect(result.errors.headline).toContain('Required.');
    expect(result.errors.targetRole).toContain('Must be 120 characters or fewer.');
    expect(result.errors.targetCompanies).toContain('Item 2 must be text.');
    expect(result.errors.targetCompanies).toContain('Item 3 must be 120 characters or fewer.');
    expect(result.errors.status).toContain('Status is not supported.');
  });

  it('normalizes input before persistence', () => {
    expect(normalizeJobSeekerRequestInput(validInput)).toEqual({
      ...validInput,
      headline: 'Senior product engineer seeking warm introductions',
      targetCompanies: ['OpenAI', 'Anthropic'],
    });

    expect(
      normalizeJobSeekerRequestInput({
        identityId: ' identity-123 ',
        headline: ' Looking   for referrals ',
        targetRole: ' Staff   Engineer ',
      }),
    ).toMatchObject({
      identityId: 'identity-123',
      headline: 'Looking for referrals',
      targetRole: 'Staff Engineer',
      targetCompanies: [],
      targetLocations: [],
      status: 'draft',
    });
  });

  it('safely serializes public requests without sensitive fields', () => {
    expect(serializeJobSeekerRequestForPublic(request)).toEqual({
      id: 'request-123',
      status: 'open',
      headline: 'Senior product engineer seeking warm introductions',
      targetRole: 'Senior Product Engineer',
      targetCompanies: ['OpenAI'],
      targetLocations: ['San Francisco'],
      remotePreference: 'Remote or hybrid',
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
      openedAt: '2026-07-08T00:00:00.000Z',
      closedAt: null,
      hasResume: true,
    });
  });

  it('serializes helper requests as defensive copies', () => {
    const helperRequest = serializeJobSeekerRequestForHelper(request);

    expect(helperRequest).toEqual(request);
    expect(helperRequest).not.toBe(request);
    expect(helperRequest.targetCompanies).not.toBe(request.targetCompanies);
    expect(helperRequest.targetLocations).not.toBe(request.targetLocations);
  });
});
