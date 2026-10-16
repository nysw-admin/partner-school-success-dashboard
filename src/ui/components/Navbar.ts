import type { EndOfYearSnapshot } from '../../types/snapshot.ts';

export function renderNavbar(
  activeSchoolCount?: number,
  availableSnapshots: EndOfYearSnapshot[] = [],
  activeSnapshotId: string | null = null
): string {
  const isTestingMode = typeof activeSchoolCount === 'number' && activeSchoolCount === 0;
  const isViewingArchive = Boolean(activeSnapshotId);

  return `
    <header class="navbar">
      <div class="nav-brand">
        <div class="brand-badge-circle" title="New York Sun Works">
          🌿
        </div>
        <div class="brand-title-group">
          <h1>New York Sun Works — Partner School Success Dashboard</h1>
          <p>Automated Decision-Support, Grading & Early-Warning Monitoring System</p>
        </div>
      </div>
      <div class="nav-meta-badges">
        ${isTestingMode ? `
          <span class="meta-pill" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 600;">
            <span>🧪</span> Test Mode: Cleared (0 Schools)
          </span>
        ` : isViewingArchive ? `
          <span class="meta-pill" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 600;">
            <span>📁</span> Archived Snapshot (${activeSchoolCount} Schools)
          </span>
        ` : typeof activeSchoolCount === 'number' ? `
          <span class="meta-pill" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-weight: 600;">
            <span>✓</span> Live Cohort (${activeSchoolCount} Schools)
          </span>
        ` : ''}

        <button id="open-snapshot-modal-btn" class="ingest-nav-btn" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155;" title="End-of-Year Snapshot & Archive Hub">
          <span>📸</span>
          <span>EOY Snapshots</span>
        </button>

        <button id="open-ingest-modal-btn" class="ingest-nav-btn" title="Data Ingestion & Pipeline Hub">
          <span class="ingest-icon">🔄</span>
          <span>Data Ingestion</span>
        </button>

        <button id="open-ai-agent-btn" class="ai-agent-nav-btn" title="Launch NYSW AI School Copilot">
          <span class="ai-sparkle">✨</span>
          <span>AI School Copilot</span>
        </button>

        <!-- Interactive School Year Selector Dropdown -->
        <div class="sy-selector-wrapper" style="display: flex; align-items: center; gap: 0.35rem; background: ${isViewingArchive ? '#fef3c7' : '#ffffff'}; border: 1px solid ${isViewingArchive ? '#fde68a' : '#cbd5e1'}; border-radius: 9999px; padding: 0.25rem 0.75rem;">
          <span style="font-size: 0.85rem;">📅</span>
          <select id="navbar-sy-select" style="background: transparent; border: none; font-size: 0.78rem; font-weight: 700; color: ${isViewingArchive ? '#92400e' : 'var(--text-main)'}; cursor: pointer; outline: none;" title="Switch School Year">
            <option value="live" ${!activeSnapshotId ? 'selected' : ''}>SY 2025–2026 (Live Cohort)</option>
            ${availableSnapshots.map(s => `
              <option value="${s.snapshotId}" ${activeSnapshotId === s.snapshotId ? 'selected' : ''}>
                ${s.schoolYear} (Final Archive)
              </option>
            `).join('')}
          </select>
        </div>
      </div>
    </header>
  `;
}
