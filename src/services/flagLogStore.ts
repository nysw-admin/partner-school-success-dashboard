export interface FlagLogEntry {
  id: string;
  schoolDbn: string;
  timestamp: string;
  author: string;
  statusTag: string;
  note: string;
  createdAt: number;
}

const STORAGE_KEY = 'nysw_flagged_status_logs';

const DEFAULT_LOGS: FlagLogEntry[] = [
  {
    id: 'log-k147-1',
    schoolDbn: 'K147',
    timestamp: 'Sep 24, 2026 · 11:30 AM',
    author: 'Spencer King (Area Manager)',
    statusTag: 'Field Visit Scheduled',
    note: 'Contacted GST Yolanda. Scheduled on-site calibration visit for next Tuesday to inspect Tower Garden nutrient dosers and resolve persistent flag.',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'log-x208-1',
    schoolDbn: 'X208',
    timestamp: 'Sep 25, 2026 · 09:15 AM',
    author: 'NYSW Ops Team',
    statusTag: 'In Progress',
    note: 'Flagged for 3 consecutive weeks down. Area manager reached out to principal regarding science lab access during facility repairs.',
    createdAt: Date.now() - 3600000 * 5,
  },
  {
    id: 'log-k380-1',
    schoolDbn: 'K380',
    timestamp: 'Sep 23, 2026 · 03:45 PM',
    author: 'Amanda Low (Area Manager)',
    statusTag: 'Principal Contacted',
    note: 'Sent formal support letter to principal regarding harvest reporting deficit. Teacher confirmed whole-class harvest festival scheduled for early October.',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'log-m028-1',
    schoolDbn: 'M028',
    timestamp: 'Sep 24, 2026 · 02:10 PM',
    author: 'Jasmin (GST)',
    statusTag: 'Under Review',
    note: 'Reviewed low login activity. Teacher requested curriculum refresher session on FF1 hydroponic units.',
    createdAt: Date.now() - 86400000,
  }
];

export function getAllLogs(): FlagLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LOGS));
      return [...DEFAULT_LOGS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_LOGS];
    return parsed;
  } catch (e) {
    console.warn('Error reading flag logs from localStorage:', e);
    return [...DEFAULT_LOGS];
  }
}

export function getLogsForSchool(dbn: string): FlagLogEntry[] {
  const all = getAllLogs();
  return all
    .filter(l => l.schoolDbn.toUpperCase() === dbn.toUpperCase())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function addLogEntry(
  schoolDbn: string,
  note: string,
  author: string = 'NYSW Team',
  statusTag: string = 'In Progress'
): FlagLogEntry {
  const all = getAllLogs();
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const newEntry: FlagLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    schoolDbn: schoolDbn.toUpperCase(),
    timestamp: formattedDate,
    author: author.trim() || 'NYSW Team',
    statusTag: statusTag || 'In Progress',
    note: note.trim(),
    createdAt: Date.now(),
  };

  all.unshift(newEntry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Error saving flag log to localStorage:', e);
  }
  return newEntry;
}

export function deleteLogEntry(id: string): void {
  const all = getAllLogs().filter(l => l.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Error deleting flag log from localStorage:', e);
  }
}
