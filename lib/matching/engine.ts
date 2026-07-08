export type HelperAvailability = 'available' | 'limited' | 'unavailable';

export interface MatchingRequest {
  id?: string;
  desiredHelp?: readonly string[];
  targetCompanies?: readonly string[];
  targetIndustries?: readonly string[];
  communities?: readonly string[];
}

export interface HelperCandidate {
  id: string;
  displayName?: string;
  helpTypes?: readonly string[];
  companies?: readonly string[];
  industries?: readonly string[];
  communities?: readonly string[];
  availability?: HelperAvailability;
  relationshipStrength?: number;
  allowMatching?: boolean;
}

export interface MatchExplanation {
  score: number;
  reasons: string[];
}

export interface RankedHelperCandidate extends HelperCandidate {
  matchScore: number;
  matchExplanation: MatchExplanation;
}

interface WeightedOverlapInput {
  requestValues?: readonly string[];
  helperValues?: readonly string[];
  weight: number;
  label: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueNormalized(values?: readonly string[]): string[] {
  return [...new Set((values ?? []).map(normalize).filter(Boolean))].sort();
}

function formatList(values: readonly string[]): string {
  return values.join(', ');
}

function scoreWeightedOverlap({
  requestValues,
  helperValues,
  weight,
  label,
}: WeightedOverlapInput): { points: number; reason?: string } {
  const requested = uniqueNormalized(requestValues);

  if (requested.length === 0) {
    return { points: 0 };
  }

  const helperSet = new Set(uniqueNormalized(helperValues));
  const matches = requested.filter((value) => helperSet.has(value));

  if (matches.length === 0) {
    return { points: 0, reason: `No ${label} overlap.` };
  }

  return {
    points: Math.round((matches.length / requested.length) * weight),
    reason: `Matches ${label}: ${formatList(matches)}.`,
  };
}

function availabilityPoints(availability: HelperAvailability | undefined): { points: number; reason: string } {
  switch (availability) {
    case 'available':
      return { points: 10, reason: 'Helper is available.' };
    case 'limited':
      return { points: 5, reason: 'Helper has limited availability.' };
    case 'unavailable':
      return { points: 0, reason: 'Helper is unavailable.' };
    default:
      return { points: 0, reason: 'Helper availability is unknown.' };
  }
}

function relationshipPoints(strength: number | undefined): { points: number; reason?: string } {
  const boundedStrength = Math.max(0, Math.min(3, Math.trunc(strength ?? 0)));

  if (boundedStrength === 0) {
    return { points: 0 };
  }

  return {
    points: boundedStrength * 5,
    reason: `Relationship context strength is ${boundedStrength}/3.`,
  };
}

export function explainMatchScore(request: MatchingRequest, helper: HelperCandidate): MatchExplanation {
  if (helper.allowMatching === false) {
    return { score: 0, reasons: ['Helper has opted out of matching.'] };
  }

  if (helper.availability === 'unavailable') {
    return { score: 0, reasons: ['Helper is unavailable.'] };
  }

  const scoredSignals = [
    scoreWeightedOverlap({
      requestValues: request.desiredHelp,
      helperValues: helper.helpTypes,
      weight: 30,
      label: 'help type',
    }),
    scoreWeightedOverlap({
      requestValues: request.targetCompanies,
      helperValues: helper.companies,
      weight: 25,
      label: 'company',
    }),
    scoreWeightedOverlap({
      requestValues: request.targetIndustries,
      helperValues: helper.industries,
      weight: 20,
      label: 'industry',
    }),
    scoreWeightedOverlap({
      requestValues: request.communities,
      helperValues: helper.communities,
      weight: 15,
      label: 'community',
    }),
    availabilityPoints(helper.availability),
    relationshipPoints(helper.relationshipStrength),
  ];

  const score = Math.min(
    100,
    scoredSignals.reduce((total, signal) => total + signal.points, 0),
  );
  const reasons = scoredSignals.flatMap((signal) => (signal.reason ? [signal.reason] : []));

  return {
    score,
    reasons: reasons.length > 0 ? reasons : ['No matching signals found.'],
  };
}

export function scoreCandidateHelper(request: MatchingRequest, helper: HelperCandidate): number {
  return explainMatchScore(request, helper).score;
}

export function rankHelperCandidates(
  request: MatchingRequest,
  helpers: readonly HelperCandidate[],
): RankedHelperCandidate[] {
  return helpers
    .map((helper) => {
      const matchExplanation = explainMatchScore(request, helper);

      return {
        ...helper,
        matchScore: matchExplanation.score,
        matchExplanation,
      };
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return left.id.localeCompare(right.id);
    });
}
