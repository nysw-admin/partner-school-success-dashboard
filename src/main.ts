import { generateRealisticCohort, sortSchoolsByGradeDesc, type SchoolWithData } from './pipeline/generator.ts';
import type { FlaggedSchoolReport } from './types/flags.ts';
import { renderNavbar } from './ui/components/Navbar.ts';
import { renderMetricsRibbon } from './ui/components/MetricsRibbon.ts';
import { renderSchoolTable, type FilterState } from './ui/components/SchoolTable.ts';
import { renderFlaggedWatchlist, renderSchoolLogSection } from './ui/components/FlaggedWatchlist.ts';
import { renderSchoolDrawer } from './ui/components/SchoolDrawer.ts';
import { addLogEntry, deleteLogEntry } from './services/flagLogStore.ts';
import { renderAIAgentModal, type AIMessage } from './ui/components/AIAgentModal.ts';
import { generateSchoolExecutiveReport, askSchoolCopilot } from './services/aiAgent.ts';
import { renderDataIngestionModal, type IngestionStatusData } from './ui/components/DataIngestionModal.ts';
import { renderSnapshotModal } from './ui/components/SnapshotModal.ts';
import {
  getAllSnapshots,
  compileCurrentCohortAsSnapshot,
  convertSnapshotToSchoolWithData,
  deleteUserSnapshot,
} from './services/snapshotService.ts';
import type { EndOfYearSnapshot } from './types/snapshot.ts';

interface AppState {
  activeTab: 'directory' | 'watchlist';
  filters: FilterState;
  selectedSchoolDbn: string | null;
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
  isAIAgentOpen: boolean;
  aiFocusSchoolDbn: string | null;
  aiMessages: AIMessage[];
  isIngestModalOpen: boolean;
  ingestStatusData: IngestionStatusData | null;
  isIngesting: boolean;
  ingestLogOutput: string | null;
  ingestError: string | null;
  ingestSuccessToast: string | null;
  isSnapshotModalOpen: boolean;
  activeSnapshotId: string | null;
  snapshotSaveSuccess: string | null;
  isSavingSnapshot: boolean;
  availableSnapshots: EndOfYearSnapshot[];
  liveSchoolsBackup: SchoolWithData[];
  liveFlaggedBackup: FlaggedSchoolReport[];
}

const cohort = generateRealisticCohort();

const initialWelcomeMsg: AIMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  content: `### 👋 Welcome to the NYSW School Intelligence Copilot!

I am your operational decision-support agent with real-time access to all **33 partner schools**, 100-point rubric scores, 3-bucket diagnostics, agricultural crop harvests, early-warning flags, and logged team updates.

**What I can do for you:**
* **Full Executive Reports:** Ask *"Generate reports"*, *"Status of each school"*, or *"Report for PS 147"*
* **Rankings & Leaderboards:** Ask *"Show top list schools"* or *"Show bottom schools needing intervention"*
* **Early-Warning Diagnostics:** Ask *"Show all flagged schools"* or *"Why is PS 208 flagged?"*
* **Agricultural Profiles:** Ask *"What crops are grown at PS 199?"* or *"Show Aquaponics setups"*
* **Staffing & Interventions:** Ask *"Who is assigned to Edison Tech?"* or *"Draft intervention email to Principal"*

Select any quick action chip above or type your question below!`,
  timestamp: 'Ready',
  suggestedFollowUps: [
    'Generate comprehensive network executive summary report',
    'Show top list schools and rankings',
    'Show bottom schools needing intervention and lowest scores',
    'Show all flagged schools on the watchlist'
  ]
};

// Live cohort is fully loaded and displayed by default (all partner schools, scores & flags)
const isTestingCleared = false;

const state: AppState = {
  activeTab: 'directory',
  filters: {
    searchQuery: '',
    borough: 'all',
    gradeTier: 'all',
    completeness: 'all',
    gst: 'all',
    edTeam: 'all',
  },
  selectedSchoolDbn: null,
  schools: isTestingCleared ? [] : cohort.schools,
  flaggedReports: isTestingCleared ? [] : cohort.flaggedReports,
  isAIAgentOpen: false,
  aiFocusSchoolDbn: null,
  aiMessages: [initialWelcomeMsg],
  isIngestModalOpen: false,
  ingestStatusData: null,
  isIngesting: false,
  ingestLogOutput: isTestingCleared
    ? `[TEST MODE ACTIVE] Dashboard is CLEARED (0 partner schools loaded).\n\nSpreadsheets in "data/incoming/" are safe & intact.\n\nReady to test the pipeline:\n  1. Click "Run Data Intake Pipeline Now" above.\n  2. The pipeline will ingest all 7 Excel files and extract Assigned GSTs from Column A.\n  3. Rubric scores and flags will be calculated.\n  4. All 405 schools will populate the dashboard in real time!\n\nWaiting for you to click "Run Data Intake Pipeline Now"...`
    : null,
  ingestError: null,
  ingestSuccessToast: null,
  isSnapshotModalOpen: false,
  activeSnapshotId: null,
  snapshotSaveSuccess: null,
  isSavingSnapshot: false,
  availableSnapshots: getAllSnapshots(cohort.schools),
  liveSchoolsBackup: isTestingCleared ? [] : cohort.schools,
  liveFlaggedBackup: isTestingCleared ? [] : cohort.flaggedReports,
};

function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  const selectedSchool = state.selectedSchoolDbn
    ? state.schools.find(s => s.school.dbn === state.selectedSchoolDbn) || null
    : null;

  const currentSnapshot = state.activeSnapshotId
    ? state.availableSnapshots.find(s => s.snapshotId === state.activeSnapshotId) || null
    : null;

  app.innerHTML = `
    <div class="app-container">
      ${renderNavbar(state.schools.length, state.availableSnapshots, state.activeSnapshotId)}

      <!-- Navigation Tabs -->
      <nav class="view-tabs" aria-label="Dashboard Views">
        <button id="tab-directory-btn" class="tab-btn ${state.activeTab === 'directory' ? 'active' : ''}">
          <span>🏫</span> Partner School Directory (${state.schools.length})
        </button>
        <button id="tab-watchlist-btn" class="tab-btn ${state.activeTab === 'watchlist' ? 'active' : ''}">
          <span>🚨</span> Weekly Flagged Watchlist
          <span class="tab-badge">${state.flaggedReports.length}</span>
        </button>
      </nav>

      ${state.ingestSuccessToast ? `
        <div class="ingest-success-toast" id="ingest-success-toast" role="status" aria-live="polite">
          <div class="toast-content">
            <span class="toast-icon">✅</span>
            <div class="toast-body">
              <strong class="toast-title">Data Intake Complete!</strong>
              <span class="toast-desc">${state.ingestSuccessToast}</span>
            </div>
          </div>
          <button id="close-toast-btn" class="toast-close-btn" aria-label="Dismiss notification" title="Dismiss">✕</button>
        </div>
      ` : ''}

      <!-- Main Body Container -->
      <main class="main-content">
        ${currentSnapshot ? `
          <div class="archived-snapshot-banner" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; border-radius: var(--radius-lg); padding: 1rem 1.4rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm); flex-wrap: wrap; gap: 0.85rem; border: 1px solid #334155;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <span style="font-size: 1.75rem;">📁</span>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <strong style="font-family: var(--font-heading); font-size: 1.05rem; color: #ffffff;">
                    VIEWING ARCHIVED RECORD: ${currentSnapshot.schoolYear}
                  </strong>
                  <span class="status-pill" style="background: rgba(255,255,255,0.15); color: #e2e8f0; font-size: 0.68rem; border: none; font-weight: 700;">
                    FROZEN HISTORICAL SNAPSHOT (READ-ONLY)
                  </span>
                </div>
                <p style="font-size: 0.8rem; color: #94a3b8; margin: 0.2rem 0 0 0;">
                  Archived by <strong>${currentSnapshot.archivedBy || 'NYSW Operations'}</strong> on ${new Date(currentSnapshot.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · <strong>${currentSnapshot.totalSchools}</strong> partner schools recorded · Network Avg: <strong>${currentSnapshot.networkSummary.averageOverallScore.toFixed(1)}/100</strong>
                </p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button id="banner-open-snapshot-btn" class="filter-select" style="background: #334155; color: #ffffff; border: 1px solid #475569; padding: 0.45rem 0.85rem; font-size: 0.78rem; cursor: pointer;">
                📸 Snapshot Archives
              </button>
              <button id="banner-switch-to-live-btn" class="ingest-run-btn" style="background: #10b981; border: none; padding: 0.45rem 1rem; font-size: 0.8rem;">
                <span>↩️</span> Return to Live SY 2025–2026 Cohort
              </button>
            </div>
          </div>
        ` : ''}

        ${renderMetricsRibbon(state.schools, state.flaggedReports)}

        <div id="view-container">
          ${state.activeTab === 'directory'
            ? renderSchoolTable(state.schools, state.filters)
            : renderFlaggedWatchlist(state.flaggedReports)
          }
        </div>
      </main>

      <!-- Detail Drawer Modal -->
      ${selectedSchool ? renderSchoolDrawer(selectedSchool, state.availableSnapshots) : ''}

      <!-- AI Copilot Modal -->
      ${state.isAIAgentOpen ? renderAIAgentModal(state.schools, state.aiFocusSchoolDbn, state.aiMessages) : ''}

      <!-- Data Ingestion Hub Modal -->
      ${state.isIngestModalOpen ? renderDataIngestionModal(state.ingestStatusData, state.isIngesting, state.ingestLogOutput, state.ingestError, state.schools.length) : ''}

      <!-- End-of-Year Snapshot Hub Modal -->
      ${state.isSnapshotModalOpen ? renderSnapshotModal(state.liveSchoolsBackup.length > 0 ? state.liveSchoolsBackup : state.schools, state.availableSnapshots, state.isSavingSnapshot, state.snapshotSaveSuccess, state.activeSnapshotId) : ''}
    </div>
  `;

  attachEventListeners();
}

function attachEventListeners() {
  // Tab switching
  const tabDir = document.getElementById('tab-directory-btn');
  const tabWatch = document.getElementById('tab-watchlist-btn');

  tabDir?.addEventListener('click', () => {
    state.activeTab = 'directory';
    renderApp();
  });

  tabWatch?.addEventListener('click', () => {
    state.activeTab = 'watchlist';
    renderApp();
  });

  // Open Data Ingestion Hub modal from Navbar
  const openIngestBtn = document.getElementById('open-ingest-modal-btn');
  openIngestBtn?.addEventListener('click', async () => {
    state.isIngestModalOpen = true;
    renderApp();
    await fetchIngestStatus();
  });

  // Close Data Ingestion Hub modal
  const closeIngestBtn = document.getElementById('close-ingest-modal-btn');
  closeIngestBtn?.addEventListener('click', () => {
    state.isIngestModalOpen = false;
    renderApp();
  });

  const ingestOverlay = document.getElementById('ingest-modal-overlay');
  ingestOverlay?.addEventListener('click', (e) => {
    if (e.target === ingestOverlay) {
      state.isIngestModalOpen = false;
      renderApp();
    }
  });

  // Refresh source files status
  const refreshSourcesBtn = document.getElementById('refresh-sources-btn');
  refreshSourcesBtn?.addEventListener('click', async () => {
    await fetchIngestStatus();
  });

  // Run data ingestion pipeline
  const runIngestBtn = document.getElementById('run-ingest-pipeline-btn');
  runIngestBtn?.addEventListener('click', async () => {
    await triggerDataIngestion();
  });

  // Dismiss success toast banner
  const closeToastBtn = document.getElementById('close-toast-btn');
  closeToastBtn?.addEventListener('click', () => {
    if (toastTimer) clearTimeout(toastTimer);
    state.ingestSuccessToast = null;
    renderApp();
  });

  // Clear dashboard in testing mode
  const clearTestBtn = document.getElementById('clear-test-dashboard-btn');
  clearTestBtn?.addEventListener('click', () => {
    sessionStorage.setItem('nysw_test_cleared', 'true');
    state.schools = [];
    state.flaggedReports = [];
    state.selectedSchoolDbn = null;
    state.ingestLogOutput = `[TEST MODE ACTIVE] Dashboard successfully CLEARED (0 partner schools active).\n\nSpreadsheets in "data/incoming/" are completely safe and untouched.\n\nNow click "Run Data Intake Pipeline Now" to verify that the automated pipeline repopulates all 405 schools!`;
    renderApp();
  });

  // Open ingest modal from empty state banner
  const tableOpenIngestBtn = document.getElementById('table-open-ingest-btn');
  tableOpenIngestBtn?.addEventListener('click', async () => {
    state.isIngestModalOpen = true;
    renderApp();
    if (!state.ingestStatusData) {
      await fetchIngestStatus();
    }
  });

  // Open AI Agent modal from Navbar
  const openAIBtn = document.getElementById('open-ai-agent-btn');
  openAIBtn?.addEventListener('click', () => {
    state.isAIAgentOpen = true;
    renderApp();
    scrollToBottomAIMessages();
  });

  // Generate AI Report buttons (from Drawer or Watchlist cards)
  document.querySelectorAll('.ai-generate-report-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dbn = btn.getAttribute('data-dbn');
      if (!dbn) return;
      const target = state.schools.find(s => s.school.dbn.toUpperCase() === dbn.toUpperCase());
      if (!target) return;

      state.aiFocusSchoolDbn = dbn;
      state.isAIAgentOpen = true;
      state.selectedSchoolDbn = null;

      const reportMarkdown = generateSchoolExecutiveReport(target);
      const reportMsg: AIMessage = {
        id: `msg-${Date.now()}-report`,
        sender: 'assistant',
        content: reportMarkdown,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        schoolDbn: dbn,
        suggestedFollowUps: [
          `What are the active flags for ${target.school.dbn}?`,
          `What crops are grown at ${target.school.dbn}?`,
          `Draft an intervention email to Principal of ${target.school.name}`,
          'Show top list schools'
        ]
      };
      state.aiMessages.push(reportMsg);
      renderApp();
      scrollToBottomAIMessages();
    });
  });

  // Close AI modal button
  const closeAIMsgBtn = document.getElementById('close-ai-modal-btn');
  closeAIMsgBtn?.addEventListener('click', () => {
    state.isAIAgentOpen = false;
    renderApp();
  });

  // Click outside to close AI modal
  const aiModalOverlay = document.getElementById('ai-agent-modal-overlay');
  aiModalOverlay?.addEventListener('click', (e) => {
    if (e.target === aiModalOverlay) {
      state.isAIAgentOpen = false;
      renderApp();
    }
  });

  // Focus school change in AI modal
  const focusSelect = document.getElementById('ai-focus-school-select') as HTMLSelectElement | null;
  focusSelect?.addEventListener('change', () => {
    state.aiFocusSchoolDbn = focusSelect.value === 'network' ? null : focusSelect.value;
    renderApp();
  });

  // Quick Action Chips in AI modal
  document.querySelectorAll('.ai-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        handleUserQuery(prompt);
      }
    });
  });

  // Clickable suggested follow-up chips
  document.querySelectorAll('.ai-followup-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const prompt = pill.getAttribute('data-prompt');
      if (prompt) {
        handleUserQuery(prompt);
      }
    });
  });

  // Copy AI report / message button
  document.querySelectorAll('.ai-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const copyId = btn.getAttribute('data-copy-id');
      const msg = state.aiMessages.find(m => m.id === copyId);
      if (msg) {
        navigator.clipboard.writeText(msg.content);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 1800);
      }
    });
  });

  // AI Chat form submit
  const aiChatForm = document.getElementById('ai-chat-form') as HTMLFormElement | null;
  const aiChatInput = document.getElementById('ai-chat-input') as HTMLInputElement | null;
  aiChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = aiChatInput?.value.trim();
    if (query) {
      if (aiChatInput) aiChatInput.value = '';
      handleUserQuery(query);
    }
  });

  // Filter inputs
  const searchInput = document.getElementById('school-search-input') as HTMLInputElement | null;
  const boroughFilter = document.getElementById('borough-filter') as HTMLSelectElement | null;
  const gradeFilter = document.getElementById('grade-filter') as HTMLSelectElement | null;
  const compFilter = document.getElementById('completeness-filter') as HTMLSelectElement | null;
  const gstFilter = document.getElementById('gst-filter') as HTMLSelectElement | null;
  const edTeamFilter = document.getElementById('edteam-filter') as HTMLSelectElement | null;

  searchInput?.addEventListener('input', (e) => {
    state.filters.searchQuery = (e.target as HTMLInputElement).value;
    updateTableViewOnly();
  });

  boroughFilter?.addEventListener('change', (e) => {
    state.filters.borough = (e.target as HTMLSelectElement).value;
    updateTableViewOnly();
  });

  gradeFilter?.addEventListener('change', (e) => {
    state.filters.gradeTier = (e.target as HTMLSelectElement).value;
    updateTableViewOnly();
  });

  compFilter?.addEventListener('change', (e) => {
    state.filters.completeness = (e.target as HTMLSelectElement).value;
    updateTableViewOnly();
  });

  gstFilter?.addEventListener('change', (e) => {
    state.filters.gst = (e.target as HTMLSelectElement).value;
    updateTableViewOnly();
  });

  edTeamFilter?.addEventListener('change', (e) => {
    state.filters.edTeam = (e.target as HTMLSelectElement).value;
    updateTableViewOnly();
  });

  // School row clicks
  document.querySelectorAll('.school-row').forEach(row => {
    row.addEventListener('click', () => {
      const dbn = row.getAttribute('data-dbn');
      if (dbn) {
        state.selectedSchoolDbn = dbn;
        renderApp();
      }
    });
  });

  // Open drawer buttons in watchlist
  document.querySelectorAll('.open-drawer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dbn = btn.getAttribute('data-dbn');
      if (dbn) {
        state.selectedSchoolDbn = dbn;
        renderApp();
      }
    });
  });

  // Close modal button
  const closeBtn = document.getElementById('close-modal-btn');
  closeBtn?.addEventListener('click', () => {
    state.selectedSchoolDbn = null;
    renderApp();
  });

  // Click outside to close modal
  const modalOverlay = document.getElementById('school-modal-overlay');
  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      state.selectedSchoolDbn = null;
      renderApp();
    }
  });

  // Open Snapshot modal from Navbar or Banner
  document.getElementById('open-snapshot-modal-btn')?.addEventListener('click', () => {
    state.isSnapshotModalOpen = true;
    state.snapshotSaveSuccess = null;
    renderApp();
  });

  document.getElementById('banner-open-snapshot-btn')?.addEventListener('click', () => {
    state.isSnapshotModalOpen = true;
    state.snapshotSaveSuccess = null;
    renderApp();
  });

  // Close Snapshot modal
  document.getElementById('close-snapshot-modal-btn')?.addEventListener('click', () => {
    state.isSnapshotModalOpen = false;
    renderApp();
  });

  document.getElementById('footer-close-snapshot-btn')?.addEventListener('click', () => {
    state.isSnapshotModalOpen = false;
    renderApp();
  });

  const snapOverlay = document.getElementById('snapshot-modal-overlay');
  snapOverlay?.addEventListener('click', (e) => {
    if (e.target === snapOverlay) {
      state.isSnapshotModalOpen = false;
      renderApp();
    }
  });

  // Interactive School Year dropdown selector in Navbar
  const sySelect = document.getElementById('navbar-sy-select') as HTMLSelectElement | null;
  sySelect?.addEventListener('change', () => {
    const val = sySelect.value;
    if (val === 'live') {
      switchToLiveCohort();
    } else {
      switchToSnapshot(val);
    }
  });

  // Switch back to live cohort buttons
  document.getElementById('banner-switch-to-live-btn')?.addEventListener('click', () => {
    switchToLiveCohort();
  });

  document.querySelectorAll<HTMLButtonElement>('.switch-to-live-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchToLiveCohort();
    });
  });

  // View snapshot button inside modal list
  document.querySelectorAll<HTMLButtonElement>('.view-snapshot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const snapId = btn.getAttribute('data-snapshot-id');
      if (snapId) {
        switchToSnapshot(snapId);
      }
    });
  });

  // Export JSON buttons
  document.querySelectorAll<HTMLButtonElement>('.export-snapshot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const snapId = btn.getAttribute('data-snapshot-id');
      if (snapId) {
        const snap = state.availableSnapshots.find(s => s.snapshotId === snapId);
        if (snap) {
          downloadJsonFile(snap, `nysw_snapshot_${snap.schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        }
      }
    });
  });

  document.getElementById('download-snapshot-json-btn')?.addEventListener('click', () => {
    const sourceCohort = state.liveSchoolsBackup.length > 0 ? state.liveSchoolsBackup : state.schools;
    const tempSnap = compileCurrentCohortAsSnapshot('SY 2025–2026', 'Manual JSON backup', sourceCohort);
    downloadJsonFile(tempSnap, `nysw_cohort_SY25_26_${Date.now()}.json`);
  });

  // Save new End-of-Year snapshot form
  const saveSnapForm = document.getElementById('save-snapshot-form') as HTMLFormElement | null;
  saveSnapForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const syInput = document.getElementById('snapshot-school-year') as HTMLInputElement | null;
    const archInput = document.getElementById('snapshot-archived-by') as HTMLInputElement | null;
    const notesInput = document.getElementById('snapshot-notes') as HTMLTextAreaElement | null;

    const syVal = syInput?.value.trim() || 'SY 2025–2026 (Final)';
    const archVal = archInput?.value.trim() || 'NYSW Operations';
    const notesVal = notesInput?.value.trim() || 'Official End-of-Year final snapshot.';

    state.isSavingSnapshot = true;
    renderApp();

    const sourceCohort = state.liveSchoolsBackup.length > 0 ? state.liveSchoolsBackup : state.schools;
    const newSnapshot = compileCurrentCohortAsSnapshot(syVal, notesVal, sourceCohort);
    newSnapshot.archivedBy = archVal;

    try {
      await fetch('/api/snapshots/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: newSnapshot }),
      });
    } catch {}

    state.availableSnapshots = getAllSnapshots(sourceCohort);
    state.isSavingSnapshot = false;
    state.snapshotSaveSuccess = `Successfully archived "${newSnapshot.schoolYear}" with ${newSnapshot.totalSchools} partner schools. Persisted to local records & data/snapshots/.`;
    renderApp();
  });

  // Delete snapshot
  document.querySelectorAll<HTMLButtonElement>('.delete-snapshot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const snapId = btn.getAttribute('data-snapshot-id');
      const yearName = btn.getAttribute('data-year') || 'this snapshot';
      if (!snapId) return;
      if (confirm(`Are you sure you want to delete the archived snapshot "${yearName}"?`)) {
        deleteUserSnapshot(snapId);
        if (state.activeSnapshotId === snapId) {
          switchToLiveCohort();
        } else {
          const sourceCohort = state.liveSchoolsBackup.length > 0 ? state.liveSchoolsBackup : state.schools;
          state.availableSnapshots = getAllSnapshots(sourceCohort);
          renderApp();
        }
      }
    });
  });

  // Escape key to close modal
  window.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (state.isSnapshotModalOpen) {
        state.isSnapshotModalOpen = false;
        renderApp();
      } else if (state.isAIAgentOpen) {
        state.isAIAgentOpen = false;
        renderApp();
      } else if (state.selectedSchoolDbn) {
        state.selectedSchoolDbn = null;
        renderApp();
      }
    }
  };

  // Wire up flag log forms and deletion buttons
  attachFlagLogListeners();
}

function switchToLiveCohort() {
  state.activeSnapshotId = null;
  state.schools = state.liveSchoolsBackup.length > 0 ? state.liveSchoolsBackup : cohort.schools;
  state.flaggedReports = state.liveFlaggedBackup.length > 0 ? state.liveFlaggedBackup : cohort.flaggedReports;
  state.selectedSchoolDbn = null;
  state.isSnapshotModalOpen = false;
  renderApp();
}

function switchToSnapshot(snapshotId: string) {
  const snap = state.availableSnapshots.find(s => s.snapshotId === snapshotId);
  if (!snap) return;
  if (!state.activeSnapshotId && state.schools.length > 0) {
    state.liveSchoolsBackup = [...state.schools];
    state.liveFlaggedBackup = [...state.flaggedReports];
  }
  const converted = convertSnapshotToSchoolWithData(snap);
  state.activeSnapshotId = snapshotId;
  state.schools = converted.schools;
  state.flaggedReports = converted.flaggedReports;
  state.selectedSchoolDbn = null;
  state.isSnapshotModalOpen = false;
  renderApp();
}

function downloadJsonFile(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleUserQuery(query: string) {
  const userMsg: AIMessage = {
    id: `msg-${Date.now()}-u`,
    sender: 'user',
    content: query,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
  state.aiMessages.push(userMsg);
  renderApp();
  scrollToBottomAIMessages();

  const focusedSchool = state.aiFocusSchoolDbn
    ? state.schools.find(s => s.school.dbn.toUpperCase() === state.aiFocusSchoolDbn!.toUpperCase()) || null
    : null;

  const result = await askSchoolCopilot(query, focusedSchool, state.schools, state.flaggedReports);

  if (result.focusedSchoolDbn) {
    state.aiFocusSchoolDbn = result.focusedSchoolDbn;
  }

  const assistantMsg: AIMessage = {
    id: `msg-${Date.now()}-a`,
    sender: 'assistant',
    content: result.answer,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    schoolDbn: result.focusedSchoolDbn,
    suggestedFollowUps: result.suggestedFollowUps,
  };
  state.aiMessages.push(assistantMsg);
  renderApp();
  scrollToBottomAIMessages();
}

function scrollToBottomAIMessages() {
  setTimeout(() => {
    const container = document.getElementById('ai-chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    input?.focus();
  }, 50);
}

function attachFlagLogListeners() {
  document.querySelectorAll<HTMLFormElement>('.flag-log-form').forEach(form => {
    if (form.hasAttribute('data-bound')) return;
    form.setAttribute('data-bound', 'true');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const dbn = form.getAttribute('data-dbn');
      if (!dbn) return;

      const statusEl = document.getElementById(`log-status-${dbn}`) as HTMLSelectElement | null;
      const authorEl = document.getElementById(`log-author-${dbn}`) as HTMLInputElement | null;
      const noteEl = document.getElementById(`log-note-${dbn}`) as HTMLTextAreaElement | null;

      const note = noteEl?.value.trim();
      if (!note) return;

      const status = statusEl?.value || 'In Progress';
      const author = authorEl?.value.trim() || 'NYSW Team';

      addLogEntry(dbn, note, author, status);

      // Refresh any log containers for this school
      document.querySelectorAll<HTMLElement>(`.flag-log-container[data-dbn="${dbn}"]`).forEach(container => {
        container.outerHTML = renderSchoolLogSection(dbn);
      });

      attachFlagLogListeners();

      document.querySelectorAll<HTMLElement>(`.flag-log-container[data-dbn="${dbn}"]`).forEach(container => {
        container.classList.add('just-updated');
        setTimeout(() => container.classList.remove('just-updated'), 1500);
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.delete-log-btn').forEach(btn => {
    if (btn.hasAttribute('data-bound')) return;
    btn.setAttribute('data-bound', 'true');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const logId = btn.getAttribute('data-log-id');
      const dbn = btn.getAttribute('data-dbn');
      if (!logId || !dbn) return;

      deleteLogEntry(logId);

      document.querySelectorAll<HTMLElement>(`.flag-log-container[data-dbn="${dbn}"]`).forEach(container => {
        container.outerHTML = renderSchoolLogSection(dbn);
      });

      attachFlagLogListeners();
    });
  });
}

function updateTableViewOnly() {
  const container = document.getElementById('view-container');
  if (container && state.activeTab === 'directory') {
    container.innerHTML = renderSchoolTable(state.schools, state.filters);
    attachEventListeners();
    // Maintain input focus
    const input = document.getElementById('school-search-input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

let toastTimer: any = null;

function showIngestSuccessToast(message: string) {
  state.ingestSuccessToast = message;
  renderApp();
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.ingestSuccessToast = null;
    renderApp();
  }, 6000);
}

async function fetchIngestStatus(shouldRender: boolean = true) {
  try {
    const res = await fetch('/api/ingest-status');
    if (res.ok) {
      const data = await res.json();
      state.ingestStatusData = data;
      state.ingestError = null;
    } else {
      state.ingestError = 'Could not load data source status from server.';
    }
  } catch (err: any) {
    state.ingestError = err.message || 'Error communicating with local server.';
  }
  if (shouldRender) {
    renderApp();
  }
}

async function triggerDataIngestion() {
  state.isIngesting = true;
  state.ingestError = null;
  state.ingestLogOutput = '[RUNNING] Executing Python ingestion pipeline...\nProcessing 7 operational data sources in data/incoming/...\nMapping Assigned GSTs from Column A...\nRecalculating 100-point rubric scores across all schools...';
  renderApp();

  try {
    const res = await fetch('/api/run-ingest', { method: 'POST' });
    const data = await res.json();
    state.isIngesting = false;
    if (data.success) {
      state.ingestLogOutput = data.output;
      state.ingestError = null;
      if (data.cohort && data.cohort.schools) {
        sessionStorage.setItem('nysw_test_cleared', 'false');
        const sorted = [...data.cohort.schools].sort(sortSchoolsByGradeDesc);
        state.schools = sorted;
        state.flaggedReports = data.cohort.flaggedReports;
        state.liveSchoolsBackup = [...sorted];
        state.liveFlaggedBackup = [...data.cohort.flaggedReports];
        state.availableSnapshots = getAllSnapshots(sorted);
      }
      await fetchIngestStatus(false);

      // Close the data ingestion window and show the dashboard
      state.isIngestModalOpen = false;
      state.selectedSchoolDbn = null;
      state.activeTab = 'directory';
      showIngestSuccessToast(`Data intake complete! Evaluated ${state.schools.length} partner schools with active rubric scores and early-warning flags.`);
    } else {
      state.ingestError = data.error || 'Ingestion encountered an issue.';
      state.ingestLogOutput = (data.stdout || '') + '\n' + (data.stderr || data.error || '');
      renderApp();
    }
  } catch (err: any) {
    state.isIngesting = false;
    state.ingestError = err.message || 'Failed to trigger ingestion pipeline.';
    renderApp();
  }
}

// Initial render on DOM load
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
renderApp();
