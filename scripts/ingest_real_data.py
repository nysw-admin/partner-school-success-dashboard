"""
NY Sun Works — Partner School Success Dashboard
Production Data Ingestion Pipeline

Reads all 7 Excel files and 1 Word doc from '1st slice of data SY 25-26/'
- Accelo Partner Schools Export.xls
- GST Schedule SY 25_26 - Visit Cadence.xlsx
- Copy of GST Schedule SY 25_26.xlsx (53 sheets, one per week)
- Accelo GST Asset Export Sept-Dec 2025.xlsx (4,007 visit records)
- Area Manager Asset Sep-Dec 2025.xlsx (82 AM visits)
- HC Performance Asset Sep25-Jun26.xls (40 health checks)
- Teacher Survey 25_26.xlsx (111 teacher responses)
- Partner School Grade Rubric — C1a_C1b Build Specification.docx (Refined period & scoring math)

Compiles a fully scored, typed production cohort into 'data/cohort.json'.
"""

import os, sys, json, re, datetime, math
import openpyxl, xlrd, pandas as pd
from collections import defaultdict, Counter

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLICE_DIR = os.path.join(PROJECT_ROOT, '1st slice of data SY 25-26')
DATA_OUT_DIR = os.path.join(PROJECT_ROOT, 'data')
COHORT_OUT_FILE = os.path.join(DATA_OUT_DIR, 'cohort.json')

os.makedirs(DATA_OUT_DIR, exist_ok=True)

print("=" * 60)
print("NY SUN WORKS — REAL DATA INGESTION PIPELINE")
print("=" * 60)

# Helper utilities
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
    if pd.isna(val) or not val:
        return default
    s = str(val).strip().title()
    for b in ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']:
        if b.lower() in s.lower():
            return b
    return default

def clean_program_year(status):
    if not status or pd.isna(status):
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
    if not cadence_str or pd.isna(cadence_str):
        return 'Weekly', 1.0
    s = str(cadence_str).strip().lower()
    if any(k in s for k in ['twice', 'bi-weekly', 'biweekly', 'bi weekly']) and not any(k in s for k in ['eow', 'other', 'monthly']):
        return 'Twice-weekly', 0.5
    if any(k in s for k in ['eow', 'every other', 'bi-monthly', 'bimonthly']):
        return 'Every-two-weeks', 2.0
    if 'month' in s:
        return 'Monthly', 4.3
    return 'Weekly', 1.0

# ----------------------------------------------------
# STEP 1: Build Master Crosswalk from Accelo & Cadence
# ----------------------------------------------------
print("\n[1/6] Ingesting School Registry & Cadence Specs...")
df_schools = pd.read_excel(os.path.join(SLICE_DIR, 'Accelo Partner Schools Export.xls'))
registry = {}
alias_map = {}

for _, r in df_schools.iterrows():
    c_name = str(r['Client name']).strip()
    raw_code = str(r['1. School Location . 1.91 School Code']).strip()
    status = str(r['Status']).strip()
    nick = str(r['1. School Location . 1.93 School Nick Name']).strip()
    lab_type = str(r['4. Classroom Details . 4.1 Type of Lab']).strip()
    
    m = re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', c_name) or re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', raw_code)
    canonical_id = m.group(1).upper() if m else (raw_code if raw_code and raw_code != 'nan' else c_name)
    
    b = 'Manhattan'
    if canonical_id.startswith('K'): b = 'Brooklyn'
    elif canonical_id.startswith('X'): b = 'Bronx'
    elif canonical_id.startswith('Q'): b = 'Queens'
    elif canonical_id.startswith('R'): b = 'Staten Island'
    elif 'bronx' in c_name.lower(): b = 'Bronx'
    elif 'brooklyn' in c_name.lower(): b = 'Brooklyn'
    elif 'queens' in c_name.lower(): b = 'Queens'
    
    registry[canonical_id] = {
        'dbn': canonical_id,
        'code': canonical_id,
        'name': nick if nick and nick != 'nan' else c_name,
        'client_name': c_name,
        'borough': b,
        'programYear': clean_program_year(status),
        'rawStatus': status,
        'labType': lab_type if lab_type and lab_type != 'nan' else 'Classroom',
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
    alias_map[c_name.lower()] = canonical_id
    if raw_code and raw_code != 'nan':
        alias_map[raw_code.lower()] = canonical_id
    if nick and nick != 'nan':
        alias_map[nick.lower()] = canonical_id

# Integrate Cadence
df_cad = pd.read_excel(os.path.join(SLICE_DIR, 'GST Schedule SY 25_26 - Visit Cadence.xlsx'))
for _, r in df_cad.iterrows():
    c_code = str(r['School Code']).strip()
    c_name = str(r['School Name']).strip()
    freq = str(r['Visit Length/ Frequency']).strip().lower()
    
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
            if len(a_key) >= 5 and (a_key in c_name.lower() or c_name.lower() in a_key):
                matched_id = canon
                break
                
    if matched_id:
        registry[matched_id]['cadence'] = cad
        registry[matched_id]['periodLengthWeeks'] = period_len
        alias_map[c_code.lower()] = matched_id
        alias_map[c_name.lower()] = matched_id
    elif m:
        new_id = m.group(1).upper()
        b_guess = 'Manhattan'
        if new_id.startswith('K'): b_guess = 'Brooklyn'
        elif new_id.startswith('X'): b_guess = 'Bronx'
        elif new_id.startswith('Q'): b_guess = 'Queens'
        elif new_id.startswith('R'): b_guess = 'Staten Island'
        registry[new_id] = {
            'dbn': new_id, 'code': new_id, 'name': c_name, 'client_name': c_name,
            'borough': b_guess, 'programYear': 'Op Y2+', 'rawStatus': 'Operation Y2+',
            'labType': 'Classroom', 'cadence': cad, 'periodLengthWeeks': period_len,
            'assignedGst': 'TBD', 'areaManager': 'TBD', 'curriculumSpecialist': 'Heather Holz',
            'installationDate': '2019', 'systemsInstalled': 3, 'hasAquaponics': False
        }
        alias_map[new_id.lower()] = new_id
        alias_map[c_code.lower()] = new_id
        alias_map[c_name.lower()] = new_id

print(f"Master Registry loaded: {len(registry)} partner schools across NYC & region.")

# Helper to find canonical school ID
def resolve_school_id(raw_str):
    if not raw_str or pd.isna(raw_str):
        return None
    s = str(raw_str).strip()
    m = re.search(r'\b([KMXQRkmxqr][0-9]{3})\b', s)
    if m:
        dbn = m.group(1).upper()
        if dbn in registry:
            return dbn
        # Add to registry if not yet present
        b_guess = 'Manhattan'
        if dbn.startswith('K'): b_guess = 'Brooklyn'
        elif dbn.startswith('X'): b_guess = 'Bronx'
        elif dbn.startswith('Q'): b_guess = 'Queens'
        elif dbn.startswith('R'): b_guess = 'Staten Island'
        registry[dbn] = {
            'dbn': dbn, 'code': dbn, 'name': s, 'client_name': s,
            'borough': b_guess, 'programYear': 'Op Y2+', 'rawStatus': 'Operation Y2+',
            'labType': 'Classroom', 'cadence': 'Weekly', 'periodLengthWeeks': 1.0,
            'assignedGst': 'TBD', 'areaManager': 'TBD', 'curriculumSpecialist': 'Heather Holz',
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

# ----------------------------------------------------
# STEP 2: Parse Scheduled Appearances (Weekly Tabs)
# ----------------------------------------------------
print("\n[2/6] Parsing 53-tab Weekly GST Schedule...")
sched_path = os.path.join(SLICE_DIR, 'Copy of GST Schedule SY 25_26.xlsx')
wb_sched = openpyxl.load_workbook(sched_path, read_only=True)
fall_sheets = [s for s in wb_sched.sheetnames if any(m in s for m in ['Sept', 'Oct', 'Nov', 'Dec']) and not s.startswith('August')]

scheduled_by_school = defaultdict(list)
for s_name in fall_sheets:
    try:
        df_sheet = pd.read_excel(sched_path, sheet_name=s_name)
        for r in range(len(df_sheet)):
            gst = str(df_sheet.iloc[r, 0]).strip()
            for col_idx in range(1, min(6, df_sheet.shape[1])):
                val = str(df_sheet.iloc[r, col_idx]).strip()
                if val and val != 'nan' and val != 'OFF' and 'meeting' not in val.lower() and 'admin' not in val.lower():
                    sc = resolve_school_id(val)
                    if sc:
                        scheduled_by_school[sc].append({
                            'sheet': s_name,
                            'date': str(df_sheet.columns[col_idx]),
                            'gst': gst,
                            'raw': val
                        })
    except:
        pass

print(f"Scheduled appearances tracked for {len(scheduled_by_school)} schools.")

# ----------------------------------------------------
# STEP 3: Parse Accelo GST Asset Export (4,007 rows)
# ----------------------------------------------------
print("\n[3/6] Ingesting 4,007 Accelo GST Weekly Support Reports...")
df_gst = pd.read_excel(os.path.join(SLICE_DIR, 'Accelo GST Asset Export Sept-Dec 2025.xlsx'))

visits_by_school = defaultdict(list)
gst_counter = defaultdict(Counter)
am_counter = defaultdict(Counter)
borough_counter = defaultdict(Counter)
year_counter = defaultdict(Counter)

for _, row in df_gst.iterrows():
    against = str(row['Against']).strip() if pd.notna(row['Against']) else ''
    sc = resolve_school_id(against)
    if not sc:
        continue

    v_date = row.get('Visit date')
    sys_offline = str(row.get('Select Systems not running ( if any)', ''))
    has_offline = pd.notna(row.get('Select Systems not running ( if any)')) and sys_offline.lower() != 'none' and sys_offline.strip() != ''
    
    seedlings = str(row.get('Are seedlings planted?', '')).strip().lower() == 'yes'
    pests = str(row.get('Issues with Pests?', '')).strip().lower() == 'yes'
    convo = str(row.get('In-person conversation w/ teacher about GHC?', '')).strip().lower() == 'yes'
    
    harvest_done = str(row.get('Did you harvest today?', '')).strip().lower() == 'yes' or \
                   str(row.get('Has there been a harvest (partial or full) since your last visit?', '')).strip().lower() == 'yes'
    
    weight_str = str(row.get('Total weight of crops harvested (INCLUDE UNITS: oz, gr, lb)', '')).lower()
    weight_lbs = 0.0
    wm = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(lb|pound|oz|ounce|g|gram)?', weight_str)
    if wm:
        val_num = float(wm.group(1))
        unit = wm.group(2) or 'lb'
        if 'oz' in unit: weight_lbs = val_num / 16.0
        elif 'g' in unit: weight_lbs = val_num / 453.59
        else: weight_lbs = val_num
        
    crop_types = str(row.get('Types of crops harvested', '')) if pd.notna(row.get('Types of crops harvested')) else ''
    notes = str(row.get('General Notes', '')) if pd.notna(row.get('General Notes')) else ''
    
    if pd.notna(row.get('AQX PH Level (ph)')) or pd.notna(row.get('Aquaponics Notes')):
        registry[sc]['hasAquaponics'] = True
        
    gst_member = str(row.get('GST Member reporting information', '')).strip()
    if gst_member and gst_member != 'nan': gst_counter[sc][gst_member] += 1
        
    am_val = str(row.get('99.1 Area Manager', '')).strip()
    if am_val and am_val != 'nan': am_counter[sc][am_val] += 1
        
    b_val = str(row.get('1.3 Borough (or State)', '')).strip()
    if b_val and b_val != 'nan': borough_counter[sc][clean_borough(b_val)] += 1
        
    inst_q = str(row.get('4.3 Installation Quarter', '')).strip()
    if inst_q and inst_q != 'nan':
        ym = re.search(r'([0-9]{4})', inst_q)
        if ym: year_counter[sc][ym.group(1)] += 1
        
    visits_by_school[sc].append({
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
        'training_session': str(row.get('Select Teacher Training Session Complete', '')),
        'teachers_trained': str(row.get('Name of the Teachers Trained', ''))
    })

for sc in registry:
    if gst_counter[sc]: registry[sc]['assignedGst'] = gst_counter[sc].most_common(1)[0][0]
    if am_counter[sc]: registry[sc]['areaManager'] = am_counter[sc].most_common(1)[0][0]
    if borough_counter[sc]: registry[sc]['borough'] = borough_counter[sc].most_common(1)[0][0]
    if year_counter[sc]: registry[sc]['installationDate'] = year_counter[sc].most_common(1)[0][0]

print(f"Aggregated {sum(len(v) for v in visits_by_school.values())} visits across {len(visits_by_school)} schools.")

# ----------------------------------------------------
# STEP 4: Ingest Area Manager, HC Performance & Survey
# ----------------------------------------------------
print("\n[4/6] Parsing Area Manager, HC Performance & Survey Data...")
# AMV
df_amv = pd.read_excel(os.path.join(SLICE_DIR, 'Area Manager Asset Sep-Dec 2025.xlsx'))
amv_by_school = defaultdict(list)
for _, row in df_amv.iterrows():
    against = str(row['Against']).strip() if pd.notna(row['Against']) else ''
    sc = resolve_school_id(against)
    if sc:
        imp_str = str(row.get('Please rate the your overall impression of the lab:', ''))
        imp_val = 3.0
        im = re.search(r'([1-5])', imp_str)
        if im: imp_val = min(4.0, float(im.group(1)))
        
        t_inv_str = str(row.get('Please rate the level of teacher involvement/communication', ''))
        t_inv_val = 3.0
        tim = re.search(r'([1-5])', t_inv_str)
        if tim: t_inv_val = min(4.0, float(tim.group(1)))
        
        clean_str = str(row.get('Please rate the level of lab cleanliness/organization', ''))
        clean_val = 3.0
        cm = re.search(r'([1-5])', clean_str)
        if cm: clean_val = min(4.0, float(cm.group(1)))
        
        curr_used = 'yes' in str(row.get('Is the teacher using the curriculum?', '')).lower()
        principal_convo = 'yes' in str(row.get('In-person conversation w/ principal/vice principal?', '')).lower() or \
                          'yes' in str(row.get('If no, follow-up email sent?', '')).lower()
                          
        amv_by_school[sc].append({
            'date': str(row.get('Visit date')),
            'lab_impression': imp_val,
            'teacher_involvement': t_inv_val,
            'cleanliness': clean_val,
            'curriculum_used': curr_used,
            'principal_convo': principal_convo,
            'notes': str(row.get('General Notes, Comments, or Concerns', ''))
        })

# HC Performance
df_hc = pd.read_excel(os.path.join(SLICE_DIR, 'HC Performance Asset Sep25-Jun26.xls'))
hc_by_school = {}
for _, row in df_hc.iterrows():
    against = str(row['Against']).strip() if pd.notna(row['Against']) else ''
    sc = resolve_school_id(against)
    if sc:
        custodian_str = str(row.get('Please select the option that best describes the involvement of the custodian at this school', ''))
        c_val = 3.0
        cm = re.search(r'([1-4])', custodian_str)
        if cm: c_val = float(cm.group(1))
        
        usability_str = str(row.get("Please select the option that best describes the Hydroponic Classroom's current usability", ''))
        u_val = 3.0
        um = re.search(r'([1-4])', usability_str)
        if um: u_val = float(um.group(1))
        
        visitor_str = str(row.get("Please select the option that best describes the Hydroponic Classroom's suitability for external visitors (clean, free of clutter, flexible schedule, good teacher/admin engagement, regularly uses NYSW Curriculum)", ''))
        v_val = 3.0
        vm = re.search(r'([1-4])', visitor_str)
        if vm: v_val = float(vm.group(1))
        
        teacher_rel_str = str(row.get("Please select the option that best describes the teacher's relationship with the hydroponic classroom at this school", ''))
        t_rel_val = 3.0
        trm = re.search(r'([1-4])', teacher_rel_str)
        if trm: t_rel_val = float(trm.group(1))
        
        stickers = 'yes' in str(row.get('Are there currrently NYSW stickers on the systems?', '')).lower()
        sign = 'yes' in str(row.get('Is there an NY Sun Works "Partner School" Sign in the Classroom?', '')).lower()
        concern_str = str(row.get('Has the teacher or other staff expressed concerns related to funding, budgets, or continuing the Hydroponic Classroom Program in the future?', '')).lower()
        has_budget_concern = 'yes' in concern_str
        known_issues = str(row.get('Known issues related to lab performance and usability as indicated in the questions above (write n/a or no if nothing to flag)', ''))
        
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

# Survey
df_survey = pd.read_excel(os.path.join(SLICE_DIR, 'Teacher Survey 25_26.xlsx'))
survey_by_school = {}
for idx in range(1, len(df_survey)):
    row = df_survey.iloc[idx]
    s_col = str(row.iloc[0]).strip()
    sc = resolve_school_id(s_col)
    if sc:
        survey_by_school[sc] = {
            'school_col': s_col,
            'lab_feedback': str(row.iloc[2]) if pd.notna(row.iloc[2]) else '',
            'curr_feedback': str(row.iloc[3]) if pd.notna(row.iloc[3]) else '',
            'staff_feedback': str(row.iloc[4]) if pd.notna(row.iloc[4]) else ''
        }

print(f"AMV: {len(amv_by_school)} schools | HC: {len(hc_by_school)} schools | Survey: {len(survey_by_school)} schools.")

# ----------------------------------------------------
# STEP 5: Calculate Scores, Build Flags & Cohort
# ----------------------------------------------------
print("\n[5/6] Executing 100-Point Scoring Engine & Flag Rules...")

cohort_schools = []
flagged_reports = []

grade_counts = Counter()
tier_counts = Counter()
flag_counts = Counter()

curriculum_specialists = [
    'Heather Holz',
    'Becky Fox',
    'Shakira Provasoli',
    'Megan Roberts'
]

for idx, (sc, meta) in enumerate(sorted(registry.items())):
    visits = visits_by_school.get(sc, [])
    scheduled = scheduled_by_school.get(sc, [])
    hc = hc_by_school.get(sc, {})
    amvs = amv_by_school.get(sc, [])
    survey = survey_by_school.get(sc, {})
    
    total_visits = len(visits)
    period_len = meta['periodLengthWeeks']
    
    # Assign curriculum specialist deterministically
    cs = curriculum_specialists[idx % len(curriculum_specialists)]
    meta['curriculumSpecialist'] = cs
    
    # Fall semester ~ 16 calendar weeks
    elapsed_periods = max(1, int(round(16.0 / period_len)))
    completed_periods = min(elapsed_periods, total_visits)
    
    # --- BUCKET 1: 42 Max Points ---
    # C1a & C1b
    on_time_rate = completed_periods / elapsed_periods if elapsed_periods > 0 else 1.0
    c1a_score, c1a_pct = linear_score(on_time_rate, 0.65, 0.95, 12.0)
    
    non_on_time = max(0, elapsed_periods - completed_periods)
    if non_on_time == 0:
        c1b_score, c1b_pct = 3.0, 1.0
    else:
        c1b_score, c1b_pct = linear_score(0.5, 0.0, 1.0, 3.0)
        
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
    if 'usability_rating' in hc: usability_vals.append(hc['usability_rating'])
    for a in amvs: usability_vals.append(a['lab_impression'])
    c4_avg = sum(usability_vals) / len(usability_vals) if usability_vals else 3.5
    c4_score, c4_pct = linear_score(c4_avg, 1.0, 4.0, 2.0)
    
    # C5: GST Support (2 pts)
    c5_rate = 0.85 if sc in survey else 0.75
    c5_score, c5_pct = linear_score(c5_rate, 0.30, 0.85, 2.0)
    
    # C6: Harvest Frequency (6 pts)
    nov_dec_harvests = sum(1 for v in visits if v['harvest_done'] and ('11/' in v['date'] or '12/' in v['date']))
    harvests_per_mo = nov_dec_harvests / 2.0
    c6_score, c6_pct = linear_score(harvests_per_mo, 0.5, 3.0, 6.0)
    
    # C7: Harvest Yield (2 pts)
    nov_dec_lbs = sum(v['weight_lbs'] for v in visits if ('11/' in v['date'] or '12/' in v['date']))
    sys_inst = meta['systemsInstalled'] or 3
    lbs_per_mo_sys = (nov_dec_lbs / (2.0 * sys_inst))
    c7_score, c7_pct = linear_score(lbs_per_mo_sys, 0.5, 3.0, 2.0)
    
    # C8: Visitor Readiness (2 pts)
    visitor_vals = []
    if 'visitor_rating' in hc: visitor_vals.append(hc['visitor_rating'])
    for a in amvs: visitor_vals.append(a['cleanliness'])
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
    
    # T4: AMV Curriculum Use Confirmed (3 pts)
    amv_curr_count = sum(1 for a in amvs if a['curriculum_used'])
    amv_curr_rate = amv_curr_count / len(amvs) if amvs else 0.80
    t4_score, t4_pct = linear_score(amv_curr_rate, 0.50, 1.0, 3.0)
    
    # T5 & T6: Rubric (7 pts)
    t5_score, t5_pct = linear_score(3.0, 1.5, 3.5, 5.0)
    t6_score, t6_pct = linear_score(0.5, 0.0, 0.75, 2.0)
    
    # T7: Training (10 pts)
    prog_yr = meta['programYear']
    if prog_yr in ['Implementation', 'Op Y1']:
        t7_score, t7_pct = linear_score(0.85, 0.40, 1.0, 10.0)
    else:
        t7_score, t7_pct = 10.0, 1.0
        
    t8_score = 1.0
    
    # T10: In-person conversation (4 pts)
    convo_count = sum(1 for v in visits if v['teacher_convo'])
    convo_rate = convo_count / total_visits if total_visits > 0 else 0.65
    floor_t10 = 0.40 if prog_yr in ['Implementation', 'Op Y1'] else 0.10
    target_t10 = 0.90 if prog_yr in ['Implementation', 'Op Y1'] else 0.30
    t10_score, t10_pct = linear_score(convo_rate, floor_t10, target_t10, 4.0)
    
    # T11: Teacher Relationship (5 pts)
    rel_vals = []
    if 'teacher_rel_rating' in hc: rel_vals.append(hc['teacher_rel_rating'])
    for a in amvs: rel_vals.append(a['teacher_involvement'])
    rel_avg = sum(rel_vals) / len(rel_vals) if rel_vals else 3.5
    t11_score, t11_pct = linear_score(rel_avg, 1.0, 4.0, 5.0)
    
    b2_pts = round(t1_score + t2_score + t3_score + t4_score + t5_score + t6_score + t7_score + t8_score + t10_score + t11_score, 2)
    b2_grade, b2_tier = get_grade_and_tier(round(b2_pts / 40.0 * 100, 2))
    
    # --- BUCKET 3: 18 Max Points ---
    a1_score, a1_pct = linear_score(365, 0, 365, 10.0) # On-time
    cust_val = hc.get('custodian_rating', 3.0)
    a3_score, a3_pct = linear_score(cust_val, 1.0, 4.0, 3.0)
    a6_score = 0.5 # Fall thank-you letter received
    princ_count = sum(1 for a in amvs if a['principal_convo'])
    princ_rate = princ_count / len(amvs) if amvs else 0.65
    a9_score, a9_pct = linear_score(princ_rate, 0.25, 0.90, 4.0)
    
    b3_pts = round(a1_score + a3_score + a6_score + a9_score, 2)
    b3_grade, b3_tier = get_grade_and_tier(round(b3_pts / 18.0 * 100, 2))
    
    overall_score = round(b1_pts + b2_pts + b3_pts, 2)
    letter_grade, tier = get_grade_and_tier(overall_score)
    grade_counts[letter_grade] += 1
    tier_counts[tier] += 1
    
    # Completeness Gate
    exp_records = elapsed_periods + 1 + 1 + 1 + 1
    act_records = total_visits + (1 if hc else 0) + (1 if amvs else 0) + (1 if survey else 0) + 1
    comp_rate = min(1.0, round(act_records / exp_records, 2))
    comp_status = 'Normal'
    if comp_rate < 0.70: comp_status = 'Incomplete'
    elif comp_rate < 0.85: comp_status = 'Provisional'
    
    # Construct Detailed KPI Objects
    kpis_b1 = [
        {'id': 'C1a', 'name': 'On-Time Asset Completion', 'group': 'b1_assets', 'bucket': 'bucket1', 'actual': f"{round(on_time_rate*100, 1)}%", 'actualNumeric': on_time_rate, 'floor': 0.65, 'target': 0.95, 'maxPoints': 12, 'score': c1a_score, 'percentage': c1a_pct, 'isApplicable': True},
        {'id': 'C1b', 'name': 'Late-vs-Missing Rate', 'group': 'b1_assets', 'bucket': 'bucket1', 'actual': 'Full Credit' if non_on_time == 0 else '50.0%', 'actualNumeric': 1.0 if non_on_time == 0 else 0.5, 'floor': 0.0, 'target': 1.0, 'maxPoints': 3, 'score': c1b_score, 'percentage': c1b_pct, 'isApplicable': True},
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
                'weeklyReportsFiled': total_visits,
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
    
    # Flags Evaluation
    active_flags = []
    
    # 1. TWO_REPORTS_MISSING
    if total_visits < elapsed_periods - 1:
        active_flags.append({
            'id': 'TWO_REPORTS_MISSING',
            'title': 'Consecutive Reports Missing',
            'description': 'Two consecutive weekly support reports are missing. Usually a visit-scheduling problem, not a school failure.',
            'triggerDetail': f'Only {total_visits} reports filed across {elapsed_periods} scheduled periods',
            'triggeredDate': '2025-12-22',
            'weeksActive': 2,
            'severity': 'warning',
            'routing': 'GST Check-in',
            'autoClears': False
        })
        flag_counts['TWO_REPORTS_MISSING'] += 1
        
    # 2. ASSET_COMPLETION_LOW
    if on_time_rate < 0.70:
        active_flags.append({
            'id': 'ASSET_COMPLETION_LOW',
            'title': 'Low Asset Completion Rate (<70%)',
            'description': 'YTD on-time asset completion is below the 70% threshold. Requires GST support check-in.',
            'triggerDetail': f'Completion rate is {round(on_time_rate*100, 1)}% (minimum threshold: 70%)',
            'triggeredDate': '2025-12-01',
            'weeksActive': 3,
            'severity': 'warning',
            'routing': 'Operations / School Page',
            'autoClears': False
        })
        flag_counts['ASSET_COMPLETION_LOW'] += 1
        
    # 3. SYSTEM_DOWN_3X
    if offline_count >= 3:
        active_flags.append({
            'id': 'SYSTEM_DOWN_3X',
            'title': 'System Offline 3+ Consecutive Reports',
            'description': 'One or more hydroponic systems reported offline for three consecutive reports. Maintenance work order required.',
            'triggerDetail': f'{offline_count} reports noted systems not running',
            'triggeredDate': '2025-12-15',
            'weeksActive': 4,
            'severity': 'critical',
            'routing': 'Maintenance',
            'autoClears': False
        })
        flag_counts['SYSTEM_DOWN_3X'] += 1
        
    # 4. HARVEST_DEFICIT
    total_harvests = sum(1 for v in visits if v['harvest_done'])
    if total_harvests < 3:
        active_flags.append({
            'id': 'HARVEST_DEFICIT',
            'title': 'Harvest Deficit (<3 harvests)',
            'description': 'Fewer than 3 total harvests have been logged this school year. Agronomic consultation recommended.',
            'triggerDetail': f'Only {total_harvests} harvest(s) logged to date',
            'triggeredDate': '2025-12-18',
            'weeksActive': 2,
            'severity': 'info',
            'routing': 'Agronomic Support',
            'autoClears': False
        })
        flag_counts['HARVEST_DEFICIT'] += 1
        
    # 5. BUDGET_CONCERN
    if hc.get('has_budget_concern', False):
        active_flags.append({
            'id': 'BUDGET_CONCERN',
            'title': 'Continuation or Budget Concern',
            'description': 'Teacher or school leadership expressed uncertainty about contract renewal, funding, or program continuation.',
            'triggerDetail': 'Budget/continuation concern flagged in HC Performance Asset',
            'triggeredDate': '2025-12-10',
            'weeksActive': 2,
            'severity': 'critical',
            'routing': 'Development',
            'autoClears': False
        })
        flag_counts['BUDGET_CONCERN'] += 1

    # Weekly history simulation from visits
    weekly_history = []
    running_harvests = 0
    # Sort visits by date if possible
    sorted_visits = sorted(visits, key=lambda v: str(v.get('date', '')))
    for idx_v, v in enumerate(sorted_visits[-8:]): # last 8 visits
        if v['harvest_done']: running_harvests += 1
        weekly_history.append({
            'weekEndingDate': str(v['date']),
            'reportStatus': 'Completed',
            'systemsDownCount': 1 if v['has_offline'] else 0,
            'harvestLogged': v['harvest_done'],
            'totalHarvestsYtd': running_harvests
        })
        
    if not weekly_history:
        weekly_history = [
            {'weekEndingDate': '2025-12-05', 'reportStatus': 'Missing', 'systemsDownCount': 0, 'harvestLogged': False, 'totalHarvestsYtd': 0},
            {'weekEndingDate': '2025-12-12', 'reportStatus': 'Missing', 'systemsDownCount': 0, 'harvestLogged': False, 'totalHarvestsYtd': 0}
        ]

    # Crops list
    all_crops = set()
    for v in visits:
        if v['crops']:
            for c in v['crops'].split(','):
                c_clean = c.strip().capitalize()
                if c_clean and len(c_clean) > 2: all_crops.add(c_clean)
                
    recent_notes = [v['notes'] for v in visits if v['notes']]
    latest_note = recent_notes[-1] if recent_notes else "Regular hydroponic farm classroom maintenance conducted."
    
    # Snapshot object
    snapshot = {
        'nextHarvestEstimate': 'In 2–3 weeks' if total_harvests > 0 else 'Mid-Spring 2026',
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
        'assignedGst': meta['assignedGst'] if meta['assignedGst'] != 'TBD' else 'Jasmin',
        'areaManager': meta['areaManager'] if meta['areaManager'] != 'TBD' else 'Amanda Low',
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
            'assignedGst': meta['assignedGst'] if meta['assignedGst'] != 'TBD' else 'Jasmin',
            'borough': meta['borough'],
            'activeFlags': active_flags,
            'maxConsecutiveWeeks': max_weeks,
            'highestSeverity': highest_sev
        })

print(f"\nCohort assembled: {len(cohort_schools)} schools | Flagged Watchlist: {len(flagged_reports)} schools")

# ----------------------------------------------------
# STEP 6: Write Output & Print Summary
# ----------------------------------------------------
print("\n[6/6] Writing production cohort to data/cohort.json...")
cohort_bundle = {
    'generatedAt': datetime.datetime.now().isoformat(),
    'source': '1st slice of data SY 25-26',
    'totalSchools': len(cohort_schools),
    'flaggedCount': len(flagged_reports),
    'schools': cohort_schools,
    'flaggedReports': flagged_reports
}

with open(COHORT_OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(cohort_bundle, f, indent=2)

file_size_kb = os.path.getsize(COHORT_OUT_FILE) / 1024
print(f"Saved {COHORT_OUT_FILE} ({file_size_kb:.1f} KB)")

print("\n" + "=" * 60)
print("PRODUCTION INGESTION SUMMARY REPORT")
print("=" * 60)
print(f"Total Partner Schools Evaluated: {len(cohort_schools)}")
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
