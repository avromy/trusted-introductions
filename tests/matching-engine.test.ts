import { describe, expect, it } from 'vitest';

import {
  explainMatchScore,
  rankHelperCandidates,
  scoreCandidateHelper,
  type HelperCandidate,
  type MatchingRequest,
} from '@/lib/matching/engine';

const request: MatchingRequest = {
  desiredHelp: ['Warm intro', 'Resume review'],
  targetCompanies: ['Acme'],
  targetIndustries: ['Climate'],
  communities: ['Founders'],
};

const strongHelper: HelperCandidate = {
  id: 'helper-strong',
  helpTypes: ['warm intro', 'resume review'],
  companies: ['acme'],
  industries: ['climate'],
  communities: ['founders'],
  availability: 'available',
  relationshipStrength: 3,
};

describe('matching engine', () => {
  it('scores candidate helpers from deterministic matching signals', () => {
    expect(scoreCandidateHelper(request, strongHelper)).toBe(100);
  });

  it('explains score inputs without AI calls or hidden state', () => {
    expect(explainMatchScore(request, strongHelper)).toEqual({
      score: 100,
      reasons: [
        'Matches help type: resume review, warm intro.',
        'Matches company: acme.',
        'Matches industry: climate.',
        'Matches community: founders.',
        'Helper is available.',
        'Relationship context strength is 3/3.',
      ],
    });
  });

  it('applies privacy and availability constraints before scoring', () => {
    expect(scoreCandidateHelper(request, { ...strongHelper, allowMatching: false })).toBe(0);
    expect(explainMatchScore(request, { ...strongHelper, availability: 'unavailable' })).toEqual({
      score: 0,
      reasons: ['Helper is unavailable.'],
    });
  });

  it('ranks helpers by score and breaks ties by stable helper id', () => {
    const ranked = rankHelperCandidates(request, [
      {
        id: 'helper-b',
        helpTypes: ['warm intro'],
        availability: 'limited',
      },
      strongHelper,
      {
        id: 'helper-a',
        helpTypes: ['warm intro'],
        availability: 'limited',
      },
    ]);

    expect(ranked.map((helper) => helper.id)).toEqual(['helper-strong', 'helper-a', 'helper-b']);
    expect(ranked[0].matchExplanation.score).toBe(ranked[0].matchScore);
  });
});
