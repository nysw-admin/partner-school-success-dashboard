export interface SourceFileStatus {
  id: string;
  name: string;
  label: string;
  description: string;
  required: boolean;
  exists: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
}

export interface IncrementalFileStatus {
  name: string;
  sizeBytes: number;
  modifiedAt: string | null;
}

export interface HistoricalMeta {
  totalCumulativeVisits: number;
  totalSchoolsTracked: number;
  newVisitsAddedThisRun: number;
  historicalVisitsRetained: number;
  lastUpdated: string | null;
}

export interface IngestionStatusData {
  success: boolean;
  sliceDirectory: string;
  intakeDirectoryRelative?: string;
  canonicalFolder?: string;
  canonicalPath?: string;
  activePath?: string;
  files: SourceFileStatus[];
  incrementalFiles?: IncrementalFileStatus[];
  historicalMeta?: HistoricalMeta | null;
  cohortMeta: {
    fileSizeBytes: number;
    lastGeneratedAt: string;
    totalSchools: number;
    flaggedCount: number;
    ingestionMetadata?: any;
  } | null;
  error?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(isoStr: string | null): string {
  if (!isoStr) return 'Never / Unknown';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export function renderDataIngestionModal(
  statusData: IngestionStatusData | null,
  isRunning: boolean = false,
  logOutput: string | null = null,
  errorMessage: string | null = null,
  currentLoadedSchools: number = 0
): string {
  const files = statusData?.files || [
    {
      id: 'registry',
      name: 'Accelo Partner Schools Export.xls',
      label: 'Accelo Partner Schools Master Registry',
      description: 'Canonical school identifiers, boroughs, program years & addresses',
      required: true,
      exists: true,
      sizeBytes: 90112,
      modifiedAt: null,
    },
    {
      id: 'cadence',
      name: 'GST Schedule SY 25_26 - Visit Cadence.xlsx',
      label: 'GST Schedule — Visit Cadence',
      description: 'Scheduled visit frequency (weekly, twice-weekly, bi-weekly)',
      required: true,
      exists: true,
      sizeBytes: 22059,
      modifiedAt: null,
    },
    {
      id: 'schedule',
      name: 'Copy of GST Schedule SY 25_26.xlsx',
      label: 'Copy of GST Schedule SY 25_26',
      description: '53-tab weekly calendar; maps Column A assigned GSTs & expected appearances',
      required: true,
      exists: true,
      sizeBytes: 587002,
      modifiedAt: null,
    },
    {
      id: 'weekly_reports',
      name: 'Accelo GST Asset Export Sept-Dec 2025.xlsx',
      label: 'Accelo GST Asset Support Reports',
      description: 'Field visit logs, system uptime, seedlings, pests, harvests & crop weights',
      required: true,
      exists: true,
      sizeBytes: 606788,
      modifiedAt: null,
    },
    {
      id: 'amv',
      name: 'Area Manager Asset Sep-Dec 2025.xlsx',
      label: 'Area Manager Observation Visits',
      description: 'Lab impression, cleanliness, teacher involvement & curriculum confirmation',
      required: false,
      exists: true,
      sizeBytes: 27659,
      modifiedAt: null,
    },
    {
      id: 'hc',
      name: 'HC Performance Asset Sep25-Jun26.xls',
      label: 'Health Check Performance Assets',
      description: 'Custodian ratings, usability, visitor readiness & budget/continuation flags',
      required: false,
      exists: true,
      sizeBytes: 66048,
      modifiedAt: null,
    },
    {
      id: 'survey',
      name: 'Teacher Survey 25_26.xlsx',
      label: 'Annual Teacher Satisfaction Survey',
      description: 'Curriculum comprehension, ease of use, GST staff rating & teacher feedback',
      required: false,
      exists: true,
      sizeBytes: 35895,
      modifiedAt: null,
    },
  ];

  const totalFiles = files.length;
  const readyFiles = files.filter(f => f.exists).length;
  const incrementalFiles = statusData?.incrementalFiles || [];
  const cumulativeVisits = statusData?.historicalMeta?.totalCumulativeVisits ?? statusData?.cohortMeta?.ingestionMetadata?.totalCumulativeVisits ?? 3974;

  return `
    <div id="ingest-modal-overlay" class="modal-overlay ingest-modal-overlay">
      <div class="ingest-modal-card">
        <!-- Ingestion Modal Header -->
        <div class="ingest-modal-header">
          <div class="ingest-header-left">
            <div class="ingest-avatar-circle">
              <span>🔄</span>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h2 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-main);">
                  NY Sun Works — Data Intake & Pipeline Hub
                </h2>
                <span class="ingest-status-pill ${isRunning ? 'running' : currentLoadedSchools === 0 ? 'ready' : 'ready'}">
                  ${isRunning ? '⏳ Running Ingestion...' : currentLoadedSchools === 0 ? '🧪 Testing Mode (Cleared)' : '🟢 Ready to Ingest'}
                </span>
                <span class="ingest-status-pill" style="background: rgba(16, 185, 129, 0.15); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3);">
                  📦 Incremental Accumulator Active
                </span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.25rem 0 0 0;">
                Self-Service Data Pipeline for NYSW Operations: Ingest new bi-weekly spreadsheets, preserve historical records, compute 100-point rubric scores, and synchronize dashboard in 1 click.
              </p>
            </div>
          </div>

          <div class="ingest-header-actions">
            <button id="close-ingest-modal-btn" class="close-btn" title="Close Data Intake Hub">✕</button>
          </div>
        </div>

        <!-- Ingestion Modal Body -->
        <div class="ingest-modal-body">
          <!-- Incremental Upload Banner -->
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 0.6rem 0.9rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-size: 0.82rem; color: #065f46;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">📦</span>
              <span>
                <strong>Bi-Weekly Incremental Updates Supported:</strong> Drop new Accelo spreadsheets every 1–2 weeks into <code>data/incoming/</code>. The model keeps historical records, merges new visits, and deduplicates overlaps.
              </span>
            </div>
            ${incrementalFiles.length > 0 ? `
              <span style="background: #10b981; color: white; padding: 0.2rem 0.55rem; border-radius: 12px; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">
                ${incrementalFiles.length} Incremental File(s) Detected
              </span>
            ` : ''}
          </div>

          <!-- Summary Metrics Cards -->
          <div class="ingest-metrics-grid">
            <div class="ingest-metric-card">
              <span class="ingest-metric-label">📁 Spreadsheet Folder</span>
              <span class="ingest-metric-val">data/incoming/</span>
              <span class="ingest-metric-sub">${readyFiles}/${totalFiles} Base Files Ready</span>
            </div>

            <div class="ingest-metric-card">
              <span class="ingest-metric-label">📋 Cumulative Visits Preserved</span>
              <span class="ingest-metric-val" style="color: #047857;">${cumulativeVisits.toLocaleString()}</span>
              <span class="ingest-metric-sub">Stored in historical_visits.json</span>
            </div>

            <div class="ingest-metric-card">
              <span class="ingest-metric-label">🏫 Active Partner Schools</span>
              <span class="ingest-metric-val">${currentLoadedSchools}</span>
              <span class="ingest-metric-sub">${currentLoadedSchools === 0 ? '⚠️ Cleared (Testing Mode)' : 'Across NYC & Five Boroughs'}</span>
            </div>

            <div class="ingest-metric-card">
              <span class="ingest-metric-label">🕒 Last Ingestion Executed</span>
              <span class="ingest-metric-val" style="font-size: 0.95rem;">
                ${formatDate(statusData?.cohortMeta?.lastGeneratedAt ?? null)}
              </span>
              <span class="ingest-metric-sub">Cohort JSON: ${formatBytes(statusData?.cohortMeta?.fileSizeBytes ?? 0)}</span>
            </div>
          </div>

          <!-- Action Button Strip -->
          <div class="ingest-action-strip">
            <div class="ingest-action-left">
              <button
                id="run-ingest-pipeline-btn"
                class="ingest-run-btn ${isRunning ? 'disabled' : ''}"
                ${isRunning ? 'disabled' : ''}
              >
                <span>${isRunning ? '⏳' : '🚀'}</span>
                <span>${isRunning ? 'Running Data Intake Pipeline...' : 'Run Data Intake Pipeline Now'}</span>
              </button>

              <button
                id="refresh-sources-btn"
                class="ingest-refresh-btn"
                title="Rescan folder for newly added Excel files"
                ${isRunning ? 'disabled' : ''}
              >
                <span>🔄</span>
                <span>Check File Status</span>
              </button>

              <button
                id="clear-test-dashboard-btn"
                class="ingest-clear-btn"
                title="Clear the active in-memory dashboard to 0 schools to test re-ingestion"
                ${isRunning ? 'disabled' : ''}
              >
                <span>🧹</span>
                <span>Clear Dashboard (Test Mode)</span>
              </button>
            </div>

            <div class="ingest-action-hint">
              <span>💡 <em>Drop new spreadsheets into <code>data/incoming/</code> and click the green button!</em></span>
            </div>
          </div>

          ${errorMessage ? `
            <div class="ingest-error-banner">
              <strong>⚠️ Ingestion Error:</strong> ${errorMessage}
            </div>
          ` : ''}

          <!-- Two Column View: Left = File Inventory, Right = Live Ingestion Terminal Output -->
          <div class="ingest-split-container">
            <!-- Left: 7 Data Sources Table -->
            <div class="ingest-sources-panel">
              <div class="panel-header-row">
                <h3 class="panel-title">
                  <span>📊</span> Operational Data Sources (${readyFiles}/${totalFiles})
                </h3>
                <span class="panel-subtitle">Assigned GSTs automatically read from <strong>Copy of GST Schedule SY 25_26 Column A</strong></span>
              </div>

              <div class="ingest-files-list">
                ${files.map(f => `
                  <div class="ingest-file-item ${f.exists ? 'file-exists' : 'file-missing'}">
                    <div class="file-item-status">
                      <span class="file-badge ${f.exists ? 'badge-ok' : 'badge-missing'}">
                        ${f.exists ? '✓ READY' : '✕ MISSING'}
                      </span>
                    </div>
                    <div class="file-item-content">
                      <div class="file-item-title-row">
                        <span class="file-label">${f.label}</span>
                        ${f.required ? '<span class="file-req-tag">Required</span>' : '<span class="file-opt-tag">Optional</span>'}
                      </div>
                      <div class="file-system-name">📄 <code>${f.name}</code></div>
                      <div class="file-description">${f.description}</div>
                      ${f.exists ? `
                        <div class="file-meta-row">
                          <span>📦 ${formatBytes(f.sizeBytes)}</span>
                          <span>•</span>
                          <span>🕒 Modified: ${formatDate(f.modifiedAt)}</span>
                        </div>
                      ` : `
                        <div class="file-meta-row" style="color: var(--tier-risk);">
                          <span>⚠️ File missing from intake folder.</span>
                        </div>
                      `}
                    </div>
                  </div>
                `).join('')}

                ${incrementalFiles.length > 0 ? `
                  <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-size: 0.85rem; font-weight: 700; color: #047857; margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.4rem;">
                      <span>📥</span> Incremental Spreadsheets Detected (${incrementalFiles.length})
                    </h4>
                    ${incrementalFiles.map(inc => `
                      <div class="ingest-file-item file-exists" style="border-left: 3px solid #10b981;">
                        <div class="file-item-status">
                          <span class="file-badge badge-ok">✓ NEW</span>
                        </div>
                        <div class="file-item-content">
                          <div class="file-item-title-row">
                            <span class="file-label">Incremental Weekly Export</span>
                          </div>
                          <div class="file-system-name">📄 <code>${inc.name}</code></div>
                          <div class="file-meta-row">
                            <span>📦 ${formatBytes(inc.sizeBytes)}</span>
                            <span>•</span>
                            <span>🕒 Modified: ${formatDate(inc.modifiedAt)}</span>
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Right: Live Execution Logs -->
            <div class="ingest-console-panel">
              <div class="panel-header-row">
                <h3 class="panel-title">
                  <span>🖥️</span> Live Pipeline Execution Output
                </h3>
                ${isRunning ? '<span class="pulse-indicator">● Processing Real Data</span>' : '<span style="font-size: 0.75rem; color: var(--text-muted);">Standard Output & Diagnostics</span>'}
              </div>

              <div id="ingest-terminal-window" class="ingest-terminal-box">
                <pre class="terminal-text">${logOutput || (currentLoadedSchools === 0
                  ? `[TEST MODE ACTIVE] Dashboard is currently CLEARED (0 partner schools loaded).\n\nSpreadsheets in the established "data/incoming/" folder are safe & intact.\n\nReady to test the pipeline:\n  1. Click "Run Data Intake Pipeline Now" above.\n  2. The pipeline will ingest all Excel files and extract Assigned GSTs from Column A.\n  3. Rubric scores and flags will be calculated.\n  4. All 405 schools will populate the dashboard in real time!\n\nWaiting for you to click "Run Data Intake Pipeline Now"...`
                  : `[READY] NY Sun Works Incremental Data Engine initialized.\n\nEstablished Intake Folder: data/incoming/\nPersistent Visit Storage: data/historical_visits.json (${cumulativeVisits} visits preserved)\n\nClick "Run Data Intake Pipeline Now" to execute the 6-step incremental ingestion workflow:\n  1. School Registry & Cadence Specs\n  2. 53-tab Weekly Schedule & Assigned GSTs from Column A\n  3. Incremental Accelo GST Reports (Deduplicating & Preserving History)\n  4. Health Checks, AM Observations & Teacher Survey\n  5. 100-Point Scoring Engine & Early-Warning Flags\n  6. Master Cohort Serialization to data/cohort.json\n\nWaiting for execution trigger...`
                )}</pre>
              </div>

              <!-- Handoff User Guide Box -->
              <div class="ingest-instructions-card">
                <h4>📘 How Incremental Handoff Works (Every 1–2 Weeks)</h4>
                <p style="margin: 0 0 0.45rem 0; color: #334155; line-height: 1.45;">
                  To update the dashboard with new data every 1–2 weeks:
                </p>
                <ol style="margin: 0 0 0.5rem 1.2rem; padding: 0; font-size: 0.8rem; color: #334155; line-height: 1.45;">
                  <li>Export your latest weekly support reports from Accelo.</li>
                  <li>Drop the new Excel spreadsheet into <strong><code>data/incoming/</code></strong>.</li>
                  <li>Click <strong>"Run Data Intake Pipeline Now"</strong> above!</li>
                </ol>
                <p style="margin: 0.4rem 0 0 0; font-size: 0.75rem; color: #64748b; line-height: 1.4;">
                  <em>✨ The model preserves all previous records in <code>data/historical_visits.json</code> and automatically deduplicates overlapping visits.</em>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
