import { defineConfig, type ViteDevServer } from 'vite';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    watch: {
      ignored: ['**/data/**', '**/*.json.tmp'],
    },
  },
  plugins: [
    {
      name: 'nysw-data-ingestion-api',
      configureServer(server: ViteDevServer) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/ingest-status' && req.method === 'GET') {
            try {
              const rootDir = process.cwd();
              const incomingDir = path.join(rootDir, 'data', 'incoming');
              const legacyDir = path.join(rootDir, '1st slice of data SY 25-26');

              // Ensure data/incoming folder always exists on any computer
              if (!fs.existsSync(incomingDir)) {
                fs.mkdirSync(incomingDir, { recursive: true });
              }

              // Prioritize data/incoming if populated with Excel files, otherwise fallback to legacy slice folder
              let sliceDir = incomingDir;
              const hasIncomingFiles = fs.existsSync(incomingDir) && fs.readdirSync(incomingDir).some(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
              if (!hasIncomingFiles && fs.existsSync(legacyDir)) {
                sliceDir = legacyDir;
              }

              const cohortFile = path.join(rootDir, 'data', 'cohort.json');

              const expectedFiles = [
                {
                  id: 'registry',
                  name: 'Accelo Partner Schools Export.xls',
                  label: 'Accelo Partner Schools Master Registry',
                  description: 'Canonical school identifiers, boroughs, program years & addresses',
                  required: true,
                },
                {
                  id: 'cadence',
                  name: 'GST Schedule SY 25_26 - Visit Cadence.xlsx',
                  label: 'GST Schedule — Visit Cadence',
                  description: 'Scheduled visit frequency (weekly, twice-weekly, bi-weekly)',
                  required: true,
                },
                {
                  id: 'schedule',
                  name: 'Copy of GST Schedule SY 25_26.xlsx',
                  label: 'Copy of GST Schedule SY 25_26',
                  description: '53-tab weekly calendar; maps Column A assigned GSTs & expected appearances',
                  required: true,
                },
                {
                  id: 'weekly_reports',
                  name: 'Accelo GST Asset Export Sept-Dec 2025.xlsx',
                  label: 'Accelo GST Asset Support Reports',
                  description: 'Field visit logs, system uptime, seedlings, pests, harvests & crop weights',
                  required: true,
                },
                {
                  id: 'amv',
                  name: 'Area Manager Asset Sep-Dec 2025.xlsx',
                  label: 'Area Manager Observation Visits',
                  description: 'Lab impression, cleanliness, teacher involvement & curriculum confirmation',
                  required: false,
                },
                {
                  id: 'hc',
                  name: 'HC Performance Asset Sep25-Jun26.xls',
                  label: 'Health Check Performance Assets',
                  description: 'Custodian ratings, usability, visitor readiness & budget/continuation flags',
                  required: false,
                },
                {
                  id: 'survey',
                  name: 'Teacher Survey 25_26.xlsx',
                  label: 'Annual Teacher Satisfaction Survey',
                  description: 'Curriculum comprehension, ease of use, GST staff rating & teacher feedback',
                  required: false,
                },
              ];

              const filesStatus = expectedFiles.map(f => {
                const filePath = path.join(sliceDir, f.name);
                const exists = fs.existsSync(filePath);
                let sizeBytes = 0;
                let modifiedAt: string | null = null;
                if (exists) {
                  const stat = fs.statSync(filePath);
                  sizeBytes = stat.size;
                  modifiedAt = stat.mtime.toISOString();
                }
                return {
                  ...f,
                  exists,
                  sizeBytes,
                  modifiedAt,
                };
              });

              let cohortMeta = null;
              if (fs.existsSync(cohortFile)) {
                try {
                  const stat = fs.statSync(cohortFile);
                  const raw = JSON.parse(fs.readFileSync(cohortFile, 'utf-8'));
                  cohortMeta = {
                    fileSizeBytes: stat.size,
                    lastGeneratedAt: raw.generatedAt || stat.mtime.toISOString(),
                    totalSchools: raw.totalSchools || raw.schools?.length || 0,
                    flaggedCount: raw.flaggedCount || raw.flaggedReports?.length || 0,
                    ingestionMetadata: raw.ingestionMetadata || null,
                  };
                } catch {
                  // ignore
                }
              }

              let historicalMeta = null;
              const histFile = path.join(rootDir, 'data', 'historical_visits.json');
              if (fs.existsSync(histFile)) {
                try {
                  const rawHist = JSON.parse(fs.readFileSync(histFile, 'utf-8'));
                  historicalMeta = {
                    totalCumulativeVisits: rawHist.totalCumulativeVisits || 0,
                    totalSchoolsTracked: rawHist.totalSchoolsTracked || 0,
                    newVisitsAddedThisRun: rawHist.newVisitsAddedThisRun || 0,
                    historicalVisitsRetained: rawHist.historicalVisitsRetained || 0,
                    lastUpdated: rawHist.lastUpdated || null,
                  };
                } catch {
                  // ignore
                }
              }

              // Scan for incremental spreadsheets in sliceDir
              const allFiles = fs.readdirSync(sliceDir);
              const incrementalFiles = allFiles
                .filter(f => (f.endsWith('.xls') || f.endsWith('.xlsx')) && !f.startsWith('~$'))
                .filter(f => !expectedFiles.some(ef => ef.name.toLowerCase() === f.toLowerCase()))
                .map(f => {
                  const stat = fs.statSync(path.join(sliceDir, f));
                  return {
                    name: f,
                    sizeBytes: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                  };
                });

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  sliceDirectory: path.relative(rootDir, sliceDir).replace(/\\/g, '/'),
                  canonicalFolder: 'data/incoming',
                  canonicalPath: incomingDir,
                  activePath: sliceDir,
                  files: filesStatus,
                  incrementalFiles,
                  historicalMeta,
                  cohortMeta,
                })
              );
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          if ((req.url === '/api/open-folder' || req.url === '/api/open-intake-folder') && (req.method === 'POST' || req.method === 'GET')) {
            try {
              const rootDir = process.cwd();
              const incomingDir = path.join(rootDir, 'data', 'incoming');
              if (!fs.existsSync(incomingDir)) {
                fs.mkdirSync(incomingDir, { recursive: true });
              }

              if (process.platform === 'win32') {
                exec(`powershell -Command "Invoke-Item '${incomingDir}'"`, (psErr) => {
                  if (psErr) {
                    exec(`start "" explorer.exe "${incomingDir}"`, { shell: 'cmd.exe' });
                  }
                });
              } else if (process.platform === 'darwin') {
                exec(`open "${incomingDir}"`);
              } else {
                exec(`xdg-open "${incomingDir}"`);
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, folderPath: incomingDir }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          if (req.url === '/api/run-ingest' && req.method === 'POST') {
            const rootDir = process.cwd();
            const scriptPath = path.join(rootDir, 'scripts', 'ingest_real_data.py');
            const cohortFile = path.join(rootDir, 'data', 'cohort.json');

            exec(`python "${scriptPath}"`, { cwd: rootDir, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
              if (error) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: false,
                    error: error.message,
                    stderr,
                    stdout,
                  })
                );
                return;
              }

              let cohortData = null;
              try {
                if (fs.existsSync(cohortFile)) {
                  cohortData = JSON.parse(fs.readFileSync(cohortFile, 'utf-8'));
                }
              } catch {
                // ignore
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  output: stdout,
                  stderr,
                  totalSchools: cohortData?.totalSchools || cohortData?.schools?.length || 0,
                  flaggedCount: cohortData?.flaggedCount || cohortData?.flaggedReports?.length || 0,
                  cohort: cohortData,
                })
              );
            });
            return;
          }

          if (req.url === '/api/snapshots' && req.method === 'GET') {
            try {
              const rootDir = process.cwd();
              const snapDir = path.join(rootDir, 'data', 'snapshots');
              if (!fs.existsSync(snapDir)) {
                fs.mkdirSync(snapDir, { recursive: true });
              }
              const files = fs.readdirSync(snapDir).filter(f => f.endsWith('.json'));
              const snapshots = files.map(f => {
                try {
                  return JSON.parse(fs.readFileSync(path.join(snapDir, f), 'utf-8'));
                } catch {
                  return null;
                }
              }).filter(Boolean);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, snapshots }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          if (req.url === '/api/snapshots/save' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const snapshot = data.snapshot;
                if (!snapshot || !snapshot.snapshotId) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Invalid snapshot data' }));
                  return;
                }

                const rootDir = process.cwd();
                const snapDir = path.join(rootDir, 'data', 'snapshots');
                if (!fs.existsSync(snapDir)) {
                  fs.mkdirSync(snapDir, { recursive: true });
                }

                const safeId = snapshot.snapshotId.replace(/[^a-zA-Z0-9_-]/g, '_');
                const filePath = path.join(snapDir, `snapshot_${safeId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, filePath, snapshotId: snapshot.snapshotId }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message }));
                return;
              }
            });
            return;
          }

          next();
        });
      },
    },
  ],
});
