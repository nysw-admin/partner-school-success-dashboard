import type { SchoolWithData } from '../../pipeline/generator.ts';

export interface FilterState {
  searchQuery: string;
  borough: string;
  gradeTier: string;
  completeness: string;
  gst: string;
  edTeam?: string;
}

export function renderSchoolTable(
  schools: SchoolWithData[],
  filters: FilterState
): string {
  if (schools.length === 0) {
    return `
      <div class="test-cleared-banner" style="background: var(--bg-card); border: 2px dashed #cbd5e1; border-radius: var(--radius-lg); padding: 3.5rem 2rem; text-align: center; margin-top: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="font-size: 3.5rem; margin-bottom: 0.75rem;">🧪</div>
        <h2 style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">
          Testing Mode: Dashboard is Cleared (0 Partner Schools Loaded)
        </h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 580px; margin: 0 auto 1.5rem auto; line-height: 1.6;">
          The active dashboard cohort has been cleared for testing. Your underlying operational spreadsheets are safe and intact in <code>1st slice of data SY 25-26/</code>.
          Click the button below to open the <strong>Data Ingestion Hub</strong> and click <strong>"Run Data Ingestion Pipeline Now"</strong> to populate all 405 schools!
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button id="table-open-ingest-btn" class="ingest-run-btn" style="padding: 0.75rem 1.75rem; font-size: 1rem; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);">
            <span>🚀</span>
            <span>Open Data Ingestion Hub & Run Pipeline</span>
          </button>
        </div>
      </div>
    `;
  }

  // Filter logic
  const filtered = schools.filter(item => {

    const s = item.school;
    const sc = item.score;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        s.name.toLowerCase().includes(q) ||
        s.dbn.toLowerCase().includes(q) ||
        s.assignedGst.toLowerCase().includes(q) ||
        (s.curriculumSpecialist && s.curriculumSpecialist.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (filters.borough && filters.borough !== 'all' && s.borough !== filters.borough) {
      return false;
    }

    if (filters.gradeTier && filters.gradeTier !== 'all' && sc.letterGrade !== filters.gradeTier) {
      return false;
    }

    if (filters.completeness && filters.completeness !== 'all' && sc.completeness.status !== filters.completeness) {
      return false;
    }

    if (filters.gst && filters.gst !== 'all' && s.assignedGst !== filters.gst) {
      return false;
    }

    if (filters.edTeam && filters.edTeam !== 'all' && s.curriculumSpecialist !== filters.edTeam) {
      return false;
    }

    return true;
  });

  const uniqueGsts = Array.from(new Set(schools.map(s => s.school.assignedGst))).sort();
  const uniqueEdTeam = Array.from(
    new Set(schools.map(s => s.school.curriculumSpecialist).filter(Boolean))
  ).sort() as string[];

  return `
    <div class="controls-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          id="school-search-input"
          class="search-input"
          placeholder="Search by school name, DBN, GST, or Ed Team..."
          value="${escapeHtml(filters.searchQuery)}"
        />
      </div>

      <div class="filter-group">
        <select id="borough-filter" class="filter-select">
          <option value="all" ${filters.borough === 'all' ? 'selected' : ''}>All Boroughs</option>
          <option value="Manhattan" ${filters.borough === 'Manhattan' ? 'selected' : ''}>Manhattan</option>
          <option value="Brooklyn" ${filters.borough === 'Brooklyn' ? 'selected' : ''}>Brooklyn</option>
          <option value="Bronx" ${filters.borough === 'Bronx' ? 'selected' : ''}>Bronx</option>
          <option value="Queens" ${filters.borough === 'Queens' ? 'selected' : ''}>Queens</option>
          <option value="Staten Island" ${filters.borough === 'Staten Island' ? 'selected' : ''}>Staten Island</option>
        </select>

        <select id="grade-filter" class="filter-select">
          <option value="all" ${filters.gradeTier === 'all' ? 'selected' : ''}>All Grade Tiers</option>
          <option value="A" ${filters.gradeTier === 'A' ? 'selected' : ''}>Grade A — Thriving</option>
          <option value="B" ${filters.gradeTier === 'B' ? 'selected' : ''}>Grade B — Healthy</option>
          <option value="C" ${filters.gradeTier === 'C' ? 'selected' : ''}>Grade C — Watch</option>
          <option value="D" ${filters.gradeTier === 'D' ? 'selected' : ''}>Grade D — Intervene</option>
          <option value="F" ${filters.gradeTier === 'F' ? 'selected' : ''}>Grade F — Below Floor / At Risk</option>
        </select>

        <select id="completeness-filter" class="filter-select">
          <option value="all" ${filters.completeness === 'all' ? 'selected' : ''}>All Completeness Gates</option>
          <option value="Normal" ${filters.completeness === 'Normal' ? 'selected' : ''}>Normal (≥85%)</option>
          <option value="Provisional" ${filters.completeness === 'Provisional' ? 'selected' : ''}>Provisional (70-84%)</option>
          <option value="Incomplete" ${filters.completeness === 'Incomplete' ? 'selected' : ''}>Incomplete (<70%)</option>
        </select>

        <select id="gst-filter" class="filter-select">
          <option value="all" ${filters.gst === 'all' ? 'selected' : ''}>All GST Staff</option>
          ${uniqueGsts.map(gst => `<option value="${gst}" ${filters.gst === gst ? 'selected' : ''}>${gst}</option>`).join('')}
        </select>

        <select id="edteam-filter" class="filter-select">
          <option value="all" ${filters.edTeam === 'all' ? 'selected' : ''}>All Ed Team</option>
          ${uniqueEdTeam.map(ed => `<option value="${ed}" ${filters.edTeam === ed ? 'selected' : ''}>${ed}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="table-container">
      <table class="school-table">
        <thead>
          <tr>
            <th style="width: 105px;">Grade & Score</th>
            <th style="min-width: 180px;">School / DBN</th>
            <th style="width: 100px;">Borough</th>
            <th style="width: 130px;">Status</th>
            <th style="width: 125px;">Assigned GST</th>
            <th style="width: 140px;">Ed Team Member</th>
            <th style="width: 115px;">Gate Status</th>
            <th style="width: 135px;">3-Bucket Breakdown</th>
            <th style="min-width: 140px;">Active Flags</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No schools match the selected filters.</td></tr>`
            : filtered.map(item => renderSchoolRow(item)).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderSchoolRow(item: SchoolWithData): string {
  const { school, score, flags } = item;
  const gradeClass = `badge-${score.letterGrade.toLowerCase()}`;

  let gateBadge = '';
  if (score.completeness.status === 'Normal') {
    gateBadge = `<span class="status-pill pill-healthy" title="Data Completeness: ${(score.completeness.rate * 100).toFixed(0)}%">✓ Complete</span>`;
  } else if (score.completeness.status === 'Provisional') {
    gateBadge = `<span class="status-pill pill-provisional" title="Data Completeness: ${(score.completeness.rate * 100).toFixed(0)}%">⚠️ Provisional (${(score.completeness.rate * 100).toFixed(0)}%)</span>`;
  } else {
    gateBadge = `<span class="status-pill pill-incomplete" title="Data Completeness: ${(score.completeness.rate * 100).toFixed(0)}%">🛑 Incomplete (${(score.completeness.rate * 100).toFixed(0)}%)</span>`;
  }

  const b1Pct = Math.round(score.bucket1.percentage * 100);
  const b2Pct = Math.round(score.bucket2.percentage * 100);
  const b3Pct = Math.round(score.bucket3.percentage * 100);

  return `
    <tr class="school-row" data-dbn="${school.dbn}">
      <td>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="grade-badge ${gradeClass}">
            ${score.letterGrade}
          </div>
          <div>
            <div style="font-family: var(--font-heading); font-weight: 800; font-size: 1.1rem; line-height: 1;">
              ${score.overallScore.toFixed(1)}
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
              ${score.tier.split('—')[1]?.trim() || ''}
            </div>
          </div>
        </div>
      </td>

      <td>
        <div class="school-name-cell">
          <span class="school-title">${escapeHtml(school.name)}</span>
          <span class="school-subtext">
            <code>${school.dbn}</code>
            ${school.hasAquaponics ? '<span class="status-pill" style="background:#e0f2fe; color:#0369a1; padding:0.1rem 0.4rem; font-size:0.65rem;">AQX Setup</span>' : ''}
          </span>
        </div>
      </td>

      <td>
        <span style="font-weight: 600; color: var(--text-main);">${school.borough}</span>
      </td>

      <td>
        <div style="display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start;">
          <span class="program-status-badge ${getProgramYearClass(school.programYear)}">${school.programYear}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Installed ${school.installationDate}</span>
        </div>
      </td>

      <td>
        <span style="font-weight: 500;">${school.assignedGst}</span>
      </td>

      <td>
        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <span style="font-size: 0.85rem;" title="NYSW Curriculum Specialist">🎓</span>
          <span style="font-weight: 500; color: var(--text-main);">${escapeHtml(school.curriculumSpecialist || 'Heather Holz')}</span>
        </div>
      </td>

      <td>
        ${gateBadge}
      </td>

      <td>
        <div class="bucket-mini-group" title="B1: ${score.bucket1.earnedPoints}/42 · B2: ${score.bucket2.earnedPoints}/40 · B3: ${score.bucket3.earnedPoints}/18">
          <div class="bucket-mini-col">
            <span style="color: var(--text-muted);">B1: ${b1Pct}%</span>
            <div class="bucket-mini-bar">
              <div class="bucket-fill" style="width: ${b1Pct}%; background: ${b1Pct >= 65 ? 'var(--tier-thriving)' : 'var(--tier-risk)'};"></div>
            </div>
          </div>
          <div class="bucket-mini-col">
            <span style="color: var(--text-muted);">B2: ${b2Pct}%</span>
            <div class="bucket-mini-bar">
              <div class="bucket-fill" style="width: ${b2Pct}%; background: ${b2Pct >= 65 ? 'var(--accent-cyan)' : 'var(--tier-risk)'};"></div>
            </div>
          </div>
          <div class="bucket-mini-col">
            <span style="color: var(--text-muted);">B3: ${b3Pct}%</span>
            <div class="bucket-mini-bar">
              <div class="bucket-fill" style="width: ${b3Pct}%; background: ${b3Pct >= 65 ? '#8b5cf6' : 'var(--tier-risk)'};"></div>
            </div>
          </div>
        </div>
      </td>

      <td>
        ${flags.length === 0
          ? `<span style="font-size: 0.8rem; color: var(--tier-thriving);">✓ Clear</span>`
          : `<div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              ${flags.map(f => `
                <span class="active-flag-chip ${f.severity === 'critical' ? '' : 'warning'}" title="${escapeHtml(f.title)}: ${escapeHtml(f.description)} (${f.weeksActive} wks active)">
                  🚨 ${escapeHtml(f.title.split(' ')[0])} (${f.weeksActive}w)
                </span>
              `).join('')}
            </div>`
        }
      </td>
    </tr>
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

function getProgramYearClass(year: string): string {
  switch (year) {
    case 'Implementation': return 'prog-implementation';
    case 'Op Y1': return 'prog-opy1';
    case 'Op Y2': return 'prog-opy2';
    case 'Op Y3+': return 'prog-opy3';
    default: return '';
  }
}

