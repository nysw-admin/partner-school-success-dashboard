import { calculateBucket1, type Bucket1Input } from './bucket1-calculator.ts';
import { calculateBucket2, type Bucket2Input } from './bucket2-calculator.ts';
import { calculateBucket3, type Bucket3Input } from './bucket3-calculator.ts';
import type { CompletenessReport, CompletenessStatus, SchoolScore } from '../types/score.ts';
import { getGradeAndTier } from './formula.ts';

export interface GraderInput {
  schoolDbn: string;
  schoolName: string;
  bucket1Input: Bucket1Input;
  bucket2Input: Bucket2Input;
  bucket3Input: Bucket3Input;
  // Reporting completeness metrics
  weeklyReportsExpected: number;
  weeklyReportsFiled: number;
  hcPerformanceExpected: number;
  hcPerformanceFiled: number;
  trainingExpected: number;
  trainingFiled: number;
  teacherSurveyCompleted: boolean;
  lettersExpected: number;
  lettersFiled: number;
  amvVisitsExpected: number;
  amvVisitsFiled: number;
  // MoM past scores (optional)
  previousOverallScore?: number;
  previousBucket1Score?: number;
  previousBucket2Score?: number;
  previousBucket3Score?: number;
}

export function evaluateSchoolScore(input: GraderInput): SchoolScore {
  const b1 = calculateBucket1(input.bucket1Input);
  const b2 = calculateBucket2(input.bucket2Input);
  const b3 = calculateBucket3(input.bucket3Input);

  // Overall Score = direct sum of 3 buckets (raw max = 100)
  const overallScore = Number((b1.earnedPoints + b2.earnedPoints + b3.earnedPoints).toFixed(2));
  const { letterGrade, tier } = getGradeAndTier(overallScore);

  // Calculate Completeness Gate
  const expectedTotal =
    input.weeklyReportsExpected +
    input.hcPerformanceExpected +
    input.trainingExpected +
    1 + // Survey
    input.lettersExpected +
    input.amvVisitsExpected;

  const filedTotal =
    input.weeklyReportsFiled +
    input.hcPerformanceFiled +
    input.trainingFiled +
    (input.teacherSurveyCompleted ? 1 : 0) +
    input.lettersFiled +
    input.amvVisitsFiled;

  const completenessRate = expectedTotal > 0
    ? Number((filedTotal / expectedTotal).toFixed(4))
    : 1.0;

  let completenessStatus: CompletenessStatus = 'Normal';
  if (completenessRate < 0.70) {
    completenessStatus = 'Incomplete';
  } else if (completenessRate < 0.85) {
    completenessStatus = 'Provisional';
  }

  const completeness: CompletenessReport = {
    status: completenessStatus,
    rate: completenessRate,
    expectedRecords: expectedTotal,
    actualRecords: filedTotal,
    details: {
      weeklyReportsExpected: input.weeklyReportsExpected,
      weeklyReportsFiled: input.weeklyReportsFiled,
      hcPerformanceExpected: input.hcPerformanceExpected,
      hcPerformanceFiled: input.hcPerformanceFiled,
      trainingExpected: input.trainingExpected,
      trainingFiled: input.trainingFiled,
      teacherSurveyCompleted: input.teacherSurveyCompleted,
      lettersExpected: input.lettersExpected,
      lettersFiled: input.lettersFiled,
      amvVisitsExpected: input.amvVisitsExpected,
      amvVisitsFiled: input.amvVisitsFiled,
    },
  };

  const momScoreChange = input.previousOverallScore !== undefined
    ? Number((overallScore - input.previousOverallScore).toFixed(2))
    : undefined;
  const momBucket1Change = input.previousBucket1Score !== undefined
    ? Number((b1.earnedPoints - input.previousBucket1Score).toFixed(2))
    : undefined;
  const momBucket2Change = input.previousBucket2Score !== undefined
    ? Number((b2.earnedPoints - input.previousBucket2Score).toFixed(2))
    : undefined;
  const momBucket3Change = input.previousBucket3Score !== undefined
    ? Number((b3.earnedPoints - input.previousBucket3Score).toFixed(2))
    : undefined;

  return {
    schoolDbn: input.schoolDbn,
    schoolName: input.schoolName,
    overallScore,
    letterGrade,
    tier,
    completeness,
    bucket1: b1,
    bucket2: b2,
    bucket3: b3,
    calculatedAt: new Date().toISOString(),
    momScoreChange,
    momBucket1Change,
    momBucket2Change,
    momBucket3Change,
  };
}
