import type { SchoolWithData } from '../pipeline/generator.ts';
import type { ActiveFlag, FlaggedSchoolReport, FlagId, FlagSeverity } from '../types/flags.ts';
import type { SchoolScore, CompletenessStatus } from '../types/score.ts';
import { calculateLinearScore, getGradeAndTier } from '../engine/formula.ts';
import { addLogEntry } from './flagLogStore.ts';

export interface ResolvedFlagRecord {
  schoolDbn: string;
  flagId: FlagId;
  flagTitle: string;
  resolvedAt: string;
  resolvedBy: string;
  originalFlag: ActiveFlag;
  scoreGain?: number;
}

const STORAGE_KEY = 'nysw_resolved_flags_v1';

// Baseline cache keyed by school DBN so we can always cleanly recalculate or reopen flags
const baselineSchoolCache = new Map<string, { score: SchoolScore; flags: ActiveFlag[] }>();

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getAllResolvedFlags(): ResolvedFlagRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error reading resolved flags from localStorage:', e);
    return [];
  }
}

function saveAllResolvedFlags(records: ResolvedFlagRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Error saving resolved flags to localStorage:', e);
  }
}

export function getResolvedFlagsForSchool(schoolDbn: string): ResolvedFlagRecord[] {
  const dbnUpper = schoolDbn.toUpperCase();
  return getAllResolvedFlags().filter(r => r.schoolDbn.toUpperCase() === dbnUpper);
}

export function isFlagResolved(schoolDbn: string, flagId: FlagId): boolean {
  const dbnUpper = schoolDbn.toUpperCase();
  return getAllResolvedFlags().some(
    r => r.schoolDbn.toUpperCase() === dbnUpper && r.flagId === flagId
  );
}

/**
 * Recalculates a SchoolScore when a set of flags have been resolved for that school.
 */
export function recalculateScoreWithResolvedFlags(
  baseScore: SchoolScore,
  resolvedFlagIds: Set<FlagId>
): { newScore: SchoolScore; baselineOverall: number; scoreDelta: number; originalGrade: string } {
  const score = deepClone(baseScore);
  const baselineOverall = baseScore.overallScore;
  const originalGrade = baseScore.letterGrade;

  if (resolvedFlagIds.size === 0) {
    return { newScore: score, baselineOverall, scoreDelta: 0, originalGrade };
  }

  // Helper to update a specific KPI inside a bucket
  const updateKpi = (
    bucketKey: 'bucket1' | 'bucket2' | 'bucket3',
    kpiId: string,
    newActualNumeric: number,
    newActualLabel: string
  ) => {
    const bucket = score[bucketKey];
    for (const grp of bucket.groups) {
      for (const kpi of grp.kpis) {
        if (kpi.id === kpiId) {
          if (newActualNumeric > kpi.actualNumeric || kpi.score < kpi.maxPoints) {
            const effectiveNumeric = Math.max(kpi.actualNumeric, newActualNumeric);
            const { score: newPts, percentage: newPct } = calculateLinearScore(
              effectiveNumeric,
              kpi.floor,
              kpi.target,
              kpi.maxPoints
            );
            if (newPts >= kpi.score) {
              kpi.actualNumeric = effectiveNumeric;
              kpi.actual = newActualLabel;
              kpi.score = newPts;
              kpi.percentage = newPct;
            }
          }
        }
      }
    }
  };

  // Apply KPI remediations for each resolved flag
  if (resolvedFlagIds.has('TWO_REPORTS_MISSING')) {
    // Missing reports accounted for / resolved:
    // C1b (Late-vs-Missing Rate, 3 pts) -> 100% (3/3 pts)
    // C1a (On-Time Asset Completion, 12 pts) -> lifted to at least 85%
    updateKpi('bucket1', 'C1b', 1.0, '0 Missing (Resolved)');
    updateKpi('bucket1', 'C1a', 0.85, '85.0% (Resolved)');

    // Update Completeness Gate (+2 filed weekly reports)
    const det = score.completeness.details;
    const added = Math.min(2, Math.max(0, det.weeklyReportsExpected - det.weeklyReportsFiled));
    det.weeklyReportsFiled += added;
    score.completeness.actualRecords = Math.min(
      score.completeness.expectedRecords,
      score.completeness.actualRecords + Math.max(added, 2)
    );
  }

  if (resolvedFlagIds.has('ASSET_COMPLETION_LOW')) {
    // Low asset completion (<70%) resolved:
    // C1a (On-Time Asset Completion, 12 pts) -> lifted to 90% (10.0 / 12.0 pts)
    // C1b (Late-vs-Missing Rate, 3 pts) -> lifted to at least 90%
    updateKpi('bucket1', 'C1a', 0.90, '90.0% (Resolved)');
    updateKpi('bucket1', 'C1b', 0.90, '90.0% (Resolved)');

    const det = score.completeness.details;
    det.weeklyReportsFiled = Math.max(
      det.weeklyReportsFiled,
      Math.ceil(det.weeklyReportsExpected * 0.90)
    );
    score.completeness.actualRecords = Math.max(
      score.completeness.actualRecords,
      Math.ceil(score.completeness.expectedRecords * 0.88)
    );
  }

  if (resolvedFlagIds.has('SYSTEM_DOWN_3X')) {
    // Hydroponic system outage resolved (systems repaired & operational):
    // C2 (Systems Uptime, 6 pts) -> 100% (6.0 / 6.0 pts)
    // C4 (Lab Usability Rating, 2 pts) -> lifted to 3.75 / 4.0
    // C9 (Seedlings Present Rate, 1 pt) -> lifted to 50% (1.0 / 1.0 pt)
    updateKpi('bucket1', 'C2', 1.0, '100% (Resolved)');
    updateKpi('bucket1', 'C4', 3.75, '3.75 (Resolved)');
    updateKpi('bucket1', 'C9', 0.50, '50.0% (Resolved)');
  }

  if (resolvedFlagIds.has('HARVEST_DEFICIT')) {
    // Harvest deficit resolved:
    // C6 (Harvest Frequency, 6 pts) -> lifted to 2.5/mo
    // C7 (Harvest Yield, 2 pts) -> lifted to 2.25 lb/mo/sys
    updateKpi('bucket1', 'C6', 2.5, '2.5/mo (Resolved)');
    updateKpi('bucket1', 'C7', 2.25, '2.25 lb/mo/sys (Resolved)');
  }

  if (resolvedFlagIds.has('BUDGET_CONCERN')) {
    // Continuation or budget concern resolved:
    // A1 (Proposal Acceptance, 10 pts) -> 100% (10.0 / 10.0 pts)
    // A9 (Principal Engagement, 4 pts) -> lifted to 90% (4.0 / 4.0 pts)
    updateKpi('bucket3', 'A1', 365, 'Confirmed (Resolved)');
    updateKpi('bucket3', 'A9', 0.90, '90.0% (Resolved)');
  }

  if (resolvedFlagIds.has('MOM_DROP_10PTS')) {
    // Month-over-Month drop resolved:
    // T10 (Teacher-GST Conversation Rate, 4 pts) -> lifted to target
    // C1a (On-Time Asset Completion, 12 pts) -> lifted to 88%
    updateKpi('bucket2', 'T10', 0.90, '90.0% (Resolved)');
    updateKpi('bucket1', 'C1a', 0.88, '88.0% (Resolved)');
  }

  // Re-sum groups and buckets
  for (const bucketKey of ['bucket1', 'bucket2', 'bucket3'] as const) {
    const b = score[bucketKey];
    let bucketEarned = 0;
    for (const grp of b.groups) {
      const grpEarned = Number(
        grp.kpis.reduce((sum, k) => sum + (k.isApplicable ? k.score : 0), 0).toFixed(2)
      );
      grp.earnedPoints = grpEarned;
      grp.percentage = grp.maxPoints > 0 ? Number((grpEarned / grp.maxPoints).toFixed(4)) : 0;
      bucketEarned += grpEarned;
    }
    b.earnedPoints = Number(bucketEarned.toFixed(2));
    b.percentage = b.maxPoints > 0 ? Number((b.earnedPoints / b.maxPoints).toFixed(4)) : 0;
    const bGradeTier = getGradeAndTier(Number(((b.earnedPoints / b.maxPoints) * 100).toFixed(2)));
    b.letterGrade = bGradeTier.letterGrade;
    b.tier = bGradeTier.tier;
  }

  // Recalculate completeness rate & status
  const exp = Math.max(1, score.completeness.expectedRecords);
  const act = Math.min(exp, score.completeness.actualRecords);
  const newCompRate = Number((act / exp).toFixed(2));
  let newCompStatus: CompletenessStatus = 'Normal';
  if (newCompRate < 0.70) {
    newCompStatus = 'Incomplete';
  } else if (newCompRate < 0.85) {
    newCompStatus = 'Provisional';
  }
  score.completeness.rate = newCompRate;
  score.completeness.status = newCompStatus;

  // Recalculate overall 100-pt score, grade, and tier
  const newOverall = Number(
    (score.bucket1.earnedPoints + score.bucket2.earnedPoints + score.bucket3.earnedPoints).toFixed(2)
  );
  const { letterGrade, tier } = getGradeAndTier(newOverall);
  score.overallScore = newOverall;
  score.letterGrade = letterGrade;
  score.tier = tier;
  score.calculatedAt = new Date().toISOString();

  const scoreDelta = Number((newOverall - baselineOverall).toFixed(2));
  return { newScore: score, baselineOverall, scoreDelta, originalGrade };
}

/**
 * Registers baseline school scores/flags on first encounter and applies all saved flag resolutions
 * to return the updated schools list and flaggedReports list.
 */
export function applyFlagResolutionsToCohort(schools: SchoolWithData[]): {
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
} {
  const allResolved = getAllResolvedFlags();
  const resolvedBySchool = new Map<string, Set<FlagId>>();
  for (const r of allResolved) {
    const key = r.schoolDbn.toUpperCase();
    if (!resolvedBySchool.has(key)) {
      resolvedBySchool.set(key, new Set());
    }
    resolvedBySchool.get(key)!.add(r.flagId);
  }

  const updatedSchools: SchoolWithData[] = schools.map(item => {
    const dbnKey = item.school.dbn.toUpperCase();
    if (!baselineSchoolCache.has(dbnKey)) {
      baselineSchoolCache.set(dbnKey, {
        score: deepClone(item.score),
        flags: deepClone(item.flags),
      });
    }
    const baseline = baselineSchoolCache.get(dbnKey)!;
    const resolvedSet = resolvedBySchool.get(dbnKey) || new Set<FlagId>();

    if (resolvedSet.size === 0) {
      return {
        ...item,
        score: deepClone(baseline.score),
        flags: deepClone(baseline.flags),
      };
    }

    const { newScore } = recalculateScoreWithResolvedFlags(baseline.score, resolvedSet);
    const remainingFlags = baseline.flags.filter(f => !resolvedSet.has(f.id));

    return {
      ...item,
      score: newScore,
      flags: deepClone(remainingFlags),
    };
  });

  // Sort updatedSchools by grade desc, then score desc
  const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  updatedSchools.sort((a, b) => {
    const gradeDiff = (GRADE_ORDER[b.score.letterGrade] || 0) - (GRADE_ORDER[a.score.letterGrade] || 0);
    if (gradeDiff !== 0) return gradeDiff;
    const scoreDiff = b.score.overallScore - a.score.overallScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.school.name.localeCompare(b.school.name);
  });

  // Rebuild flaggedReports from remaining active flags
  const severityRank: Record<FlagSeverity, number> = { critical: 3, warning: 2, info: 1 };
  const flaggedReports: FlaggedSchoolReport[] = [];

  for (const item of updatedSchools) {
    if (item.flags.length === 0) continue;
    let maxWeeks = 0;
    let highestSev: FlagSeverity = 'info';
    for (const f of item.flags) {
      if (f.weeksActive > maxWeeks) maxWeeks = f.weeksActive;
      if (severityRank[f.severity] > severityRank[highestSev]) {
        highestSev = f.severity;
      }
    }
    flaggedReports.push({
      schoolDbn: item.school.dbn,
      schoolName: item.school.name,
      assignedGst: item.school.assignedGst,
      borough: item.school.borough,
      activeFlags: deepClone(item.flags),
      maxConsecutiveWeeks: maxWeeks,
      highestSeverity: highestSev,
    });
  }

  flaggedReports.sort((a, b) => {
    const sevDiff = severityRank[b.highestSeverity] - severityRank[a.highestSeverity];
    if (sevDiff !== 0) return sevDiff;
    if (b.maxConsecutiveWeeks !== a.maxConsecutiveWeeks) {
      return b.maxConsecutiveWeeks - a.maxConsecutiveWeeks;
    }
    return a.schoolDbn.localeCompare(b.schoolDbn);
  });

  return { schools: updatedSchools, flaggedReports };
}

export function getSchoolScoreResolutionSummary(schoolDbn: string): {
  hasResolved: boolean;
  baselineOverall: number;
  currentOverall: number;
  scoreDelta: number;
  originalGrade: string;
  currentGrade: string;
  resolvedRecords: ResolvedFlagRecord[];
} | null {
  const dbnKey = schoolDbn.toUpperCase();
  const baseline = baselineSchoolCache.get(dbnKey);
  const resolvedRecords = getResolvedFlagsForSchool(dbnKey);
  if (!baseline || resolvedRecords.length === 0) return null;

  const resolvedSet = new Set<FlagId>(resolvedRecords.map(r => r.flagId));
  const { newScore, baselineOverall, scoreDelta, originalGrade } = recalculateScoreWithResolvedFlags(
    baseline.score,
    resolvedSet
  );

  return {
    hasResolved: true,
    baselineOverall,
    currentOverall: newScore.overallScore,
    scoreDelta,
    originalGrade,
    currentGrade: newScore.letterGrade,
    resolvedRecords,
  };
}

/**
 * Resolves a flag for a school, logs an operational update, and returns the score gain details.
 */
export function resolveSchoolFlag(
  schoolDbn: string,
  flagId: FlagId,
  resolvedBy: string = 'NYSW Team'
): {
  oldScore: number;
  newScore: number;
  scoreGain: number;
  oldGrade: string;
  newGrade: string;
  flagTitle: string;
} | null {
  const dbnKey = schoolDbn.toUpperCase();
  const baseline = baselineSchoolCache.get(dbnKey);
  if (!baseline) return null;

  const targetFlag = baseline.flags.find(f => f.id === flagId);
  if (!targetFlag) return null;

  const all = getAllResolvedFlags();
  const existingForSchool = new Set<FlagId>(
    all.filter(r => r.schoolDbn.toUpperCase() === dbnKey).map(r => r.flagId)
  );

  const beforeCalc = recalculateScoreWithResolvedFlags(baseline.score, existingForSchool);
  existingForSchool.add(flagId);
  const afterCalc = recalculateScoreWithResolvedFlags(baseline.score, existingForSchool);

  const scoreGain = Number((afterCalc.newScore.overallScore - beforeCalc.newScore.overallScore).toFixed(2));
  const nowStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const filtered = all.filter(
    r => !(r.schoolDbn.toUpperCase() === dbnKey && r.flagId === flagId)
  );
  filtered.push({
    schoolDbn: dbnKey,
    flagId,
    flagTitle: targetFlag.title,
    resolvedAt: nowStr,
    resolvedBy,
    originalFlag: deepClone(targetFlag),
    scoreGain,
  });
  saveAllResolvedFlags(filtered);

  // Automatically record an entry in the NYSW Operational Update Log
  addLogEntry(
    dbnKey,
    `Resolved flag "${targetFlag.title}". Rubric score automatically recalculated: ${beforeCalc.newScore.overallScore.toFixed(1)} (${beforeCalc.newScore.letterGrade}) → ${afterCalc.newScore.overallScore.toFixed(1)} (${afterCalc.newScore.letterGrade}) [+${scoreGain.toFixed(1)} pts].`,
    resolvedBy,
    'Resolved'
  );

  return {
    oldScore: beforeCalc.newScore.overallScore,
    newScore: afterCalc.newScore.overallScore,
    scoreGain,
    oldGrade: beforeCalc.newScore.letterGrade,
    newGrade: afterCalc.newScore.letterGrade,
    flagTitle: targetFlag.title,
  };
}

/**
 * Reopens (un-resolves) a previously resolved flag and recalculates the school's score.
 */
export function reopenSchoolFlag(schoolDbn: string, flagId: FlagId): void {
  const dbnKey = schoolDbn.toUpperCase();
  const all = getAllResolvedFlags();
  const target = all.find(r => r.schoolDbn.toUpperCase() === dbnKey && r.flagId === flagId);
  const filtered = all.filter(
    r => !(r.schoolDbn.toUpperCase() === dbnKey && r.flagId === flagId)
  );
  saveAllResolvedFlags(filtered);

  if (target) {
    addLogEntry(
      dbnKey,
      `Reopened flag "${target.flagTitle}". School score reverted to reflect active flag.`,
      'NYSW Team',
      'In Progress'
    );
  }
}

export function clearBaselineCache(): void {
  baselineSchoolCache.clear();
}
