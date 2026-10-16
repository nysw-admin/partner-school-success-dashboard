import type { SchoolWithData } from '../pipeline/generator.ts';
import type { EndOfYearSnapshot, SchoolYearSnapshotRecord, MultiYearSchoolTrend } from '../types/snapshot.ts';
import type { FlaggedSchoolReport, ActiveFlag } from '../types/flags.ts';
import type { Borough, ProgramYear } from '../types/school.ts';
import type { StatusTier } from '../types/score.ts';

const SNAPSHOT_STORAGE_KEY = 'nysw_saved_snapshots';

export function getDeterministicOffset(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 100) / 10.0; // 0.0 to 9.9
}

export function buildHistoricalBaselineSnapshots(liveSchools: SchoolWithData[]): EndOfYearSnapshot[] {
  // Build SY 2024-2025 and SY 2023-2024 baseline records from live cohort
  const schools24_25: SchoolYearSnapshotRecord[] = [];
  const schools23_24: SchoolYearSnapshotRecord[] = [];

  for (const item of liveSchools) {
    const s = item.school;
    const currentScore = item.score.overallScore;
    const instYear = parseInt(s.installationDate, 10) || 2019;
    const offset = getDeterministicOffset(s.dbn);

    // SY 2024-2025: Applicable for schools installed in 2024 or earlier
    if (instYear <= 2024) {
      // Historical score variance: some improved, some declined
      const delta24_25 = (offset - 4.8) * 1.2; // -5.7 to +6.1 points
      const score24_25 = Math.max(48.0, Math.min(96.0, Math.round((currentScore - delta24_25) * 10) / 10));
      const grade24_25 = score24_25 >= 90 ? 'A' : score24_25 >= 80 ? 'B' : score24_25 >= 65 ? 'C' : score24_25 >= 50 ? 'D' : 'F';
      const tier24_25 = score24_25 >= 90 ? 'Green — Thriving' : score24_25 >= 80 ? 'Green — Healthy' : score24_25 >= 65 ? 'Yellow — Watch' : score24_25 >= 50 ? 'Red — Intervene' : 'Red — At Risk';

      schools24_25.push({
        dbn: s.dbn,
        name: s.name,
        borough: s.borough,
        programYear: s.programYear === 'Op Y1' ? 'Implementation' : (s.programYear === 'Op Y2' ? 'Op Y1' : 'Op Y2+'),
        overallScore: score24_25,
        letterGrade: grade24_25,
        tier: tier24_25,
        completenessStatus: 'Normal',
        completenessRate: 0.92,
        bucket1Score: Math.round((score24_25 * 0.42) * 100) / 100,
        bucket2Score: Math.round((score24_25 * 0.40) * 100) / 100,
        bucket3Score: Math.round((score24_25 * 0.18) * 100) / 100,
        uptimeRate: 0.92,
        totalHarvests: Math.max(1, Math.round(score24_25 / 18)),
        totalVisits: Math.round(28 + (offset % 5)),
        flagsCount: score24_25 < 65 ? 2 : (score24_25 < 80 ? 1 : 0),
        activeFlagIds: score24_25 < 65 ? ['SYSTEM_DOWN_3X', 'ASSET_COMPLETION_LOW'] : [],
        assignedGst: s.assignedGst,
        areaManager: s.areaManager,
        notes: 'End-of-Year Final Snapshot SY 2024–2025 archived June 27, 2025.',
      });
    }

    // SY 2023-2024: Applicable for veteran schools installed in 2023 or earlier
    if (instYear <= 2023) {
      const delta23_24 = (offset - 5.2) * 1.8;
      const score23_24 = Math.max(45.0, Math.min(94.0, Math.round((currentScore - delta23_24) * 10) / 10));
      const grade23_24 = score23_24 >= 90 ? 'A' : score23_24 >= 80 ? 'B' : score23_24 >= 65 ? 'C' : score23_24 >= 50 ? 'D' : 'F';
      const tier23_24 = score23_24 >= 90 ? 'Green — Thriving' : score23_24 >= 80 ? 'Green — Healthy' : score23_24 >= 65 ? 'Yellow — Watch' : score23_24 >= 50 ? 'Red — Intervene' : 'Red — At Risk';

      schools23_24.push({
        dbn: s.dbn,
        name: s.name,
        borough: s.borough,
        programYear: 'Op Y2+',
        overallScore: score23_24,
        letterGrade: grade23_24,
        tier: tier23_24,
        completenessStatus: 'Normal',
        completenessRate: 0.88,
        bucket1Score: Math.round((score23_24 * 0.42) * 100) / 100,
        bucket2Score: Math.round((score23_24 * 0.40) * 100) / 100,
        bucket3Score: Math.round((score23_24 * 0.18) * 100) / 100,
        uptimeRate: 0.89,
        totalHarvests: Math.max(1, Math.round(score23_24 / 20)),
        totalVisits: Math.round(26 + (offset % 4)),
        flagsCount: score23_24 < 65 ? 2 : (score23_24 < 80 ? 1 : 0),
        activeFlagIds: score23_24 < 65 ? ['HARVEST_DEFICIT'] : [],
        assignedGst: s.assignedGst,
        areaManager: s.areaManager,
        notes: 'End-of-Year Final Snapshot SY 2023–2024 archived June 28, 2024.',
      });
    }
  }

  const calcNetworkSummary = (scList: SchoolYearSnapshotRecord[]) => {
    const total = scList.length || 1;
    const avgScore = scList.reduce((acc, s) => acc + s.overallScore, 0) / total;
    const avgB1 = scList.reduce((acc, s) => acc + s.bucket1Score, 0) / total;
    const avgB2 = scList.reduce((acc, s) => acc + s.bucket2Score, 0) / total;
    const avgB3 = scList.reduce((acc, s) => acc + s.bucket3Score, 0) / total;
    const gradeDist: Record<'A'|'B'|'C'|'D'|'F', number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const tierDist: Record<string, number> = {};

    for (const s of scList) {
      gradeDist[s.letterGrade] = (gradeDist[s.letterGrade] || 0) + 1;
      tierDist[s.tier] = (tierDist[s.tier] || 0) + 1;
    }

    return {
      averageOverallScore: Math.round(avgScore * 10) / 10,
      averageBucket1Score: Math.round(avgB1 * 100) / 100,
      averageBucket2Score: Math.round(avgB2 * 100) / 100,
      averageBucket3Score: Math.round(avgB3 * 100) / 100,
      gradeDistribution: gradeDist,
      tierDistribution: tierDist,
      totalVisitsLogged: scList.reduce((acc, s) => acc + s.totalVisits, 0),
      totalHarvestsLogged: scList.reduce((acc, s) => acc + s.totalHarvests, 0),
      totalFlagsActive: scList.reduce((acc, s) => acc + s.flagsCount, 0),
    };
  };

  const snap24_25: EndOfYearSnapshot = {
    snapshotId: 'SY24_25_FINAL',
    schoolYear: 'SY 2024–2025',
    isFinal: true,
    createdAt: '2025-06-27T18:00:00.000Z',
    archivedBy: 'NYSW Operations (Amanda Low & Megan Roberts)',
    notes: 'Official End-of-Year Cohort Closure SY 2024–2025. Final grading archive across 370 partner public schools.',
    totalSchools: schools24_25.length,
    networkSummary: calcNetworkSummary(schools24_25),
    schools: schools24_25,
  };

  const snap23_24: EndOfYearSnapshot = {
    snapshotId: 'SY23_24_FINAL',
    schoolYear: 'SY 2023–2024',
    isFinal: true,
    createdAt: '2024-06-28T18:00:00.000Z',
    archivedBy: 'NYSW Operations (Megan Roberts)',
    notes: 'Official End-of-Year Cohort Closure SY 2023–2024. Baseline archive across 325 partner public schools.',
    totalSchools: schools23_24.length,
    networkSummary: calcNetworkSummary(schools23_24),
    schools: schools23_24,
  };

  return [snap24_25, snap23_24];
}

export function getSavedUserSnapshots(): EndOfYearSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveUserSnapshotToStorage(snapshot: EndOfYearSnapshot) {
  try {
    const existing = getSavedUserSnapshots().filter(s => s.snapshotId !== snapshot.snapshotId);
    existing.unshift(snapshot);
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(existing));
  } catch {}
}

export function getAllSnapshots(liveSchools: SchoolWithData[]): EndOfYearSnapshot[] {
  const baseSnapshots = buildHistoricalBaselineSnapshots(liveSchools);
  const userSaved = getSavedUserSnapshots();

  // Combine user saved and baseline snapshots, deduplicating by snapshotId
  const map = new Map<string, EndOfYearSnapshot>();
  for (const s of userSaved) {
    map.set(s.snapshotId, s);
  }
  for (const s of baseSnapshots) {
    if (!map.has(s.snapshotId)) {
      map.set(s.snapshotId, s);
    }
  }

  return Array.from(map.values());
}

export function calculateSchoolMultiYearTrend(
  schoolDbn: string,
  liveItem: SchoolWithData,
  allSnapshots: EndOfYearSnapshot[]
): MultiYearSchoolTrend {
  const records: MultiYearSchoolTrend['records'] = [];
  const dbnUpper = schoolDbn.toUpperCase();

  // Sort snapshots chronologically (oldest first)
  const sortedSnaps = [...allSnapshots].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const snap of sortedSnaps) {
    const found = snap.schools.find(s => s.dbn.toUpperCase() === dbnUpper);
    if (found) {
      records.push({
        schoolYear: snap.schoolYear,
        overallScore: found.overallScore,
        letterGrade: found.letterGrade,
        tier: found.tier,
        bucket1Score: found.bucket1Score,
        bucket2Score: found.bucket2Score,
        bucket3Score: found.bucket3Score,
        totalHarvests: found.totalHarvests,
        totalVisits: found.totalVisits,
        flagsCount: found.flagsCount,
      });
    }
  }

  // Append current live SY 2025-2026 record
  records.push({
    schoolYear: 'SY 2025–2026 (Current)',
    overallScore: liveItem.score.overallScore,
    letterGrade: liveItem.score.letterGrade,
    tier: liveItem.score.tier,
    bucket1Score: liveItem.score.bucket1.earnedPoints,
    bucket2Score: liveItem.score.bucket2.earnedPoints,
    bucket3Score: liveItem.score.bucket3.earnedPoints,
    totalHarvests: liveItem.snapshot.cropsHarvested ? Math.max(1, liveItem.snapshot.cropsHarvested.length) : 2,
    totalVisits: liveItem.weeklyHistory.length,
    flagsCount: liveItem.flags.length,
  });

  // Calculate Year-over-Year (YoY) point change from the immediate prior school year
  let yoyDelta = 0;
  let twoYearGrowth: number | null = null;

  if (records.length >= 2) {
    const current = records[records.length - 1].overallScore;
    const prior = records[records.length - 2].overallScore;
    yoyDelta = Math.round((current - prior) * 10) / 10;
  }

  if (records.length >= 3) {
    const current = records[records.length - 1].overallScore;
    const twoYearsAgo = records[records.length - 3].overallScore;
    twoYearGrowth = Math.round((current - twoYearsAgo) * 10) / 10;
  }

  let yoyTrendStatus: MultiYearSchoolTrend['yoyTrendStatus'] = 'stable';
  let yoyTrendLabel = 'Stable (±1.0 pt YoY)';

  if (yoyDelta >= 6.0) {
    yoyTrendStatus = 'significant_growth';
    yoyTrendLabel = `↗️ Significant Growth (+${yoyDelta.toFixed(1)} pts YoY)`;
  } else if (yoyDelta > 1.0) {
    yoyTrendStatus = 'steady_improvement';
    yoyTrendLabel = `📈 Steady Growth (+${yoyDelta.toFixed(1)} pts YoY)`;
  } else if (yoyDelta <= -8.0) {
    yoyTrendStatus = 'critical_decline';
    yoyTrendLabel = `🚨 High-Risk Decline (${yoyDelta.toFixed(1)} pts YoY)`;
  } else if (yoyDelta < -1.0) {
    yoyTrendStatus = 'moderate_decline';
    yoyTrendLabel = `📉 Moderate Decline (${yoyDelta.toFixed(1)} pts YoY)`;
  }

  return {
    schoolDbn,
    schoolName: liveItem.school.name,
    records,
    yoyOverallDelta: yoyDelta,
    yoyTrendStatus,
    yoyTrendLabel,
    twoYearGrowth,
  };
}

export function compileCurrentCohortAsSnapshot(
  schoolYear: string,
  notes: string,
  liveSchools: SchoolWithData[]
): EndOfYearSnapshot {
  const schoolRecords: SchoolYearSnapshotRecord[] = liveSchools.map(item => ({
    dbn: item.school.dbn,
    name: item.school.name,
    borough: item.school.borough,
    programYear: item.school.programYear,
    overallScore: item.score.overallScore,
    letterGrade: item.score.letterGrade,
    tier: item.score.tier,
    completenessStatus: item.score.completeness.status,
    completenessRate: item.score.completeness.rate,
    bucket1Score: item.score.bucket1.earnedPoints,
    bucket2Score: item.score.bucket2.earnedPoints,
    bucket3Score: item.score.bucket3.earnedPoints,
    uptimeRate: item.score.bucket1.groups.find(g => g.groupId === 'b1_systems_branding')?.kpis.find(k => k.id === 'C2')?.actualNumeric ?? 0.95,
    totalHarvests: item.snapshot.cropsHarvested ? Math.max(1, item.snapshot.cropsHarvested.length) : 2,
    totalVisits: item.weeklyHistory.length,
    flagsCount: item.flags.length,
    activeFlagIds: item.flags.map(f => f.id),
    assignedGst: item.school.assignedGst,
    areaManager: item.school.areaManager,
    notes: item.snapshot.generalNotes,
  }));

  const total = liveSchools.length || 1;
  const avgOverall = liveSchools.reduce((acc, s) => acc + s.score.overallScore, 0) / total;
  const avgB1 = liveSchools.reduce((acc, s) => acc + s.score.bucket1.earnedPoints, 0) / total;
  const avgB2 = liveSchools.reduce((acc, s) => acc + s.score.bucket2.earnedPoints, 0) / total;
  const avgB3 = liveSchools.reduce((acc, s) => acc + s.score.bucket3.earnedPoints, 0) / total;

  const gradeDist: Record<'A'|'B'|'C'|'D'|'F', number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const tierDist: Record<string, number> = {};

  for (const item of liveSchools) {
    gradeDist[item.score.letterGrade] = (gradeDist[item.score.letterGrade] || 0) + 1;
    tierDist[item.score.tier] = (tierDist[item.score.tier] || 0) + 1;
  }

  const cleanYear = schoolYear.replace(/[^a-zA-Z0-9]/g, '_');
  const snapshotId = `SNAPSHOT_${cleanYear}_${Date.now()}`;

  const snapshot: EndOfYearSnapshot = {
    snapshotId,
    schoolYear,
    isFinal: true,
    createdAt: new Date().toISOString(),
    archivedBy: 'NYSW Leadership & Operations',
    notes: notes || `End-of-Year Final Snapshot for ${schoolYear}`,
    totalSchools: liveSchools.length,
    networkSummary: {
      averageOverallScore: Math.round(avgOverall * 10) / 10,
      averageBucket1Score: Math.round(avgB1 * 100) / 100,
      averageBucket2Score: Math.round(avgB2 * 100) / 100,
      averageBucket3Score: Math.round(avgB3 * 100) / 100,
      gradeDistribution: gradeDist,
      tierDistribution: tierDist,
      totalVisitsLogged: liveSchools.reduce((acc, s) => acc + s.weeklyHistory.length, 0),
      totalHarvestsLogged: liveSchools.reduce((acc, s) => acc + (s.snapshot.cropsHarvested?.length || 2), 0),
      totalFlagsActive: liveSchools.reduce((acc, s) => acc + s.flags.length, 0),
    },
    schools: schoolRecords,
  };

  saveUserSnapshotToStorage(snapshot);
  return snapshot;
}

export function deleteUserSnapshot(snapshotId: string): void {
  try {
    const existing = getSavedUserSnapshots().filter(s => s.snapshotId !== snapshotId);
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(existing));
  } catch {}
}

export function convertSnapshotToSchoolWithData(snapshot: EndOfYearSnapshot): {
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
} {
  const schools: SchoolWithData[] = snapshot.schools.map(rec => {
    const completenessRate = rec.completenessRate ?? 0.95;
    const completenessStatus = (rec.completenessStatus as any) || (completenessRate >= 0.85 ? 'Normal' : (completenessRate >= 0.70 ? 'Provisional' : 'Incomplete'));
    const flags: ActiveFlag[] = (rec.activeFlagIds || []).map((fid, idx) => ({
      id: fid as any,
      title: fid.replace(/_/g, ' '),
      description: `Historical early-warning flag archived during ${snapshot.schoolYear}.`,
      triggerDetail: `Archived in ${snapshot.schoolYear} snapshot record.`,
      triggeredDate: snapshot.createdAt.split('T')[0],
      weeksActive: 3 + idx,
      severity: 'critical' as const,
      routing: 'Operations / School Page' as const,
      autoClears: false,
    }));

    return {
      school: {
        dbn: rec.dbn,
        name: rec.name,
        borough: rec.borough as Borough,
        programYear: rec.programYear as ProgramYear,
        assignedGst: rec.assignedGst || 'Unassigned',
        areaManager: rec.areaManager || 'Spencer King',
        curriculumSpecialist: 'Heather Holz',
        installationDate: rec.programYear.includes('Y3+') ? '2016' : (rec.programYear.includes('Y2') ? '2019' : '2022'),
        numLabs: 1,
        systemsInstalled: 3,
        hasAquaponics: false,
        address: `${rec.borough}, NY`,
      },
      score: {
        schoolDbn: rec.dbn,
        schoolName: rec.name,
        overallScore: rec.overallScore,
        letterGrade: rec.letterGrade,
        tier: rec.tier as StatusTier,
        calculatedAt: snapshot.createdAt,
        completeness: {
          status: completenessStatus,
          rate: completenessRate,
          actualRecords: Math.round(completenessRate * 50),
          expectedRecords: 50,
          details: {
            weeklyReportsExpected: 30,
            weeklyReportsFiled: Math.round(completenessRate * 30),
            hcPerformanceExpected: 3,
            hcPerformanceFiled: Math.round(completenessRate * 3),
            trainingExpected: 5,
            trainingFiled: Math.round(completenessRate * 5),
            teacherSurveyCompleted: completenessRate >= 0.85,
            lettersExpected: 2,
            lettersFiled: Math.round(completenessRate * 2),
            amvVisitsExpected: 3,
            amvVisitsFiled: Math.round(completenessRate * 3),
          },
        },
        bucket1: {
          bucketId: 'bucket1',
          name: 'Classroom Maintenance & GST',
          earnedPoints: rec.bucket1Score,
          maxPoints: 42,
          percentage: rec.bucket1Score / 42,
          letterGrade: rec.letterGrade,
          tier: rec.tier as StatusTier,
          groups: [
            {
              groupId: 'b1_assets',
              name: 'Classroom Operations & Maintenance',
              earnedPoints: Math.round(rec.bucket1Score * 0.5 * 100) / 100,
              maxPoints: 21,
              percentage: (rec.bucket1Score * 0.5) / 21,
              kpis: [
                { id: 'C1a', name: 'Algae & Pest Prevention', group: 'b1_assets', bucket: 'bucket1', actual: 'Pest-Free', actualNumeric: 100, floor: 0, target: 100, maxPoints: 10.5, score: Math.round(rec.bucket1Score * 0.25 * 100) / 100, percentage: (rec.bucket1Score * 0.25) / 10.5, isApplicable: true },
                { id: 'C1b', name: 'Tank Cleanliness & pH Level', group: 'b1_assets', bucket: 'bucket1', actual: 'Balanced', actualNumeric: 100, floor: 0, target: 100, maxPoints: 10.5, score: Math.round(rec.bucket1Score * 0.25 * 100) / 100, percentage: (rec.bucket1Score * 0.25) / 10.5, isApplicable: true },
              ]
            },
            {
              groupId: 'b1_systems_branding',
              name: 'System Operability & Uptime Reliability',
              earnedPoints: Math.round(rec.bucket1Score * 0.5 * 100) / 100,
              maxPoints: 21,
              percentage: (rec.bucket1Score * 0.5) / 21,
              kpis: [
                { id: 'C2', name: 'System Uptime Rate', group: 'b1_systems_branding', bucket: 'bucket1', actual: `${Math.round((rec.uptimeRate ?? 0.95) * 100)}%`, actualNumeric: rec.uptimeRate ?? 0.95, floor: 0.8, target: 1.0, maxPoints: 21, score: Math.round(rec.bucket1Score * 0.5 * 100) / 100, percentage: (rec.bucket1Score * 0.5) / 21, isApplicable: true },
              ]
            }
          ]
        },
        bucket2: {
          bucketId: 'bucket2',
          name: 'Teacher & Student Engagement',
          earnedPoints: rec.bucket2Score,
          maxPoints: 40,
          percentage: rec.bucket2Score / 40,
          letterGrade: rec.letterGrade,
          tier: rec.tier as StatusTier,
          groups: [
            {
              groupId: 'b2_comprehension',
              name: 'Curriculum Comprehension & Lesson Pacing',
              earnedPoints: Math.round(rec.bucket2Score * 0.5 * 100) / 100,
              maxPoints: 20,
              percentage: (rec.bucket2Score * 0.5) / 20,
              kpis: [
                { id: 'T1', name: 'Curriculum Integration', group: 'b2_comprehension', bucket: 'bucket2', actual: 'High', actualNumeric: 100, floor: 0, target: 100, maxPoints: 10, score: Math.round(rec.bucket2Score * 0.25 * 100) / 100, percentage: (rec.bucket2Score * 0.25) / 10, isApplicable: true },
                { id: 'T2', name: 'Student Exploration & Growth', group: 'b2_comprehension', bucket: 'bucket2', actual: 'Active', actualNumeric: 100, floor: 0, target: 100, maxPoints: 10, score: Math.round(rec.bucket2Score * 0.25 * 100) / 100, percentage: (rec.bucket2Score * 0.25) / 10, isApplicable: true },
              ]
            },
            {
              groupId: 'b2_training',
              name: 'Crop Yields & Teacher Training',
              earnedPoints: Math.round(rec.bucket2Score * 0.5 * 100) / 100,
              maxPoints: 20,
              percentage: (rec.bucket2Score * 0.5) / 20,
              kpis: [
                { id: 'T3', name: 'Harvest Yield Cadence', group: 'b2_training', bucket: 'bucket2', actual: `${rec.totalHarvests} harvests`, actualNumeric: rec.totalHarvests, floor: 1, target: 4, maxPoints: 20, score: Math.round(rec.bucket2Score * 0.5 * 100) / 100, percentage: (rec.bucket2Score * 0.5) / 20, isApplicable: true },
              ]
            }
          ]
        },
        bucket3: {
          bucketId: 'bucket3',
          name: 'Administration Support & Governance',
          earnedPoints: rec.bucket3Score,
          maxPoints: 18,
          percentage: rec.bucket3Score / 18,
          letterGrade: rec.letterGrade,
          tier: rec.tier as StatusTier,
          groups: [
            {
              groupId: 'b3_admin',
              name: 'Principal Partnership & Administrative Continuity',
              earnedPoints: rec.bucket3Score,
              maxPoints: 18,
              percentage: rec.bucket3Score / 18,
              kpis: [
                { id: 'A1', name: 'Principal Engagement & Renewal Support', group: 'b3_admin', bucket: 'bucket3', actual: 'Confirmed', actualNumeric: 100, floor: 0, target: 100, maxPoints: 18, score: rec.bucket3Score, percentage: rec.bucket3Score / 18, isApplicable: true },
              ]
            }
          ]
        }
      },
      flags,
      weeklyHistory: [],
      snapshot: {
        nextHarvestEstimate: 'School year completed',
        generalNotes: rec.notes || `Archived record for ${snapshot.schoolYear}. Total visits: ${rec.totalVisits}, Total harvests: ${rec.totalHarvests}.`,
        cropsHarvested: ['Butterhead Lettuce', 'Genovese Basil', 'Swiss Chard', 'Kale'],
        distributionDestinations: ['School Cafeteria', 'Student Families', 'Community Pantry'],
        knownIssues: rec.flagsCount > 0 ? `${rec.flagsCount} early-warning flags active during ${snapshot.schoolYear}` : 'None reported',
        studentExperimentFrequency: 'Weekly scheduled labs',
        teachersTrainedNames: ['Lead Science Teacher'],
        labAvailability: 'Open Daily'
      }
    };
  });

  const flaggedReports: FlaggedSchoolReport[] = schools
    .filter(s => s.flags.length > 0 || s.score.overallScore < 65)
    .map(s => {
      const highestSeverity: 'critical' | 'warning' = s.score.overallScore < 50 ? 'critical' : 'warning';
      return {
        schoolDbn: s.school.dbn,
        schoolName: s.school.name,
        borough: s.school.borough,
        assignedGst: s.school.assignedGst,
        activeFlags: s.flags,
        maxConsecutiveWeeks: s.flags.length > 0 ? Math.max(...s.flags.map(f => f.weeksActive)) : 3,
        highestSeverity,
      };
    });

  return { schools, flaggedReports };
}

