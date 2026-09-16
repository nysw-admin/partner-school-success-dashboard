import type { KPIScoreResult } from '../types/rubric.ts';
import type { BucketScore } from '../types/score.ts';
import { calculateLinearScore, getGradeAndTier, rescaleGroupKpis, clamp } from './formula.ts';

export interface Bucket3Input {
  // A1: Proposal Acceptance
  daysLatePastSept30: number;          // 0 if accepted on or before Sept 30; >0 if after
  proposalAcceptedDateText?: string;   // Descriptive label

  // A3: Custodian Involvement (HC Performance 1-4)
  hcCustodianInvolvementRating: number;

  // A6: Letters Received
  hasFallThankYouLetter: boolean;      // 0.5 pt
  hasSpringLetterOfSupport: boolean;   // 0.5 pt

  // A9: Principal Engagement (Events + AMV)
  eventsHeld: number;
  eventsPrincipalSupportRating?: number; // 1 to 4 scale
  amvVisitsHeld: number;
  amvPrincipalContactSuccessRate?: number; // 0 to 1 (in-person or follow-up email)
}

export function calculateBucket3(input: Bucket3Input): BucketScore {
  // A1: Proposal Acceptance (10 pts)
  // Actual = max(0, 365 - daysLatePastSept30)
  const effectiveDays = Math.max(0, 365 - input.daysLatePastSept30);
  const a1Result = calculateLinearScore(effectiveDays, 0, 365, 10);
  const a1: KPIScoreResult = {
    id: 'A1',
    name: 'Proposal Acceptance',
    group: 'b3_admin',
    bucket: 'bucket3',
    actual: input.daysLatePastSept30 === 0
      ? 'Accepted On/Before Sept 30'
      : `${input.daysLatePastSept30} days past Sept 30`,
    actualNumeric: effectiveDays,
    floor: 0,
    target: 365,
    maxPoints: 10,
    score: a1Result.score,
    percentage: a1Result.percentage,
    isApplicable: true,
  };

  // A3: Custodian Involvement (3 pts, floor 1, target 4)
  const a3Result = calculateLinearScore(input.hcCustodianInvolvementRating, 1, 4, 3);
  const a3: KPIScoreResult = {
    id: 'A3',
    name: 'Custodian Involvement',
    group: 'b3_admin',
    bucket: 'bucket3',
    actual: Number(input.hcCustodianInvolvementRating.toFixed(2)),
    actualNumeric: input.hcCustodianInvolvementRating,
    floor: 1,
    target: 4,
    maxPoints: 3,
    score: a3Result.score,
    percentage: a3Result.percentage,
    isApplicable: true,
  };

  // A6: Letters Received (1 pt, 0.5 pt each)
  const lettersCount = (input.hasFallThankYouLetter ? 1 : 0) + (input.hasSpringLetterOfSupport ? 1 : 0);
  const a6Result = calculateLinearScore(lettersCount, 0, 2, 1);
  const a6: KPIScoreResult = {
    id: 'A6',
    name: 'Letters Received',
    group: 'b3_admin',
    bucket: 'bucket3',
    actual: `${lettersCount}/2 letters (${input.hasFallThankYouLetter ? 'Fall ✓' : 'No Fall'}, ${input.hasSpringLetterOfSupport ? 'Spring ✓' : 'No Spring'})`,
    actualNumeric: lettersCount,
    floor: 0,
    target: 2,
    maxPoints: 1,
    score: a6Result.score,
    percentage: a6Result.percentage,
    isApplicable: true,
  };

  // A9: Principal Engagement (4 pts, floor 0.25, target 0.90)
  // Pooled mean of Events normalized (1-4 -> 0-1) and AMV conversation/email rate
  const engagementComponents: number[] = [];
  if (input.eventsHeld > 0 && input.eventsPrincipalSupportRating !== undefined) {
    // 1-4 scale normalized to 0-1: (rating - 1) / 3
    engagementComponents.push(clamp((input.eventsPrincipalSupportRating - 1) / 3, 0, 1));
  }
  if (input.amvVisitsHeld > 0 && input.amvPrincipalContactSuccessRate !== undefined) {
    engagementComponents.push(input.amvPrincipalContactSuccessRate);
  }

  const a9Applicable = engagementComponents.length > 0;
  const a9Actual = a9Applicable
    ? engagementComponents.reduce((a, b) => a + b, 0) / engagementComponents.length
    : 0;
  const a9Result = a9Applicable
    ? calculateLinearScore(a9Actual, 0.25, 0.90, 4)
    : { score: 0, percentage: 0 };

  const a9: KPIScoreResult = {
    id: 'A9',
    name: 'Principal Engagement',
    group: 'b3_admin',
    bucket: 'bucket3',
    actual: a9Applicable ? Number(a9Actual.toFixed(2)) : 'No Events or AMV visits',
    actualNumeric: a9Actual,
    floor: 0.25,
    target: 0.90,
    maxPoints: 4,
    score: a9Result.score,
    percentage: a9Result.percentage,
    isApplicable: a9Applicable,
    dropReason: a9Applicable ? undefined : 'No Events or AMV visits held; group rescaled',
  };

  const adminGroup = rescaleGroupKpis([a1, a3, a6, a9], 18);

  const earnedPoints = adminGroup.groupEarnedPoints;
  const percentage = Number((earnedPoints / 18).toFixed(4));
  const { letterGrade, tier } = getGradeAndTier(percentage * 100);

  return {
    bucketId: 'bucket3',
    name: 'Administration Support',
    maxPoints: 18,
    earnedPoints,
    percentage,
    letterGrade,
    tier,
    groups: [
      {
        groupId: 'b3_admin',
        name: 'Administration Support',
        maxPoints: 18,
        earnedPoints: adminGroup.groupEarnedPoints,
        percentage,
        kpis: adminGroup.rescaledKpis,
      },
    ],
  };
}
