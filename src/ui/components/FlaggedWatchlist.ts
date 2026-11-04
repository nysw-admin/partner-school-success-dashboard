import type { FlaggedSchoolReport } from '../../types/flags.ts';
import { getLogsForSchool } from '../../services/flagLogStore.ts';
import { getAllResolvedFlags, getSchoolScoreResolutionSummary } from '../../services/flagResolutionService.ts';

export function renderFlaggedWatchlist(flaggedReports: FlaggedSchoolReport[]): string {
  const allResolved = getAllResolvedFlags();
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
            Generated end-of-week. Lists all currently-flagged schools, assigned GST, trigger causes, consecutive weeks active, and team intervention notes.
          </p>
        </div>
        <div style="font-size: 0.85rem; background: #ffffff; padding: 0.5rem 1rem; border-radius: var(--radius-md); border: 1px solid #fecaca;">
          <strong>GST Distribution:</strong>
          ${Object.entries(gstCounts).map(([gst, count]) => `
            <span style="margin-left: 0.5rem; color: #7f1d1d;">${gst}: <strong>${count}</strong></span>
          `).join(' · ')}
        </div>
      </div>
      ${allResolved.length > 0 ? `
        <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #fecaca; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: #ecfdf5; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid #a7f3d0;">
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span style="font-size: 1.1rem;">✅</span>
            <span style="font-size: 0.84rem; font-weight: 700; color: #065f46;">
              ${allResolved.length} Flag${allResolved.length === 1 ? '' : 's'} Resolved &amp; Recalculated:
            </span>
            ${allResolved.map(r => `
              <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #ffffff; border: 1px solid #6ee7b7; border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.75rem; color: #065f46; font-weight: 600;">
                <strong>${escapeHtml(r.schoolDbn)}</strong>: ${escapeHtml(r.flagTitle)} ${r.scoreGain !== undefined ? `<span style="color:#047857;">(+${r.scoreGain.toFixed(1)} pts)</span>` : ''}
                <button
                  type="button"
                  class="reopen-flag-btn"
                  data-dbn="${escapeHtml(r.schoolDbn)}"
                  data-flag-id="${escapeHtml(r.flagId)}"
                  style="background: transparent; border: none; color: #b45309; font-weight: 700; cursor: pointer; font-size: 0.72rem; padding: 0 0.15rem;"
                  title="Reopen this flag and revert score"
                >↩ Undo</button>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <div class="flagged-list">
      ${flaggedReports.map(report => renderFlaggedCard(report)).join('')}
    </div>
  `;
}

function renderFlaggedCard(report: FlaggedSchoolReport): string {
  const isCritical = report.highestSeverity === 'critical';
  const resSummary = getSchoolScoreResolutionSummary(report.schoolDbn);

  return `
    <div class="flagged-card ${isCritical ? '' : 'warning'}" data-dbn="${report.schoolDbn}">
      <div class="flag-details" style="flex: 1;">
        <div style="display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap;">
          <h3>${escapeHtml(report.schoolName)}</h3>
          <code style="font-size: 0.8rem; background: var(--bg-card-alt); padding: 0.15rem 0.45rem; border-radius: 4px;">${report.schoolDbn}</code>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${report.borough}</span>
          ${resSummary ? `
            <span class="status-pill pill-healthy" style="font-size: 0.72rem; padding: 0.12rem 0.5rem;">
              ✓ Recalculated Score: ${resSummary.currentOverall.toFixed(1)} (Grade ${resSummary.currentGrade}, +${resSummary.scoreDelta.toFixed(1)} pts)
            </span>
          ` : ''}
        </div>

        <div class="flag-meta">
          <span>Assigned GST: <strong>${report.assignedGst}</strong></span>
          <span>Max Consecutive Weeks Active: <strong style="color: ${report.maxConsecutiveWeeks >= 3 ? 'var(--tier-risk)' : 'var(--text-main)'};">${report.maxConsecutiveWeeks} weeks</strong></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem;">
          ${report.activeFlags.map(flag => `
            <div style="background: var(--bg-main); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 0.75rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span class="active-flag-chip ${flag.severity === 'critical' ? '' : 'warning'}">
                    ${flag.title}
                  </span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">
                    Active for ${flag.weeksActive} consecutive week${flag.weeksActive > 1 ? 's' : ''}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span class="meta-pill" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                    Route: ${flag.routing}
                  </span>
                  <button
                    type="button"
                    class="resolve-flag-btn"
                    data-dbn="${report.schoolDbn}"
                    data-flag-id="${flag.id}"
                    style="background: #059669; color: #ffffff; border: 1px solid #047857; padding: 0.32rem 0.7rem; border-radius: var(--radius-sm); font-family: var(--font-heading); font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; box-shadow: var(--shadow-sm);"
                    title="Mark this flag as resolved and recalculate the school's score"
                  >
                    <span>✓</span> Resolve Flag &amp; Recalculate Score
                  </button>
                </div>
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

        <!-- NYSW Operational Status & Intervention Log -->
        ${renderSchoolLogSection(report.schoolDbn)}
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch;">
        <button
          class="open-drawer-btn"
          data-dbn="${report.schoolDbn}"
          style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); padding: 0.5rem 1rem; border-radius: var(--radius-md); font-family: var(--font-heading); font-weight: 600; cursor: pointer; white-space: nowrap;"
        >
          Inspect School Snapshot →
        </button>
        <button
          class="ai-generate-report-btn"
          data-dbn="${report.schoolDbn}"
          style="background: #ffffff; color: var(--primary-dark); border: 1px solid var(--border-subtle); padding: 0.45rem 1rem; border-radius: var(--radius-md); font-family: var(--font-heading); font-weight: 600; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.35rem;"
          title="Generate AI status report & diagnosis"
        >
          <span>✨</span> AI Status Report
        </button>
      </div>
    </div>
  `;
}

export function renderSchoolLogSection(schoolDbn: string): string {
  const logs = getLogsForSchool(schoolDbn);

  return `
    <div class="flag-log-container" data-dbn="${schoolDbn}">
      <div class="flag-log-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1rem;">📝</span>
          <span class="flag-log-title">NYSW Operational Update Log</span>
          <span class="log-count-pill">${logs.length} update${logs.length === 1 ? '' : 's'}</span>
        </div>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Stored permanently for intervention tracking</span>
      </div>

      <!-- History of logged updates -->
      <div class="flag-log-history">
        ${logs.length === 0 ? `
          <div class="no-logs-msg">
            No updates logged yet. Use the field below to document calls, site visits, or remediation steps.
          </div>
        ` : `
          <div class="log-entries-list">
            ${logs.map(log => `
              <div class="log-entry-item" data-log-id="${log.id}">
                <div class="log-entry-meta">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span class="log-author-name">👤 ${escapeHtml(log.author)}</span>
                    <span class="log-status-badge ${getStatusTagClass(log.statusTag)}">${escapeHtml(log.statusTag)}</span>
                    <span class="log-timestamp">🕒 ${escapeHtml(log.timestamp)}</span>
                  </div>
                  <button class="delete-log-btn" data-log-id="${log.id}" data-dbn="${schoolDbn}" title="Remove this note">✕</button>
                </div>
                <div class="log-entry-body">
                  ${escapeHtml(log.note)}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- New Log Input Form -->
      <form class="flag-log-form" data-dbn="${schoolDbn}">
        <div class="log-form-header">
          <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.03em;">
            + Log New Status Update / Field Action
          </span>
        </div>
        <div class="log-form-controls">
          <select class="log-status-select" id="log-status-${schoolDbn}">
            <option value="In Progress">Status: In Progress</option>
            <option value="Field Visit Scheduled">Status: Field Visit Scheduled</option>
            <option value="Principal Contacted">Status: Principal Contacted</option>
            <option value="Under Review">Status: Under Review</option>
            <option value="Resolved">Status: Flag Resolved</option>
            <option value="General Note">Status: General Note</option>
          </select>

          <input
            type="text"
            class="log-author-input"
            id="log-author-${schoolDbn}"
            placeholder="Staff name / role"
            value="NYSW Team"
          />
        </div>

        <div class="log-form-input-row">
          <textarea
            class="log-note-textarea"
            id="log-note-${schoolDbn}"
            placeholder="Log details on intervention, teacher check-in, maintenance action, or principal meeting..."
            rows="2"
            required
          ></textarea>
          <button type="submit" class="log-submit-btn">
            <span>💾</span> Log Update
          </button>
        </div>
      </form>
    </div>
  `;
}

function getStatusTagClass(status: string): string {
  switch (status) {
    case 'Resolved':
      return 'log-tag-resolved';
    case 'Field Visit Scheduled':
      return 'log-tag-scheduled';
    case 'Principal Contacted':
      return 'log-tag-contacted';
    case 'Under Review':
      return 'log-tag-review';
    case 'In Progress':
      return 'log-tag-inprogress';
    default:
      return 'log-tag-default';
  }
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
