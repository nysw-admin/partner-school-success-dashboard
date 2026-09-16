import type { KPIScoreResult } from '../types/rubric.ts';
import type { BucketScore } from '../types/score.ts';
import { calculateLinearScore, getGradeAndTier, rescaleGroupKpis } from './formula.ts';
import type { ProgramYear } from '../types/school.ts';

export interface Bucket2Input {
  programYear: ProgramYear;
  isNewOpY2Teacher?: boolean;
  surveyCompleted: boolean;

  // Group 1: Survey inputs
  q14Q16UsageAndEaseNormalized?: number;       // T1: 0 to 1 scale (Floor: 0.30, Target: 0.85)
  q15Q26HelpfulnessConfidenceNormalized?: number; // T2: 0 to 1 scale (Floor: 0.30, Target: 0.85)
  q18Q19Q22MaterialsUtilizationNormalized?: number; // T3: 0 to 1 scale (Floor: 0.25, Target: 0.80)

  // T4: AMV Curriculum Use Confirmed
  amvVisitsHeld: number;
  amvCurriculumConfirmedRate?: number;         // T4: 0 to 1 (Floor: 0.50, Target: 1.0)

  // T5 & T6: Rubric Level & Growth (non-PD sessions)
  latestRubricLevel?: number;                  // T5: 1 to 4 scale (Floor: 1.5, Target: 3.5)
  rubricGrowth?: number;                       // T6: delta (Floor: 0.0, Target: 0.75)

  // Group 2: Training & PD
  trainingCompletionRate?: number;             // T7: 0 to 1 (Floor: 0.40, Target: 1.0)
  attendedAtLeastOnePD: boolean;               // T8: 1 pt if true, 0 if false

  // Group 3: HC Engagement
  conversationRate: number;                    // T10: (weekly + AMV conversation) / total visits
  hcTeacherRelationshipRating?: number;        // 1 to 4 scale
  amvTeacherInvolvementRating?: number;        // 1 to 4 scale
}

export function calculateBucket2(input: Bucket2Input): BucketScore {
  const isTrainingApplicable =
    input.programYear === 'Implementation' ||
    input.programYear === 'Op Y1' ||
    (input.programYear === 'Op Y2' && input.isNewOpY2Teacher === true);

  // Group 1: Curriculum Comprehension (20 pts)
  const t1Applicable = input.surveyCompleted && input.q14Q16UsageAndEaseNormalized !== undefined;
  const t1Actual = t1Applicable ? input.q14Q16UsageAndEaseNormalized! : 0;
  const t1Result = t1Applicable
    ? calculateLinearScore(t1Actual, 0.30, 0.85, 6)
    : { score: 0, percentage: 0 };
  const t1: KPIScoreResult = {
    id: 'T1',
    name: 'Curriculum Usage & Ease',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t1Applicable ? Number(t1Actual.toFixed(3)) : 'Survey Not Completed',
    actualNumeric: t1Actual,
    floor: 0.30,
    target: 0.85,
    maxPoints: 6,
    score: t1Result.score,
    percentage: t1Result.percentage,
    isApplicable: t1Applicable,
    dropReason: t1Applicable ? undefined : 'Survey not completed',
  };

  const t2Applicable = input.surveyCompleted && input.q15Q26HelpfulnessConfidenceNormalized !== undefined;
  const t2Actual = t2Applicable ? input.q15Q26HelpfulnessConfidenceNormalized! : 0;
  const t2Result = t2Applicable
    ? calculateLinearScore(t2Actual, 0.30, 0.85, 2)
    : { score: 0, percentage: 0 };
  const t2: KPIScoreResult = {
    id: 'T2',
    name: 'Curriculum Helpfulness & Teacher Confidence',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t2Applicable ? Number(t2Actual.toFixed(3)) : 'Survey Not Completed',
    actualNumeric: t2Actual,
    floor: 0.30,
    target: 0.85,
    maxPoints: 2,
    score: t2Result.score,
    percentage: t2Result.percentage,
    isApplicable: t2Applicable,
    dropReason: t2Applicable ? undefined : 'Survey not completed',
  };

  const t3Applicable = input.surveyCompleted && input.q18Q19Q22MaterialsUtilizationNormalized !== undefined;
  const t3Actual = t3Applicable ? input.q18Q19Q22MaterialsUtilizationNormalized! : 0;
  const t3Result = t3Applicable
    ? calculateLinearScore(t3Actual, 0.25, 0.80, 2)
    : { score: 0, percentage: 0 };
  const t3: KPIScoreResult = {
    id: 'T3',
    name: 'Materials & Resource Utilization',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t3Applicable ? Number(t3Actual.toFixed(3)) : 'Survey Not Completed',
    actualNumeric: t3Actual,
    floor: 0.25,
    target: 0.80,
    maxPoints: 2,
    score: t3Result.score,
    percentage: t3Result.percentage,
    isApplicable: t3Applicable,
    dropReason: t3Applicable ? undefined : 'Survey not completed',
  };

  // T4: AMV confirmed curriculum use (drops if 0 AMVs)
  const t4Applicable = input.amvVisitsHeld > 0 && input.amvCurriculumConfirmedRate !== undefined;
  const t4Actual = t4Applicable ? input.amvCurriculumConfirmedRate! : 0;
  const t4Result = t4Applicable
    ? calculateLinearScore(t4Actual, 0.50, 1.0, 3)
    : { score: 0, percentage: 0 };
  const t4: KPIScoreResult = {
    id: 'T4',
    name: 'Curriculum Use Confirmed (AMV)',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t4Applicable ? Number(t4Actual.toFixed(2)) : 'No AMV Visits',
    actualNumeric: t4Actual,
    floor: 0.50,
    target: 1.0,
    maxPoints: 3,
    score: t4Result.score,
    percentage: t4Result.percentage,
    isApplicable: t4Applicable,
    dropReason: t4Applicable ? undefined : 'Zero AMV visits held',
  };

  // T5: Rubric level (only applies if training applicable)
  const t5Applicable = isTrainingApplicable && input.latestRubricLevel !== undefined;
  const t5Actual = t5Applicable ? input.latestRubricLevel! : 0;
  const t5Result = t5Applicable
    ? calculateLinearScore(t5Actual, 1.5, 3.5, 5)
    : { score: 0, percentage: 0 };
  const t5: KPIScoreResult = {
    id: 'T5',
    name: 'Rubric Level',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t5Applicable ? Number(t5Actual.toFixed(2)) : 'Not Applicable (Op Y2+)',
    actualNumeric: t5Actual,
    floor: 1.5,
    target: 3.5,
    maxPoints: 5,
    score: t5Result.score,
    percentage: t5Result.percentage,
    isApplicable: t5Applicable,
    dropReason: t5Applicable ? undefined : 'Mature school (Op Y2+), group rescaled',
  };

  // T6: Rubric growth (only applies if training applicable)
  const t6Applicable = isTrainingApplicable && input.rubricGrowth !== undefined;
  const t6Actual = t6Applicable ? input.rubricGrowth! : 0;
  const t6Result = t6Applicable
    ? calculateLinearScore(t6Actual, 0, 0.75, 2)
    : { score: 0, percentage: 0 };
  const t6: KPIScoreResult = {
    id: 'T6',
    name: 'Rubric Growth',
    group: 'b2_comprehension',
    bucket: 'bucket2',
    actual: t6Applicable ? Number(t6Actual.toFixed(3)) : 'Not Applicable (Op Y2+)',
    actualNumeric: t6Actual,
    floor: 0,
    target: 0.75,
    maxPoints: 2,
    score: t6Result.score,
    percentage: t6Result.percentage,
    isApplicable: t6Applicable,
    dropReason: t6Applicable ? undefined : 'Mature school (Op Y2+), group rescaled',
  };

  const compGroup = rescaleGroupKpis([t1, t2, t3, t4, t5, t6], 20);

  // Group 2: Curriculum Training Sessions & PDs (11 pts)
  const t7Applicable = isTrainingApplicable && input.trainingCompletionRate !== undefined;
  const t7Actual = t7Applicable ? input.trainingCompletionRate! : 0;
  const t7Result = t7Applicable
    ? calculateLinearScore(t7Actual, 0.40, 1.0, 10)
    : { score: 0, percentage: 0 };
  const t7: KPIScoreResult = {
    id: 'T7',
    name: 'Training Session Completion',
    group: 'b2_training',
    bucket: 'bucket2',
    actual: t7Applicable ? Number(t7Actual.toFixed(2)) : 'Not Applicable (Op Y2+)',
    actualNumeric: t7Actual,
    floor: 0.40,
    target: 1.0,
    maxPoints: 10,
    score: t7Result.score,
    percentage: t7Result.percentage,
    isApplicable: t7Applicable,
    dropReason: t7Applicable ? undefined : 'Mature school (Op Y2+), group rescaled',
  };

  const t8Earned = input.attendedAtLeastOnePD ? 1 : 0;
  const t8: KPIScoreResult = {
    id: 'T8',
    name: 'PD Attendance',
    group: 'b2_training',
    bucket: 'bucket2',
    actual: input.attendedAtLeastOnePD ? 'Yes (Attended ≥1 PD)' : 'No PD Attended',
    actualNumeric: t8Earned,
    floor: 0,
    target: 1,
    maxPoints: 1,
    score: t8Earned,
    percentage: t8Earned,
    isApplicable: true,
  };

  const trainingGroup = rescaleGroupKpis([t7, t8], 11);

  // Group 3: HC Engagement (9 pts)
  // T10: Teacher-GST conversation rate, tiered by program year
  const isEarlyYear =
    input.programYear === 'Implementation' || input.programYear === 'Op Y1';
  const t10Floor = isEarlyYear ? 0.40 : 0.10;
  const t10Target = isEarlyYear ? 0.90 : 0.30;
  const t10Result = calculateLinearScore(input.conversationRate, t10Floor, t10Target, 4);

  const t10: KPIScoreResult = {
    id: 'T10',
    name: 'Teacher–GST Conversation Rate',
    group: 'b2_hc_engagement',
    bucket: 'bucket2',
    actual: `${(input.conversationRate * 100).toFixed(0)}% (${isEarlyYear ? 'Op Y1 tier' : 'Op Y2+ tier'})`,
    actualNumeric: input.conversationRate,
    floor: t10Floor,
    target: t10Target,
    maxPoints: 4,
    score: t10Result.score,
    percentage: t10Result.percentage,
    isApplicable: true,
  };

  // T11: Teacher relationship rating (pooled HC + AMV)
  const relRatings: number[] = [];
  if (input.hcTeacherRelationshipRating !== undefined) relRatings.push(input.hcTeacherRelationshipRating);
  if (input.amvTeacherInvolvementRating !== undefined) relRatings.push(input.amvTeacherInvolvementRating);
  const t11Actual = relRatings.length > 0
    ? relRatings.reduce((a, b) => a + b, 0) / relRatings.length
    : 2.5;
  const t11Result = calculateLinearScore(t11Actual, 1, 4, 5);
  const t11: KPIScoreResult = {
    id: 'T11',
    name: 'Teacher Relationship Rating',
    group: 'b2_hc_engagement',
    bucket: 'bucket2',
    actual: Number(t11Actual.toFixed(2)),
    actualNumeric: t11Actual,
    floor: 1,
    target: 4,
    maxPoints: 5,
    score: t11Result.score,
    percentage: t11Result.percentage,
    isApplicable: true,
  };

  const engagementGroup = rescaleGroupKpis([t10, t11], 9);

  const earnedPoints = Number(
    (
      compGroup.groupEarnedPoints +
      trainingGroup.groupEarnedPoints +
      engagementGroup.groupEarnedPoints
    ).toFixed(2)
  );

  const percentage = Number((earnedPoints / 40).toFixed(4));
  const { letterGrade, tier } = getGradeAndTier(percentage * 100);

  return {
    bucketId: 'bucket2',
    name: 'Teacher & Student Engagement',
    maxPoints: 40,
    earnedPoints,
    percentage,
    letterGrade,
    tier,
    groups: [
      {
        groupId: 'b2_comprehension',
        name: 'Curriculum Comprehension',
        maxPoints: 20,
        earnedPoints: compGroup.groupEarnedPoints,
        percentage: Number((compGroup.groupEarnedPoints / 20).toFixed(4)),
        kpis: compGroup.rescaledKpis,
      },
      {
        groupId: 'b2_training',
        name: 'Curriculum Training Sessions & PDs',
        maxPoints: 11,
        earnedPoints: trainingGroup.groupEarnedPoints,
        percentage: Number((trainingGroup.groupEarnedPoints / 11).toFixed(4)),
        kpis: trainingGroup.rescaledKpis,
      },
      {
        groupId: 'b2_hc_engagement',
        name: 'HC Engagement',
        maxPoints: 9,
        earnedPoints: engagementGroup.groupEarnedPoints,
        percentage: Number((engagementGroup.groupEarnedPoints / 9).toFixed(4)),
        kpis: engagementGroup.rescaledKpis,
      },
    ],
  };
}
