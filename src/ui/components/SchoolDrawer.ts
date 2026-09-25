import type { SchoolWithData } from '../../pipeline/generator.ts';
import type { GroupScore } from '../../types/score.ts';
import { renderSchoolLogSection } from './FlaggedWatchlist.ts';

export function renderSchoolDrawer(item: SchoolWithData): string {
  const { school, score, flags, snapshot } = item;
  const gradeClass = `badge-${score.letterGrade.toLowerCase()}`;

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
          <button id="close-modal-btn" class="close-btn" title="Close Drawer">✕</button>
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
