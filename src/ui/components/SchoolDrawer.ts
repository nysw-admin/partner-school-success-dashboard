import type { SchoolWithData } from '../../pipeline/generator.ts';
import type { GroupScore } from '../../types/score.ts';
import type { EndOfYearSnapshot, MultiYearSchoolTrend } from '../../types/snapshot.ts';
import { calculateSchoolMultiYearTrend, getAllSnapshots } from '../../services/snapshotService.ts';
import { renderSchoolLogSection } from './FlaggedWatchlist.ts';

export function renderSchoolDrawer(item: SchoolWithData, allSnapshots?: EndOfYearSnapshot[]): string {
  const { school, score, flags, snapshot } = item;
  const gradeClass = `badge-${score.letterGrade.toLowerCase()}`;
  const snapshotsList = allSnapshots || getAllSnapshots([item]);
  const trend = calculateSchoolMultiYearTrend(school.dbn, item, snapshotsList);

  return `
    <div id="school-modal-overlay" class="modal-overlay">
      <div class="modal-drawer">
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="drawer-header-left">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <h2>${escapeHtml(school.name)}</h2>
              <code style="background: var(--bg-card-alt); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.9rem;">${school.dbn}</code>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              ${school.borough} · ${school.programYear} · Installed ${school.installationDate} · Assigned GST: <strong>${school.assignedGst}</strong> · Ed Team: <strong>${school.curriculumSpecialist || 'Heather Holz'}</strong>
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button class="ai-generate-report-btn" data-dbn="${school.dbn}" title="Generate AI status report and Q&A">
              <span>✨</span> Generate AI Executive Report
            </button>
            <button id="close-modal-btn" class="close-btn" title="Close Drawer">✕</button>
          </div>
        </div>

        <!-- Drawer Body -->
        <div class="drawer-body">
          <!-- Overall Summary Score Banner -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; gap: 1.25rem;">
              <div class="grade-badge ${gradeClass}" style="width: 54px; height: 54px; font-size: 1.75rem;">
                ${score.letterGrade}
              </div>
              <div>
                <div style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; line-height: 1;">
                  ${score.overallScore.toFixed(1)} <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: 500;">/ 100</span>
                </div>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-top: 0.2rem;">
                  Tier: <span style="color: var(--text-main);">${score.tier}</span>
                </div>
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Completeness Gate</div>
              <div>
                ${score.completeness.status === 'Normal'
                  ? `<span class="status-pill pill-healthy">✓ Gate Cleared (${(score.completeness.rate * 100).toFixed(0)}%)</span>`
                  : score.completeness.status === 'Provisional'
                  ? `<span class="status-pill pill-provisional">⚠️ Provisional (${(score.completeness.rate * 100).toFixed(0)}%)</span>`
                  : `<span class="status-pill pill-incomplete">🛑 Incomplete Data (${(score.completeness.rate * 100).toFixed(0)}%)</span>`
                }
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
                ${score.completeness.actualRecords} / ${score.completeness.expectedRecords} required records filed
              </div>
            </div>
          </div>

          <!-- Multi-Year Longitudinal Performance Trajectory (YoY) -->
          ${renderMultiYearTrendSection(trend)}

          <!-- Active Early-Warning Flags (if any) -->
          ${flags.length > 0 ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-lg); padding: 1.25rem;">
              <h4 style="font-family: var(--font-heading); color: #991b1b; font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🚨</span> Active Early-Warning Flags (${flags.length})
              </h4>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${flags.map(f => `
                  <div style="background: #ffffff; border: 1px solid #fed7aa; border-radius: var(--radius-md); padding: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: 700; font-size: 0.85rem; color: #9a3412;">${f.title} (${f.weeksActive}w active)</span>
                      <span class="meta-pill" style="background:#ffedd5; color:#c2410c; border:none; font-size:0.7rem;">Action: ${f.routing}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${f.description}</div>
                    <div style="font-size: 0.75rem; font-weight: 500; color: #78350f; margin-top: 0.25rem;">Trigger: ${f.triggerDetail}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- BUCKET 1: Classroom Maintenance & GST (42 pts) -->
          <div class="rubric-section-card">
            <div class="rubric-section-header">
              <div>
                <h3>Bucket 1: Classroom Maintenance & GST</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Is the lab operational, clean, productive, and serviced?</p>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800;">
                  ${score.bucket1.earnedPoints.toFixed(2)} <span style="font-size: 0.85rem; color: var(--text-muted);">/ 42.00</span>
                </span>
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--tier-thriving);">${score.bucket1.tier.split('—')[1]}</div>
              </div>
            </div>
            ${score.bucket1.groups.map(g => renderGroupBlock(g)).join('')}
          </div>

          <!-- BUCKET 2: Teacher & Student Engagement (40 pts) -->
          <div class="rubric-section-card">
            <div class="rubric-section-header">
              <div>
                <h3>Bucket 2: Teacher & Student Engagement</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Are teachers utilizing curriculum, attending training, and cultivating students?</p>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800;">
                  ${score.bucket2.earnedPoints.toFixed(2)} <span style="font-size: 0.85rem; color: var(--text-muted);">/ 40.00</span>
                </span>
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--accent-cyan);">${score.bucket2.tier.split('—')[1]}</div>
              </div>
            </div>
            ${score.bucket2.groups.map(g => renderGroupBlock(g)).join('')}
          </div>

          <!-- BUCKET 3: Administration Support (18 pts) -->
          <div class="rubric-section-card">
            <div class="rubric-section-header">
              <div>
                <h3>Bucket 3: Administration Support</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Are contracts signed, letters returned, and school leaders involved?</p>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800;">
                  ${score.bucket3.earnedPoints.toFixed(2)} <span style="font-size: 0.85rem; color: var(--text-muted);">/ 18.00</span>
                </span>
                <div style="font-size: 0.75rem; font-weight: 600; color: #8b5cf6;">${score.bucket3.tier.split('—')[1]}</div>
              </div>
            </div>
            ${score.bucket3.groups.map(g => renderGroupBlock(g)).join('')}
          </div>

          <!-- Profile / Snapshot Context (Not Graded) -->
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem;">
            <h4 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>🌱</span> Classroom Profile & Agricultural Snapshot
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; font-size: 0.85rem;">
              <div>
                <strong style="color: var(--text-muted);">Next Estimated Harvest:</strong>
                <div>${snapshot.nextHarvestEstimate}</div>
              </div>
              <div>
                <strong style="color: var(--text-muted);">Crops Cultivated:</strong>
                <div>${snapshot.cropsHarvested.join(', ')}</div>
              </div>
              <div>
                <strong style="color: var(--text-muted);">Distribution Channels:</strong>
                <div>${snapshot.distributionDestinations.join(', ')}</div>
              </div>
              <div>
                <strong style="color: var(--text-muted);">Hands-on Student Experiments:</strong>
                <div>${snapshot.studentExperimentFrequency}</div>
              </div>
              ${snapshot.aquaponicsNotes ? `
                <div style="grid-column: 1 / -1; background: #e0f2fe; padding: 0.75rem 1rem; border-radius: var(--radius-md); color: #0369a1;">
                  <strong>Aquaponics (AQX) Live Tank Readings:</strong> ${snapshot.aquaponicsNotes}
                </div>
              ` : ''}
              <div style="grid-column: 1 / -1; background: var(--bg-card-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                <strong style="color: var(--text-muted);">AI Qualitative Operational Summary:</strong>
                <p style="margin-top: 0.25rem;">${snapshot.generalNotes}</p>
                ${snapshot.knownIssues !== 'None reported' ? `<p style="margin-top: 0.35rem; color: #dc2626;"><strong>Reported Challenges:</strong> ${snapshot.knownIssues}</p>` : ''}
              </div>
            </div>
          </div>

          <!-- NYSW Operational Status & Intervention Log -->
          <div style="margin-top: 1.5rem;">
            ${renderSchoolLogSection(school.dbn)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGroupBlock(group: GroupScore): string {
  return `
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 2px solid var(--border-light); font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
        <span>${group.name}</span>
        <span>${group.earnedPoints.toFixed(2)} / ${group.maxPoints.toFixed(2)} pts</span>
      </div>
      <div>
        ${group.kpis.map(k => `
          <div class="kpi-row">
            <div>
              <div class="kpi-title">
                <span><code>${k.id}</code></span>
                <span>${escapeHtml(k.name)}</span>
              </div>
              <div class="kpi-math-details">
                Actual: <strong>${typeof k.actual === 'number' ? (k.actual <= 1 ? (k.actual * 100).toFixed(0) + '%' : k.actual) : k.actual}</strong>
                · Floor: ${k.floor} · Target: ${k.target}
                ${k.dropReason ? ` · <span style="color: var(--tier-watch);">${k.dropReason}</span>` : ''}
              </div>
            </div>
            <div class="kpi-score-badge" style="color: ${k.score >= (k.maxPoints * 0.7) ? 'var(--tier-thriving)' : 'var(--tier-risk)'};">
              ${k.isApplicable ? `${k.score.toFixed(2)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">/ ${k.maxPoints}</span>` : '<span style="color: var(--text-muted);">Rescaled</span>'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMultiYearTrendSection(trend: MultiYearSchoolTrend): string {
  const deltaColor = trend.yoyTrendStatus === 'significant_growth' || trend.yoyTrendStatus === 'steady_improvement'
    ? '#059669'
    : trend.yoyTrendStatus === 'stable'
    ? '#0284c7'
    : '#dc2626';

  const deltaBg = trend.yoyTrendStatus === 'significant_growth' || trend.yoyTrendStatus === 'steady_improvement'
    ? '#ecfdf5'
    : trend.yoyTrendStatus === 'stable'
    ? '#f0f9ff'
    : '#fef2f2';

  const deltaBorder = trend.yoyTrendStatus === 'significant_growth' || trend.yoyTrendStatus === 'steady_improvement'
    ? '#a7f3d0'
    : trend.yoyTrendStatus === 'stable'
    ? '#bae6fd'
    : '#fecaca';

  return `
    <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <span>📈</span> Multi-Year Longitudinal Performance Trajectory
          </h4>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">
            Year-over-Year (YoY) score progression across archived school years and live cohort.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="status-pill" style="background: ${deltaBg}; color: ${deltaColor}; border: 1px solid ${deltaBorder}; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.65rem;">
            ${trend.yoyTrendLabel}
          </span>
          ${trend.twoYearGrowth !== null ? `
            <span class="status-pill" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-weight: 600; font-size: 0.75rem; padding: 0.25rem 0.55rem;">
              2-Yr Growth: <strong>${trend.twoYearGrowth > 0 ? '+' : ''}${trend.twoYearGrowth.toFixed(1)} pts</strong>
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Year Comparison Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.85rem;">
        ${trend.records.map((r, idx) => {
          const isLatest = idx === trend.records.length - 1;
          const rGradeClass = `badge-${r.letterGrade.toLowerCase()}`;
          const b1Pct = Math.min(100, Math.round((r.bucket1Score / 42) * 100));
          const b2Pct = Math.min(100, Math.round((r.bucket2Score / 40) * 100));
          const b3Pct = Math.min(100, Math.round((r.bucket3Score / 18) * 100));

          return `
            <div style="background: ${isLatest ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' : '#f8fafc'}; border: 1px solid ${isLatest ? '#86efac' : '#e2e8f0'}; border-radius: var(--radius-md); padding: 0.9rem; position: relative;">
              ${isLatest ? `
                <div style="position: absolute; top: -8px; right: 8px; background: #059669; color: #ffffff; font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Live Record
                </div>
              ` : `
                <div style="position: absolute; top: -8px; right: 8px; background: #64748b; color: #ffffff; font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Archived
                </div>
              `}
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
                ${r.schoolYear}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; line-height: 1;">
                    ${r.overallScore.toFixed(1)}
                  </span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">/100</span>
                </div>
                <div class="grade-badge ${rGradeClass}" style="width: 32px; height: 32px; font-size: 1rem;">
                  ${r.letterGrade}
                </div>
              </div>
              <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.65rem;">
                ${r.tier.split('—')[1]?.trim() || r.tier}
              </div>

              <!-- 3-Bucket Visual Mini-Bars -->
              <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.68rem;">
                <div>
                  <div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 1px;">
                    <span>B1 Maint:</span>
                    <strong>${r.bucket1Score.toFixed(1)}/42</strong>
                  </div>
                  <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${b1Pct}%; height: 100%; background: ${b1Pct >= 65 ? '#10b981' : '#f59e0b'};"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 1px;">
                    <span>B2 Engmnt:</span>
                    <strong>${r.bucket2Score.toFixed(1)}/40</strong>
                  </div>
                  <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${b2Pct}%; height: 100%; background: ${b2Pct >= 65 ? '#06b6d4' : '#f59e0b'};"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 1px;">
                    <span>B3 Admin:</span>
                    <strong>${r.bucket3Score.toFixed(1)}/18</strong>
                  </div>
                  <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${b3Pct}%; height: 100%; background: ${b3Pct >= 65 ? '#8b5cf6' : '#f59e0b'};"></div>
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.6rem; padding-top: 0.4rem; border-top: 1px dashed #e2e8f0; font-size: 0.68rem; color: var(--text-muted);">
                <span>🌿 ${r.totalHarvests} harvests</span>
                <span>📋 ${r.totalVisits} visits</span>
                <span style="color: ${r.flagsCount > 0 ? '#ef4444' : 'inherit'};">🚨 ${r.flagsCount} flags</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

