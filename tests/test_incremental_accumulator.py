import os, json, subprocess, sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(PROJECT_ROOT, 'scripts') not in sys.path:
    sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))

HIST_FILE = os.path.join(PROJECT_ROOT, 'data', 'historical_visits.json')
COHORT_FILE = os.path.join(PROJECT_ROOT, 'data', 'cohort.json')
SNAP_DIR = os.path.join(PROJECT_ROOT, 'data', 'snapshots')

print("Testing Python Ingestion Pipeline & Incremental Accumulator...")

# 1. Check historical visits file exists and has records for SY 2026-2027
assert os.path.exists(HIST_FILE), "historical_visits.json should exist"
with open(HIST_FILE, 'r', encoding='utf-8') as f:
    hist = json.load(f)

base_count = hist.get('totalCumulativeVisits', 0)
assert base_count == 2167, f"Expected 2167 visits from GST Asset Nov 2026.xls, got {base_count}"
assert hist.get('schoolYear') == 'SY 2026–2027', f"Expected SY 2026–2027, got {hist.get('schoolYear')}"
print(f"[PASS] Base historical repository verified with {base_count} visits ({hist.get('schoolYear')}).")

# 2. Check cohort.json has ingestionMetadata and 391 schools
assert os.path.exists(COHORT_FILE), "cohort.json should exist"
with open(COHORT_FILE, 'r', encoding='utf-8') as f:
    cohort = json.load(f)

meta = cohort.get('ingestionMetadata', {})
assert meta.get('mode') == 'incremental_accumulator', "Expected mode 'incremental_accumulator'"
assert meta.get('totalCumulativeVisits') == base_count, "Metadata total visits matches"
assert len(cohort.get('schools', [])) == 391, f"Expected 391 schools, got {len(cohort.get('schools', []))}"
print(f"[PASS] Cohort metadata verified: {len(cohort['schools'])} schools, {meta.get('totalCumulativeVisits')} cumulative visits across {meta.get('elapsedCalendarWeeks')} weeks.")

# 3. Verify automatic school-year rollover & archiving when a new school year arrives
from ingest_real_data import detect_active_school_year, auto_archive_prior_cohort
detected_sy, start_yr = detect_active_school_year(['Missing Assets 27_28.xlsx', 'GST Asset Nov 2027.xls'])
assert detected_sy == 'SY 2027–2028' and start_yr == 2027, f"Expected SY 2027–2028, got {detected_sy}"

test_snap_path = os.path.join(SNAP_DIR, 'snapshot_SY_2026_2027_AUTO_FINAL.json')
try:
    auto_archive_prior_cohort(COHORT_FILE, 'SY 2027–2028')
    assert os.path.exists(test_snap_path), "auto_archive_prior_cohort must create archived snapshot JSON"
    with open(test_snap_path, 'r', encoding='utf-8') as f:
        snap_data = json.load(f)
    assert snap_data.get('schoolYear') == 'SY 2026–2027'
    assert snap_data.get('totalSchools') == 391
    print(f"[PASS] School-Year Rollover & Auto-Archive verified (SY 2026–2027 -> SY 2027–2028 archived {snap_data['totalSchools']} schools).")
finally:
    if os.path.exists(test_snap_path):
        os.remove(test_snap_path)

# 4. Run ingestion script again to ensure idempotency (0 new visits added, total remains 2167)
cmd = [sys.executable, os.path.join(PROJECT_ROOT, 'scripts', 'ingest_real_data.py')]
res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
assert res.returncode == 0, f"Ingestion failed: {res.stderr}"

with open(HIST_FILE, 'r', encoding='utf-8') as f:
    hist_second = json.load(f)

assert hist_second.get('totalCumulativeVisits') == base_count, "Idempotent run should not duplicate records"
assert hist_second.get('newVisitsAddedThisRun') == 0, "Idempotent run should have 0 new visits added"
print(f"[PASS] Idempotency & deduplication verified! Total remains strictly {base_count} with 0 duplicates.")

print("\nALL PYTHON PIPELINE & INCREMENTAL ACCUMULATOR TESTS PASSED 100%!")
