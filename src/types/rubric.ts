export type KPIId =
  // Bucket 1: Classroom Maintenance / GST (42 pts)
  | 'C1a' | 'C1b' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10'
  // Bucket 2: Teacher & Student Engagement (40 pts)
  | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T10' | 'T11'
  // Bucket 3: Administration Support (18 pts)
  | 'A1' | 'A3' | 'A6' | 'A9';

export type BucketId = 'bucket1' | 'bucket2' | 'bucket3';

export type GroupId =
  // Bucket 1 Groups
  | 'b1_assets'
  | 'b1_systems_branding'
  | 'b1_harvests'
  | 'b1_readiness'
  // Bucket 2 Groups
  | 'b2_comprehension'
  | 'b2_training'
  | 'b2_hc_engagement'
  // Bucket 3 Group
  | 'b3_admin';

export interface KPIDefinition {
  id: KPIId;
  name: string;
  bucket: BucketId;
  group: GroupId;
  floor: number;
  target: number;
  maxPoints: number;
  unit: string;
  source: string;
  notes: string;
  reasoning: string;
}

export interface KPIScoreResult {
  id: KPIId;
  name: string;
  group: GroupId;
  bucket: BucketId;
  actual: number | string | boolean;
  actualNumeric: number;
  floor: number;
  target: number;
  maxPoints: number;
  score: number;                     // Clamped points earned
  percentage: number;                // 0 to 1 scale
  isApplicable: boolean;
  dropReason?: string;
}
