import type { BucketId, GroupId, KPIScoreResult } from './rubric.ts';

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type StatusTier =
  | 'Green — Thriving'
  | 'Green — Healthy'
  | 'Yellow — Watch'
  | 'Red — Intervene'
  | 'Red — At Risk';

export type CompletenessStatus = 'Normal' | 'Provisional' | 'Incomplete';

export interface GroupScore {
  groupId: GroupId;
  name: string;
  maxPoints: number;
  earnedPoints: number;
  percentage: number;
  kpis: KPIScoreResult[];
}

export interface BucketScore {
  bucketId: BucketId;
  name: string;
  maxPoints: number;
  earnedPoints: number;
  percentage: number;
  letterGrade: LetterGrade;
  tier: StatusTier;
  groups: GroupScore[];
}

export interface CompletenessReport {
  status: CompletenessStatus;
  rate: number;                      // 0 to 1
  expectedRecords: number;
  actualRecords: number;
  details: {
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
  };
}

export interface SchoolScore {
  schoolDbn: string;
  schoolName: string;
  overallScore: number;              // 0 to 100
  letterGrade: LetterGrade;
  tier: StatusTier;
  completeness: CompletenessReport;
  bucket1: BucketScore;
  bucket2: BucketScore;
  bucket3: BucketScore;
  calculatedAt: string;
  momScoreChange?: number;           // Month-over-month score diff
  momBucket1Change?: number;
  momBucket2Change?: number;
  momBucket3Change?: number;
}
