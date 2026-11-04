import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getExpectedFiles(sliceDir) {
  const candidates = [
    {
      id: 'registry',
      patterns: ['Accelo Partner Schools Export.xls'],
      label: 'Accelo Partner Schools Master Registry',
      description: 'Canonical school identifiers, boroughs, program years & addresses',
      required: true,
    },
    {
      id: 'cadence',
      patterns: ['GST Schedule SY 26_27 - Visit Cadence.xlsx', 'GST Schedule SY 25_26 - Visit Cadence.xlsx'],
      label: 'GST Schedule — Visit Cadence (SY 26–27)',
      description: 'Scheduled visit frequency (weekly, twice-weekly, bi-weekly, monthly)',
      required: true,
    },
    {
      id: 'schedule',
      patterns: ['GST Schedule SY 26_27.xlsx', 'Copy of GST Schedule SY 25_26.xlsx'],
      label: 'Weekly GST Schedule (SY 26–27)',
      description: 'Weekly calendar tabs; maps Column A assigned GSTs & expected appearances',
      required: true,
    },
    {
      id: 'weekly_reports',
      patterns: ['GST Accelo Assets 9.1.26-11.3.26.xls', 'GST Accelo Assets 9.1.26-11.3.26.xlsx', 'GST Asset Nov 2026.xls', 'GST Asset Sept 2026.xls', 'Accelo GST Asset Export Sept-Dec 2025.xlsx'],
      label: 'Accelo GST Weekly Support Reports (SY 26–27)',
      description: 'Field visit logs, system uptime, seedlings, pests, harvests, crop weights & Area Managers',
      required: true,
    },
    {
      id: 'missing_assets',
      patterns: ['Missing Assets 26_27.xlsx'],
      label: 'Missing Assets Performance Report (SY 26–27)',
      description: 'Weekly Completed, Missing & Late Assets tracker for C1a & C1b scoring',
      required: true,
    },
    {
      id: 'curriculum',
      patterns: ['Ed Team Assets 9.1.26-11.3.26.xls', 'Curriculum Training Asset Sep2025-Jun2026.xlsx'],
      label: 'Curriculum Training & Ed Team Asset',
      description: 'Ed Team specialists (Column L), teacher training sessions & domains',
      required: false,
    },
    {
      id: 'amv',
      patterns: ['Area Manager Assets 9.1.26-11.3.26.xls', 'Area Manager Asset Sep-Dec 2025.xlsx'],
      label: 'Area Manager Observation Visits',
      description: 'Lab impression, cleanliness, teacher involvement & curriculum confirmation',
      required: false,
    },
    {
      id: 'hc',
      patterns: ['HC Performance Asset Sep25-Jun26.xls'],
      label: 'Health Check Performance Assets',
      description: 'Custodian ratings, usability, visitor readiness & budget/continuation flags',
      required: false,
    },
    {
      id: 'survey',
      patterns: ['Teacher Survey 25_26.xlsx'],
      label: 'Annual Teacher Satisfaction Survey',
      description: 'Curriculum comprehension, ease of use, GST staff rating & teacher feedback',
      required: false,
    },
  ];

  return candidates.map(c => {
    let matchedName = c.patterns[0];
    let exists = false;
    let sizeBytes = 0;
    let modifiedAt = null;
    for (const pat of c.patterns) {
      const fp = path.join(sliceDir, pat);
      if (fs.existsSync(fp)) {
        matchedName = pat;
        exists = true;
        const stat = fs.statSync(fp);
        sizeBytes = stat.size;
        modifiedAt = stat.mtime.toISOString();
        break;
      }
    }
    return {
      id: c.id,
      name: matchedName,
      label: c.label,
      description: c.description,
      required: c.required,
      exists,
      sizeBytes,
      modifiedAt,
    };
  });
}

function runPythonIngestion(rootDir, scriptPath, callback) {
  const commands = process.platform === 'win32'
    ? [`py "${scriptPath}"`, `python "${scriptPath}"`, `python3 "${scriptPath}"`]
    : [`/opt/venv/bin/python "${scriptPath}"`, `python3 "${scriptPath}"`, `python "${scriptPath}"`];

  const tryNext = (idx) => {
    if (idx >= commands.length) {
      callback(new Error('Could not find a working Python interpreter.'), '', '');
      return;
    }
    exec(commands[idx], { cwd: rootDir, maxBuffer: 1024 * 1024 * 15 }, (error, stdout, stderr) => {
      if (error && idx + 1 < commands.length) {
        tryNext(idx + 1);
      } else {
        callback(error, stdout, stderr);
      }
    });
  };
  tryNext(0);
}

export function handleRequest(req, res) {
  const reqPath = decodeURI((req.url || '/').split('?')[0]);
  const rootDir = __dirname;

  // API: GET /api/cohort
  if (reqPath === '/api/cohort' && req.method === 'GET') {
    const cohortFile = path.join(rootDir, 'data', 'cohort.json');
    res.setHeader('Content-Type', 'application/json');
    if (fs.existsSync(cohortFile)) {
      fs.createReadStream(cohortFile).pipe(res);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: 'cohort.json not found' }));
    }
    return;
  }

  // API: GET /api/ingest-status
  if (reqPath === '/api/ingest-status' && req.method === 'GET') {
    try {
      const incomingDir = path.join(rootDir, 'data', 'incoming');
      const legacyDir = path.join(rootDir, '1st slice of data SY 25-26');
      if (!fs.existsSync(incomingDir)) {
        fs.mkdirSync(incomingDir, { recursive: true });
      }
      let sliceDir = incomingDir;
      const hasIncomingFiles = fs.existsSync(incomingDir) && fs.readdirSync(incomingDir).some(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
      if (!hasIncomingFiles && fs.existsSync(legacyDir)) {
        sliceDir = legacyDir;
      }

      const filesStatus = getExpectedFiles(sliceDir);
      const cohortFile = path.join(rootDir, 'data', 'cohort.json');
      let cohortMeta = null;
      if (fs.existsSync(cohortFile)) {
        try {
          const stat = fs.statSync(cohortFile);
          const raw = JSON.parse(fs.readFileSync(cohortFile, 'utf-8'));
          cohortMeta = {
            schoolYear: raw.schoolYear || 'SY 2026–2027',
            fileSizeBytes: stat.size,
            lastGeneratedAt: raw.generatedAt || stat.mtime.toISOString(),
            totalSchools: raw.totalSchools || raw.schools?.length || 0,
            flaggedCount: raw.flaggedCount || raw.flaggedReports?.length || 0,
            ingestionMetadata: raw.ingestionMetadata || null,
          };
        } catch {}
      }

      let historicalMeta = null;
      const histFile = path.join(rootDir, 'data', 'historical_visits.json');
      if (fs.existsSync(histFile)) {
        try {
          const rawHist = JSON.parse(fs.readFileSync(histFile, 'utf-8'));
          historicalMeta = {
            schoolYear: rawHist.schoolYear || 'SY 2026–2027',
            totalCumulativeVisits: rawHist.totalCumulativeVisits || 0,
            totalSchoolsTracked: rawHist.totalSchoolsTracked || 0,
            newVisitsAddedThisRun: rawHist.newVisitsAddedThisRun || 0,
            historicalVisitsRetained: rawHist.historicalVisitsRetained || 0,
            lastUpdated: rawHist.lastUpdated || null,
          };
        } catch {}
      }

      const allFiles = fs.existsSync(sliceDir) ? fs.readdirSync(sliceDir) : [];
      const incrementalFiles = allFiles
        .filter(f => (f.endsWith('.xls') || f.endsWith('.xlsx')) && !f.startsWith('~$'))
        .filter(f => !filesStatus.some(ef => ef.name.toLowerCase() === f.toLowerCase()))
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
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // API: POST /api/run-ingest
  if (reqPath === '/api/run-ingest' && req.method === 'POST') {
    const scriptPath = path.join(rootDir, 'scripts', 'ingest_real_data.py');
    const cohortFile = path.join(rootDir, 'data', 'cohort.json');

    runPythonIngestion(rootDir, scriptPath, (error, stdout, stderr) => {
      let cohortData = null;
      try {
        if (fs.existsSync(cohortFile)) {
          cohortData = JSON.parse(fs.readFileSync(cohortFile, 'utf-8'));
        }
      } catch {}

      if (error && !cohortData) {
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

      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: true,
          output: stdout || `[SUCCESS] Loaded ${cohortData?.totalSchools || 0} schools for ${cohortData?.schoolYear || 'SY 2026–2027'}.`,
          stderr: stderr || '',
          schoolYear: cohortData?.schoolYear || 'SY 2026–2027',
          totalSchools: cohortData?.totalSchools || cohortData?.schools?.length || 0,
          flaggedCount: cohortData?.flaggedCount || cohortData?.flaggedReports?.length || 0,
          cohort: cohortData,
        })
      );
    });
    return;
  }

  // API: GET /api/snapshots
  if (reqPath === '/api/snapshots' && req.method === 'GET') {
    try {
      const snapDir = path.join(rootDir, 'data', 'snapshots');
      if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
      }
      const files = fs.readdirSync(snapDir).filter(f => f.endsWith('.json'));
      const snapshots = files
        .map(f => {
          try {
            return JSON.parse(fs.readFileSync(path.join(snapDir, f), 'utf-8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, snapshots }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // API: POST /api/snapshots/save
  if (reqPath === '/api/snapshots/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
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
        const snapDir = path.join(rootDir, 'data', 'snapshots');
        if (!fs.existsSync(snapDir)) {
          fs.mkdirSync(snapDir, { recursive: true });
        }
        const safeId = snapshot.snapshotId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(snapDir, `snapshot_${safeId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, filePath, snapshotId: snapshot.snapshotId }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static files in dist/
  const filePath = path.join(distDir, reqPath === '/' ? 'index.html' : reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Build not found. Please run npm run build first.');
    }
  }
}

export const server = http.createServer(handleRequest);

if (process.env.NO_LISTEN !== '1') {
  server.listen(port, '0.0.0.0', () => {
    console.log(`NY Sun Works Dashboard production server running at http://0.0.0.0:${port}`);
  });
}
