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

function review(status: StewardReview['status']): StewardReview {
  return {
    id: `review-${status}`,
    requestId: 'request-1',
    stewardIdentityId: 'steward-1',
    subjectIdentityId: 'helper-1',
    matchSuggestionId: 'suggestion-1',
    status,
    decisionReason: status === 'pending' ? null : 'Reviewed',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    decidedAt: status === 'pending' ? null : '2026-07-10T00:00:00.000Z',
  };
}

function renderPage(status: StewardReview['status'] = 'pending') {
  return renderToStaticMarkup(
    <StewardMatchReviewPage
      matches={[{ suggestion, review: review(status) }]}
      requestId="request-1"
    />,
  );
}

describe('steward match review page', () => {
  it('renders editable decision controls for pending and needs-info reviews', () => {
    expect(renderPage('pending')).toContain('value="approved"');
    expect(renderPage('pending')).toContain('value="rejected"');
    expect(renderPage('needs_info')).toContain('value="needs_info"');
  });

  it('renders recalculate form', () => {
    const markup = renderPage();
    expect(markup).toContain('name="requestId"');
    expect(markup).toContain('value="request-1"');
    expect(markup).toContain('Recalculate matches');
  });

  it('offers introduction creation only for approved reviews', () => {
    expect(renderPage('approved')).toContain('Create introduction');
    expect(renderPage('rejected')).not.toContain('Create introduction');
    expect(renderPage('pending')).not.toContain('Create introduction');
  });

  it('locks finalized decisions', () => {
    expect(renderPage('approved')).toContain('This steward decision is finalized and cannot be changed.');
    expect(renderPage('rejected')).toContain('This steward decision is finalized and cannot be changed.');
    expect(renderPage('approved')).not.toContain('value="rejected"');
  });

  it('renders empty and unauthorized states', () => {
    expect(renderToStaticMarkup(<StewardMatchReviewPage matches={[]} requestId="request-1" />)).toContain('No matches to review yet');
    expect(renderToStaticMarkup(<StewardMatchReviewPage authorized={false} matches={[]} requestId="request-1" />)).toContain('Steward access required');
  });
});
