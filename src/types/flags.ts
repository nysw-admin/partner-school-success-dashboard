export type FlagId =
  | 'TWO_REPORTS_MISSING'       // 2 consecutive weekly reports missing
  | 'ASSET_COMPLETION_LOW'      // Completed Assets Rate < 70% (checked Dec 1 onwards)
  | 'SYSTEM_DOWN_3X'            // Any system down on 3 consecutive reports (before May 15)
  | 'HARVEST_DEFICIT'           // Fewer than 3 total harvests logged (checked starting March 1)
  | 'BUDGET_CONCERN'            // Continuation or budget concern flagged in HC Performance
  | 'MOM_DROP_10PTS';           // Bucket score drops 10+ points month over month

export type FlagSeverity = 'critical' | 'warning' | 'info';

export type FlagRouting = 'GST Check-in' | 'Maintenance' | 'Agronomic Support' | 'Development' | 'Operations / School Page';

export interface ActiveFlag {
  id: FlagId;
  title: string;
  description: string;
  triggerDetail: string;
  triggeredDate: string;        // YYYY-MM-DD
  weeksActive: number;          // Consecutive weeks active
  severity: FlagSeverity;
  routing: FlagRouting;
  autoClears: boolean;
}

export interface FlaggedSchoolReport {
  schoolDbn: string;
  schoolName: string;
  assignedGst: string;
  borough: string;
  activeFlags: ActiveFlag[];
  maxConsecutiveWeeks: number;
  highestSeverity: FlagSeverity;
}
