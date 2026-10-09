export function renderNavbar(activeSchoolCount?: number): string {
  const isTestingMode = typeof activeSchoolCount === 'number' && activeSchoolCount === 0;

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
        ` : typeof activeSchoolCount === 'number' ? `
          <span class="meta-pill" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-weight: 600;">
            <span>✓</span> Live Cohort (${activeSchoolCount} Schools)
          </span>
        ` : ''}
        <button id="open-ingest-modal-btn" class="ingest-nav-btn" title="Data Ingestion & Pipeline Hub">
          <span class="ingest-icon">🔄</span>
          <span>Data Ingestion</span>
        </button>
        <button id="open-ai-agent-btn" class="ai-agent-nav-btn" title="Launch NYSW AI School Copilot">
          <span class="ai-sparkle">✨</span>
          <span>AI School Copilot</span>
        </button>
        <span class="meta-pill meta-pill-program">
          <span>🏛️</span> Pursuit | Mizuho Bank Nonprofit Builder
        </span>
        <span class="meta-pill meta-pill-sy">
          <span>📅</span> SY 2025–2026
        </span>
      </div>
    </header>
  `;
}

