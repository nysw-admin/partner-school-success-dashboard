import type { SchoolWithData } from '../../pipeline/generator.ts';

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  schoolDbn?: string;
  suggestedFollowUps?: string[];
}

export function renderAIAgentModal(
  schools: SchoolWithData[],
  focusedSchoolDbn: string | null,
  messages: AIMessage[]
): string {
  const focusedSchool = focusedSchoolDbn
    ? schools.find(s => s.school.dbn.toUpperCase() === focusedSchoolDbn.toUpperCase())
    : null;

  return `
    <div id="ai-agent-modal-overlay" class="modal-overlay ai-agent-overlay">
      <div class="ai-modal-card">
        <!-- AI Modal Header -->
        <div class="ai-modal-header">
          <div class="ai-header-left">
            <div class="ai-avatar-circle">
              <span>✨</span>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--text-main);">
                  NYSW School Intelligence Copilot
                </h2>
                <span class="ai-status-pill">Active AI</span>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">
                Automated School Status Summaries, Agricultural Snapshots & Operational Decision-Support
              </p>
            </div>
          </div>

          <div class="ai-header-actions">
            <!-- Focus School Selector -->
            <div class="ai-school-focus-select-wrap">
              <label for="ai-focus-school-select" style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted);">Focus School:</label>
              <select id="ai-focus-school-select" class="filter-select" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;">
                <option value="network" ${!focusedSchool ? 'selected' : ''}>🌐 Network Overview (33 Schools)</option>
                ${schools.map(s => `
                  <option value="${s.school.dbn}" ${focusedSchoolDbn === s.school.dbn ? 'selected' : ''}>
                    ${s.school.name} (${s.school.dbn}) — Grade ${s.score.letterGrade}
                  </option>
                `).join('')}
              </select>
            </div>

            <button id="close-ai-modal-btn" class="close-btn" title="Close AI Copilot">✕</button>
          </div>
        </div>

        <!-- Quick Prompt Chips -->
        <div class="ai-chips-bar">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Quick Actions:</span>
          <button class="ai-chip-btn" data-prompt="${focusedSchool ? `Generate report for ${focusedSchool.school.dbn}` : 'Generate comprehensive network executive summary report'}">
            📑 ${focusedSchool ? 'School Executive Report' : 'Master Network Report'}
          </button>
          <button class="ai-chip-btn" data-prompt="Show top list schools and rankings">
            🏆 Top List Schools
          </button>
          <button class="ai-chip-btn" data-prompt="Show bottom schools needing intervention and lowest scores">
            🚨 Priority Interventions
          </button>
          <button class="ai-chip-btn" data-prompt="Show all flagged schools on the watchlist">
            ⚠️ Flagged Watchlist
          </button>
          <button class="ai-chip-btn" data-prompt="${focusedSchool ? `What crops are grown and what is the harvest forecast for ${focusedSchool.school.dbn}?` : 'Show crops and upcoming harvest forecasts across network'}">
            🌱 Crops & Harvests
          </button>
          <button class="ai-chip-btn" data-prompt="Show Ed Team specialists and GST staff assignments summary">
            👥 Ed Team & Staffing
          </button>
          <button class="ai-chip-btn" data-prompt="${focusedSchool ? `Draft an intervention email to the principal of ${focusedSchool.school.name}` : 'Draft an intervention email to school principal'}">
            ✉️ Draft Principal Email
          </button>
          <button class="ai-chip-btn" data-prompt="How is the 100-point score and Bucket 1 calculated?">
            📐 Scoring Formula
          </button>
        </div>

        <!-- Chat / Report Conversation Scroll Area -->
        <div class="ai-chat-messages" id="ai-chat-messages-container">
          ${messages.map(msg => renderAIMessageItem(msg)).join('')}
        </div>

        <!-- Input Box -->
        <div class="ai-chat-input-container">
          <form id="ai-chat-form" class="ai-chat-form">
            <input
              type="text"
              id="ai-chat-input"
              class="ai-chat-input"
              placeholder="Ask anything: 'generate reports', 'top list schools', 'show flagged', 'crops in PS 89', 'Shakira Provasoli'..."
              autocomplete="off"
              required
            />
            <button type="submit" class="ai-send-btn" id="ai-send-btn">
              <span>Send</span>
              <span>➤</span>
            </button>
          </form>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem; padding: 0 0.5rem; font-size: 0.72rem; color: var(--text-light);">
            <span>Instant reports, rankings, early-warning flag diagnostics, agricultural profiles, and principal email drafting.</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAIMessageItem(msg: AIMessage): string {
  const isUser = msg.sender === 'user';

  return `
    <div class="ai-msg-row ${isUser ? 'user-row' : 'assistant-row'}">
      <div class="ai-msg-avatar">
        ${isUser ? '👤' : '✨'}
      </div>
      <div class="ai-msg-bubble">
        <div class="ai-msg-meta">
          <span style="font-weight: 700; font-size: 0.78rem;">${isUser ? 'You' : 'NYSW AI Copilot'}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${msg.timestamp}</span>
          ${!isUser ? `
            <button class="ai-copy-btn" data-copy-id="${msg.id}" title="Copy report content to clipboard">
              📋 Copy
            </button>
          ` : ''}
        </div>
        <div class="ai-msg-content" id="msg-content-${msg.id}">
          ${formatMarkdownToHtml(msg.content)}
        </div>
        ${!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 ? `
          <div class="ai-followup-chips-container" style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-light); display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;">
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Suggested Next:</span>
            ${msg.suggestedFollowUps.map(p => `
              <button class="ai-followup-pill" data-prompt="${escapeHtml(p)}" style="background: #f1f5f9; border: 1px solid var(--border-subtle); color: var(--text-main); font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: var(--radius-full); cursor: pointer; transition: all 0.15s ease;">
                ${escapeHtml(p)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Lightweight, robust in-browser Markdown to HTML line-by-line parser with table & callout support
 */
function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let inTable = false;
  let isFirstTableRow = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    // Check markdown table row (| col | col |)
    if (line.startsWith('|') && line.endsWith('|')) {
      if (inList) { result.push('</ul>'); inList = false; }
      if (!inTable) {
        result.push('<div style="overflow-x: auto; margin: 0.85rem 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; border: 1px solid var(--border-light); border-radius: 6px; overflow: hidden; background: #ffffff;">');
        inTable = true;
        isFirstTableRow = true;
      }
      // Check if it's separator row like | :--- | :--- |
      if (/^\|[\s\:\-\|]+$/.test(line)) {
        continue;
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (isFirstTableRow) {
        result.push('<thead style="background: var(--bg-card-alt); border-bottom: 2px solid var(--border-subtle);"><tr>');
        cells.forEach(c => result.push(`<th style="padding: 0.45rem 0.65rem; text-align: left; font-weight: 700; color: var(--text-main); white-space: nowrap;">${inlineFormat(c)}</th>`));
        result.push('</tr></thead><tbody>');
        isFirstTableRow = false;
      } else {
        result.push('<tr style="border-bottom: 1px solid var(--border-light); transition: background 0.15s ease;">');
        cells.forEach(c => result.push(`<td style="padding: 0.45rem 0.65rem; vertical-align: top;">${inlineFormat(c)}</td>`));
        result.push('</tr>');
      }
      continue;
    } else if (inTable) {
      result.push('</tbody></table></div>');
      inTable = false;
    }

    // Check horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />');
      continue;
    }

    // Check headings
    if (line.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      const content = inlineFormat(line.slice(4));
      result.push(`<h4 style="margin: 1.2rem 0 0.4rem 0; font-family: var(--font-heading); color: var(--text-main); font-size: 1rem; font-weight: 700;">${content}</h4>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      const content = inlineFormat(line.slice(3));
      result.push(`<h3 style="margin: 1.4rem 0 0.5rem 0; font-family: var(--font-heading); color: var(--primary-dark); font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid var(--border-light); padding-bottom: 0.35rem;">${content}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      const content = inlineFormat(line.slice(2));
      result.push(`<h2 style="margin: 0.2rem 0 0.8rem 0; font-family: var(--font-heading); color: var(--primary); font-size: 1.3rem; font-weight: 800;">${content}</h2>`);
      continue;
    }

    // Check bullet lists (* or - or numbered)
    const listMatch = line.match(/^(\s*)([\*\-]|(\d+)\.)\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        result.push('<ul style="margin: 0.5rem 0; padding-left: 1.4rem; list-style-type: disc;">');
        inList = true;
      }
      const itemContent = inlineFormat(listMatch[4]);
      result.push(`<li style="margin: 0.3rem 0; line-height: 1.5;">${itemContent}</li>`);
      continue;
    } else if (inList && line.trim() === '') {
      result.push('</ul>');
      inList = false;
      continue;
    } else if (inList) {
      result.push('</ul>');
      inList = false;
    }

    // Blank lines
    if (line.trim() === '') {
      result.push('<div style="height: 0.4rem;"></div>');
      continue;
    }

    // Regular paragraphs
    result.push(`<p style="margin: 0.4rem 0; line-height: 1.6;">${inlineFormat(line)}</p>`);
  }

  if (inList) {
    result.push('</ul>');
  }
  if (inTable) {
    result.push('</tbody></table></div>');
  }

  return result.join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: var(--bg-card-alt); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.82rem; color: var(--primary-dark); font-weight: 600;">$1</code>');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
