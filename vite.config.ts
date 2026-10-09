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
                  };
                } catch {
                  // ignore
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  sliceDirectory: path.relative(rootDir, sliceDir).replace(/\\/g, '/'),
                  canonicalFolder: 'data/incoming',
                  canonicalPath: incomingDir,
                  activePath: sliceDir,
                  files: filesStatus,
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

          next();
        });
      },
    },
  ],
});
