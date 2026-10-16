export interface SchoolYearSnapshotRecord {
  dbn: string;
  name: string;
  borough: string;
  programYear: string;
  overallScore: number;
  letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  tier: string;
  completenessStatus: string;
  completenessRate: number;
  bucket1Score: number;
  bucket2Score: number;
  bucket3Score: number;
  uptimeRate: number;
  totalHarvests: number;
  totalVisits: number;
  flagsCount: number;
  activeFlagIds: string[];
  assignedGst: string;
  areaManager: string;
  notes?: string;
}

export interface EndOfYearSnapshot {
  snapshotId: string;
  schoolYear: string;
  isFinal: boolean;
  createdAt: string;
  archivedBy?: string;
  notes: string;
  totalSchools: number;
  networkSummary: {
    averageOverallScore: number;
    averageBucket1Score: number;
    averageBucket2Score: number;
    averageBucket3Score: number;
    gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>;
    tierDistribution: Record<string, number>;
    totalVisitsLogged: number;
    totalHarvestsLogged: number;
    totalFlagsActive: number;
  };
  schools: SchoolYearSnapshotRecord[];
}

export interface MultiYearSchoolTrend {
  schoolDbn: string;
  schoolName: string;
  records: Array<{
    schoolYear: string;
    overallScore: number;
    letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    tier: string;
    bucket1Score: number;
    bucket2Score: number;
    bucket3Score: number;
    totalHarvests: number;
    totalVisits: number;
    flagsCount: number;
  }>;
  yoyOverallDelta: number;
  yoyTrendStatus: 'significant_growth' | 'steady_improvement' | 'stable' | 'moderate_decline' | 'critical_decline';
  yoyTrendLabel: string;
  twoYearGrowth: number | null;
}
