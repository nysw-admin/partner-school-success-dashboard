import { generateRealisticCohort, type SchoolWithData } from './pipeline/generator.ts';
import type { FlaggedSchoolReport } from './types/flags.ts';
import { renderNavbar } from './ui/components/Navbar.ts';
import { renderMetricsRibbon } from './ui/components/MetricsRibbon.ts';
import { renderSchoolTable, type FilterState } from './ui/components/SchoolTable.ts';
import { renderFlaggedWatchlist, renderSchoolLogSection } from './ui/components/FlaggedWatchlist.ts';
import { renderSchoolDrawer } from './ui/components/SchoolDrawer.ts';
import { addLogEntry, deleteLogEntry } from './services/flagLogStore.ts';
import { renderAIAgentModal, type AIMessage } from './ui/components/AIAgentModal.ts';
import { generateSchoolExecutiveReport, askSchoolCopilot } from './services/aiAgent.ts';

interface AppState {
  activeTab: 'directory' | 'watchlist';
  filters: FilterState;
  selectedSchoolDbn: string | null;
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
  isAIAgentOpen: boolean;
  aiFocusSchoolDbn: string | null;
  aiMessages: AIMessage[];
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
  schools: cohort.schools,
  flaggedReports: cohort.flaggedReports,
  isAIAgentOpen: false,
  aiFocusSchoolDbn: null,
  aiMessages: [initialWelcomeMsg],
};

function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  const selectedSchool = state.selectedSchoolDbn
    ? state.schools.find(s => s.school.dbn === state.selectedSchoolDbn) || null
    : null;

  app.innerHTML = `
    <div class="app-container">
      ${renderNavbar()}

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

      <!-- Main Body Container -->
      <main class="main-content">
        ${renderMetricsRibbon(state.schools, state.flaggedReports)}

        <div id="view-container">
          ${state.activeTab === 'directory'
            ? renderSchoolTable(state.schools, state.filters)
            : renderFlaggedWatchlist(state.flaggedReports)
          }
        </div>
      </main>

      <!-- Detail Drawer Modal -->
      ${selectedSchool ? renderSchoolDrawer(selectedSchool) : ''}

      <!-- AI Copilot Modal -->
      ${state.isAIAgentOpen ? renderAIAgentModal(state.schools, state.aiFocusSchoolDbn, state.aiMessages) : ''}
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

  // Escape key to close modal
  window.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (state.isAIAgentOpen) {
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

// Initial render on DOM load
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
renderApp();
