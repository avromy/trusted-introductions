import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getSafeIntroductionContextEntries,
  IntroductionDetail,
} from '@/app/steward/introductions/[introductionId]/introduction-detail';
import type { Introduction } from '@/lib/introductions/repository';

const INTRODUCTION: Introduction = {
  id: 'intro-123',
  requestId: 'request-123',
  matchId: 'match-456',
  stewardReviewId: 'review-789',
  requesterIdentityId: 'requester-identity',
  helperIdentityId: 'helper-identity',
  createdByIdentityId: 'steward-identity',
  status: 'draft',
  context: {
    requestHeadline: 'Seeking climate product introductions',
    targetCompanies: ['Northstar Climate', 'Grid Works'],
    matchReasons: ['Helper knows climate operators', 'Requester wants product leadership context'],
    privateNestedObject: { email: 'private@example.com' },
    blank: '   ',
  },
  createdAt: '2026-07-08T12:00:00.000Z',
  updatedAt: '2026-07-09T12:00:00.000Z',
};

describe('introduction detail page', () => {
  it('renders safe introduction context and audit-safe metadata', () => {
    const html = renderToStaticMarkup(<IntroductionDetail introduction={INTRODUCTION} />);

    expect(html).toContain('AI does not write personal endorsements');
    expect(html).toContain('Requester identity');
    expect(html).toContain('requester-identity');
    expect(html).toContain('Helper identity');
    expect(html).toContain('helper-identity');
    expect(html).toContain('Request');
    expect(html).toContain('request-123');
    expect(html).toContain('Match');
    expect(html).toContain('match-456');
    expect(html).toContain('draft');
    expect(html).toContain('Safe introduction context');
    expect(html).toContain('Seeking climate product introductions');
    expect(html).toContain('Northstar Climate, Grid Works');
    expect(html).toContain(
      'Helper knows climate operators, Requester wants product leadership context',
    );
    expect(html).not.toContain('private@example.com');
  });

  it('normalizes only display-safe primitive context values', () => {
    expect(getSafeIntroductionContextEntries(INTRODUCTION.context)).toEqual([
      { label: 'Request headline', value: 'Seeking climate product introductions' },
      { label: 'Target companies', value: 'Northstar Climate, Grid Works' },
      {
        label: 'Match rationale',
        value: 'Helper knows climate operators, Requester wants product leadership context',
      },
    ]);
  });
});
