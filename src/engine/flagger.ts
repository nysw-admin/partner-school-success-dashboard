import type { ActiveFlag, FlaggedSchoolReport } from '../types/flags.ts';
import type { School } from '../types/school.ts';
import type { SchoolScore } from '../types/score.ts';

export interface WeeklyLogHistoryItem {
  weekEndingDate: string;              // YYYY-MM-DD
  reportStatus: 'Completed' | 'Late' | 'Missing';
  systemsDownCount: number;            // Number of systems not running
  harvestLogged: boolean;
  totalHarvestsYtd: number;
}

export interface FlagEvaluationContext {
  school: School;
  currentDate: string;                 // YYYY-MM-DD
  weeklyHistory: WeeklyLogHistoryItem[]; // chronological order (oldest to newest)
  cumulativeAssetCompletionRate: number; // 0 to 1
  hasFundingOrBudgetCern: boolean;     // from HC Performance
  score: SchoolScore;
  existingFlagWeeksActive?: Partial<Record<string, number>>; // Persistent tracker of weeks active
}

export function evaluateSchoolFlags(ctx: FlagEvaluationContext): ActiveFlag[] {
  const flags: ActiveFlag[] = [];
  const currDate = new Date(ctx.currentDate);
  const month = currDate.getMonth() + 1; // 1-12
  const day = currDate.getDate();

  const history = ctx.weeklyHistory;
  const numLogs = history.length;

  // 1. TWO_REPORTS_MISSING: Two consecutive weekly reports missing
  if (numLogs >= 2) {
    const last1 = history[numLogs - 1];
    const last2 = history[numLogs - 2];
    if (last1.reportStatus === 'Missing' && last2.reportStatus === 'Missing') {
      const prevWeeks = ctx.existingFlagWeeksActive?.['TWO_REPORTS_MISSING'] ?? 0;
      flags.push({
        id: 'TWO_REPORTS_MISSING',
        title: 'Consecutive Reports Missing',
        description: 'Two consecutive weekly support reports are missing. Usually a visit-scheduling problem, not a school failure.',
        triggerDetail: `Missing reports on ${last2.weekEndingDate} and ${last1.weekEndingDate}`,
        triggeredDate: last1.weekEndingDate,
        weeksActive: prevWeeks + 1,
        severity: 'warning',
        routing: 'GST Check-in',
        autoClears: false,
      });
    }
  }

  // 2. ASSET_COMPLETION_LOW: Completed Assets Rate below 70% (checked once by Dec 1, then continuously)
  // Dec 1 is month 12, or months 1-6 of current school year (Dec, Jan, Feb, Mar, Apr, May, Jun)
  const isPastDec1 = (month === 12) || (month >= 1 && month <= 8);
  if (isPastDec1 && ctx.cumulativeAssetCompletionRate < 0.70) {
    const prevWeeks = ctx.existingFlagWeeksActive?.['ASSET_COMPLETION_LOW'] ?? 0;
    flags.push({
      id: 'ASSET_COMPLETION_LOW',
      title: 'Low Asset Completion Rate (<70%)',
      description: 'YTD on-time asset completion is below the 70% threshold. Requires GST support check-in.',
      triggerDetail: `Current completion rate: ${(ctx.cumulativeAssetCompletionRate * 100).toFixed(1)}% (Floor: 70%)`,
      triggeredDate: ctx.currentDate,
      weeksActive: prevWeeks + 1,
      severity: 'critical',
      routing: 'GST Check-in',
      autoClears: true,
    });
  }

  // 3. SYSTEM_DOWN_3X: Any system down on 3 consecutive reports (before May 15; after that, seasonal per C2)
  const isBeforeMay15 = (month < 5) || (month === 5 && day < 15) || (month >= 9);
  if (isBeforeMay15 && numLogs >= 3) {
    const last3 = history.slice(-3);
    const allThreeHadDownSystems = last3.every(log => log.systemsDownCount > 0);
    if (allThreeHadDownSystems) {
      const prevWeeks = ctx.existingFlagWeeksActive?.['SYSTEM_DOWN_3X'] ?? 0;
      flags.push({
        id: 'SYSTEM_DOWN_3X',
        title: 'Persistent System Outage (3+ Weeks)',
        description: 'Hydroponic system has been reported non-running on 3 consecutive visits. Dispatches maintenance.',
        triggerDetail: `Down systems observed across visits ending: ${last3.map(l => l.weekEndingDate).join(', ')}`,
        triggeredDate: last3[2].weekEndingDate,
        weeksActive: prevWeeks + 1,
        severity: 'critical',
        routing: 'Maintenance',
        autoClears: true,
      });
    }
  }

  // 4. HARVEST_DEFICIT: Fewer than 3 total harvests logged (checked starting March 1, auto-clears once count >= 3)
  const isPastMarch1 = (month >= 3 && month <= 8);
  const totalHarvests = numLogs > 0 ? history[numLogs - 1].totalHarvestsYtd : 0;
  if (isPastMarch1 && totalHarvests < 3) {
    const prevWeeks = ctx.existingFlagWeeksActive?.['HARVEST_DEFICIT'] ?? 0;
    flags.push({
      id: 'HARVEST_DEFICIT',
      title: 'Harvest Deficit (<3 Harvests by Spring)',
      description: 'Fewer than 3 cumulative harvests have been logged this school year. Triggers agronomic review.',
      triggerDetail: `Total harvests logged YTD: ${totalHarvests} (Target: ≥3 by March 1)`,
      triggeredDate: ctx.currentDate,
      weeksActive: prevWeeks + 1,
      severity: 'warning',
      routing: 'Agronomic Support',
      autoClears: true,
    });
  }

  // 5. BUDGET_CONCERN: Continuation or budget concern flagged in HC Performance
  if (ctx.hasFundingOrBudgetCern) {
    const prevWeeks = ctx.existingFlagWeeksActive?.['BUDGET_CONCERN'] ?? 0;
    flags.push({
      id: 'BUDGET_CONCERN',
      title: 'Funding / Contract Renewal Risk',
      description: 'Staff expressed concerns regarding budget, municipal funding, or lab contract renewal.',
      triggerDetail: 'Noted during HC Performance review. Immediate routing to Development.',
      triggeredDate: ctx.currentDate,
      weeksActive: prevWeeks + 1,
      severity: 'critical',
      routing: 'Development',
      autoClears: false,
    });
  }

  // 6. MOM_DROP_10PTS: Any bucket score drops 10+ points month over month
  const b1Drop = (ctx.score.momBucket1Change ?? 0) <= -10;
  const b2Drop = (ctx.score.momBucket2Change ?? 0) <= -10;
  const b3Drop = (ctx.score.momBucket3Change ?? 0) <= -10;
  if (b1Drop || b2Drop || b3Drop) {
    const prevWeeks = ctx.existingFlagWeeksActive?.['MOM_DROP_10PTS'] ?? 0;
    const droppedBuckets: string[] = [];
    if (b1Drop) droppedBuckets.push(`Bucket 1 (${ctx.score.momBucket1Change} pts)`);
    if (b2Drop) droppedBuckets.push(`Bucket 2 (${ctx.score.momBucket2Change} pts)`);
    if (b3Drop) droppedBuckets.push(`Bucket 3 (${ctx.score.momBucket3Change} pts)`);

    flags.push({
      id: 'MOM_DROP_10PTS',
      title: 'Sudden Bucket Performance Drop (≥10 pts MoM)',
      description: 'A performance bucket experienced a steep decline compared to last month.',
      triggerDetail: `Significant negative shift: ${droppedBuckets.join(', ')}`,
      triggeredDate: ctx.currentDate,
      weeksActive: prevWeeks + 1,
      severity: 'warning',
      routing: 'Operations / School Page',
      autoClears: true,
    });
  }

  return flags;
}

export function buildFlaggedSchoolReport(
  school: School,
  flags: ActiveFlag[]
): FlaggedSchoolReport | null {
  if (flags.length === 0) return null;

  const maxConsecutiveWeeks = Math.max(...flags.map(f => f.weeksActive));
  const hasCritical = flags.some(f => f.severity === 'critical');
  const hasWarning = flags.some(f => f.severity === 'warning');

  return {
    schoolDbn: school.dbn,
    schoolName: school.name,
    assignedGst: school.assignedGst,
    borough: school.borough,
    activeFlags: flags,
    maxConsecutiveWeeks,
    highestSeverity: hasCritical ? 'critical' : (hasWarning ? 'warning' : 'info'),
  };
}
