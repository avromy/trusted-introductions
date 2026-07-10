import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StewardMatchReviewPage } from '@/app/steward/requests/[requestId]/matches/_components/steward-match-review-page';
import type { MatchSuggestion, StewardReview } from '@/types/matching';

const suggestion: MatchSuggestion = {
  id: 'suggestion-1',
  requestId: 'request-1',
  helperIdentityId: 'helper-1',
  helperCapabilityId: 'capability-1',
  rank: 1,
  score: 87,
  reasons: ['Matches desired help: introductions.', 'Matches communities: NYC.'],
  metadata: {},
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

const review: StewardReview = {
  id: 'review-1',
  requestId: 'request-1',
  stewardIdentityId: 'steward-1',
  subjectIdentityId: 'helper-1',
  matchSuggestionId: 'suggestion-1',
  status: 'pending',
  decisionReason: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  decidedAt: null,
};

function renderPage() {
  return renderToStaticMarkup(
    <StewardMatchReviewPage
      matches={[{ suggestion, review }]}
      requestId="request-1"
    />,
  );
}

describe('steward match review page', () => {
  it('renders approve decision button', () => {
    expect(renderPage()).toContain('value="approved"');
    expect(renderPage()).toContain('Approve');
  });

  it('renders reject decision button', () => {
    expect(renderPage()).toContain('value="rejected"');
    expect(renderPage()).toContain('Reject');
  });

  it('renders needs-info decision button', () => {
    expect(renderPage()).toContain('value="needs_info"');
    expect(renderPage()).toContain('Needs info');
  });

  it('renders recalculate form', () => {
    const markup = renderPage();

    expect(markup).toContain('name="requestId"');
    expect(markup).toContain('value="request-1"');
    expect(markup).toContain('Recalculate matches');
  });

  it('renders empty and unauthorized states', () => {
    expect(renderToStaticMarkup(<StewardMatchReviewPage matches={[]} requestId="request-1" />)).toContain('No matches to review yet');
    expect(renderToStaticMarkup(<StewardMatchReviewPage authorized={false} matches={[]} requestId="request-1" />)).toContain('Steward access required');
  });
});
