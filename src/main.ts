import { generateRealisticCohort, type SchoolWithData } from './pipeline/generator.ts';
import type { FlaggedSchoolReport } from './types/flags.ts';
import { renderNavbar } from './ui/components/Navbar.ts';
import { renderMetricsRibbon } from './ui/components/MetricsRibbon.ts';
import { renderSchoolTable, type FilterState } from './ui/components/SchoolTable.ts';
import { renderFlaggedWatchlist, renderSchoolLogSection } from './ui/components/FlaggedWatchlist.ts';
import { renderSchoolDrawer } from './ui/components/SchoolDrawer.ts';
import { addLogEntry, deleteLogEntry } from './services/flagLogStore.ts';

interface AppState {
  activeTab: 'directory' | 'watchlist';
  filters: FilterState;
  selectedSchoolDbn: string | null;
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
}

const cohort = generateRealisticCohort();

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
    if (e.key === 'Escape' && state.selectedSchoolDbn) {
      state.selectedSchoolDbn = null;
      renderApp();
    }
  };

  // Wire up flag log forms and deletion buttons
  attachFlagLogListeners();
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
