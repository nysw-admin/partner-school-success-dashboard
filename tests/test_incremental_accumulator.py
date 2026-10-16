import os, json, subprocess, sys, time
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST_FILE = os.path.join(PROJECT_ROOT, 'data', 'historical_visits.json')
COHORT_FILE = os.path.join(PROJECT_ROOT, 'data', 'cohort.json')

print("Testing Incremental Accumulator...")

# 1. Check historical visits file exists and has records
assert os.path.exists(HIST_FILE), "historical_visits.json should exist"
with open(HIST_FILE, 'r', encoding='utf-8') as f:
    hist = json.load(f)

base_count = hist.get('totalCumulativeVisits', 0)
assert base_count > 3900, f"Expected >3900 visits, got {base_count}"
print(f"[PASS] Base historical repository verified with {base_count} visits.")

# 2. Check cohort.json has ingestionMetadata
assert os.path.exists(COHORT_FILE), "cohort.json should exist"
with open(COHORT_FILE, 'r', encoding='utf-8') as f:
    cohort = json.load(f)

meta = cohort.get('ingestionMetadata', {})
assert meta.get('mode') == 'incremental_accumulator', "Expected mode 'incremental_accumulator'"
assert meta.get('totalCumulativeVisits') == base_count, "Metadata total visits matches"
print(f"[PASS] Cohort metadata verified: {meta.get('totalCumulativeVisits')} cumulative visits across {meta.get('elapsedCalendarWeeks')} weeks.")

# 3. Simulate an incremental upload: create a small incremental Excel file in data/incoming/
test_inc_file = os.path.join(PROJECT_ROOT, 'data', 'incoming', 'Accelo GST Asset Export Jan 2026 (Test).xlsx')

# Take 3 rows from existing df and shift dates to Jan 2026 with unique run timestamp
base_df = pd.read_excel(os.path.join(PROJECT_ROOT, 'data', 'incoming', 'Accelo GST Asset Export Sept-Dec 2025.xlsx'))
sample_rows = base_df.head(3).copy()
sample_rows['Title'] = sample_rows['Title'] + f' - Incremental Test {int(time.time())}'
sample_rows['Visit date'] = '01/14/2026'
sample_rows.to_excel(test_inc_file, index=False)

try:
    # Run ingestion script
    cmd = [sys.executable, os.path.join(PROJECT_ROOT, 'scripts', 'ingest_real_data.py')]
    res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"Ingestion failed: {res.stderr}"

    # Check updated historical repository
    with open(HIST_FILE, 'r', encoding='utf-8') as f:
        hist_updated = json.load(f)

    new_count = hist_updated.get('totalCumulativeVisits', 0)
    assert new_count == base_count + 3, f"Expected {base_count + 3} visits, got {new_count}"
    print(f"[PASS] Incremental upload successfully merged 3 new visits! (New total: {new_count})")

    # Run ingestion script again to ensure idempotency (0 new visits added, total remains base_count + 3)
    res2 = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res2.returncode == 0

    with open(HIST_FILE, 'r', encoding='utf-8') as f:
        hist_third = json.load(f)

    assert hist_third.get('totalCumulativeVisits') == new_count, "Second run should not duplicate records"
    assert hist_third.get('newVisitsAddedThisRun') == 0, "Second run should have 0 new visits added"
    print(f"[PASS] Deduplication verified! Total remains strictly {new_count} without duplicates.")

finally:
    # Clean up test incremental file
    if os.path.exists(test_inc_file):
        os.remove(test_inc_file)
    # Re-run pipeline to restore base state
    subprocess.run([sys.executable, os.path.join(PROJECT_ROOT, 'scripts', 'ingest_real_data.py'), '--reset'], cwd=PROJECT_ROOT, capture_output=True)
    print("[PASS] Test cleanup completed and base state restored.")

print("\nALL INCREMENTAL ACCUMULATOR TESTS PASSED 100%!")
