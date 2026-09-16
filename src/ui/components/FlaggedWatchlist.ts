import type { FlaggedSchoolReport } from '../../types/flags.ts';

export function renderFlaggedWatchlist(flaggedReports: FlaggedSchoolReport[]): string {
  if (flaggedReports.length === 0) {
    return `
      <div style="background: var(--bg-card); border-radius: var(--radius-lg); padding: 3rem; text-align: center; border: 1px solid var(--border-light);">
        <span style="font-size: 3rem;">🎉</span>
        <h2 style="font-family: var(--font-heading); margin-top: 1rem;">No Active Operational Flags</h2>
        <p style="color: var(--text-muted);">All partner schools are currently operating within compliance boundaries.</p>
      </div>
    `;
  }

  // Count GST frequency in flagged reports to spot patterns
  const gstCounts: Record<string, number> = {};
  flaggedReports.forEach(r => {
    gstCounts[r.assignedGst] = (gstCounts[r.assignedGst] || 0) + 1;
  });

  return `
    <div style="margin-bottom: 1.5rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-family: var(--font-heading); color: #991b1b; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
            <span>🚨</span> Shared Weekly Flagged-Schools Report
          </h2>
          <p style="font-size: 0.85rem; color: #b91c1c; margin-top: 0.25rem;">
            Generated end-of-week. Lists all currently-flagged schools, assigned GST, trigger causes, and consecutive weeks active.
          </p>
        </div>
        <div style="font-size: 0.85rem; background: #ffffff; padding: 0.5rem 1rem; border-radius: var(--radius-md); border: 1px solid #fecaca;">
          <strong>GST Distribution:</strong>
          ${Object.entries(gstCounts).map(([gst, count]) => `
            <span style="margin-left: 0.5rem; color: #7f1d1d;">${gst}: <strong>${count}</strong></span>
          `).join(' · ')}
        </div>
      </div>
    </div>

    <div class="flagged-list">
      ${flaggedReports.map(report => renderFlaggedCard(report)).join('')}
    </div>
  `;
}

function renderFlaggedCard(report: FlaggedSchoolReport): string {
  const isCritical = report.highestSeverity === 'critical';

  return `
    <div class="flagged-card ${isCritical ? '' : 'warning'}" data-dbn="${report.schoolDbn}">
      <div class="flag-details" style="flex: 1;">
        <div style="display: flex; align-items: baseline; gap: 0.75rem;">
          <h3>${escapeHtml(report.schoolName)}</h3>
          <code style="font-size: 0.8rem; background: var(--bg-card-alt); padding: 0.15rem 0.45rem; border-radius: 4px;">${report.schoolDbn}</code>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${report.borough}</span>
        </div>

        <div class="flag-meta">
          <span>Assigned GST: <strong>${report.assignedGst}</strong></span>
          <span>Max Consecutive Weeks Active: <strong style="color: ${report.maxConsecutiveWeeks >= 3 ? 'var(--tier-risk)' : 'var(--text-main)'};">${report.maxConsecutiveWeeks} weeks</strong></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem;">
          ${report.activeFlags.map(flag => `
            <div style="background: var(--bg-main); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 0.75rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="active-flag-chip ${flag.severity === 'critical' ? '' : 'warning'}">
                    ${flag.title}
                  </span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">
                    Active for ${flag.weeksActive} consecutive week${flag.weeksActive > 1 ? 's' : ''}
                  </span>
                </div>
                <span class="meta-pill" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                  Route: ${flag.routing}
                </span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                ${escapeHtml(flag.description)}
              </p>
              <div style="font-size: 0.75rem; color: var(--text-main); font-weight: 500; margin-top: 0.35rem;">
                🔍 <em>Trigger detail:</em> ${escapeHtml(flag.triggerDetail)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <button
          class="open-drawer-btn"
          data-dbn="${report.schoolDbn}"
          style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); padding: 0.5rem 1rem; border-radius: var(--radius-md); font-family: var(--font-heading); font-weight: 600; cursor: pointer; white-space: nowrap;"
        >
          Inspect School Snapshot →
        </button>
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
