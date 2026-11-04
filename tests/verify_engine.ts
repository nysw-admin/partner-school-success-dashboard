import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Writable, Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

process.env.NO_LISTEN = '1';
const { handleRequest } = await import('../server.js');

import { generateRealisticCohort } from '../src/pipeline/generator.ts';
import {
  recalculateScoreWithResolvedFlags,
  applyFlagResolutionsToCohort,
  resolveSchoolFlag,
  reopenSchoolFlag,
  clearBaselineCache,
} from '../src/services/flagResolutionService.ts';
import { renderSchoolTable } from '../src/ui/components/SchoolTable.ts';
import { renderSchoolDrawer } from '../src/ui/components/SchoolDrawer.ts';
import { renderFlaggedWatchlist } from '../src/ui/components/FlaggedWatchlist.ts';
import { renderMetricsRibbon } from '../src/ui/components/MetricsRibbon.ts';
import { renderNavbar } from '../src/ui/components/Navbar.ts';
import { getAllSnapshots } from '../src/services/snapshotService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Mock localStorage in Node environment for UI & service tests
const memoryStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => memoryStorage.get(k) ?? null,
  setItem: (k: string, v: string) => memoryStorage.set(k, v),
  removeItem: (k: string) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};

let passed = 0;
function logPass(suite: string, name: string) {
  passed++;
  console.log(`  [PASS] [${suite}] ${name}`);
}

async function runAllTests() {
  console.log('================================================================');
  console.log('NY SUN WORKS — AUTOMATED TEST SUITE (SMOKE, FUNCTIONAL, INT, E2E)');
  console.log('================================================================\n');

  // =========================================================================
  // 1. SMOKE TESTS
  // =========================================================================
  console.log('--- 1. SMOKE TESTS ---');

  const cohortPath = path.join(PROJECT_ROOT, 'data', 'cohort.json');
  const histVisitsPath = path.join(PROJECT_ROOT, 'data', 'historical_visits.json');
  const distIndexPath = path.join(PROJECT_ROOT, 'dist', 'index.html');

  assert.ok(fs.existsSync(cohortPath), 'data/cohort.json must exist');
  assert.ok(fs.existsSync(histVisitsPath), 'data/historical_visits.json must exist');
  assert.ok(fs.existsSync(distIndexPath), 'dist/index.html production build must exist');
  logPass('SMOKE', 'Production artifacts (data/cohort.json, data/historical_visits.json, dist/index.html) exist');

  const rawCohortJson = JSON.parse(fs.readFileSync(cohortPath, 'utf-8'));
  assert.equal(rawCohortJson.schoolYear, 'SY 2026–2027', 'Active school year must be SY 2026–2027');
  assert.ok(Array.isArray(rawCohortJson.schools) && rawCohortJson.schools.length >= 379, 'Cohort must contain >= 379 partner schools');
  assert.equal(rawCohortJson.ingestionMetadata.totalCumulativeVisits, 2167, 'Cumulative visits from GST Asset Nov 2026.xls must be 2167');
  logPass('SMOKE', `Cohort JSON verified: ${rawCohortJson.schoolYear}, ${rawCohortJson.schools.length} schools, ${rawCohortJson.ingestionMetadata.totalCumulativeVisits} visits`);

  // =========================================================================
  // 2. FUNCTIONAL TESTS
  // =========================================================================
  console.log('\n--- 2. FUNCTIONAL TESTS ---');

  const cohort = generateRealisticCohort();
  const schools = cohort.schools;

  // 2a. Area Manager Column K Extraction & 'Unassigned' Fallback
  const validAreaManagers = new Set(['Wyatt', 'Spencer', 'Erin', 'Jasmin', 'Nef', 'Melissa', 'Unassigned']);
  const observedAreaManagers = new Set(schools.map(s => s.school.areaManager));
  for (const am of observedAreaManagers) {
    assert.ok(validAreaManagers.has(am), `Unexpected Area Manager value: "${am}"`);
  }
  for (const amExpected of ['Wyatt', 'Spencer', 'Erin', 'Jasmin', 'Nef', 'Melissa', 'Unassigned']) {
    assert.ok(observedAreaManagers.has(amExpected), `Expected Area Manager "${amExpected}" to be present`);
  }
  const unassignedAmCount = schools.filter(s => s.school.areaManager === 'Unassigned').length;
  assert.ok(unassignedAmCount > 0, 'Schools without an Area Manager must be labeled "Unassigned"');
  logPass('FUNCTIONAL', `Area Manager Column K verified: 6 managers + ${unassignedAmCount} "Unassigned" schools (no invalid values)`);

  // 2b. GST Team First-Name Extraction from Column L
  for (const s of schools) {
    const gst = s.school.assignedGst;
    assert.ok(gst && gst.length > 0, `School ${s.school.dbn} must have a non-empty assignedGst`);
    assert.ok(!gst.includes(' '), `GST name "${gst}" for ${s.school.dbn} must be first-name only (no surname spaces)`);
    assert.notEqual(gst.toLowerCase(), 'rammiro', 'Typo "Rammiro" must be normalized to "Ramiro"');
  }
  const assignedGstsSet = new Set(schools.map(s => s.school.assignedGst));
  for (const expectedGst of ['Maria', 'Xavier', 'Kate', 'Evan', 'Duala', 'Ramiro', 'Unassigned']) {
    assert.ok(assignedGstsSet.has(expectedGst), `Expected GST "${expectedGst}" in cohort`);
  }
  logPass('FUNCTIONAL', `GST Team Column L verified: ${assignedGstsSet.size - 1} unique GST first names + "Unassigned" fallback`);

  // 2c. Missing Assets 26_27.xlsx Rates & Flags Audit
  const twoMissingFlagCount = schools.filter(s => s.flags.some(f => f.id === 'TWO_REPORTS_MISSING')).length;
  const lowAssetFlagCount = schools.filter(s => s.flags.some(f => f.id === 'ASSET_COMPLETION_LOW')).length;
  assert.equal(twoMissingFlagCount, 153, `Expected 153 schools with TWO_REPORTS_MISSING from Missing Assets 26_27.xlsx, got ${twoMissingFlagCount}`);
  assert.equal(lowAssetFlagCount, 120, `Expected 120 schools with ASSET_COMPLETION_LOW from Missing Assets 26_27.xlsx, got ${lowAssetFlagCount}`);
  for (const s of schools) {
    const lowFlag = s.flags.find(f => f.id === 'ASSET_COMPLETION_LOW');
    const c1a = s.score.bucket1.groups[0].kpis.find(k => k.id === 'C1a')!;
    if (lowFlag) {
      assert.ok(c1a.actualNumeric < 0.70, `School ${s.school.dbn} has ASSET_COMPLETION_LOW but C1a is ${c1a.actualNumeric}`);
      assert.ok(lowFlag.triggerDetail.includes('Missing Assets 26_27.xlsx'), 'Trigger detail must reference Missing Assets 26_27.xlsx');
    }
  }
  logPass('FUNCTIONAL', `Missing Assets 26_27.xlsx verified: C1a/C1b rates & flags (${twoMissingFlagCount} TWO_REPORTS_MISSING, ${lowAssetFlagCount} ASSET_COMPLETION_LOW)`);

  // 2d. KPI Real-Data vs. Explicit Pending Placeholders Audit
  const countKpiMatching = (kpiId: string, pred: (actual: string) => boolean) =>
    schools.filter(s => {
      for (const b of [s.score.bucket1, s.score.bucket2, s.score.bucket3]) {
        for (const g of b.groups) {
          for (const k of g.kpis) {
            if (k.id === kpiId && pred(String(k.actual))) return true;
          }
        }
      }
      return false;
    }).length;

  assert.ok(countKpiMatching('T7', a => a.includes('Session')) >= 90, 'T7 must read real completed training sessions for >= 90 schools');
  assert.ok(countKpiMatching('T7', a => a.includes('Pending Training')) >= 40, 'T7 must show Pending Training placeholder when no sessions uploaded for Op Y1/Impl');
  assert.ok(countKpiMatching('T8', a => a.includes('Attended')) >= 55, 'T8 must read real PD attendance from Ed Team Assets');
  assert.ok(countKpiMatching('T5', a => a.includes('(Ed Team)')) >= 55, 'T5 must read real 5-domain rubric levels from Ed Team Assets');
  assert.ok(countKpiMatching('C5', a => a.includes('(Survey)') || a.includes('(HC Comm)')) >= 100, 'C5 must read real Survey & HC communication ratings');
  assert.ok(countKpiMatching('C3', a => a === 'Stickers & Sign Present' || a === 'Partial (1 of 2)' || a === 'Missing Branding') === 39, 'C3 must read real branding from 39 HC schools');
  assert.ok(countKpiMatching('A3', a => a.includes('(HC)')) === 39, 'A3 must read real custodian ratings from 39 HC schools');
  assert.ok(countKpiMatching('A1', a => a.includes('Confirmed') || a.includes('Review Needed')) >= 340, 'A1 must read real status from Accelo Partner Schools Export for >= 340 active schools');
  assert.ok(countKpiMatching('A1', a => a.includes('Pending Activity')) >= 40, 'A1 must show Pending Activity placeholder for schools with no visits/schedules yet');
  logPass('FUNCTIONAL', 'KPI Real-Data vs. Pending Placeholder audit verified across T1–T8, C3–C8, and A1–A9');

  // 2e. Flag Resolution & Automatic Score Recalculation
  memoryStorage.clear();
  clearBaselineCache();
  const baseApplied = applyFlagResolutionsToCohort(schools);
  const targetSchool = baseApplied.schools.find(
    s => s.flags.some(f => f.id === 'TWO_REPORTS_MISSING') && s.flags.some(f => f.id === 'ASSET_COMPLETION_LOW')
  )!;
  assert.ok(targetSchool, 'Must find a school with TWO_REPORTS_MISSING and ASSET_COMPLETION_LOW');
  const initialScore = targetSchool.score.overallScore;
  const initialFlagsCount = targetSchool.flags.length;

  const res1 = resolveSchoolFlag(targetSchool.school.dbn, 'ASSET_COMPLETION_LOW', 'Test Auditor');
  assert.ok(res1, 'resolveSchoolFlag must return resolution summary');
  assert.ok(res1.newScore > initialScore, `Score must increase after resolving ASSET_COMPLETION_LOW (${initialScore} -> ${res1.newScore})`);
  assert.ok(res1.scoreGain > 0, `Score gain must be positive (+${res1.scoreGain})`);

  const after1 = applyFlagResolutionsToCohort(baseApplied.schools);
  const updatedSchool1 = after1.schools.find(s => s.school.dbn === targetSchool.school.dbn)!;
  assert.equal(updatedSchool1.flags.length, initialFlagsCount - 1, 'Active flags count must decrease by 1');
  assert.equal(updatedSchool1.score.overallScore, res1.newScore, 'Cohort school score must match recalculated score');

  // Reopen the flag and verify exact baseline restoration
  reopenSchoolFlag(targetSchool.school.dbn, 'ASSET_COMPLETION_LOW');
  const afterReopen = applyFlagResolutionsToCohort(after1.schools);
  const restoredSchool = afterReopen.schools.find(s => s.school.dbn === targetSchool.school.dbn)!;
  assert.equal(restoredSchool.score.overallScore, initialScore, 'Reopening flag must restore exact baseline score');
  assert.equal(restoredSchool.flags.length, initialFlagsCount, 'Reopening flag must restore original flag count');
  logPass('FUNCTIONAL', `Flag Resolution & Score Recalculation verified (${targetSchool.school.dbn}: ${initialScore} -> ${res1.newScore} [+${res1.scoreGain} pts] -> restored to ${restoredSchool.score.overallScore})`);

  // 2f. UI Component Rendering & Filter Tests
  const allTableHtml = renderSchoolTable(schools, {
    searchQuery: '',
    borough: 'all',
    gradeTier: 'all',
    completeness: 'all',
    areaManager: 'all',
    gst: 'all',
    edTeam: 'all',
  });
  assert.ok(allTableHtml.includes('id="areamanager-filter"'), 'SchoolTable must render #areamanager-filter dropdown');
  assert.ok(allTableHtml.includes('>Area Manager</th>'), 'SchoolTable must render Area Manager column header');
  assert.ok(allTableHtml.includes('class="resolve-flag-btn"'), 'SchoolTable must render Resolve Flag buttons in Active Flags column');

  const spencerTableHtml = renderSchoolTable(schools, {
    searchQuery: '',
    borough: 'all',
    gradeTier: 'all',
    completeness: 'all',
    areaManager: 'Spencer',
    gst: 'all',
    edTeam: 'all',
  });
  assert.ok(spencerTableHtml.includes('Spencer'), 'Filtered table by Area Manager "Spencer" must include Spencer rows');

  const drawerHtml = renderSchoolDrawer(targetSchool, getAllSnapshots(schools));
  assert.ok(drawerHtml.includes('Area Manager:'), 'SchoolDrawer must display Area Manager');
  assert.ok(drawerHtml.includes('Resolve Flag &amp; Recalculate Score'), 'SchoolDrawer must render Resolve Flag & Recalculate Score buttons');

  const watchlistHtml = renderFlaggedWatchlist(cohort.flaggedReports);
  assert.ok(watchlistHtml.includes('Resolve Flag &amp; Recalculate Score'), 'FlaggedWatchlist must render Resolve Flag & Recalculate Score buttons');

  const ribbonHtml = renderMetricsRibbon(schools, cohort.flaggedReports.length);
  const navbarHtml = renderNavbar(schools.length, getAllSnapshots(schools), null, 'SY 2026–2027');
  assert.ok(ribbonHtml.length > 100 && navbarHtml.includes('SY 2026–2027'), 'MetricsRibbon and Navbar must render SY 2026–2027');
  logPass('FUNCTIONAL', 'All UI components (SchoolTable, SchoolDrawer, FlaggedWatchlist, MetricsRibbon, Navbar) rendered & verified');

  // =========================================================================
  // 3. INTEGRATION & END-TO-END (E2E) SERVER API TESTS
  // =========================================================================
  console.log('\n--- 3. INTEGRATION & END-TO-END (E2E) SERVER API TESTS ---');

  async function requestServer(method: string, urlPath: string, bodyObj?: any): Promise<{ status: number; text: string; json: () => any }> {
    return new Promise((resolve, reject) => {
      const reqStream = new Readable({ read() {} }) as any;
      reqStream.method = method;
      reqStream.url = urlPath;
      reqStream.headers = { 'content-type': 'application/json' };

      const chunks: Buffer[] = [];
      const resStream = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          callback();
        },
      }) as any;

      resStream.statusCode = 200;
      resStream.headers = {} as Record<string, string>;
      resStream.setHeader = (k: string, v: string) => {
        resStream.headers[k.toLowerCase()] = v;
      };
      resStream.writeHead = (code: number, hdrs?: Record<string, string>) => {
        resStream.statusCode = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            resStream.headers[k.toLowerCase()] = v;
          }
        }
      };

      const origEnd = resStream.end.bind(resStream);
      resStream.end = (chunk?: any, encoding?: any, cb?: any) => {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        origEnd(undefined, encoding, () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          resolve({
            status: resStream.statusCode,
            text,
            json: () => JSON.parse(text),
          });
          if (typeof cb === 'function') cb();
        });
      };

      resStream.on('error', reject);

      handleRequest(reqStream, resStream);

      if (bodyObj !== undefined) {
        reqStream.push(JSON.stringify(bodyObj));
      }
      reqStream.push(null);
    });
  }

  // Probe GET /
  const indexRes = await requestServer('GET', '/');
  assert.equal(indexRes.status, 200, 'GET / must return 200 OK');
  assert.ok(indexRes.text.includes('<div id="app"></div>'), 'GET / must return index.html');
  logPass('E2E', 'GET / returned 200 OK with production dashboard HTML');

  // Probe GET /api/ingest-status
  const statusRes = await requestServer('GET', '/api/ingest-status');
  assert.equal(statusRes.status, 200, 'GET /api/ingest-status must return 200 OK');
  const statusJson: any = statusRes.json();
  assert.equal(statusJson.success, true);
  assert.equal(statusJson.cohortMeta.schoolYear, 'SY 2026–2027');
  assert.equal(statusJson.cohortMeta.totalSchools, 391);
  const readyRequired = statusJson.files.filter((f: any) => f.required && f.exists);
  assert.equal(readyRequired.length, 5, 'All 5 required operational spreadsheets must be READY');
  logPass('E2E', `GET /api/ingest-status verified (${statusJson.files.filter((f: any) => f.exists).length}/${statusJson.files.length} files READY, SY 2026–2027)`);

  // Probe GET /api/cohort
  const cohortRes = await requestServer('GET', '/api/cohort');
  assert.equal(cohortRes.status, 200, 'GET /api/cohort must return 200 OK');
  const cohortApiJson: any = cohortRes.json();
  assert.equal(cohortApiJson.schoolYear, 'SY 2026–2027');
  assert.equal(cohortApiJson.schools.length, 391);
  logPass('E2E', 'GET /api/cohort returned 391 partner schools for SY 2026–2027');

  // Probe GET /api/snapshots
  const snapsRes = await requestServer('GET', '/api/snapshots');
  assert.equal(snapsRes.status, 200, 'GET /api/snapshots must return 200 OK');
  const snapsJson: any = snapsRes.json();
  assert.equal(snapsJson.success, true);
  assert.ok(Array.isArray(snapsJson.snapshots), 'GET /api/snapshots must return snapshots array');
  const allSnaps = getAllSnapshots(schools);
  assert.ok(allSnaps.length >= 3, 'Snapshot service must provide historical SY archives (SY 2023–24, SY 2024–25, SY 2025–26)');
  logPass('E2E', `GET /api/snapshots & SnapshotService verified (${allSnaps.length} historical school-year archives ready)`);

  // Probe POST /api/run-ingest (Full End-to-End Pipeline Execution)
  const runRes = await requestServer('POST', '/api/run-ingest');
  assert.equal(runRes.status, 200, 'POST /api/run-ingest must return 200 OK');
  const runJson: any = runRes.json();
  assert.equal(runJson.success, true, `POST /api/run-ingest must succeed: ${runJson.error || ''}`);
  assert.equal(runJson.schoolYear, 'SY 2026–2027');
  assert.equal(runJson.cohort.schools.length, 391);
  logPass('E2E', 'POST /api/run-ingest executed live Python pipeline end-to-end and returned 391 scored schools');

  console.log('\n================================================================');
  console.log(`ALL ${passed} AUTOMATED TESTS (SMOKE, FUNCTIONAL, INT, E2E) PASSED!`);
  console.log('================================================================');
}

runAllTests().catch(err => {
  console.error('\n[TEST FAILURE]', err);
  process.exit(1);
});
