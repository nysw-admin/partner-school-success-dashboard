export function renderNavbar(): string {
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
