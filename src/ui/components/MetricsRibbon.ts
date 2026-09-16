import type { SchoolWithData } from '../../pipeline/generator.ts';
import type { FlaggedSchoolReport } from '../../types/flags.ts';

export function renderMetricsRibbon(
  schools: SchoolWithData[],
  flaggedReports: FlaggedSchoolReport[]
): string {
  const totalSchools = schools.length;
  const avgScore = Number(
    (schools.reduce((acc, s) => acc + s.score.overallScore, 0) / totalSchools).toFixed(1)
  );

  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  schools.forEach(s => {
    gradeCounts[s.score.letterGrade] = (gradeCounts[s.score.letterGrade] || 0) + 1;
  });

  const pctA = Math.round((gradeCounts.A / totalSchools) * 100);
  const pctB = Math.round((gradeCounts.B / totalSchools) * 100);
  const pctC = Math.round((gradeCounts.C / totalSchools) * 100);
  const pctD = Math.round((gradeCounts.D / totalSchools) * 100);
  const pctF = Math.round((gradeCounts.F / totalSchools) * 100);

  // Bucket Averages
  const avgB1 = Number(
    (schools.reduce((acc, s) => acc + s.score.bucket1.earnedPoints, 0) / totalSchools).toFixed(1)
  );
  const avgB2 = Number(
    (schools.reduce((acc, s) => acc + s.score.bucket2.earnedPoints, 0) / totalSchools).toFixed(1)
  );
  const avgB3 = Number(
    (schools.reduce((acc, s) => acc + s.score.bucket3.earnedPoints, 0) / totalSchools).toFixed(1)
  );

  return `
    <div class="metrics-ribbon">
      <div class="metric-card">
        <div class="metric-card-header">
          <span>Active Partner Cohort</span>
          <span>🏫</span>
        </div>
        <div class="metric-card-value">${totalSchools}</div>
        <div class="metric-card-sub">Schools across 5 NYC Boroughs (Scaling to 370+)</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-header">
          <span>Network Mean Score</span>
          <span>📊</span>
        </div>
        <div class="metric-card-value">${avgScore} <span style="font-size: 1rem; font-weight: 500; color: var(--text-muted);">/ 100</span></div>
        <div class="metric-card-sub">B1: ${avgB1}/42 · B2: ${avgB2}/40 · B3: ${avgB3}/18</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-header">
          <span>Grade Band Distribution</span>
          <span>🎯</span>
        </div>
        <div class="metric-card-value" style="font-size: 1.35rem; display: flex; gap: 0.5rem; align-items: baseline;">
          <span style="color: var(--tier-thriving);">A: ${gradeCounts.A}</span>
          <span style="color: var(--tier-healthy);">B: ${gradeCounts.B}</span>
          <span style="color: var(--tier-watch);">C: ${gradeCounts.C}</span>
          <span style="color: var(--tier-intervene);">D: ${gradeCounts.D}</span>
          <span style="color: var(--tier-risk);">F: ${gradeCounts.F}</span>
        </div>
        <div class="grade-dist-bar" title="A: ${pctA}%, B: ${pctB}%, C: ${pctC}%, D: ${pctD}%, F: ${pctF}%">
          <div class="grade-dist-segment seg-a" style="width: ${pctA}%;"></div>
          <div class="grade-dist-segment seg-b" style="width: ${pctB}%;"></div>
          <div class="grade-dist-segment seg-c" style="width: ${pctC}%;"></div>
          <div class="grade-dist-segment seg-d" style="width: ${pctD}%;"></div>
          <div class="grade-dist-segment seg-f" style="width: ${pctF}%;"></div>
        </div>
      </div>

      <div class="metric-card" style="border-left: 4px solid var(--tier-risk);">
        <div class="metric-card-header">
          <span>Early-Warning Flagged</span>
          <span>🚨</span>
        </div>
        <div class="metric-card-value" style="color: var(--tier-risk);">${flaggedReports.length}</div>
        <div class="metric-card-sub">Schools requiring immediate field or admin attention</div>
      </div>
    </div>
  `;
}
