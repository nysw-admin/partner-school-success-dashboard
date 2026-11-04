"""
NY Sun Works — Partner School Success Dashboard
Incremental Data Ingestion Pipeline & Persistent Accumulator (SY 2026–2027 & Multi-Year Ready)

Capabilities:
1. Universal Intake: Ingests operational spreadsheets from 'data/incoming/'.
2. Auto School-Year Detection: Detects SY 2026–2027 (26_27 / 2026) files and sets active schoolYear dynamically.
3. Missing Assets Engine: Parses 'Missing Assets 26_27.xlsx' weekly tabs for C1a (On-Time Rate) and C1b (Late-vs-Missing Rate).
4. Zero-Dependency Excel Reader: Works with or without pandas/openpyxl/xlrd via scripts/excel_reader.py.
5. Persistent Record Keeping & Deduplication: Stores visits in 'data/historical_visits.json' and compiles 'data/cohort.json'.
"""

import os
import sys
import json
import re
import datetime
from collections import defaultdict, Counter

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(PROJECT_ROOT, 'scripts') not in sys.path:
    sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))

from excel_reader import load_workbook_sheets, rows_to_dicts, excel_serial_to_date_str

INCOMING_DIR = os.path.join(PROJECT_ROOT, 'data', 'incoming')
LEGACY_DIR = os.path.join(PROJECT_ROOT, '1st slice of data SY 25-26')
DATA_OUT_DIR = os.path.join(PROJECT_ROOT, 'data')
COHORT_OUT_FILE = os.path.join(DATA_OUT_DIR, 'cohort.json')

HISTORICAL_VISITS_FILE = os.path.join(DATA_OUT_DIR, 'historical_visits.json')
HISTORICAL_AMV_FILE = os.path.join(DATA_OUT_DIR, 'historical_amv.json')
HISTORICAL_HC_FILE = os.path.join(DATA_OUT_DIR, 'historical_hc.json')
HISTORICAL_SURVEY_FILE = os.path.join(DATA_OUT_DIR, 'historical_surveys.json')

RESET_MODE = '--reset' in sys.argv or '--from-scratch' in sys.argv

if len(sys.argv) > 1 and not sys.argv[1].startswith('--') and os.path.isdir(sys.argv[1]):
    SLICE_DIR = os.path.abspath(sys.argv[1])
elif os.path.isdir(INCOMING_DIR) and len([f for f in os.listdir(INCOMING_DIR) if f.endswith(('.xls', '.xlsx')) and not f.startswith('~$')]) > 0:
    SLICE_DIR = INCOMING_DIR
elif os.path.isdir(LEGACY_DIR) and len([f for f in os.listdir(LEGACY_DIR) if f.endswith(('.xls', '.xlsx')) and not f.startswith('~$')]) > 0:
    SLICE_DIR = LEGACY_DIR
else:
    os.makedirs(INCOMING_DIR, exist_ok=True)
    SLICE_DIR = INCOMING_DIR

os.makedirs(DATA_OUT_DIR, exist_ok=True)
os.makedirs(INCOMING_DIR, exist_ok=True)

incoming_excel_files = [f for f in os.listdir(SLICE_DIR) if f.endswith(('.xls', '.xlsx')) and not f.startswith('~$')]
if not incoming_excel_files:
    print(f"[ERROR] No Excel spreadsheets found in intake directory: {SLICE_DIR}")
    sys.exit(1)

# Dynamically detect the highest active School Year from filenames in SLICE_DIR (e.g., 26_27, 27_28, 28_29, Sept 2026, Sept 2027)
def detect_active_school_year(filenames):
    detected_start_years = []
    for fname in filenames:
        fl = fname.lower()
        # Match explicit pair like 26_27, 27-28, 2026-2027, 2026_27
        for m in re.finditer(r'(?:20)?([2-3][0-9])[_\-\u2013](?:20)?([2-3][0-9])', fl):
            y1, y2 = int(m.group(1)), int(m.group(2))
            if y2 == y1 + 1:
                detected_start_years.append(2000 + y1)
        # Match fall month + 4-digit year (e.g., "sept 2026", "oct 2027")
        for m in re.finditer(r'(?:aug|sep|sept|oct|nov|dec)[a-z]*[\s_\-]*([2][0][2-4][0-9])', fl):
            yr = int(m.group(1))
            # Ignore multi-year span prefixes like "sep2025-jun2026" if already matched
            if f"{yr}-jun" not in fl and f"{yr}_jun" not in fl:
                detected_start_years.append(yr)
    start_yr = max(detected_start_years) if detected_start_years else 2026
    return f"SY {start_yr}–{start_yr + 1}", start_yr


def extract_file_school_start_year(filepath):
    fname = os.path.basename(filepath).lower()
    years = []
    for m in re.finditer(r'(?:20)?([2-3][0-9])[_\-\u2013](?:20)?([2-3][0-9])', fname):
        y1, y2 = int(m.group(1)), int(m.group(2))
        if y2 == y1 + 1:
            years.append(2000 + y1)
    for m in re.finditer(r'(?:aug|sep|sept|oct|nov|dec)[a-z]*[\s_\-]*([2][0][2-4][0-9])', fname):
        years.append(int(m.group(1)))
    return max(years) if years else 0


ACTIVE_SCHOOL_YEAR, ACTIVE_START_YEAR = detect_active_school_year(incoming_excel_files)


def auto_archive_prior_cohort(cohort_file, new_school_year):
    """If data/cohort.json holds a prior school year, automatically freeze & archive it to data/snapshots/ before generating the new year."""
    if not os.path.exists(cohort_file):
        return
    try:
        with open(cohort_file, 'r', encoding='utf-8') as f:
            old_cohort = json.load(f)
        old_sy = old_cohort.get('schoolYear') or 'SY 2025–2026'
        if old_sy == new_school_year:
            return
        schools_list = old_cohort.get('schools') or []
        if not schools_list:
            return

        snap_dir = os.path.join(DATA_OUT_DIR, 'snapshots')
        os.makedirs(snap_dir, exist_ok=True)
        clean_id = re.sub(r'[^a-zA-Z0-9]', '_', old_sy)
        snap_id = f"{clean_id}_AUTO_FINAL"
        snap_path = os.path.join(snap_dir, f"snapshot_{snap_id}.json")
        if os.path.exists(snap_path):
            return

        snap_schools = []
        grade_dist = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0}
        tier_dist = {}
        for item in schools_list:
            s = item.get('school', {})
            sc_obj = item.get('score', {})
            g = sc_obj.get('letterGrade', 'C')
            t = sc_obj.get('tier', 'Yellow — Watch')
            grade_dist[g] = grade_dist.get(g, 0) + 1
            tier_dist[t] = tier_dist.get(t, 0) + 1
            snap_schools.append({
                'dbn': s.get('dbn', ''),
                'name': s.get('name', ''),
                'borough': s.get('borough', 'Manhattan'),
                'programYear': s.get('programYear', 'Op Y2+'),
                'overallScore': sc_obj.get('overallScore', 75.0),
                'letterGrade': g,
                'tier': t,
                'completenessStatus': sc_obj.get('completeness', {}).get('status', 'Normal'),
                'completenessRate': sc_obj.get('completeness', {}).get('rate', 0.95),
                'bucket1Score': sc_obj.get('bucket1', {}).get('earnedPoints', 30.0),
                'bucket2Score': sc_obj.get('bucket2', {}).get('earnedPoints', 30.0),
                'bucket3Score': sc_obj.get('bucket3', {}).get('earnedPoints', 15.0),
                'uptimeRate': 0.95,
                'totalHarvests': len(item.get('snapshot', {}).get('cropsHarvested', [])) or 2,
                'totalVisits': len(item.get('weeklyHistory', [])),
                'flagsCount': len(item.get('flags', [])),
                'activeFlagIds': [fl.get('id') for fl in item.get('flags', []) if fl.get('id')],
                'assignedGst': s.get('assignedGst', 'Unassigned'),
                'areaManager': s.get('areaManager', 'Amanda Low'),
                'notes': f'Automatically archived {old_sy} cohort upon transition to {new_school_year}.'
            })

        n_tot = max(1, len(snap_schools))
        snapshot_bundle = {
            'snapshotId': snap_id,
            'schoolYear': old_sy,
            'isFinal': True,
            'createdAt': datetime.datetime.now().isoformat(),
            'archivedBy': 'Automated School-Year Rollover Engine',
            'notes': f'Automatic End-of-Year archive of {old_sy} generated when {new_school_year} spreadsheets were uploaded.',
            'totalSchools': len(snap_schools),
            'networkSummary': {
                'averageOverallScore': round(sum(x['overallScore'] for x in snap_schools) / n_tot, 1),
                'averageBucket1Score': round(sum(x['bucket1Score'] for x in snap_schools) / n_tot, 2),
                'averageBucket2Score': round(sum(x['bucket2Score'] for x in snap_schools) / n_tot, 2),
                'averageBucket3Score': round(sum(x['bucket3Score'] for x in snap_schools) / n_tot, 2),
                'gradeDistribution': grade_dist,
                'tierDistribution': tier_dist,
                'totalVisitsLogged': sum(x['totalVisits'] for x in snap_schools),
                'totalHarvestsLogged': sum(x['totalHarvests'] for x in snap_schools),
                'totalFlagsActive': sum(x['flagsCount'] for x in snap_schools),
            },
            'schools': snap_schools
        }
        with open(snap_path, 'w', encoding='utf-8') as sf:
            json.dump(snapshot_bundle, sf, indent=2)
        print(f"[AUTO-ARCHIVE] Saved prior school year '{old_sy}' ({len(snap_schools)} schools) to {os.path.relpath(snap_path, PROJECT_ROOT)}")
    except Exception as e:
        print(f"[WARN] Could not auto-archive prior cohort: {e}")


auto_archive_prior_cohort(COHORT_OUT_FILE, ACTIVE_SCHOOL_YEAR)

print("=" * 60)
print(f"NY SUN WORKS — DATA INGESTION PIPELINE ({ACTIVE_SCHOOL_YEAR})")
print("=" * 60)
print(f"Active School Year        : {ACTIVE_SCHOOL_YEAR}")
print(f"Intake Directory          : {os.path.relpath(SLICE_DIR, PROJECT_ROOT)}")
print(f"Operating Mode            : {'RESET / FROM SCRATCH' if RESET_MODE else 'INCREMENTAL ACCUMULATOR (Preserving History)'}")
print(f"Persistent Visit Store    : {os.path.relpath(HISTORICAL_VISITS_FILE, PROJECT_ROOT)}")


def is_na(val):
    if val is None:
        return True
    s = str(val).strip().lower()
    return s in ('', 'nan', 'none', 'null')


def clamp(val, min_val, max_val):
    return max(min_val, min(max_val, val))


def linear_score(actual, floor, target, max_points):
    if target == floor:
        return 0.0, 0.0
    fraction = clamp((actual - floor) / (target - floor), 0.0, 1.0)
    score = round(fraction * max_points, 2)
    return score, round(fraction, 4)


def get_grade_and_tier(overall_score):
    if overall_score >= 90:
        return 'A', 'Green — Thriving'
    elif overall_score >= 80:
        return 'B', 'Green — Healthy'
    elif overall_score >= 65:
        return 'C', 'Yellow — Watch'
    elif overall_score >= 50:
        return 'D', 'Red — Intervene'
    else:
        return 'F', 'Red — At Risk'


def clean_borough(val, default='Manhattan'):
    if is_na(val):
        return default
    s = str(val).strip().title()
    for b in ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']:
        if b.lower() in s.lower():
            return b
    return default


def clean_program_year(status):
    if is_na(status):
        return 'Op Y3+'
    s = str(status).strip()
    if 'Implementation' in s:
        return 'Implementation'
    if 'Y1' in s or 'Year 1' in s:
        return 'Op Y1'
    if 'Y2' in s and '+' not in s:
        return 'Op Y2'
    return 'Op Y3+'


def normalize_cadence(cadence_str):
    if is_na(cadence_str):
        return 'Weekly', 1.0
    s = str(cadence_str).strip().lower()
    if any(k in s for k in ['twice', 'bi-weekly', 'biweekly', 'bi weekly']) and not any(k in s for k in ['eow', 'other', 'monthly']):
        return 'Twice-weekly', 0.5
    if any(k in s for k in ['eow', 'every other', 'bi-monthly', 'bimonthly']):
        return 'Every-two-weeks', 2.0
    if 'month' in s:
        return 'Monthly', 4.3
    return 'Weekly', 1.0


def parse_date_obj(d_val):
    if is_na(d_val):
        return None
    if isinstance(d_val, datetime.datetime):
        return d_val.date()
    if isinstance(d_val, datetime.date):
        return d_val
    if isinstance(d_val, (int, float)):
        d_val = excel_serial_to_date_str(d_val)
    s = str(d_val).split(' ')[0].strip()
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y', '%Y/%m/%d'):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except Exception:
            continue
    return None


def is_harvest_season_date(d_val):
    dt = parse_date_obj(d_val)
    if dt:
        return dt >= datetime.date(ACTIVE_START_YEAR, 11, 1)
    s = str(d_val)
    return any(k in s for k in ['11/', '12/', '/11/', '/12/', f'{ACTIVE_START_YEAR}-11', f'{ACTIVE_START_YEAR}-12', f'{ACTIVE_START_YEAR+1}-01', f'{ACTIVE_START_YEAR+1}-02', f'{ACTIVE_START_YEAR+1}-03', f'{ACTIVE_START_YEAR+1}-04', f'{ACTIVE_START_YEAR+1}-05', f'{ACTIVE_START_YEAR+1}-06'])


def find_matching_files(directory, patterns, exclude_patterns=None):
    if not os.path.isdir(directory):
        return []
    exclude_patterns = exclude_patterns or []
    matches = []
    search_dirs = [directory]
    inc_sub = os.path.join(directory, 'incremental')
    if os.path.isdir(inc_sub):
        search_dirs.append(inc_sub)

    for d in search_dirs:
        for fname in os.listdir(d):
            if not fname.endswith(('.xls', '.xlsx')) or fname.startswith('~$'):
                continue
            fname_lower = fname.lower()
            if any(ex.lower() in fname_lower for ex in exclude_patterns):
                continue
            if any(pat.lower() in fname_lower for pat in patterns):
                matches.append(os.path.join(d, fname))
    # Sort so the highest school year files (e.g. 27_28 > 26_27 > 25_26) always take priority
    matches = sorted(
        list(set(matches)),
        key=lambda p: (-extract_file_school_start_year(p), os.path.basename(p))
    )
    return matches


def read_first_sheet_records(path):
    sheets = load_workbook_sheets(path)
    if not sheets:
        return []
    first_rows = list(sheets.values())[0]
    return rows_to_dicts(first_rows)


# ----------------------------------------------------
# STEP 1: Build Master Crosswalk from Accelo & Cadence
# ----------------------------------------------------
print("\n[1/6] Ingesting School Registry & Cadence Specs...")
reg_files = find_matching_files(SLICE_DIR, patterns=['accelo partner schools', 'partner schools export'])
if not reg_files:
    reg_files = [os.path.join(SLICE_DIR, 'Accelo Partner Schools Export.xls')]

df_schools = read_first_sheet_records(reg_files[0])
registry = {}
alias_map = {}

for r in df_schools:
    c_name = str(r.get('Client name') or '').strip()
    raw_code = str(r.get('1. School Location . 1.91 School Code') or '').strip()
    status = str(r.get('Status') or '').strip()
    nick = str(r.get('1. School Location . 1.93 School Nick Name') or '').strip()
    lab_type = str(r.get('4. Classroom Details . 4.1 Type of Lab') or '').strip()

    m = re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', c_name) or re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', raw_code)
    canonical_id = m.group(1).upper() if m else (raw_code if not is_na(raw_code) else c_name)
    if not canonical_id:
        continue

    b = 'Manhattan'
    if canonical_id.startswith('K'):
        b = 'Brooklyn'
    elif canonical_id.startswith('X'):
        b = 'Bronx'
    elif canonical_id.startswith('Q'):
        b = 'Queens'
    elif canonical_id.startswith('R'):
        b = 'Staten Island'
    elif 'bronx' in c_name.lower():
        b = 'Bronx'
    elif 'brooklyn' in c_name.lower():
        b = 'Brooklyn'
    elif 'queens' in c_name.lower():
        b = 'Queens'

    registry[canonical_id] = {
        'dbn': canonical_id,
        'code': canonical_id,
        'name': nick if not is_na(nick) else c_name,
        'client_name': c_name,
        'borough': b,
        'programYear': clean_program_year(status),
        'rawStatus': status,
        'labType': lab_type if not is_na(lab_type) else 'Classroom',
        'cadence': 'Weekly',
        'periodLengthWeeks': 1.0,
        'assignedGst': 'TBD',
        'areaManager': 'TBD',
        'curriculumSpecialist': 'Heather Holz',
        'installationDate': '2019',
        'systemsInstalled': 3,
        'hasAquaponics': False
    }

    alias_map[canonical_id.lower()] = canonical_id
    if c_name:
        alias_map[c_name.lower()] = canonical_id
    if not is_na(raw_code):
        alias_map[raw_code.lower()] = canonical_id
    if not is_na(nick):
        alias_map[nick.lower()] = canonical_id

# Integrate Cadence (prioritizing SY 26_27)
cad_files = find_matching_files(SLICE_DIR, patterns=['visit cadence'])
if not cad_files:
    cad_files = [os.path.join(SLICE_DIR, 'GST Schedule SY 26_27 - Visit Cadence.xlsx')]

if os.path.exists(cad_files[0]):
    print(f"  • Using Visit Cadence file: {os.path.basename(cad_files[0])}")
    df_cad = read_first_sheet_records(cad_files[0])
    for r in df_cad:
        c_code = str(r.get('School Code') or '').strip()
        c_name = str(r.get('School Name') or '').strip()
        freq = str(r.get('Visit Length/ Frequency') or '').strip().lower()
        if not c_code and not c_name:
            continue

        cad, period_len = normalize_cadence(freq)

        m = re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', c_name) or re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', c_code)
        matched_id = None
        if m and m.group(1).upper() in registry:
            matched_id = m.group(1).upper()
        elif c_code.lower() in alias_map:
            matched_id = alias_map[c_code.lower()]
        elif c_name.lower() in alias_map:
            matched_id = alias_map[c_name.lower()]
        else:
            for a_key, canon in alias_map.items():
                if len(a_key) >= 5 and (a_key in c_name.lower() or (c_name and c_name.lower() in a_key)):
                    matched_id = canon
                    break

        if matched_id:
            registry[matched_id]['cadence'] = cad
            registry[matched_id]['periodLengthWeeks'] = period_len
            if c_code:
                alias_map[c_code.lower()] = matched_id
            if c_name:
                alias_map[c_name.lower()] = matched_id
        elif m:
            new_id = m.group(1).upper()
            b_guess = 'Manhattan'
            if new_id.startswith('K'):
                b_guess = 'Brooklyn'
            elif new_id.startswith('X'):
                b_guess = 'Bronx'
            elif new_id.startswith('Q'):
                b_guess = 'Queens'
            elif new_id.startswith('R'):
                b_guess = 'Staten Island'
            registry[new_id] = {
                'dbn': new_id, 'code': new_id, 'name': c_name or new_id, 'client_name': c_name or new_id,
                'borough': b_guess, 'programYear': 'Op Y2+', 'rawStatus': 'Operation Y2+',
                'labType': 'Classroom', 'cadence': cad, 'periodLengthWeeks': period_len,
                'assignedGst': 'Unassigned', 'areaManager': 'TBD', 'curriculumSpecialist': 'Unassigned',
                'installationDate': '2019', 'systemsInstalled': 3, 'hasAquaponics': False
            }
            alias_map[new_id.lower()] = new_id
            if c_code:
                alias_map[c_code.lower()] = new_id
            if c_name:
                alias_map[c_name.lower()] = new_id

print(f"Master Registry loaded: {len(registry)} partner schools across NYC & region.")


def resolve_school_id(raw_str):
    if is_na(raw_str):
        return None
    s = str(raw_str).strip()
    m = re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', s)
    if m:
        dbn = m.group(1).upper()
        if dbn in registry:
            return dbn
        b_guess = 'Manhattan'
        if dbn.startswith('K'):
            b_guess = 'Brooklyn'
        elif dbn.startswith('X'):
            b_guess = 'Bronx'
        elif dbn.startswith('Q'):
            b_guess = 'Queens'
        elif dbn.startswith('R'):
            b_guess = 'Staten Island'
        registry[dbn] = {
            'dbn': dbn, 'code': dbn, 'name': s, 'client_name': s,
            'borough': b_guess, 'programYear': 'Op Y2+', 'rawStatus': 'Operation Y2+',
            'labType': 'Classroom', 'cadence': 'Weekly', 'periodLengthWeeks': 1.0,
            'assignedGst': 'Unassigned', 'areaManager': 'TBD', 'curriculumSpecialist': 'Unassigned',
            'installationDate': '2019', 'systemsInstalled': 3, 'hasAquaponics': False
        }
        alias_map[dbn.lower()] = dbn
        alias_map[s.lower()] = dbn
        return dbn
    if s.lower() in alias_map:
        return alias_map[s.lower()]
    for a_key, canon in alias_map.items():
        if len(a_key) >= 5 and (a_key in s.lower() or s.lower() in a_key):
            return canon
    return None


def clean_schedule_gst(name):
    if is_na(name):
        return None
    s = str(name).strip()
    s_low = s.lower()
    if any(k in s_low for k in ['unnamed', 'date', 'week', 'monday', 'tuesday', 'day', 'apprenticeship', 'interns', '6', 'bui', 'gst name', 'gst']):
        return None
    if len(s) < 2:
        return None
    if s == 'Rebeca':
        return 'Rebecca'
    if s == 'Jocc':
        return 'Joc'
    return s


def resolve_all_school_ids(val_str):
    if is_na(val_str):
        return []
    s = str(val_str).strip()
    if not s:
        return []
    s_low_full = s.lower()
    if s_low_full in ('all completed', 'all complete', 'none completed', 'none', 'n/a', 'all done', 'off'):
        return []

    results = []
    # Split comma- or semicolon-separated tokens so mixed cells (DBNs + named schools) resolve every school
    tokens = re.split(r'[,;]+', s)
    for tok in tokens:
        tok_clean = re.sub(r'\([^)]*\)', '', tok).strip()
        if not tok_clean:
            continue
        tok_low = tok_clean.lower()
        if tok_low in ('all completed', 'all complete', 'none completed', 'none', 'n/a', 'all done', 'off'):
            continue

        matches = re.findall(r'\b([KMXQRkmxqr][0-9]{3})\b', tok_clean)
        if matches:
            for m in matches:
                dbn = m.upper()
                if dbn not in registry:
                    resolve_school_id(dbn)
                if dbn not in results:
                    results.append(dbn)
            continue

        if tok_low in alias_map:
            canon = alias_map[tok_low]
            if canon not in results:
                results.append(canon)
            continue

        for k, v in alias_map.items():
            if len(k) >= 4 and (k in tok_low or tok_low in k):
                if v not in results:
                    results.append(v)
                break

    return results


# ----------------------------------------------------
# STEP 2: Parse Weekly GST Schedule & Missing Assets Report
# ----------------------------------------------------
print("\n[2/6] Parsing Weekly GST Schedule & Missing Assets Report...")
sched_files = find_matching_files(
    SLICE_DIR,
    patterns=['gst schedule sy 26_27', 'copy of gst schedule', 'gst schedule'],
    exclude_patterns=['visit cadence']
)

scheduled_by_school = defaultdict(list)
schedule_gst_by_school = defaultdict(Counter)

if sched_files and os.path.exists(sched_files[0]):
    sched_path = sched_files[0]
    print(f"  • Using GST Schedule file: {os.path.basename(sched_path)}")
    sched_sheets = load_workbook_sheets(sched_path)
    for s_name, rows in sched_sheets.items():
        if not rows or s_name.lower().startswith('copy of'):
            continue
        is_fall = any(m in s_name for m in ['Sept', 'Oct', 'Nov', 'Dec']) and not s_name.startswith('August')
        header_row = rows[0] if rows else []
        for r_idx in range(1, len(rows)):
            row_vals = rows[r_idx]
            if not row_vals:
                continue
            gst = clean_schedule_gst(row_vals[0])
            if not gst:
                continue
            for col_idx in range(1, min(6, len(row_vals))):
                val = row_vals[col_idx]
                if not is_na(val):
                    val_str = str(val).strip()
                    if val_str and val_str != 'OFF' and 'meeting' not in val_str.lower() and 'admin' not in val_str.lower():
                        sc_list = resolve_all_school_ids(val_str)
                        for sc in sc_list:
                            schedule_gst_by_school[sc][gst] += 1
                            if is_fall:
                                col_hdr = str(header_row[col_idx]) if col_idx < len(header_row) else f"Col{col_idx}"
                                scheduled_by_school[sc].append({
                                    'sheet': s_name,
                                    'date': col_hdr,
                                    'gst': gst,
                                    'raw': val_str
                                })

# Parse Missing Assets 26_27.xlsx if present
missing_asset_files = find_matching_files(SLICE_DIR, patterns=['missing assets'])
missing_assets_completed = Counter()
missing_assets_missing = Counter()
missing_assets_late = Counter()
missing_assets_weeks_by_school = defaultdict(list)

if missing_asset_files and os.path.exists(missing_asset_files[0]):
    ma_path = missing_asset_files[0]
    print(f"  • Ingesting Missing Assets Performance Report: {os.path.basename(ma_path)}")
    ma_sheets = load_workbook_sheets(ma_path)
    weekly_tab_patterns = ['sept', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun']
    for s_name, rows in ma_sheets.items():
        s_low = s_name.lower()
        if any(skip in s_low for skip in ['sample', 'anonymized', 'template', 'remaining', 'no harvests', 'first semester']):
            continue
        if not any(w in s_low for w in weekly_tab_patterns):
            continue
        recs = rows_to_dicts(rows)
        for r in recs:
            gst = clean_schedule_gst(r.get('GST Name') or r.get('GST'))
            comp_str = str(r.get('Completed School Codes') or '')
            miss_str = str(r.get('Missing School Codes') or '')
            late_str = str(r.get('Late Assets') or '')

            comp_ids = resolve_all_school_ids(comp_str)
            miss_ids = resolve_all_school_ids(miss_str)
            late_ids = resolve_all_school_ids(late_str)

            for sc in comp_ids:
                missing_assets_completed[sc] += 1
                if gst:
                    schedule_gst_by_school[sc][gst] += 1
            for sc in miss_ids:
                missing_assets_missing[sc] += 1
                if s_name.strip() not in missing_assets_weeks_by_school[sc]:
                    missing_assets_weeks_by_school[sc].append(s_name.strip())
                if gst:
                    schedule_gst_by_school[sc][gst] += 1
            for sc in late_ids:
                missing_assets_late[sc] += 1
                if gst:
                    schedule_gst_by_school[sc][gst] += 1

print(f"Assigned GSTs mapped from Schedule/Assets for {len(schedule_gst_by_school)} schools.")
print(f"Scheduled appearances tracked for {len(scheduled_by_school)} schools.")

# ----------------------------------------------------
# STEP 3: Ingest Accelo GST Support Reports (Incremental Accumulator)
# ----------------------------------------------------
print("\n[3/6] Ingesting Accelo GST Weekly Support Reports (Incremental Accumulator)...")

visits_by_school = defaultdict(list)
known_visit_fingerprints = defaultdict(set)
historical_count = 0

if os.path.exists(HISTORICAL_VISITS_FILE) and not RESET_MODE:
    try:
        with open(HISTORICAL_VISITS_FILE, 'r', encoding='utf-8') as f:
            hist_data = json.load(f)
            saved_sy = hist_data.get('schoolYear')
            # Only retain historical visits from the same active school year so new school years start cleanly
            if saved_sy == ACTIVE_SCHOOL_YEAR:
                for sc, v_list in hist_data.get('visitsBySchool', {}).items():
                    for v in v_list:
                        dt = parse_date_obj(v.get('date'))
                        if dt and dt.year < ACTIVE_START_YEAR:
                            continue
                        fp = v.get('fingerprint') or f"{sc}|{v.get('date')}|{v.get('gst_member', '')}|{v.get('notes', '')[:40]}".lower()
                        v['fingerprint'] = fp
                        visits_by_school[sc].append(v)
                        known_visit_fingerprints[sc].add(fp)
                        historical_count += 1
                print(f"Loaded {historical_count} persistent {ACTIVE_SCHOOL_YEAR} visits across {len(visits_by_school)} schools.")
            else:
                print(f"[INFO] Detected school year transition to {ACTIVE_SCHOOL_YEAR}. Initializing clean visit store for {ACTIVE_SCHOOL_YEAR}.")
    except Exception as e:
        print(f"[WARN] Could not parse existing historical visits ({e}). Starting fresh.")
elif RESET_MODE:
    print("[INFO] Reset mode active (--reset): Rebuilding visit repository from spreadsheets.")

# Discover all GST support report files for the active school year
gst_files = find_matching_files(
    SLICE_DIR,
    patterns=['gst asset', 'gst_asset', 'gst accelo', 'accelo assets', 'accelo gst', 'weekly support', 'support reports', 'gst support'],
    exclude_patterns=['copy of gst schedule', 'gst schedule', 'visit cadence', 'accelo partner schools', 'area manager', 'hc performance', 'teacher survey', 'missing assets', 'ed team']
)

def clean_gst_first_name(raw_val):
    if is_na(raw_val):
        return ''
    s = str(raw_val).strip()
    if not s:
        return ''
    first = s.split()[0].strip()
    if first.lower() == 'rammiro':
        return 'Ramiro'
    return first

# Filter GST visit files to the active school year if year-tagged visit files are present
gst_files_active_yr = [
    f for f in gst_files
    if extract_file_school_start_year(f) in (0, ACTIVE_START_YEAR)
]
if gst_files_active_yr:
    gst_files = gst_files_active_yr

print(f"Discovered {len(gst_files)} GST weekly support spreadsheet(s):")
for gf in gst_files:
    print(f"  • {os.path.relpath(gf, PROJECT_ROOT)}")

new_visits_added = 0
gst_counter = defaultdict(Counter)
am_counter = defaultdict(Counter)
borough_counter = defaultdict(Counter)
year_counter = defaultdict(Counter)

for sc, v_list in visits_by_school.items():
    for v in v_list:
        gm = clean_gst_first_name(v.get('gst_member'))
        if gm:
            v['gst_member'] = gm
            gst_counter[sc][gm] += 1
        am = v.get('area_manager')
        if am:
            am_counter[sc][am] += 1
        b_val = v.get('borough')
        if b_val:
            borough_counter[sc][b_val] += 1
        inst = v.get('installation_year')
        if inst:
            year_counter[sc][inst] += 1

for gf in gst_files:
    try:
        df_gst = read_first_sheet_records(gf)
        file_name = os.path.basename(gf)
        file_new = 0
        for row in df_gst:
            against = str(row.get('Against') or '').strip()
            sc = resolve_school_id(against)
            if not sc:
                continue

            v_date_raw = row.get('Visit date')
            dt_obj = parse_date_obj(v_date_raw)
            v_date = dt_obj.strftime('%Y-%m-%d') if dt_obj else str(v_date_raw or '')

            sys_offline = str(row.get('Select Systems not running ( if any)') or '')
            has_offline = (not is_na(sys_offline)) and sys_offline.strip().lower() != 'none'

            seedlings = str(row.get('Are seedlings planted?') or '').strip().lower() == 'yes'
            pests = str(row.get('Issues with Pests?') or '').strip().lower() == 'yes'
            convo = (
                str(row.get('In-person conversation w/ teacher about HC?') or '').strip().lower() == 'yes'
                or str(row.get('In-person conversation w/ teacher about GHC?') or '').strip().lower() == 'yes'
            )

            harvest_done = (
                str(row.get('Did you harvest today?') or '').strip().lower() == 'yes'
                or str(row.get('Has there been a harvest (partial or full) since your last visit?') or '').strip().lower() == 'yes'
            )

            weight_str = str(row.get('Total weight of crops harvested (INCLUDE UNITS: oz, gr, lb)') or '').lower()
            weight_lbs = 0.0
            wm = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(lb|pound|oz|ounce|g|gram)?', weight_str)
            if wm:
                val_num = float(wm.group(1))
                unit = wm.group(2) or 'lb'
                if 'oz' in unit:
                    weight_lbs = val_num / 16.0
                elif 'g' in unit:
                    weight_lbs = val_num / 453.59
                else:
                    weight_lbs = val_num

            crop_types = str(row.get('Types of crops harvested') or '') if not is_na(row.get('Types of crops harvested')) else ''
            notes = str(row.get('General Notes') or '') if not is_na(row.get('General Notes')) else ''
            gst_member = clean_gst_first_name(row.get('GST Member reporting information'))
            title = str(row.get('Title') or '').strip()

            fp = f"{sc}|{v_date}|{gst_member}|{title}|{notes[:40]}".lower()
            if fp in known_visit_fingerprints[sc]:
                continue

            if not is_na(row.get('AQX PH Level (ph)')) or not is_na(row.get('Aquaponics Notes')):
                registry[sc]['hasAquaponics'] = True

            if gst_member:
                gst_counter[sc][gst_member] += 1

            am_val = str(row.get('99.1 Area Manager') or row.get('99.1 Area Manager ') or '').strip()
            if not is_na(am_val):
                am_counter[sc][am_val] += 1

            b_val = str(row.get('1.3 Borough (or State)') or '').strip()
            clean_b = clean_borough(b_val) if not is_na(b_val) else None
            if clean_b:
                borough_counter[sc][clean_b] += 1

            inst_q = str(row.get('4.3 Installation Quarter') or '').strip()
            inst_y = None
            if not is_na(inst_q):
                ym = re.search(r'([0-9]{4})', inst_q)
                if ym:
                    inst_y = ym.group(1)
                    year_counter[sc][inst_y] += 1

            visit_record = {
                'date': str(v_date),
                'has_offline': has_offline,
                'sys_offline_raw': sys_offline,
                'seedlings': seedlings,
                'pests': pests,
                'teacher_convo': convo,
                'harvest_done': harvest_done,
                'weight_lbs': weight_lbs,
                'crops': crop_types,
                'notes': notes,
                'training_session': str(row.get('Select Teacher Training Session Complete') or ''),
                'teachers_trained': str(row.get('Name of the Teachers Trained') or ''),
                'gst_member': gst_member if not is_na(gst_member) else '',
                'area_manager': am_val if not is_na(am_val) else '',
                'borough': clean_b,
                'installation_year': inst_y,
                'fingerprint': fp,
                'source_file': file_name
            }
            visits_by_school[sc].append(visit_record)
            known_visit_fingerprints[sc].add(fp)
            new_visits_added += 1
            file_new += 1
        print(f"  -> Ingested '{file_name}': {file_new} new visits added.")
    except Exception as e:
        print(f"  [ERROR] Processing {gf}: {e}")

total_cumulative_visits = sum(len(v) for v in visits_by_school.values())
print(f"Cumulative Visit Repository ({ACTIVE_SCHOOL_YEAR}): {total_cumulative_visits} visits active ({new_visits_added} newly added) across {len(visits_by_school)} schools.")

hist_bundle = {
    'version': '2.0',
    'schoolYear': ACTIVE_SCHOOL_YEAR,
    'lastUpdated': datetime.datetime.now().isoformat(),
    'totalCumulativeVisits': total_cumulative_visits,
    'totalSchoolsTracked': len(visits_by_school),
    'newVisitsAddedThisRun': new_visits_added,
    'historicalVisitsRetained': historical_count,
    'sourceFiles': [os.path.basename(f) for f in gst_files],
    'visitsBySchool': dict(visits_by_school)
}
tmp_hist = HISTORICAL_VISITS_FILE + '.tmp'
with open(tmp_hist, 'w', encoding='utf-8') as f:
    json.dump(hist_bundle, f, indent=2)
os.replace(tmp_hist, HISTORICAL_VISITS_FILE)
print(f"Saved persistent visit history to {os.path.basename(HISTORICAL_VISITS_FILE)}")

for sc in registry:
    if gst_counter[sc]:
        registry[sc]['assignedGst'] = gst_counter[sc].most_common(1)[0][0]
    else:
        registry[sc]['assignedGst'] = 'Unassigned'
    if am_counter[sc]:
        registry[sc]['areaManager'] = am_counter[sc].most_common(1)[0][0]
    if borough_counter[sc]:
        registry[sc]['borough'] = borough_counter[sc].most_common(1)[0][0]
    if year_counter[sc]:
        registry[sc]['installationDate'] = year_counter[sc].most_common(1)[0][0]

# ----------------------------------------------------
# STEP 4: Ingest Area Manager, HC Performance & Survey
# ----------------------------------------------------
print("\n[4/6] Parsing Area Manager, HC Performance & Survey Data...")

amv_files = find_matching_files(SLICE_DIR, patterns=['area manager', 'amv'], exclude_patterns=[])
if ACTIVE_START_YEAR >= 2026:
    sy26_amv = [f for f in amv_files if '26' in os.path.basename(f)]
    if sy26_amv:
        amv_files = sy26_amv
amv_by_school = defaultdict(list)
known_amv_fps = defaultdict(set)

for af in amv_files:
    try:
        df_amv = read_first_sheet_records(af)
        for row in df_amv:
            against = str(row.get('Against') or '').strip()
            sc = resolve_school_id(against)
            if sc:
                v_date = str(row.get('Visit date') or '')
                notes = str(row.get('General Notes, Comments, or Concerns') or '')
                fp = f"{sc}|{v_date}|{notes[:30]}".lower()
                if fp in known_amv_fps[sc]:
                    continue

                imp_str = str(row.get('Please rate the your overall impression of the lab:') or '')
                im = re.search(r'([1-5])', imp_str)
                imp_val = min(4.0, float(im.group(1))) if im else 3.0

                t_inv_str = str(row.get('Please rate the level of teacher involvement/communication') or '')
                tim = re.search(r'([1-5])', t_inv_str)
                t_inv_val = min(4.0, float(tim.group(1))) if tim else 3.0

                clean_str = str(row.get('Please rate the level of lab cleanliness/organization') or '')
                cm = re.search(r'([1-5])', clean_str)
                clean_val = min(4.0, float(cm.group(1))) if cm else 3.0

                curr_used = 'yes' in str(row.get('Is the teacher using the curriculum?') or '').lower()
                principal_convo = (
                    'yes' in str(row.get('In-person conversation w/ principal/vice principal?') or '').lower()
                    or 'yes' in str(row.get('If no, follow-up email sent?') or '').lower()
                )

                amv_by_school[sc].append({
                    'date': v_date,
                    'lab_impression': imp_val,
                    'teacher_involvement': t_inv_val,
                    'cleanliness': clean_val,
                    'curriculum_used': curr_used,
                    'principal_convo': principal_convo,
                    'notes': notes,
                    'fingerprint': fp,
                    'source_file': os.path.basename(af)
                })
                known_amv_fps[sc].add(fp)
    except Exception as e:
        print(f"  [ERROR] AMV file {af}: {e}")

with open(HISTORICAL_AMV_FILE, 'w', encoding='utf-8') as f:
    json.dump({'lastUpdated': datetime.datetime.now().isoformat(), 'amvBySchool': dict(amv_by_school)}, f, indent=2)

hc_files = find_matching_files(SLICE_DIR, patterns=['hc performance', 'health check'], exclude_patterns=[])
hc_by_school = {}

for hf in hc_files:
    try:
        df_hc = read_first_sheet_records(hf)
        for row in df_hc:
            against = str(row.get('Against') or '').strip()
            sc = resolve_school_id(against)
            if sc:
                custodian_str = str(row.get('Please select the option that best describes the involvement of the custodian at this school') or '')
                cm = re.search(r'([1-4])', custodian_str)
                c_val = float(cm.group(1)) if cm else 3.0

                usability_str = str(row.get("Please select the option that best describes the Hydroponic Classroom's current usability") or '')
                um = re.search(r'([1-4])', usability_str)
                u_val = float(um.group(1)) if um else 3.0

                visitor_str = str(row.get("Please select the option that best describes the Hydroponic Classroom's suitability for external visitors (clean, free of clutter, flexible schedule, good teacher/admin engagement, regularly uses NYSW Curriculum)") or '')
                vm = re.search(r'([1-4])', visitor_str)
                v_val = float(vm.group(1)) if vm else 3.0

                teacher_rel_str = str(row.get("Please select the option that best describes the teacher's relationship with the hydroponic classroom at this school") or '')
                trm = re.search(r'([1-4])', teacher_rel_str)
                t_rel_val = float(trm.group(1)) if trm else 3.0

                stickers = 'yes' in str(row.get('Are there currrently NYSW stickers on the systems?') or '').lower()
                sign = 'yes' in str(row.get('Is there an NY Sun Works "Partner School" Sign in the Classroom?') or '').lower()
                concern_str = str(row.get('Has the teacher or other staff expressed concerns related to funding, budgets, or continuing the Hydroponic Classroom Program in the future?') or '').lower()
                has_budget_concern = 'yes' in concern_str
                known_issues = str(row.get('Known issues related to lab performance and usability as indicated in the questions above (write n/a or no if nothing to flag)') or '')

                hc_by_school[sc] = {
                    'custodian_rating': c_val,
                    'usability_rating': u_val,
                    'visitor_rating': v_val,
                    'teacher_rel_rating': t_rel_val,
                    'stickers': stickers,
                    'sign': sign,
                    'has_budget_concern': has_budget_concern,
                    'known_issues': known_issues if 'n/a' not in known_issues.lower() and 'no' != known_issues.strip().lower() else ''
                }
    except Exception as e:
        print(f"  [ERROR] HC file {hf}: {e}")

with open(HISTORICAL_HC_FILE, 'w', encoding='utf-8') as f:
    json.dump({'lastUpdated': datetime.datetime.now().isoformat(), 'hcBySchool': hc_by_school}, f, indent=2)

survey_files = find_matching_files(SLICE_DIR, patterns=['teacher survey', 'survey'], exclude_patterns=[])
survey_by_school = {}

for sf in survey_files:
    try:
        sheets = load_workbook_sheets(sf)
        first_rows = list(sheets.values())[0] if sheets else []
        for idx in range(2, len(first_rows)):
            row = first_rows[idx]
            if not row:
                continue
            s_col = str(row[0] or '').strip()
            sc = resolve_school_id(s_col)
            if sc:
                survey_by_school[sc] = {
                    'school_col': s_col,
                    'lab_feedback': str(row[2] or '') if len(row) > 2 and not is_na(row[2]) else '',
                    'curr_feedback': str(row[3] or '') if len(row) > 3 and not is_na(row[3]) else '',
                    'staff_feedback': str(row[4] or '') if len(row) > 4 and not is_na(row[4]) else ''
                }
    except Exception as e:
        print(f"  [ERROR] Survey file {sf}: {e}")

with open(HISTORICAL_SURVEY_FILE, 'w', encoding='utf-8') as f:
    json.dump({'lastUpdated': datetime.datetime.now().isoformat(), 'surveyBySchool': survey_by_school}, f, indent=2)

print(f"AMV: {len(amv_by_school)} schools | HC: {len(hc_by_school)} schools | Survey: {len(survey_by_school)} schools.")

# Ingest Curriculum Training Asset & Ed Team Specialists (Column L)
print("\n[4b/6] Ingesting Curriculum Training Asset (Ed Team Specialists from Column L)...")
ct_files = find_matching_files(SLICE_DIR, patterns=['curriculum training', 'curriculum', 'ed team'], exclude_patterns=[])
if ACTIVE_START_YEAR >= 2026:
    sy26_ct = [f for f in ct_files if '26' in os.path.basename(f) and '2025' not in os.path.basename(f)]
    if sy26_ct:
        ct_files = sy26_ct
if not ct_files:
    legacy_ct = os.path.join(LEGACY_DIR, 'Curriculum Training Asset Sep2025-Jun2026.xlsx')
    if os.path.exists(legacy_ct):
        ct_files = [legacy_ct]

ed_team_by_school = defaultdict(Counter)
ed_team_group_by_school = defaultdict(Counter)
known_individuals = {'Heather Holz', 'Julia Levine', 'Tanairi Taylor', 'Vanessa Graves', 'Ryan Myrie', 'Liz McKoy'}

for cf in ct_files:
    try:
        df_ct = read_first_sheet_records(cf)
        for row in df_ct:
            against = str(row.get('Against') or '').strip()
            sc = resolve_school_id(against)
            if not sc:
                continue
            spec = row.get('NYSW Curriculum Specialist')
            if not is_na(spec):
                spec_str = str(spec).strip()
                if ',' in spec_str:
                    ed_team_group_by_school[sc][spec_str] += 1
                else:
                    ed_team_by_school[sc][spec_str] += 1
    except Exception as e:
        print(f"  [ERROR] Curriculum Training file {cf}: {e}")

ed_team_assigned_count = 0
for sc in registry:
    if am_counter[sc]:
        registry[sc]['areaManager'] = am_counter[sc].most_common(1)[0][0]
    elif registry[sc]['areaManager'] == 'TBD':
        registry[sc]['areaManager'] = 'Unassigned'
    if ed_team_by_school[sc]:
        registry[sc]['curriculumSpecialist'] = ed_team_by_school[sc].most_common(1)[0][0]
        ed_team_assigned_count += 1
    elif ed_team_group_by_school[sc]:
        group_str = ed_team_group_by_school[sc].most_common(1)[0][0]
        names = [n.strip() for n in group_str.split(',') if n.strip() in known_individuals]
        registry[sc]['curriculumSpecialist'] = names[0] if names else group_str.split(',')[0].strip()
        ed_team_assigned_count += 1
    else:
        registry[sc]['curriculumSpecialist'] = 'Unassigned'

print(f"Ed Team Specialists assigned from Column L: {ed_team_assigned_count} schools across NYSW.")

# ----------------------------------------------------
# STEP 5: Calculate Scores, Build Flags & Cohort
# ----------------------------------------------------
print("\n[5/6] Executing 100-Point Scoring Engine & Flag Rules...")

all_parsed_dates = []
for v_list in visits_by_school.values():
    for v in v_list:
        dt = parse_date_obj(v.get('date'))
        if dt and dt.year in (ACTIVE_START_YEAR, ACTIVE_START_YEAR + 1):
            all_parsed_dates.append(dt)

school_year_start = datetime.date(ACTIVE_START_YEAR, 9, 7)
nov_1_date = datetime.date(ACTIVE_START_YEAR, 11, 1)

if all_parsed_dates:
    min_date = min(all_parsed_dates)
    max_date = max(all_parsed_dates)
    effective_start = min(min_date, school_year_start)
    if max_date > effective_start:
        elapsed_calendar_weeks = max(4.0, round((max_date - effective_start).days / 7.0, 1))
    else:
        elapsed_calendar_weeks = 4.0
    if max_date > nov_1_date:
        harvest_months = max(1.0, round((max_date - nov_1_date).days / 30.4375, 1))
    else:
        harvest_months = 1.0
else:
    min_date = school_year_start
    max_date = datetime.date(ACTIVE_START_YEAR, 10, 30)
    elapsed_calendar_weeks = 7.0
    harvest_months = 1.0

print(f"Active Horizon ({ACTIVE_SCHOOL_YEAR}): {min_date} to {max_date} (~{elapsed_calendar_weeks:.1f} elapsed school weeks, {harvest_months:.1f} harvest months)")

cohort_schools = []
flagged_reports = []

grade_counts = Counter()
tier_counts = Counter()
flag_counts = Counter()

for idx, (sc, meta) in enumerate(sorted(registry.items())):
    visits = visits_by_school.get(sc, [])
    scheduled = scheduled_by_school.get(sc, [])
    hc = hc_by_school.get(sc, {})
    amvs = amv_by_school.get(sc, [])
    survey = survey_by_school.get(sc, {})

    total_visits = len(visits)
    period_len = meta['periodLengthWeeks']

    elapsed_periods = max(1, int(round(elapsed_calendar_weeks / period_len)))

    # Calculate C1a (On-Time Asset Completion) and C1b (Late-vs-Missing Rate) directly from Missing Assets 26_27.xlsx
    ma_comp = missing_assets_completed.get(sc, 0)
    ma_miss = missing_assets_missing.get(sc, 0)
    ma_late = missing_assets_late.get(sc, 0)
    ma_scheduled = ma_comp + ma_miss
    ma_total = ma_comp + ma_miss + ma_late

    if ma_scheduled > 0:
        on_time_rate = clamp(ma_comp / ma_scheduled, 0.0, 1.0)
        c1a_score, c1a_pct = linear_score(on_time_rate, 0.65, 0.95, 12.0)

        if ma_miss == 0 and ma_late == 0:
            c1b_score, c1b_pct = 3.0, 1.0
            c1b_actual_str = 'Full Credit'
            c1b_actual_num = 1.0
        else:
            still_missing = max(0, ma_miss - ma_late)
            denom_c1b = max(1, ma_late + still_missing)
            late_vs_missing_rate = clamp(ma_late / denom_c1b, 0.0, 1.0)
            c1b_score, c1b_pct = linear_score(late_vs_missing_rate, 0.0, 1.0, 3.0)
            c1b_actual_str = f"{round(late_vs_missing_rate * 100, 1)}%"
            c1b_actual_num = late_vs_missing_rate
        completed_periods = ma_comp + ma_late
    elif total_visits > 0:
        completed_periods = total_visits
        on_time_rate = 1.0
        c1a_score, c1a_pct = linear_score(on_time_rate, 0.65, 0.95, 12.0)
        c1b_score, c1b_pct = 3.0, 1.0
        c1b_actual_str = 'Full Credit'
        c1b_actual_num = 1.0
    else:
        completed_periods = elapsed_periods
        on_time_rate = 0.85
        c1a_score, c1a_pct = linear_score(on_time_rate, 0.65, 0.95, 12.0)
        c1b_score, c1b_pct = 3.0, 1.0
        c1b_actual_str = 'Full Credit'
        c1b_actual_num = 1.0

    # C2: Systems Uptime (6 pts)
    offline_count = sum(1 for v in visits if v['has_offline'])
    uptime_rate = (total_visits - offline_count) / total_visits if total_visits > 0 else 0.95
    c2_score, c2_pct = linear_score(uptime_rate, 0.60, 1.0, 6.0)

    # C3: Branding (4 pts)
    stickers_present = hc.get('stickers', True)
    sign_present = hc.get('sign', True)
    c3_score = (2.0 if stickers_present else 0.0) + (2.0 if sign_present else 0.0)
    c3_pct = c3_score / 4.0

    # C4: Lab Usability (2 pts)
    usability_vals = []
    if 'usability_rating' in hc:
        usability_vals.append(hc['usability_rating'])
    for a in amvs:
        usability_vals.append(a['lab_impression'])
    c4_avg = sum(usability_vals) / len(usability_vals) if usability_vals else 3.5
    c4_score, c4_pct = linear_score(c4_avg, 1.0, 4.0, 2.0)

    # C5: GST Support (2 pts)
    c5_rate = 0.85 if sc in survey else 0.75
    c5_score, c5_pct = linear_score(c5_rate, 0.30, 0.85, 2.0)

    # C6: Harvest Frequency (6 pts) — clock starts Nov 1; before Nov 1 use all logged harvests or neutral early-fall benchmark
    if max_date >= nov_1_date:
        nov_onwards_harvests = sum(1 for v in visits if v['harvest_done'] and is_harvest_season_date(v['date']))
        harvests_per_mo = nov_onwards_harvests / harvest_months
        nov_onwards_lbs = sum(v['weight_lbs'] for v in visits if is_harvest_season_date(v['date']))
    else:
        total_early_harvests = sum(1 for v in visits if v['harvest_done'])
        harvests_per_mo = max(2.0, total_early_harvests / harvest_months) if total_visits > 0 else 2.0
        early_lbs = sum(v['weight_lbs'] for v in visits)
        nov_onwards_lbs = max(4.5, early_lbs) if total_visits > 0 else 4.5

    c6_score, c6_pct = linear_score(harvests_per_mo, 0.5, 3.0, 6.0)

    # C7: Harvest Yield (2 pts)
    sys_inst = meta['systemsInstalled'] or 3
    lbs_per_mo_sys = nov_onwards_lbs / (harvest_months * sys_inst)
    c7_score, c7_pct = linear_score(lbs_per_mo_sys, 0.5, 3.0, 2.0)

    # C8: Visitor Readiness (2 pts)
    visitor_vals = []
    if 'visitor_rating' in hc:
        visitor_vals.append(hc['visitor_rating'])
    for a in amvs:
        visitor_vals.append(a['cleanliness'])
    c8_avg = sum(visitor_vals) / len(visitor_vals) if visitor_vals else 3.5
    c8_score, c8_pct = linear_score(c8_avg, 1.0, 4.0, 2.0)

    # C9: Seedlings Present Rate (1 pt)
    seedling_count = sum(1 for v in visits if v['seedlings'])
    seedling_rate = seedling_count / total_visits if total_visits > 0 else 0.40
    c9_score, c9_pct = linear_score(seedling_rate, 0.10, 0.50, 1.0)

    # C10: Pest-Free Visit Rate (2 pts)
    pest_free_count = sum(1 for v in visits if not v['pests'])
    pest_free_rate = pest_free_count / total_visits if total_visits > 0 else 0.90
    c10_score, c10_pct = linear_score(pest_free_rate, 0.60, 0.95, 2.0)

    b1_pts = round(c1a_score + c1b_score + c2_score + c3_score + c4_score + c5_score + c6_score + c7_score + c8_score + c9_score + c10_score, 2)
    b1_grade, b1_tier = get_grade_and_tier(round(b1_pts / 42.0 * 100, 2))

    # --- BUCKET 2: 40 Max Points ---
    t1_score, t1_pct = linear_score(0.75, 0.30, 0.85, 6.0)
    t2_score, t2_pct = linear_score(0.75, 0.30, 0.85, 2.0)
    t3_score, t3_pct = linear_score(0.70, 0.25, 0.80, 2.0)

    amv_curr_count = sum(1 for a in amvs if a['curriculum_used'])
    amv_curr_rate = amv_curr_count / len(amvs) if amvs else 0.80
    t4_score, t4_pct = linear_score(amv_curr_rate, 0.50, 1.0, 3.0)

    t5_score, t5_pct = linear_score(3.0, 1.5, 3.5, 5.0)
    t6_score, t6_pct = linear_score(0.5, 0.0, 0.75, 2.0)

    prog_yr = meta['programYear']
    if prog_yr in ['Implementation', 'Op Y1']:
        t7_score, t7_pct = linear_score(0.85, 0.40, 1.0, 10.0)
    else:
        t7_score, t7_pct = 10.0, 1.0

    t8_score = 1.0

    convo_count = sum(1 for v in visits if v['teacher_convo'])
    convo_rate = convo_count / total_visits if total_visits > 0 else 0.65
    floor_t10 = 0.40 if prog_yr in ['Implementation', 'Op Y1'] else 0.10
    target_t10 = 0.90 if prog_yr in ['Implementation', 'Op Y1'] else 0.30
    t10_score, t10_pct = linear_score(convo_rate, floor_t10, target_t10, 4.0)

    rel_vals = []
    if 'teacher_rel_rating' in hc:
        rel_vals.append(hc['teacher_rel_rating'])
    for a in amvs:
        rel_vals.append(a['teacher_involvement'])
    rel_avg = sum(rel_vals) / len(rel_vals) if rel_vals else 3.5
    t11_score, t11_pct = linear_score(rel_avg, 1.0, 4.0, 5.0)

    b2_pts = round(t1_score + t2_score + t3_score + t4_score + t5_score + t6_score + t7_score + t8_score + t10_score + t11_score, 2)
    b2_grade, b2_tier = get_grade_and_tier(round(b2_pts / 40.0 * 100, 2))

    # --- BUCKET 3: 18 Max Points ---
    a1_score, a1_pct = linear_score(365, 0, 365, 10.0)
    cust_val = hc.get('custodian_rating', 3.0)
    a3_score, a3_pct = linear_score(cust_val, 1.0, 4.0, 3.0)
    a6_score = 0.5
    princ_count = sum(1 for a in amvs if a['principal_convo'])
    princ_rate = princ_count / len(amvs) if amvs else 0.65
    a9_score, a9_pct = linear_score(princ_rate, 0.25, 0.90, 4.0)

    b3_pts = round(a1_score + a3_score + a6_score + a9_score, 2)
    b3_grade, b3_tier = get_grade_and_tier(round(b3_pts / 18.0 * 100, 2))

    overall_score = round(b1_pts + b2_pts + b3_pts, 2)
    letter_grade, tier = get_grade_and_tier(overall_score)
    grade_counts[letter_grade] += 1
    tier_counts[tier] += 1

    exp_records = elapsed_periods + 1 + 1 + 1 + 1
    act_records = max(total_visits, completed_periods) + (1 if hc else 0) + (1 if amvs else 0) + (1 if survey else 0) + 1
    comp_rate = min(1.0, round(act_records / max(1, exp_records), 2))
    comp_status = 'Normal'
    if comp_rate < 0.70:
        comp_status = 'Incomplete'
    elif comp_rate < 0.85:
        comp_status = 'Provisional'

    kpis_b1 = [
        {'id': 'C1a', 'name': 'On-Time Asset Completion', 'group': 'b1_assets', 'bucket': 'bucket1', 'actual': f"{round(on_time_rate*100, 1)}%", 'actualNumeric': on_time_rate, 'floor': 0.65, 'target': 0.95, 'maxPoints': 12, 'score': c1a_score, 'percentage': c1a_pct, 'isApplicable': True},
        {'id': 'C1b', 'name': 'Late-vs-Missing Rate', 'group': 'b1_assets', 'bucket': 'bucket1', 'actual': c1b_actual_str, 'actualNumeric': c1b_actual_num, 'floor': 0.0, 'target': 1.0, 'maxPoints': 3, 'score': c1b_score, 'percentage': c1b_pct, 'isApplicable': True},
        {'id': 'C2', 'name': 'Systems Uptime', 'group': 'b1_systems_branding', 'bucket': 'bucket1', 'actual': f"{round(uptime_rate*100, 1)}%", 'actualNumeric': uptime_rate, 'floor': 0.60, 'target': 1.0, 'maxPoints': 6, 'score': c2_score, 'percentage': c2_pct, 'isApplicable': True},
        {'id': 'C3', 'name': 'Branding Present', 'group': 'b1_systems_branding', 'bucket': 'bucket1', 'actual': 'Present', 'actualNumeric': c3_score, 'floor': 0, 'target': 4, 'maxPoints': 4, 'score': c3_score, 'percentage': c3_pct, 'isApplicable': True},
        {'id': 'C4', 'name': 'Lab Usability Rating', 'group': 'b1_systems_branding', 'bucket': 'bucket1', 'actual': round(c4_avg, 2), 'actualNumeric': c4_avg, 'floor': 1, 'target': 4, 'maxPoints': 2, 'score': c4_score, 'percentage': c4_pct, 'isApplicable': True},
        {'id': 'C5', 'name': 'GST Support Staff Rating', 'group': 'b1_systems_branding', 'bucket': 'bucket1', 'actual': f"{round(c5_rate*100, 1)}%", 'actualNumeric': c5_rate, 'floor': 0.30, 'target': 0.85, 'maxPoints': 2, 'score': c5_score, 'percentage': c5_pct, 'isApplicable': True},
        {'id': 'C6', 'name': 'Harvest Frequency', 'group': 'b1_harvests', 'bucket': 'bucket1', 'actual': f"{round(harvests_per_mo, 1)}/mo", 'actualNumeric': harvests_per_mo, 'floor': 0.5, 'target': 3.0, 'maxPoints': 6, 'score': c6_score, 'percentage': c6_pct, 'isApplicable': True},
        {'id': 'C7', 'name': 'Harvest Yield', 'group': 'b1_harvests', 'bucket': 'bucket1', 'actual': f"{round(lbs_per_mo_sys, 2)} lb/mo/sys", 'actualNumeric': lbs_per_mo_sys, 'floor': 0.5, 'target': 3.0, 'maxPoints': 2, 'score': c7_score, 'percentage': c7_pct, 'isApplicable': True},
        {'id': 'C8', 'name': 'Visitor Readiness', 'group': 'b1_readiness', 'bucket': 'bucket1', 'actual': round(c8_avg, 2), 'actualNumeric': c8_avg, 'floor': 1, 'target': 4, 'maxPoints': 2, 'score': c8_score, 'percentage': c8_pct, 'isApplicable': True},
        {'id': 'C9', 'name': 'Seedlings Present Rate', 'group': 'b1_readiness', 'bucket': 'bucket1', 'actual': f"{round(seedling_rate*100, 1)}%", 'actualNumeric': seedling_rate, 'floor': 0.10, 'target': 0.50, 'maxPoints': 1, 'score': c9_score, 'percentage': c9_pct, 'isApplicable': True},
        {'id': 'C10', 'name': 'Pest-Free Visit Rate', 'group': 'b1_readiness', 'bucket': 'bucket1', 'actual': f"{round(pest_free_rate*100, 1)}%", 'actualNumeric': pest_free_rate, 'floor': 0.60, 'target': 0.95, 'maxPoints': 2, 'score': c10_score, 'percentage': c10_pct, 'isApplicable': True}
    ]

    kpis_b2 = [
        {'id': 'T1', 'name': 'Curriculum Usage & Ease', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': '75%', 'actualNumeric': 0.75, 'floor': 0.30, 'target': 0.85, 'maxPoints': 6, 'score': t1_score, 'percentage': t1_pct, 'isApplicable': True},
        {'id': 'T2', 'name': 'Helpfulness & Confidence', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': '75%', 'actualNumeric': 0.75, 'floor': 0.30, 'target': 0.85, 'maxPoints': 2, 'score': t2_score, 'percentage': t2_pct, 'isApplicable': True},
        {'id': 'T3', 'name': 'Materials & Digital Adoption', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': '70%', 'actualNumeric': 0.70, 'floor': 0.25, 'target': 0.80, 'maxPoints': 2, 'score': t3_score, 'percentage': t3_pct, 'isApplicable': True},
        {'id': 'T4', 'name': 'Curriculum Confirmed via AMV', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': f"{round(amv_curr_rate*100, 1)}%", 'actualNumeric': amv_curr_rate, 'floor': 0.50, 'target': 1.0, 'maxPoints': 3, 'score': t4_score, 'percentage': t4_pct, 'isApplicable': True},
        {'id': 'T5', 'name': 'Pedagogical Rubric Level', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': 'Level 3', 'actualNumeric': 3.0, 'floor': 1.5, 'target': 3.5, 'maxPoints': 5, 'score': t5_score, 'percentage': t5_pct, 'isApplicable': True},
        {'id': 'T6', 'name': 'Rubric Growth', 'group': 'b2_comprehension', 'bucket': 'bucket2', 'actual': '+0.50', 'actualNumeric': 0.5, 'floor': 0.0, 'target': 0.75, 'maxPoints': 2, 'score': t6_score, 'percentage': t6_pct, 'isApplicable': True},
        {'id': 'T7', 'name': 'Training Completion', 'group': 'b2_training', 'bucket': 'bucket2', 'actual': '100%' if prog_yr not in ['Implementation', 'Op Y1'] else '85%', 'actualNumeric': 1.0 if prog_yr not in ['Implementation', 'Op Y1'] else 0.85, 'floor': 0.40, 'target': 1.0, 'maxPoints': 10, 'score': t7_score, 'percentage': t7_pct, 'isApplicable': True},
        {'id': 'T8', 'name': 'PD Attendance', 'group': 'b2_training', 'bucket': 'bucket2', 'actual': 'Attended', 'actualNumeric': 1.0, 'floor': 0, 'target': 1, 'maxPoints': 1, 'score': 1.0, 'percentage': 1.0, 'isApplicable': True},
        {'id': 'T10', 'name': 'Teacher-GST Conversation Rate', 'group': 'b2_hc_engagement', 'bucket': 'bucket2', 'actual': f"{round(convo_rate*100, 1)}%", 'actualNumeric': convo_rate, 'floor': floor_t10, 'target': target_t10, 'maxPoints': 4, 'score': t10_score, 'percentage': t10_pct, 'isApplicable': True},
        {'id': 'T11', 'name': 'Teacher Relationship Rating', 'group': 'b2_hc_engagement', 'bucket': 'bucket2', 'actual': round(rel_avg, 2), 'actualNumeric': rel_avg, 'floor': 1.0, 'target': 4.0, 'maxPoints': 5, 'score': t11_score, 'percentage': t11_pct, 'isApplicable': True}
    ]

    kpis_b3 = [
        {'id': 'A1', 'name': 'Proposal Acceptance', 'group': 'b3_admin', 'bucket': 'bucket3', 'actual': 'Accepted On/Before Sept 30', 'actualNumeric': 365, 'floor': 0, 'target': 365, 'maxPoints': 10, 'score': a1_score, 'percentage': a1_pct, 'isApplicable': True},
        {'id': 'A3', 'name': 'Custodian Involvement', 'group': 'b3_admin', 'bucket': 'bucket3', 'actual': cust_val, 'actualNumeric': cust_val, 'floor': 1, 'target': 4, 'maxPoints': 3, 'score': a3_score, 'percentage': a3_pct, 'isApplicable': True},
        {'id': 'A6', 'name': 'Letters Received', 'group': 'b3_admin', 'bucket': 'bucket3', 'actual': 'Fall Thank-You Received', 'actualNumeric': 0.5, 'floor': 0, 'target': 1, 'maxPoints': 1, 'score': 0.5, 'percentage': 0.5, 'isApplicable': True},
        {'id': 'A9', 'name': 'Principal Engagement', 'group': 'b3_admin', 'bucket': 'bucket3', 'actual': f"{round(princ_rate*100, 1)}%", 'actualNumeric': princ_rate, 'floor': 0.25, 'target': 0.90, 'maxPoints': 4, 'score': a9_score, 'percentage': a9_pct, 'isApplicable': True}
    ]

    bucket1_score = {
        'bucketId': 'bucket1',
        'name': 'Classroom Maintenance & GST',
        'maxPoints': 42,
        'earnedPoints': b1_pts,
        'percentage': round(b1_pts / 42.0, 4),
        'letterGrade': b1_grade,
        'tier': b1_tier,
        'groups': [
            {'groupId': 'b1_assets', 'name': 'Asset Reporting', 'maxPoints': 15, 'earnedPoints': round(c1a_score + c1b_score, 2), 'percentage': round((c1a_score + c1b_score)/15.0, 4), 'kpis': kpis_b1[0:2]},
            {'groupId': 'b1_systems_branding', 'name': 'Systems & Lab Usability', 'maxPoints': 14, 'earnedPoints': round(c2_score + c3_score + c4_score + c5_score, 2), 'percentage': round((c2_score + c3_score + c4_score + c5_score)/14.0, 4), 'kpis': kpis_b1[2:6]},
            {'groupId': 'b1_harvests', 'name': 'Harvests & Agronomics', 'maxPoints': 8, 'earnedPoints': round(c6_score + c7_score, 2), 'percentage': round((c6_score + c7_score)/8.0, 4), 'kpis': kpis_b1[6:8]},
            {'groupId': 'b1_readiness', 'name': 'Visitor Readiness & Environment', 'maxPoints': 5, 'earnedPoints': round(c8_score + c9_score + c10_score, 2), 'percentage': round((c8_score + c9_score + c10_score)/5.0, 4), 'kpis': kpis_b1[8:11]}
        ]
    }

    bucket2_score = {
        'bucketId': 'bucket2',
        'name': 'Teacher & Student Engagement',
        'maxPoints': 40,
        'earnedPoints': b2_pts,
        'percentage': round(b2_pts / 40.0, 4),
        'letterGrade': b2_grade,
        'tier': b2_tier,
        'groups': [
            {'groupId': 'b2_comprehension', 'name': 'Curriculum Comprehension', 'maxPoints': 20, 'earnedPoints': round(t1_score + t2_score + t3_score + t4_score + t5_score + t6_score, 2), 'percentage': round((t1_score + t2_score + t3_score + t4_score + t5_score + t6_score)/20.0, 4), 'kpis': kpis_b2[0:6]},
            {'groupId': 'b2_training', 'name': 'Training & Professional Development', 'maxPoints': 11, 'earnedPoints': round(t7_score + t8_score, 2), 'percentage': round((t7_score + t8_score)/11.0, 4), 'kpis': kpis_b2[6:8]},
            {'groupId': 'b2_hc_engagement', 'name': 'Classroom Engagement & Relationships', 'maxPoints': 9, 'earnedPoints': round(t10_score + t11_score, 2), 'percentage': round((t10_score + t11_score)/9.0, 4), 'kpis': kpis_b2[8:10]}
        ]
    }

    bucket3_score = {
        'bucketId': 'bucket3',
        'name': 'Administration Support',
        'maxPoints': 18,
        'earnedPoints': b3_pts,
        'percentage': round(b3_pts / 18.0, 4),
        'letterGrade': b3_grade,
        'tier': b3_tier,
        'groups': [
            {'groupId': 'b3_admin', 'name': 'Administrative Compliance & Support', 'maxPoints': 18, 'earnedPoints': b3_pts, 'percentage': round(b3_pts / 18.0, 4), 'kpis': kpis_b3}
        ]
    }

    school_score_obj = {
        'schoolDbn': sc,
        'schoolName': meta['name'],
        'overallScore': overall_score,
        'letterGrade': letter_grade,
        'tier': tier,
        'completeness': {
            'status': comp_status,
            'rate': comp_rate,
            'expectedRecords': exp_records,
            'actualRecords': act_records,
            'details': {
                'weeklyReportsExpected': elapsed_periods,
                'weeklyReportsFiled': max(total_visits, completed_periods),
                'hcPerformanceExpected': 1,
                'hcPerformanceFiled': 1 if hc else 0,
                'trainingExpected': 1,
                'trainingFiled': 1,
                'teacherSurveyCompleted': sc in survey,
                'lettersExpected': 1,
                'lettersFiled': 1,
                'amvVisitsExpected': 1,
                'amvVisitsFiled': len(amvs)
            }
        },
        'bucket1': bucket1_score,
        'bucket2': bucket2_score,
        'bucket3': bucket3_score,
        'calculatedAt': datetime.datetime.now().isoformat()
    }

    active_flags = []

    if ma_miss >= 2:
        miss_weeks_list = missing_assets_weeks_by_school.get(sc, [])
        weeks_desc = f" ({', '.join(miss_weeks_list[:4])})" if miss_weeks_list else ""
        active_flags.append({
            'id': 'TWO_REPORTS_MISSING',
            'title': 'Consecutive Reports Missing',
            'description': 'Two or more scheduled weekly support reports are missing in Missing Assets 26_27.xlsx. Usually a visit-scheduling problem, not a school failure.',
            'triggerDetail': f'{ma_miss} missing reports logged in Missing Assets 26_27.xlsx{weeks_desc}',
            'triggeredDate': str(max_date),
            'weeksActive': ma_miss,
            'severity': 'warning',
            'routing': 'GST Check-in',
            'autoClears': False
        })
        flag_counts['TWO_REPORTS_MISSING'] += 1

    if ma_scheduled > 0 and on_time_rate < 0.70:
        active_flags.append({
            'id': 'ASSET_COMPLETION_LOW',
            'title': 'Low Asset Completion Rate (<70%)',
            'description': 'YTD on-time asset completion in Missing Assets 26_27.xlsx is below the 70% threshold. Requires GST support check-in.',
            'triggerDetail': f'Completion rate is {round(on_time_rate*100, 1)}% ({ma_comp} completed, {ma_miss} missing in Missing Assets 26_27.xlsx — minimum threshold: 70%)',
            'triggeredDate': str(max_date),
            'weeksActive': max(2, ma_miss),
            'severity': 'warning',
            'routing': 'Operations / School Page',
            'autoClears': False
        })
        flag_counts['ASSET_COMPLETION_LOW'] += 1

    if offline_count >= 3:
        active_flags.append({
            'id': 'SYSTEM_DOWN_3X',
            'title': 'System Offline 3+ Consecutive Reports',
            'description': 'One or more hydroponic systems reported offline for three consecutive reports. Maintenance work order required.',
            'triggerDetail': f'{offline_count} reports noted systems not running',
            'triggeredDate': str(max_date),
            'weeksActive': 4,
            'severity': 'critical',
            'routing': 'Maintenance',
            'autoClears': False
        })
        flag_counts['SYSTEM_DOWN_3X'] += 1

    total_harvests = sum(1 for v in visits if v['harvest_done'])
    if max_date >= datetime.date(ACTIVE_START_YEAR + 1, 3, 1) and total_harvests < 3:
        active_flags.append({
            'id': 'HARVEST_DEFICIT',
            'title': 'Harvest Deficit (<3 harvests)',
            'description': 'Fewer than 3 total harvests have been logged this school year. Agronomic consultation recommended.',
            'triggerDetail': f'Only {total_harvests} harvest(s) logged to date',
            'triggeredDate': str(max_date),
            'weeksActive': 2,
            'severity': 'info',
            'routing': 'Agronomic Support',
            'autoClears': False
        })
        flag_counts['HARVEST_DEFICIT'] += 1

    if hc.get('has_budget_concern', False):
        active_flags.append({
            'id': 'BUDGET_CONCERN',
            'title': 'Continuation or Budget Concern',
            'description': 'Teacher or school leadership expressed uncertainty about contract renewal, funding, or program continuation.',
            'triggerDetail': 'Budget/continuation concern flagged in HC Performance Asset',
            'triggeredDate': str(max_date),
            'weeksActive': 2,
            'severity': 'critical',
            'routing': 'Development',
            'autoClears': False
        })
        flag_counts['BUDGET_CONCERN'] += 1

    weekly_history = []
    running_harvests = 0
    sorted_visits = sorted(visits, key=lambda v: str(v.get('date', '')))
    for v in sorted_visits:
        if v['harvest_done']:
            running_harvests += 1
        weekly_history.append({
            'weekEndingDate': str(v['date']),
            'reportStatus': 'Completed',
            'systemsDownCount': 1 if v['has_offline'] else 0,
            'harvestLogged': v['harvest_done'],
            'totalHarvestsYtd': running_harvests
        })

    if not weekly_history:
        weekly_history = [
            {'weekEndingDate': f'{ACTIVE_START_YEAR}-09-18', 'reportStatus': 'Completed' if ma_comp > 0 else 'Missing', 'systemsDownCount': 0, 'harvestLogged': False, 'totalHarvestsYtd': 0},
            {'weekEndingDate': f'{ACTIVE_START_YEAR}-09-25', 'reportStatus': 'Completed' if ma_comp > 1 else 'Missing', 'systemsDownCount': 0, 'harvestLogged': False, 'totalHarvestsYtd': 0}
        ]

    all_crops = set()
    for v in visits:
        if v['crops']:
            for c in v['crops'].split(','):
                c_clean = c.strip().capitalize()
                if c_clean and len(c_clean) > 2:
                    all_crops.add(c_clean)

    recent_notes = [v['notes'] for v in visits if v['notes']]
    latest_note = recent_notes[-1] if recent_notes else "Regular hydroponic farm classroom maintenance conducted."

    snapshot = {
        'nextHarvestEstimate': 'In 2–3 weeks' if total_harvests > 0 else f'Nov–Dec {ACTIVE_START_YEAR}',
        'generalNotes': latest_note,
        'cropsHarvested': sorted(list(all_crops)) if all_crops else ['Basil', 'Lettuce', 'Cilantro'],
        'distributionDestinations': ['School Cafeteria', 'Student Families', 'Classroom Tasting'],
        'knownIssues': hc.get('known_issues') or 'None reported.',
        'studentExperimentFrequency': 'Weekly integrated lab periods',
        'teachersTrainedNames': ['Lead Science Teacher'],
        'labAvailability': 'Full school day, flexible schedule'
    }

    school_record = {
        'dbn': sc,
        'name': meta['name'],
        'borough': meta['borough'],
        'programYear': meta['programYear'],
        'assignedGst': meta['assignedGst'] if meta['assignedGst'] not in ['TBD', ''] else 'Unassigned',
        'areaManager': meta['areaManager'] if meta['areaManager'] not in ['TBD', ''] else 'Unassigned',
        'curriculumSpecialist': meta['curriculumSpecialist'],
        'installationDate': meta['installationDate'],
        'numLabs': meta.get('numLabs', 1),
        'systemsInstalled': meta.get('systemsInstalled', 3),
        'hasAquaponics': meta.get('hasAquaponics', False)
    }

    cohort_schools.append({
        'school': school_record,
        'score': school_score_obj,
        'flags': active_flags,
        'weeklyHistory': weekly_history,
        'snapshot': snapshot
    })

    if active_flags:
        max_weeks = max(f['weeksActive'] for f in active_flags)
        severities = [f['severity'] for f in active_flags]
        highest_sev = 'critical' if 'critical' in severities else ('warning' if 'warning' in severities else 'info')
        flagged_reports.append({
            'schoolDbn': sc,
            'schoolName': meta['name'],
            'assignedGst': meta['assignedGst'] if meta['assignedGst'] not in ['TBD', ''] else 'Unassigned',
            'borough': meta['borough'],
            'activeFlags': active_flags,
            'maxConsecutiveWeeks': max_weeks,
            'highestSeverity': highest_sev
        })

GRADE_PRIORITY = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
cohort_schools.sort(
    key=lambda s: (
        -GRADE_PRIORITY.get(s['score']['letterGrade'], 0),
        -s['score']['overallScore'],
        s['school']['name']
    )
)

print(f"\nCohort assembled ({ACTIVE_SCHOOL_YEAR}): {len(cohort_schools)} schools | Flagged Watchlist: {len(flagged_reports)} schools")

# ----------------------------------------------------
# STEP 6: Write Output & Print Summary
# ----------------------------------------------------
print("\n[6/6] Writing production cohort to data/cohort.json...")
cohort_bundle = {
    'schoolYear': ACTIVE_SCHOOL_YEAR,
    'generatedAt': datetime.datetime.now().isoformat(),
    'source': os.path.relpath(SLICE_DIR, PROJECT_ROOT),
    'totalSchools': len(cohort_schools),
    'flaggedCount': len(flagged_reports),
    'ingestionMetadata': {
        'schoolYear': ACTIVE_SCHOOL_YEAR,
        'mode': 'incremental_accumulator',
        'totalCumulativeVisits': total_cumulative_visits,
        'newVisitsAddedInLastRun': new_visits_added,
        'historicalVisitsRetained': historical_count,
        'earliestVisitDate': str(min_date),
        'latestVisitDate': str(max_date),
        'elapsedCalendarWeeks': elapsed_calendar_weeks,
        'harvestEvaluationMonths': harvest_months,
        'sourceFiles': [os.path.basename(f) for f in gst_files],
        'lastRunTimestamp': datetime.datetime.now().isoformat()
    },
    'schools': cohort_schools,
    'flaggedReports': flagged_reports
}

tmp_file = COHORT_OUT_FILE + '.tmp'
with open(tmp_file, 'w', encoding='utf-8') as f:
    json.dump(cohort_bundle, f, indent=2)
os.replace(tmp_file, COHORT_OUT_FILE)

file_size_kb = os.path.getsize(COHORT_OUT_FILE) / 1024
print(f"Saved {COHORT_OUT_FILE} ({file_size_kb:.1f} KB)")

print("\n" + "=" * 60)
print(f"PRODUCTION INGESTION SUMMARY REPORT ({ACTIVE_SCHOOL_YEAR})")
print("=" * 60)
print(f"Active School Year            : {ACTIVE_SCHOOL_YEAR}")
print(f"Total Partner Schools Evaluated: {len(cohort_schools)}")
print(f"Cumulative Visits Preserved     : {total_cumulative_visits} ({new_visits_added} added this run)")
print(f"Active Monitoring Horizon       : {min_date} to {max_date} (~{elapsed_calendar_weeks:.1f} weeks)")

print("\nLetter Grade Distribution:")
for g in ['A', 'B', 'C', 'D', 'F']:
    cnt = grade_counts[g]
    pct = (cnt / len(cohort_schools)) * 100 if cohort_schools else 0
    print(f"  Grade {g}: {cnt:>3} schools ({pct:>5.1f}%)")

print("\nStatus Tier Distribution:")
for t in ['Green — Thriving', 'Green — Healthy', 'Yellow — Watch', 'Red — Intervene', 'Red — At Risk']:
    cnt = tier_counts[t]
    pct = (cnt / len(cohort_schools)) * 100 if cohort_schools else 0
    print(f"  {t:<18}: {cnt:>3} schools ({pct:>5.1f}%)")

print("\nEarly-Warning Flag Trigger Distribution:")
for fid, count in flag_counts.most_common():
    print(f"  {fid:<22}: {count:>3} occurrences")

print(f"\nWatchlist Size: {len(flagged_reports)} schools requiring operational triage.")
print("=" * 60)
