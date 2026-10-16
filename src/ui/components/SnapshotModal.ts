import type { EndOfYearSnapshot } from '../../types/snapshot.ts';
import type { SchoolWithData } from '../../pipeline/generator.ts';

export function renderSnapshotModal(
  liveSchools: SchoolWithData[],
  allSnapshots: EndOfYearSnapshot[],
  isSaving: boolean = false,
  saveSuccessMsg: string | null = null,
  activeSnapshotId: string | null = null
): string {
  const total = liveSchools.length || 1;
  const avgScore = liveSchools.reduce((acc, s) => acc + s.score.overallScore, 0) / total;
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of liveSchools) {
    gradeCounts[s.score.letterGrade]++;
  }
  const totalVisits = liveSchools.reduce((acc, s) => acc + s.weeklyHistory.length, 0);
  const totalHarvests = liveSchools.reduce((acc, s) => acc + (s.snapshot.cropsHarvested?.length || 2), 0);
  const totalFlags = liveSchools.reduce((acc, s) => acc + s.flags.length, 0);

  return `
    <div id="snapshot-modal-overlay" class="modal-overlay">
      <div class="modal-container" style="max-width: 860px; max-height: 90vh; overflow-y: auto;">
        <!-- Modal Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 1.5rem 1.75rem; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                📸
              </div>
              <div>
                <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; margin: 0; color: #ffffff;">
                  End-of-Year Dashboard Snapshot & Longitudinal Archives
                </h3>
                <p style="font-size: 0.82rem; color: #94a3b8; margin: 0.2rem 0 0 0;">
                  Archive final school-year records to freeze historical cohort results and enable multi-year trend tracking.
                </p>
              </div>
            </div>
            <button id="close-snapshot-modal-btn" class="close-btn" style="color: #cbd5e1;" title="Close Modal">✕</button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="modal-body" style="padding: 1.5rem 1.75rem; display: flex; flex-direction: column; gap: 1.5rem; background: var(--bg-main);">
          
          ${saveSuccessMsg ? `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 0.85rem 1.15rem; color: #065f46; font-size: 0.88rem; display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 1.2rem;">✅</span>
              <div>
                <strong>Snapshot Archived Successfully!</strong>
                <p style="margin: 0.15rem 0 0 0; font-size: 0.8rem; color: #047857;">${saveSuccessMsg}</p>
              </div>
            </div>
          ` : ''}

          <!-- SECTION 1: Capture End-of-Year Snapshot -->
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.4rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                <span>💾</span> Freeze Active Cohort as Final School-Year Snapshot
              </h4>
              <span class="status-pill pill-healthy" style="font-size: 0.75rem;">
                🟢 Active Cohort: ${liveSchools.length} Schools
              </span>
            </div>

            <!-- Current Live Cohort Preview Bar -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.9rem 1.1rem; margin-bottom: 1.25rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; font-size: 0.82rem;">
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">Avg Overall Score</span>
                <div style="font-family: var(--font-heading); font-size: 1.35rem; font-weight: 800; color: var(--text-main);">
                  ${avgScore.toFixed(1)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">/ 100</span>
                </div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">Grade Distribution</span>
                <div style="display: flex; gap: 0.3rem; margin-top: 0.2rem; font-size: 0.75rem; font-weight: 700;">
                  <span style="color: #059669;">A:${gradeCounts.A}</span>
                  <span style="color: #0284c7;">B:${gradeCounts.B}</span>
                  <span style="color: #d97706;">C:${gradeCounts.C}</span>
                  <span style="color: #ea580c;">D:${gradeCounts.D}</span>
                  <span style="color: #dc2626;">F:${gradeCounts.F}</span>
                </div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">GST Field Visits</span>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); margin-top: 0.1rem;">
                  ${totalVisits.toLocaleString()}
                </div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">Crops Harvested</span>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); margin-top: 0.1rem;">
                  ${totalHarvests.toLocaleString()}
                </div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 600;">Active Flags</span>
                <div style="font-weight: 700; font-size: 1.1rem; color: ${totalFlags > 0 ? '#dc2626' : 'var(--text-main)'}; margin-top: 0.1rem;">
                  ${totalFlags}
                </div>
              </div>
            </div>

            <!-- Snapshot Form -->
            <form id="save-snapshot-form" style="display: flex; flex-direction: column; gap: 0.9rem;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label for="snapshot-school-year" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.3rem;">
                    School Year Title *
                  </label>
                  <input
                    type="text"
                    id="snapshot-school-year"
                    class="filter-select"
                    style="width: 100%; font-size: 0.85rem;"
                    value="SY 2025–2026 (Final)"
                    required
                    placeholder="e.g. SY 2025–2026 (Final)"
                  />
                </div>
                <div>
                  <label for="snapshot-archived-by" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.3rem;">
                    Archived By *
                  </label>
                  <input
                    type="text"
                    id="snapshot-archived-by"
                    class="filter-select"
                    style="width: 100%; font-size: 0.85rem;"
                    value="NYSW Operations (Amanda Low & Megan Roberts)"
                    required
                    placeholder="e.g. Amanda Low & Megan Roberts"
                  />
                </div>
              </div>

              <div>
                <label for="snapshot-notes" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.3rem;">
                  Operational Archive Notes / Closeout Summary
                </label>
                <textarea
                  id="snapshot-notes"
                  class="filter-select"
                  style="width: 100%; min-height: 65px; font-size: 0.83rem; font-family: inherit; resize: vertical;"
                  placeholder="Notes explaining this final snapshot (e.g. final grading following Week 38 audits and spring harvest cycle)..."
                >Official End-of-Year cohort closeout. Finalized 100-point rubric scores, 3-bucket diagnostics, and early-warning flags for longitudinal tracking.</textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.25rem;">
                <button
                  type="button"
                  id="download-snapshot-json-btn"
                  class="meta-pill"
                  style="cursor: pointer; background: #ffffff; border: 1px solid #cbd5e1; font-weight: 600; padding: 0.55rem 1rem; font-size: 0.82rem; color: #475569;"
                  title="Download raw snapshot JSON backup to your computer"
                >
                  <span>⬇️</span> Download Current Cohort JSON Backup
                </button>
                <button
                  type="submit"
                  id="confirm-save-snapshot-btn"
                  class="ingest-run-btn"
                  style="padding: 0.55rem 1.25rem; font-size: 0.85rem;"
                  ${isSaving ? 'disabled' : ''}
                >
                  <span>${isSaving ? '⏳ Archiving...' : '💾 Freeze & Save Final Snapshot'}</span>
                </button>
              </div>
            </form>
          </div>

          <!-- SECTION 2: Longitudinal Archive Library -->
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.4rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <div>
                <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                  <span>📚</span> Multi-Year Archive Library (${allSnapshots.length} School Years)
                </h4>
                <p style="font-size: 0.76rem; color: var(--text-muted); margin: 0.15rem 0 0 0;">
                  Switch the active dashboard to any historical school year to review past performance and audit records.
                </p>
              </div>
              ${activeSnapshotId ? `
                <span class="status-pill" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 600; font-size: 0.75rem;">
                  Currently Viewing Archive
                </span>
              ` : `
                <span class="status-pill pill-healthy" style="font-size: 0.75rem;">
                  Viewing Live SY 2025–2026
                </span>
              `}
            </div>

            <!-- List of Snapshots -->
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${allSnapshots.map(snap => {
                const isActive = activeSnapshotId === snap.snapshotId;
                const dateStr = new Date(snap.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                const isCustom = !snap.snapshotId.startsWith('SY24_25_') && !snap.snapshotId.startsWith('SY23_24_');

                return `
                  <div style="background: ${isActive ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${isActive ? '#86efac' : '#e2e8f0'}; border-radius: var(--radius-md); padding: 1rem 1.15rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="max-width: 520px;">
                      <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem;">
                        <span style="font-family: var(--font-heading); font-size: 1rem; font-weight: 700; color: var(--text-main);">
                          ${snap.schoolYear}
                        </span>
                        <span class="status-pill" style="background: #e2e8f0; color: #334155; border: none; font-size: 0.68rem; font-weight: 700;">
                          ${snap.isFinal ? 'FINAL ARCHIVE' : 'DRAFT'}
                        </span>
                        ${isActive ? `
                          <span class="status-pill" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-size: 0.68rem; font-weight: 700;">
                            ACTIVE IN DASHBOARD
                          </span>
                        ` : ''}
                      </div>

                      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem;">
                        Archived on <strong>${dateStr}</strong> · By: <strong>${snap.archivedBy || 'NYSW Operations'}</strong> · <strong>${snap.totalSchools}</strong> partner schools
                      </div>

                      <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.76rem;">
                        <span style="font-weight: 600; color: var(--text-main);">
                          Avg Score: <strong>${snap.networkSummary.averageOverallScore.toFixed(1)}/100</strong>
                        </span>
                        <span style="color: var(--text-muted);">·</span>
                        <span style="color: var(--text-muted);">
                          B1: ${snap.networkSummary.averageBucket1Score.toFixed(1)} · B2: ${snap.networkSummary.averageBucket2Score.toFixed(1)} · B3: ${snap.networkSummary.averageBucket3Score.toFixed(1)}
                        </span>
                      </div>

                      ${snap.notes ? `
                        <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.4rem; font-style: italic;">
                          "${escapeHtml(snap.notes)}"
                        </div>
                      ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                      ${isActive ? `
                        <button
                          type="button"
                          class="switch-to-live-btn"
                          style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); padding: 0.4rem 0.75rem; font-size: 0.76rem; font-weight: 600; color: #0f172a; cursor: pointer;"
                        >
                          ↩️ Return to Live Cohort
                        </button>
                      ` : `
                        <button
                          type="button"
                          class="view-snapshot-btn"
                          data-snapshot-id="${snap.snapshotId}"
                          style="background: #0f172a; color: #ffffff; border: none; border-radius: var(--radius-sm); padding: 0.45rem 0.85rem; font-size: 0.76rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;"
                          title="Switch dashboard to view this archived school year"
                        >
                          <span>👁️</span> View Archive
                        </button>
                      `}

                      <button
                        type="button"
                        class="export-snapshot-btn"
                        data-snapshot-id="${snap.snapshotId}"
                        style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); padding: 0.45rem 0.75rem; font-size: 0.76rem; font-weight: 500; color: #475569; cursor: pointer;"
                        title="Export snapshot JSON"
                      >
                        ⬇️ JSON
                      </button>

                      ${isCustom ? `
                        <button
                          type="button"
                          class="delete-snapshot-btn"
                          data-snapshot-id="${snap.snapshotId}"
                          data-year="${escapeHtml(snap.schoolYear)}"
                          style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: var(--radius-sm); padding: 0.45rem 0.65rem; font-size: 0.76rem; font-weight: 600; color: #e11d48; cursor: pointer;"
                          title="Delete custom snapshot"
                        >
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="modal-footer" style="padding: 1rem 1.75rem; background: #f8fafc; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            💡 Archived records are securely stored locally & on disk in <code>data/snapshots/</code>.
          </div>
          <button id="footer-close-snapshot-btn" class="filter-select" style="padding: 0.45rem 1.25rem; font-size: 0.82rem; cursor: pointer;">
            Close Archive Hub
          </button>
        </div>
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
