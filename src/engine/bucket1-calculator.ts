import type { KPIScoreResult } from '../types/rubric.ts';
import type { BucketScore } from '../types/score.ts';
import { calculateLinearScore, getGradeAndTier, rescaleGroupKpis } from './formula.ts';

export interface Bucket1Input {
  // C1a & C1b: Assets
  onTimeAssetRate: number;              // 0 to 1 (Weeks completed on-time / scheduled)
  lateVsMissingRate?: number;           // 0 to 1 (Late / (Late + Missing))
  hasZeroNonOnTimeWeeks?: boolean;      // If true, C1b earns automatic full 3 pts

  // C2: Systems Uptime
  systemsUptimeRate: number;            // 0 to 1 (Systems running / systems installed, excl AQX)
  
  // C3: Branding Present
  stickersPresent: boolean;             // 2 pts
  partnerSignPresent: boolean;          // 2 pts

  // C4: Lab Usability Rating
  hcUsabilityRating?: number;           // 1 to 4 scale
  amvLabImpressionRating?: number;      // 1 to 4 scale

  // C5: GST Support Rating (from Teacher Survey)
  surveyCompleted: boolean;
  gstSupportSurveyNormalized?: number;  // 0 to 1 scale (pooled Q28, Q30, Q31)

  // C6: Harvest Frequency
  harvestsPerMonthSinceNov: number;     // e.g. 2.6/mo (Floor: 0.5, Target: 3.0)

  // C7: Harvest Yield
  harvestLbsPerMonthPerSystem: number;  // e.g. 2.4 lb/mo/sys (Floor: 0.5, Target: 3.0)

  // C8: Visitor Readiness
  hcVisitorSuitabilityRating?: number;  // 1 to 4 scale
  amvCleanlinessRating?: number;        // 1 to 4 scale

  // C9: Seedlings Present Rate
  seedlingsPresentRate: number;         // 0 to 1 (Floor: 0.10, Target: 0.50)

  // C10: Pest-Free Visit Rate
  pestFreeVisitRate: number;            // 0 to 1 (Floor: 0.60, Target: 0.95)
}

export function calculateBucket1(input: Bucket1Input): BucketScore {
  // Group 1: Assets (15 pts)
  const c1aResult = calculateLinearScore(input.onTimeAssetRate, 0.65, 0.95, 12);
  const c1a: KPIScoreResult = {
    id: 'C1a',
    name: 'Completed Assets Rate',
    group: 'b1_assets',
    bucket: 'bucket1',
    actual: input.onTimeAssetRate,
    actualNumeric: input.onTimeAssetRate,
    floor: 0.65,
    target: 0.95,
    maxPoints: 12,
    score: c1aResult.score,
    percentage: c1aResult.percentage,
    isApplicable: true,
  };

  let c1bScore = 3;
  let c1bPct = 1;
  const lateRate = input.lateVsMissingRate ?? 1;
  if (!input.hasZeroNonOnTimeWeeks) {
    const res = calculateLinearScore(lateRate, 0, 1, 3);
    c1bScore = res.score;
    c1bPct = res.percentage;
  }
  const c1b: KPIScoreResult = {
    id: 'C1b',
    name: 'Late-vs-Missing Rate',
    group: 'b1_assets',
    bucket: 'bucket1',
    actual: input.hasZeroNonOnTimeWeeks ? 'Full Credit (0 late/missing)' : lateRate,
    actualNumeric: lateRate,
    floor: 0,
    target: 1,
    maxPoints: 3,
    score: c1bScore,
    percentage: c1bPct,
    isApplicable: true,
  };

  const assetsGroup = rescaleGroupKpis([c1a, c1b], 15);

  // Group 2: Systems & Branding (14 pts)
  const c2Result = calculateLinearScore(input.systemsUptimeRate, 0.60, 1.0, 6);
  const c2: KPIScoreResult = {
    id: 'C2',
    name: 'Systems Uptime',
    group: 'b1_systems_branding',
    bucket: 'bucket1',
    actual: input.systemsUptimeRate,
    actualNumeric: input.systemsUptimeRate,
    floor: 0.60,
    target: 1.0,
    maxPoints: 6,
    score: c2Result.score,
    percentage: c2Result.percentage,
    isApplicable: true,
  };

  const c3Earned = (input.stickersPresent ? 2 : 0) + (input.partnerSignPresent ? 2 : 0);
  const c3: KPIScoreResult = {
    id: 'C3',
    name: 'Branding Present',
    group: 'b1_systems_branding',
    bucket: 'bucket1',
    actual: `${input.stickersPresent ? 'Stickers ✓' : 'No Stickers'}, ${input.partnerSignPresent ? 'Sign ✓' : 'No Sign'}`,
    actualNumeric: c3Earned,
    floor: 0,
    target: 4,
    maxPoints: 4,
    score: c3Earned,
    percentage: c3Earned / 4,
    isApplicable: true,
  };

  // C4: Lab usability (pooled mean HC + AMV)
  const usabilityRatings: number[] = [];
  if (input.hcUsabilityRating !== undefined) usabilityRatings.push(input.hcUsabilityRating);
  if (input.amvLabImpressionRating !== undefined) usabilityRatings.push(input.amvLabImpressionRating);
  const c4Actual = usabilityRatings.length > 0
    ? usabilityRatings.reduce((a, b) => a + b, 0) / usabilityRatings.length
    : 2.5; // fallback
  const c4Result = calculateLinearScore(c4Actual, 1, 4, 2);
  const c4: KPIScoreResult = {
    id: 'C4',
    name: 'Lab Usability Rating',
    group: 'b1_systems_branding',
    bucket: 'bucket1',
    actual: Number(c4Actual.toFixed(2)),
    actualNumeric: c4Actual,
    floor: 1,
    target: 4,
    maxPoints: 2,
    score: c4Result.score,
    percentage: c4Result.percentage,
    isApplicable: true,
  };

  // C5: GST Support Rating (conditional on survey completion)
  const c5Applicable = input.surveyCompleted && input.gstSupportSurveyNormalized !== undefined;
  const c5Actual = c5Applicable ? input.gstSupportSurveyNormalized! : 0;
  const c5Result = c5Applicable
    ? calculateLinearScore(c5Actual, 0.30, 0.85, 2)
    : { score: 0, percentage: 0 };
  const c5: KPIScoreResult = {
    id: 'C5',
    name: 'GST Support Rating',
    group: 'b1_systems_branding',
    bucket: 'bucket1',
    actual: c5Applicable ? Number(c5Actual.toFixed(2)) : 'Survey Not Completed',
    actualNumeric: c5Actual,
    floor: 0.30,
    target: 0.85,
    maxPoints: 2,
    score: c5Result.score,
    percentage: c5Result.percentage,
    isApplicable: c5Applicable,
    dropReason: c5Applicable ? undefined : 'Teacher Survey not completed; group rescaled',
  };

  const systemsGroup = rescaleGroupKpis([c2, c3, c4, c5], 14);

  // Group 3: Harvests & Distribution (8 pts)
  const c6Result = calculateLinearScore(input.harvestsPerMonthSinceNov, 0.5, 3.0, 6);
  const c6: KPIScoreResult = {
    id: 'C6',
    name: 'Harvest Frequency',
    group: 'b1_harvests',
    bucket: 'bucket1',
    actual: `${input.harvestsPerMonthSinceNov}/mo`,
    actualNumeric: input.harvestsPerMonthSinceNov,
    floor: 0.5,
    target: 3.0,
    maxPoints: 6,
    score: c6Result.score,
    percentage: c6Result.percentage,
    isApplicable: true,
  };

  const c7Result = calculateLinearScore(input.harvestLbsPerMonthPerSystem, 0.5, 3.0, 2);
  const c7: KPIScoreResult = {
    id: 'C7',
    name: 'Harvest Yield',
    group: 'b1_harvests',
    bucket: 'bucket1',
    actual: `${input.harvestLbsPerMonthPerSystem} lb/mo/sys`,
    actualNumeric: input.harvestLbsPerMonthPerSystem,
    floor: 0.5,
    target: 3.0,
    maxPoints: 2,
    score: c7Result.score,
    percentage: c7Result.percentage,
    isApplicable: true,
  };

  const harvestsGroup = rescaleGroupKpis([c6, c7], 8);

  // Group 4: Visitor & Classroom Readiness (5 pts)
  const readinessRatings: number[] = [];
  if (input.hcVisitorSuitabilityRating !== undefined) readinessRatings.push(input.hcVisitorSuitabilityRating);
  if (input.amvCleanlinessRating !== undefined) readinessRatings.push(input.amvCleanlinessRating);
  const c8Actual = readinessRatings.length > 0
    ? readinessRatings.reduce((a, b) => a + b, 0) / readinessRatings.length
    : 2.5;
  const c8Result = calculateLinearScore(c8Actual, 1, 4, 2);
  const c8: KPIScoreResult = {
    id: 'C8',
    name: 'Visitor Readiness Rating',
    group: 'b1_readiness',
    bucket: 'bucket1',
    actual: Number(c8Actual.toFixed(2)),
    actualNumeric: c8Actual,
    floor: 1,
    target: 4,
    maxPoints: 2,
    score: c8Result.score,
    percentage: c8Result.percentage,
    isApplicable: true,
  };

  const c9Result = calculateLinearScore(input.seedlingsPresentRate, 0.10, 0.50, 1);
  const c9: KPIScoreResult = {
    id: 'C9',
    name: 'Seedlings Present',
    group: 'b1_readiness',
    bucket: 'bucket1',
    actual: input.seedlingsPresentRate,
    actualNumeric: input.seedlingsPresentRate,
    floor: 0.10,
    target: 0.50,
    maxPoints: 1,
    score: c9Result.score,
    percentage: c9Result.percentage,
    isApplicable: true,
  };

  const c10Result = calculateLinearScore(input.pestFreeVisitRate, 0.60, 0.95, 2);
  const c10: KPIScoreResult = {
    id: 'C10',
    name: 'Pest-Free Visit Rate',
    group: 'b1_readiness',
    bucket: 'bucket1',
    actual: input.pestFreeVisitRate,
    actualNumeric: input.pestFreeVisitRate,
    floor: 0.60,
    target: 0.95,
    maxPoints: 2,
    score: c10Result.score,
    percentage: c10Result.percentage,
    isApplicable: true,
  };

  const readinessGroup = rescaleGroupKpis([c8, c9, c10], 5);

  const earnedPoints = Number(
    (
      assetsGroup.groupEarnedPoints +
      systemsGroup.groupEarnedPoints +
      harvestsGroup.groupEarnedPoints +
      readinessGroup.groupEarnedPoints
    ).toFixed(2)
  );

  const percentage = Number((earnedPoints / 42).toFixed(4));
  const { letterGrade, tier } = getGradeAndTier(percentage * 100);

  return {
    bucketId: 'bucket1',
    name: 'Classroom Maintenance / GST',
    maxPoints: 42,
    earnedPoints,
    percentage,
    letterGrade,
    tier,
    groups: [
      {
        groupId: 'b1_assets',
        name: 'Assets',
        maxPoints: 15,
        earnedPoints: assetsGroup.groupEarnedPoints,
        percentage: Number((assetsGroup.groupEarnedPoints / 15).toFixed(4)),
        kpis: assetsGroup.rescaledKpis,
      },
      {
        groupId: 'b1_systems_branding',
        name: 'Systems & Branding',
        maxPoints: 14,
        earnedPoints: systemsGroup.groupEarnedPoints,
        percentage: Number((systemsGroup.groupEarnedPoints / 14).toFixed(4)),
        kpis: systemsGroup.rescaledKpis,
      },
      {
        groupId: 'b1_harvests',
        name: 'Harvests & Distribution',
        maxPoints: 8,
        earnedPoints: harvestsGroup.groupEarnedPoints,
        percentage: Number((harvestsGroup.groupEarnedPoints / 8).toFixed(4)),
        kpis: harvestsGroup.rescaledKpis,
      },
      {
        groupId: 'b1_readiness',
        name: 'Visitor & Classroom Readiness',
        maxPoints: 5,
        earnedPoints: readinessGroup.groupEarnedPoints,
        percentage: Number((readinessGroup.groupEarnedPoints / 5).toFixed(4)),
        kpis: readinessGroup.rescaledKpis,
      },
    ],
  };
}
