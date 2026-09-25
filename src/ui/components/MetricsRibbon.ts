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
        <div class="metric-card-value">${totalSchools} <span style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">schools</span></div>
        <div class="metric-card-sub">Across 5 NYC Boroughs · Network Mean: <strong>${avgScore}/100</strong></div>
      </div>

      <div class="metric-card bucket-key-card">
        <div class="metric-card-header">
          <span>Bucket Key (100 Pts)</span>
          <span>🔑</span>
        </div>
        <div class="bucket-key-items">
          <div class="bucket-key-row" title="Bucket 1: 42 Max Points. Evaluates GST weekly maintenance visits, hydroponic systems care, harvest yields, and lab readiness. (Network Avg: ${avgB1}/42 pts)">
            <span class="bucket-key-tag b1-tag">B1</span>
            <div class="bucket-key-details">
              <div class="bucket-key-line">
                <span class="bucket-key-name">Classroom Maintenance & GST</span>
                <span class="bucket-key-pts">42 pts</span>
              </div>
              <div class="bucket-key-desc">Hydroponic systems, visits & harvests</div>
            </div>
          </div>

          <div class="bucket-key-row" title="Bucket 2: 40 Max Points. Evaluates teacher professional development, portal logins, classroom lessons, and student science comprehension. (Network Avg: ${avgB2}/40 pts)">
            <span class="bucket-key-tag b2-tag">B2</span>
            <div class="bucket-key-details">
              <div class="bucket-key-line">
                <span class="bucket-key-name">Teacher & Student Engagement</span>
                <span class="bucket-key-pts">40 pts</span>
              </div>
              <div class="bucket-key-desc">PD training, portal logins & STEM lessons</div>
            </div>
          </div>

          <div class="bucket-key-row" title="Bucket 3: 18 Max Points. Evaluates administration support, principal check-ins, maintenance agreements & long-term sustainability. (Network Avg: ${avgB3}/18 pts)">
            <span class="bucket-key-tag b3-tag">B3</span>
            <div class="bucket-key-details">
              <div class="bucket-key-line">
                <span class="bucket-key-name">Administration Support</span>
                <span class="bucket-key-pts">18 pts</span>
              </div>
              <div class="bucket-key-desc">Principal check-ins & sustainability</div>
            </div>
          </div>
        </div>
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
