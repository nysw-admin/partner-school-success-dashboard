import type { SchoolWithData } from '../../pipeline/generator.ts';

export interface FilterState {
  searchQuery: string;
  borough: string;
  gradeTier: string;
  completeness: string;
  gst: string;
}

export function renderSchoolTable(
  schools: SchoolWithData[],
  filters: FilterState
): string {
  // Filter logic
  const filtered = schools.filter(item => {
    const s = item.school;
    const sc = item.score;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        s.name.toLowerCase().includes(q) ||
        s.dbn.toLowerCase().includes(q) ||
        s.assignedGst.toLowerCase().includes(q);
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

    return true;
  });

  const uniqueGsts = Array.from(new Set(schools.map(s => s.school.assignedGst))).sort();

  return `
    <div class="controls-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          id="school-search-input"
          class="search-input"
          placeholder="Search by school name, DBN (e.g. K089), or GST..."
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
      </div>
    </div>

    <div class="table-container">
      <table class="school-table">
        <thead>
          <tr>
            <th>Grade & Score</th>
            <th>School / DBN</th>
            <th>Borough & Program</th>
            <th>Assigned GST</th>
            <th>Gate Status</th>
            <th>3-Bucket Breakdown</th>
            <th>Active Flags</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No schools match the selected filters.</td></tr>`
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
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 500;">${school.borough}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${school.programYear} · Installed ${school.installationDate}</span>
        </div>
      </td>

      <td>
        <span style="font-weight: 500;">${school.assignedGst}</span>
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
