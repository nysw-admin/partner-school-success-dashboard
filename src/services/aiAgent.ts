import type { SchoolWithData } from '../pipeline/generator.ts';
import type { FlaggedSchoolReport } from '../types/flags.ts';
import { getLogsForSchool } from './flagLogStore.ts';

/**
 * NYSW Dashboard AI Intelligence Service
 * Generates executive summaries, diagnostic reports, and answers queries
 * regarding school health, rubrics, metrics, and operational interventions.
 */

export interface CopilotResponse {
  answer: string;
  focusedSchoolDbn?: string;
  suggestedFollowUps?: string[];
}

/**
 * Generate a comprehensive executive summary report for a specific school.
 */
export function generateSchoolExecutiveReport(item: SchoolWithData): string {
  const { school, score, flags, snapshot } = item;
  const logs = getLogsForSchool(school.dbn);

  const b1Pct = Math.round(score.bucket1.percentage * 100);
  const b2Pct = Math.round(score.bucket2.percentage * 100);
  const b3Pct = Math.round(score.bucket3.percentage * 100);

  const flagSeverity = flags.some(f => f.severity === 'critical') ? 'CRITICAL' : flags.length > 0 ? 'WARNING' : 'CLEAR';

  let report = `# 🏫 NYSW EXECUTIVE STATUS REPORT: ${school.name} (${school.dbn})
**Generated Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}  
**Program Status:** ${school.programYear} (Installed ${school.installationDate})  
**Borough:** ${school.borough} | **Labs:** ${school.numLabs} Lab (${school.systemsInstalled} systems${school.hasAquaponics ? ', with Aquaponics AQX' : ''})

---

## 1. Executive Health Score & Performance Tier
* **Composite Score:** **${score.overallScore.toFixed(1)} / 100**
* **Letter Grade:** **Grade ${score.letterGrade}**
* **Performance Tier:** **${score.tier}**
* **Data Completeness Gate:** **${score.completeness.status}** (${(score.completeness.rate * 100).toFixed(0)}% records submitted, ${score.completeness.actualRecords}/${score.completeness.expectedRecords} logs)
* **Operational Risk Level:** **${flagSeverity}** (${flags.length} active trigger${flags.length === 1 ? '' : 's'})

### Key Staffing & Operations Assignments:
* **GST Team (Field Technician):** ${school.assignedGst || 'Unassigned'}
* **Curriculum Specialist (Ed Team):** ${school.curriculumSpecialist || 'Unassigned'}
* **Area Manager (Supervision):** ${school.areaManager}

---

## 2. 3-Bucket Performance Diagnostics

### 🌿 Bucket 1: Classroom Maintenance & GST (${score.bucket1.earnedPoints.toFixed(1)} / 42.0 pts — ${b1Pct}%)
* **Diagnostic Assessment:** ${b1Pct >= 80 ? 'Optimal lab hygiene, high system uptime, and strong weekly support cadence.' : b1Pct >= 65 ? 'Acceptable baseline maintenance; monitor seedling replenishment and nutrient levels.' : 'Immediate remediation required: recurring equipment downtime or missed maintenance visits.'}
* **Key Components:**
  - Asset Completion: ${score.bucket1.groups.find(g => g.groupId === 'b1_assets')?.earnedPoints.toFixed(1) || '0'} / 15.0 pts
  - Systems & Branding: ${score.bucket1.groups.find(g => g.groupId === 'b1_systems_branding')?.earnedPoints.toFixed(1) || '0'} / 14.0 pts
  - Harvest & Distribution: ${score.bucket1.groups.find(g => g.groupId === 'b1_harvests')?.earnedPoints.toFixed(1) || '0'} / 8.0 pts
  - Readiness & Satisfaction: ${score.bucket1.groups.find(g => g.groupId === 'b1_readiness')?.earnedPoints.toFixed(1) || '0'} / 5.0 pts

### 👩‍🏫 Bucket 2: Teacher & Student Engagement (${score.bucket2.earnedPoints.toFixed(1)} / 40.0 pts — ${b2Pct}%)
* **Diagnostic Assessment:** ${b2Pct >= 80 ? 'Highly engaged classroom teacher actively implementing NYSW curriculum and logging sessions.' : b2Pct >= 65 ? 'Moderate participation; curriculum used sporadically; recommended for supplemental PD.' : 'Disengagement risk: infrequent teacher logins or missed curriculum professional development.'}
* **Key Components:**
  - Curriculum Implementation: ${score.bucket2.groups.find(g => g.groupId === 'b2_comprehension')?.earnedPoints.toFixed(1) || '0'} / 15.0 pts
  - Teacher Professional Development: ${score.bucket2.groups.find(g => g.groupId === 'b2_training')?.earnedPoints.toFixed(1) || '0'} / 15.0 pts
  - Hands-on Lab Activity: ${score.bucket2.groups.find(g => g.groupId === 'b2_hc_engagement')?.earnedPoints.toFixed(1) || '0'} / 10.0 pts

### 🏛️ Bucket 3: Administration Support (${score.bucket3.earnedPoints.toFixed(1)} / 18.0 pts — ${b3Pct}%)
* **Diagnostic Assessment:** ${b3Pct >= 80 ? 'Strong administrative champion; active maintenance agreement; welcoming to visitors.' : 'Administrative friction or renewal uncertainty. Area Manager check-in advised.'}
* **Key Components:**
  - Leadership & Sustainability: ${score.bucket3.earnedPoints.toFixed(1)} / 18.0 pts

---

## 3. Early-Warning Triggers & Operational Alerts
`;

  if (flags.length === 0) {
    report += `\n* ✅ **No active flags.** Program is in compliance across all operational thresholds.\n`;
  } else {
    flags.forEach((f, idx) => {
      report += `\n### Alert ${idx + 1}: ${f.title} (${f.severity.toUpperCase()})
* **Consecutive Weeks Active:** ${f.weeksActive} week${f.weeksActive > 1 ? 's' : ''}
* **Operational Routing:** \`${f.routing}\`
* **Trigger Cause:** ${f.description}
* **Underlying Diagnostic Detail:** ${f.triggerDetail}
`;
    });
  }

  report += `
---

## 4. Agricultural & Classroom Snapshot
* **Next Forecasted Harvest:** ${snapshot.nextHarvestEstimate || 'Pending schedule'}
* **Cultivated Crops:** ${snapshot.cropsHarvested.join(', ')}
* **Produce Distribution:** ${snapshot.distributionDestinations.join(', ')}
* **Student Lab Experiments:** ${snapshot.studentExperimentFrequency}
${school.hasAquaponics ? `* **Aquaponics Live Status:** ${snapshot.aquaponicsNotes || 'Normal operating parameters'}` : ''}
* **Qualitative Field Summary:** ${snapshot.generalNotes}
* **Reported Obstacles:** ${snapshot.knownIssues}

---

## 5. Team Operational Action Log (${logs.length} logged record${logs.length === 1 ? '' : 's'})
`;

  if (logs.length === 0) {
    report += `\n* *No team notes recorded yet. Use the dashboard to log new outreach or intervention steps.*\n`;
  } else {
    logs.forEach(l => {
      report += `\n* **[${l.timestamp}] ${l.author}** — *Status: ${l.statusTag}*  \n  "${l.note}"\n`;
    });
  }

  report += `
---

## 6. Prescriptive Action Plan & Next Steps
1. **GST Action Item:** ${b1Pct < 70 ? `Prioritize hardware inspection, flush nutrient reservoirs, and resolve "${flags[0]?.title || 'maintenance concerns'}".` : 'Maintain standard bi-weekly visit cadence and verify seeding replenishment.'}
2. **Ed Team Action Item:** ${b2Pct < 70 ? `Curriculum Specialist ${school.curriculumSpecialist || 'Unassigned'} to schedule 1-on-1 pedagogical check-in with lead teacher.` : 'Invite lead teacher to present student projects at the upcoming NYSW Youth STEM Conference.'}
3. **Admin / Management Action Item:** ${flags.length > 0 ? `Area Manager ${school.areaManager} to follow up on unresolved ${flags[0]?.title} before end of week.` : 'Standard quarterly check-in with principal.'}
`;

  return report;
}

/**
 * Generate a comprehensive network-wide executive status report.
 */
export function generateNetworkExecutiveReport(allSchools: SchoolWithData[], flaggedReports: FlaggedSchoolReport[]): string {
  const total = allSchools.length;
  const avgScore = Number((allSchools.reduce((sum, s) => sum + s.score.overallScore, 0) / total).toFixed(1));

  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  allSchools.forEach(s => { gradeCounts[s.score.letterGrade] = (gradeCounts[s.score.letterGrade] || 0) + 1; });

  const sorted = [...allSchools].sort((a, b) => b.score.overallScore - a.score.overallScore);
  const topSchools = sorted.slice(0, 5);
  const bottomSchools = sorted.slice(-5).reverse();

  const boroughs = ['Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island'] as const;
  const boroughStats = boroughs.map(b => {
    const bSchools = allSchools.filter(s => s.school.borough === b);
    const bAvg = bSchools.length > 0 ? (bSchools.reduce((acc, s) => acc + s.score.overallScore, 0) / bSchools.length).toFixed(1) : '0';
    const bFlags = bSchools.reduce((acc, s) => acc + s.flags.length, 0);
    const passCount = bSchools.filter(s => ['A', 'B', 'C'].includes(s.score.letterGrade)).length;
    return { borough: b, count: bSchools.length, avg: bAvg, flags: bFlags, passRate: Math.round((passCount / (bSchools.length || 1)) * 100) };
  });

  let report = `# 🌐 NYSW COMPREHENSIVE NETWORK EXECUTIVE STATUS REPORT
**Cohort Scope:** ${total} Active Hydroponic Partner Schools across 5 NYC Boroughs  
**Reporting Cycle:** SY 2025–2026 (Live Decision-Support Monitoring)  
**Scoring Architecture:** 100-Point Composite Model (Bucket 1: 42 pts · Bucket 2: 40 pts · Bucket 3: 18 pts)

---

## 1. Network Performance & Health Overview
* **Network Mean Composite Score:** **${avgScore} / 100**
* **Network Pass Rate (Grades A–C):** **${Math.round(((gradeCounts.A + gradeCounts.B + gradeCounts.C) / total) * 100)}%** (${gradeCounts.A + gradeCounts.B + gradeCounts.C} of ${total} schools in good standing)
* **Tier Distribution Breakdown:**
  - 🟢 **Grade A — Thriving (90–100):** **${gradeCounts.A} schools** (${Math.round((gradeCounts.A / total) * 100)}%)
  - 🟢 **Grade B — Healthy (80–89.9):** **${gradeCounts.B} schools** (${Math.round((gradeCounts.B / total) * 100)}%)
  - 🟡 **Grade C — Watch (70–79.9):** **${gradeCounts.C} schools** (${Math.round((gradeCounts.C / total) * 100)}%)
  - 🟠 **Grade D — Intervene (60–69.9):** **${gradeCounts.D} schools** (${Math.round((gradeCounts.D / total) * 100)}%)
  - 🔴 **Grade F — At Risk (< 60):** **${gradeCounts.F} schools** (${Math.round((gradeCounts.F / total) * 100)}%)

* **Weekly Flagged Watchlist:** **${flaggedReports.length} schools** currently require active operational intervention.

---

## 2. 🏆 Top 5 Flagship Performing Schools
These schools maintain 95%+ system uptime, 100% asset completion, active harvests, and high teacher PD participation:

| Rank | School Name | DBN | Borough | Grade | Overall | Bucket 1 | Bucket 2 | Bucket 3 | Assigned Team |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  topSchools.forEach((s, idx) => {
    report += `| **#${idx + 1}** | **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)}** | ${s.score.bucket1.earnedPoints.toFixed(1)}/42 | ${s.score.bucket2.earnedPoints.toFixed(1)}/40 | ${s.score.bucket3.earnedPoints.toFixed(1)}/18 | ${s.school.assignedGst} / ${s.school.curriculumSpecialist || 'Heather Holz'} |\n`;
  });

  report += `
---

## 3. 🚨 Priority Intervention Schools (Lowest Scoring / At Risk)
These partner schools currently have composite scores below 65 or trigger multiple early-warning flags:

| Rank | School Name | DBN | Borough | Grade | Overall | Bucket 1 | Bucket 2 | Active Alert Triggers | Field Team |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  bottomSchools.forEach((s, idx) => {
    const flagsSummary = s.flags.map(f => f.title).join(', ');
    report += `| **#${idx + 1}** | **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)}** | ${s.score.bucket1.earnedPoints.toFixed(1)}/42 | ${s.score.bucket2.earnedPoints.toFixed(1)}/40 | ${flagsSummary || 'Score below 60 floor'} | ${s.school.assignedGst} / ${s.school.curriculumSpecialist || 'Heather Holz'} |\n`;
  });

  report += `
---

## 4. 🏙️ Borough Performance Diagnostics
| Borough | School Count | Average Score | Active Flags | Pass Rate (Grades A–C) |
| :--- | :--- | :--- | :--- | :--- |
${boroughStats.map(b => `| **${b.borough}** | ${b.count} | **${b.avg} / 100** | ${b.flags} alerts | ${b.passRate}% |`).join('\n')}

---

## 5. 🌱 Agricultural & Laboratory Snapshot
* **Hydroponic Science Labs:** 33 partner schools active.
* **Aquaponics Technology (AQX):** ${allSchools.filter(s => s.school.hasAquaponics).length} schools operating recirculating fish & plant aquatic ecosystems.
* **Cultivated Crops:** Genovese Basil, Curly Kale, Spearmint, Romaine Lettuce, Cherry Tomatoes.
* **Distribution Destinations:** School Cafeteria Salad Bars, Student Take-Home, Local Community Fridges.

---

## 6. Strategic Recommendations for NYSW Operations
1. **Field Calibration Visits:** Area Managers should schedule visits with the **${bottomSchools.length} lowest-scoring schools** to resolve hardware downtime and teacher vacancies.
2. **Curriculum Specialist Focus:** Provide targeted 1-on-1 pedagogical sessions for schools with Bucket 2 engagement below 25 points.
3. **Data Completeness Enforcement:** Ensure schools with Provisional reporting file remaining logs prior to semester closing.
`;

  return report;
}

/**
 * Fuzzy school resolver that matches DBNs, numbers, nicknames, and full names.
 */
export function findSchoolInQuery(query: string, allSchools: SchoolWithData[]): SchoolWithData | null {
  const q = query.toLowerCase().trim();

  // 1. Direct DBN check (e.g., K089, k089, M028, x208, q620)
  for (const s of allSchools) {
    const dbn = s.school.dbn.toLowerCase();
    const dbnPattern = new RegExp(`\\b${dbn}\\b`, 'i');
    if (dbnPattern.test(q) || q.includes(dbn)) {
      return s;
    }
  }

  // 2. School number matching (e.g. "PS 89", "PS 089", "P.S. 89", "PS147", "147", "IS 219", "089")
  for (const s of allSchools) {
    const dbn = s.school.dbn.toLowerCase();
    const numPart = dbn.replace(/^[a-z]/, ''); // e.g. "089"
    const numStripped = numPart.replace(/^0+/, ''); // e.g. "89"

    const patterns = [
      new RegExp(`\\b(p\\.?s\\.?|i\\.?s\\.?|m\\.?s\\.?|hs|school)\\s*0*${numStripped}\\b`, 'i'),
      new RegExp(`\\bps0*${numStripped}\\b`, 'i'),
      new RegExp(`\\bis0*${numStripped}\\b`, 'i'),
    ];

    if (patterns.some(p => p.test(q))) {
      return s;
    }

    if (q.includes(` ${numPart} `) || q.endsWith(` ${numPart}`) || q.includes(` ${numStripped} `) || q.endsWith(` ${numStripped}`)) {
      return s;
    }
  }

  // 3. Name tokens & distinctive keywords
  const distinctKeywords: Record<string, string> = {
    'cypress hills': 'K089',
    'cypress': 'K089',
    'parkside': 'K130',
    'remsen': 'K147',
    'pitkin': 'K159',
    'straus': 'M199',
    'jessie isador': 'M199',
    'edison': 'Q620',
    'thomas edison': 'Q620',
    'spofford': 'X208',
    'wright brothers': 'M028',
    'wright': 'M028',
    'business': 'X434',
    'bronx high school of business': 'X434',
    'damrosch': 'X186',
    'wildlife': 'X492',
    'wildlife conservation': 'X492',
    'new venture': 'X219',
    'new school': 'X244',
    'amistad': 'M311',
    'duarte': 'M132',
    'juan pablo': 'M132',
    'dyckman': 'M152',
    'dyckman valley': 'M152',
    'gregory jackson': 'K284',
    'john wayne': 'K380',
    'sunset park': 'K415',
    'sunset park prep': 'K415',
    'emily dickinson': 'M075',
    'dickinson': 'M075',
    'ochs': 'M111',
    'adolph': 'M111',
    'robert e simon': 'M165',
    'simon': 'M165',
    'patrick henry': 'M171',
    'marino jeantet': 'Q019',
    'jeantet': 'Q019',
    'aerospace': 'Q127',
    'paul klapper': 'Q219',
    'klapper': 'Q219',
    'fairview': 'Q314',
    'whittier': 'R018',
    'john g whittier': 'R018',
    'tyler': 'R045',
    'john tyler': 'R045',
    'dalmau': 'R061',
    'francisco dalmau': 'R061',
    'belmont': 'X032',
    'mother hale': 'X065',
    'clason': 'X100',
    'isaac clason': 'X100',
  };

  for (const [kw, dbn] of Object.entries(distinctKeywords)) {
    if (q.includes(kw)) {
      const match = allSchools.find(s => s.school.dbn.toUpperCase() === dbn.toUpperCase());
      if (match) return match;
    }
  }

  // 4. Substring search in full school name
  for (const s of allSchools) {
    if (q.includes(s.school.name.toLowerCase())) {
      return s;
    }
  }

  return null;
}

/**
 * Natural language Q&A and reasoning copilot for all school data queries.
 */
export async function askSchoolCopilot(
  query: string,
  focusedSchool: SchoolWithData | null,
  allSchools: SchoolWithData[],
  flaggedReports: FlaggedSchoolReport[]
): Promise<CopilotResponse> {
  const cleanQ = query.trim().toLowerCase();

  // 1. Resolve school target: explicitly mentioned in query takes precedence over focused school
  const mentionedSchool = findSchoolInQuery(cleanQ, allSchools);
  const targetSchool = mentionedSchool || focusedSchool;

  // 2. Intent: Top List Schools / Rankings / Best Schools
  if (
    cleanQ.includes('top list') ||
    cleanQ.includes('top school') ||
    cleanQ.includes('top schools') ||
    cleanQ.includes('best school') ||
    cleanQ.includes('best schools') ||
    cleanQ.includes('highest scor') ||
    cleanQ.includes('highest-scor') ||
    cleanQ.includes('leader') ||
    cleanQ.includes('leaderboard') ||
    cleanQ.includes('ranking') ||
    cleanQ.includes('rankings') ||
    cleanQ.includes('top 5') ||
    cleanQ.includes('top 10') ||
    (cleanQ.includes('top') && !cleanQ.includes('stop'))
  ) {
    const sorted = [...allSchools].sort((a, b) => b.score.overallScore - a.score.overallScore);
    const top10 = sorted.slice(0, 10);

    let answer = `### 🏆 Top Performing Partner Schools Leaderboard\n\n`;
    answer += `Here are the highest-scoring schools across the network, evaluated across our 100-point rubric:\n\n`;
    answer += `| Rank | School Name | DBN | Borough | Grade | Overall Score | Bucket 1 (Lab) | Bucket 2 (PD) | Bucket 3 (Admin) | Assigned GST |\n`;
    answer += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    top10.forEach((s, idx) => {
      answer += `| **#${idx + 1}** | **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)} / 100** | ${s.score.bucket1.earnedPoints.toFixed(1)}/42 | ${s.score.bucket2.earnedPoints.toFixed(1)}/40 | ${s.score.bucket3.earnedPoints.toFixed(1)}/18 | ${s.school.assignedGst} |\n`;
    });

    answer += `\n**Key Characteristics of Leaders:**\n`;
    answer += `* 100% on-time weekly maintenance asset completion.\n`;
    answer += `* High student lab usability scores (3.8+ out of 4.0).\n`;
    answer += `* Regular teacher attendance at NYSW professional development sessions.\n`;

    return {
      answer,
      focusedSchoolDbn: top10[0]?.school.dbn,
      suggestedFollowUps: [
        `Generate report for ${top10[0]?.school.dbn}`,
        `Generate report for ${top10[1]?.school.dbn}`,
        'Show bottom schools needing intervention',
        'Which borough has the highest score?'
      ]
    };
  }

  // 3. Intent: Bottom Schools / Lowest Scoring / Failing / Intervene / At Risk
  if (
    cleanQ.includes('bottom') ||
    cleanQ.includes('lowest') ||
    cleanQ.includes('worst') ||
    cleanQ.includes('failing') ||
    cleanQ.includes('at risk') ||
    cleanQ.includes('at-risk') ||
    cleanQ.includes('intervene') ||
    cleanQ.includes('critical') ||
    cleanQ.includes('struggling') ||
    cleanQ.includes('need help') ||
    cleanQ.includes('needs help')
  ) {
    const criticalSchools = [...allSchools]
      .filter(s => s.score.letterGrade === 'F' || s.score.letterGrade === 'D' || s.flags.length > 0)
      .sort((a, b) => a.score.overallScore - b.score.overallScore);

    let answer = `### 🚨 Priority Partner Schools Requiring Operational Intervention\n\n`;
    answer += `Currently, **${criticalSchools.length} partner schools** have composite scores below 70 or have active early-warning flags:\n\n`;
    answer += `| Rank | School Name | DBN | Borough | Grade | Score | Active Alert Flags | Assigned GST | Ed Team Specialist |\n`;
    answer += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    criticalSchools.slice(0, 8).forEach((s, idx) => {
      const flagsText = s.flags.map(f => `\`${f.title} (${f.weeksActive}w)\``).join(', ');
      answer += `| **#${idx + 1}** | **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)}** | ${flagsText || 'Score below 60 floor threshold'} | ${s.school.assignedGst} | ${s.school.curriculumSpecialist || 'Heather Holz'} |\n`;
    });

    answer += `\n**Recommended Intervention Actions:**\n`;
    answer += `1. **Area Manager Outreach:** Conduct immediate in-person lab evaluations.\n`;
    answer += `2. **Hardware Calibration:** Verify pump operations, timers, and seedling supplies.\n`;
    answer += `3. **Teacher Re-engagement:** Schedule 1-on-1 curriculum planning with the assigned Ed Team specialist.\n`;

    return {
      answer,
      focusedSchoolDbn: criticalSchools[0]?.school.dbn,
      suggestedFollowUps: [
        `Generate report for ${criticalSchools[0]?.school.dbn}`,
        `Draft intervention email to ${criticalSchools[0]?.school.name}`,
        `Why is ${criticalSchools[0]?.school.dbn} flagged?`,
        'Show top list schools'
      ]
    };
  }

  // 4. Intent: Active Flags / Watchlist / Warnings
  if (
    cleanQ.includes('flag') ||
    cleanQ.includes('watchlist') ||
    cleanQ.includes('alert') ||
    cleanQ.includes('warning') ||
    cleanQ.includes('trigger')
  ) {
    if (targetSchool && (mentionedSchool || cleanQ.includes('this school') || cleanQ.includes(targetSchool.school.dbn.toLowerCase()))) {
      const s = targetSchool;
      if (s.flags.length === 0) {
        return {
          answer: `### ✅ Flag Status for ${s.school.name} (${s.school.dbn})\n\n` +
            `* **Current Status:** **No Active Flags (Clear)**\n` +
            `* **Overall Score:** **${s.score.overallScore.toFixed(1)} / 100** (Grade **${s.score.letterGrade}** — *${s.score.tier}*)\n` +
            `* **Classroom Systems:** Healthy system uptime and compliant weekly asset reporting.\n\n` +
            `*Ask "Generate report for ${s.school.dbn}" for a full executive briefing.*`,
          focusedSchoolDbn: s.school.dbn,
          suggestedFollowUps: [`Generate report for ${s.school.dbn}`, `What crops are grown at ${s.school.dbn}?`, 'Show all flagged schools']
        };
      } else {
        let flagDetails = `### 🚨 Active Flags for ${s.school.name} (${s.school.dbn})\n\n` +
          `This school currently has **${s.flags.length} active operational alert${s.flags.length > 1 ? 's' : ''}** on the Weekly Watchlist:\n\n`;

        s.flags.forEach((f, idx) => {
          flagDetails += `#### Alert ${idx + 1}: ${f.title} (${f.severity.toUpperCase()})\n` +
            `* **Weeks Active:** ${f.weeksActive} consecutive week${f.weeksActive > 1 ? 's' : ''}\n` +
            `* **Operational Routing:** \`${f.routing}\`\n` +
            `* **Trigger Cause:** ${f.description}\n` +
            `* **Underlying Diagnostic Detail:** ${f.triggerDetail}\n\n`;
        });

        flagDetails += `**Remediation Steps:**\n` +
          `* Assigned GST **${s.school.assignedGst}** and Area Manager **${s.school.areaManager}** should coordinate a field audit.\n` +
          `* Use the **Weekly Watchlist Log** to record any outreach updates.`;

        return {
          answer: flagDetails,
          focusedSchoolDbn: s.school.dbn,
          suggestedFollowUps: [
            `Generate report for ${s.school.dbn}`,
            `Draft intervention email to ${s.school.name}`,
            'Show all flagged schools on the watchlist'
          ]
        };
      }
    } else {
      // Network flagged overview
      let answer = `### 🚨 Weekly Flagged Watchlist Diagnostic Summary\n\n`;
      answer += `There are currently **${flaggedReports.length} schools** flagged for early-warning operational failure modes:\n\n`;
      answer += `| School Name | DBN | Borough | Severity | Weeks Active | Primary Alert Reason | Assigned Field Team |\n`;
      answer += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      flaggedReports.forEach(r => {
        const topFlag = r.activeFlags[0];
        const matchingSchool = allSchools.find(s => s.school.dbn.toUpperCase() === r.schoolDbn.toUpperCase());
        const specialist = matchingSchool?.school.curriculumSpecialist || 'Heather Holz';
        answer += `| **${r.schoolName}** | \`${r.schoolDbn}\` | ${r.borough} | **${r.highestSeverity.toUpperCase()}** | ${topFlag ? `${topFlag.weeksActive}w` : '1w'} | ${topFlag ? topFlag.title : 'Low Performance'} | ${r.assignedGst} / ${specialist} |\n`;
      });

      answer += `\n**Most Common Failure Modes in Current Cycle:**\n`;
      answer += `1. **Missing Weekly Reports (2+ consecutive weeks):** GST report filing delays.\n`;
      answer += `2. **Low Cumulative Asset Completion (< 70%):** Incomplete maintenance checklists.\n`;
      answer += `3. **Harvest Deficits:** Less than 3 recorded harvests post-March 1.\n`;

      return {
        answer,
        suggestedFollowUps: [
          `Generate report for ${flaggedReports[0]?.schoolDbn || 'K147'}`,
          `Draft intervention email for ${flaggedReports[0]?.schoolName || 'PS 147'}`,
          'Show top list schools',
          'Which borough has the most flags?'
        ]
      };
    }
  }

  // 5. Intent: Reports & Summaries (Single School or Master Network Report)
  if (
    cleanQ.includes('report') ||
    cleanQ.includes('reports') ||
    cleanQ.includes('summary') ||
    cleanQ.includes('status') ||
    cleanQ.includes('brief') ||
    cleanQ.includes('overview') ||
    cleanQ.includes('snapshot') ||
    cleanQ.includes('generate')
  ) {
    if (mentionedSchool) {
      // User specifically requested this school
      return {
        answer: generateSchoolExecutiveReport(mentionedSchool),
        focusedSchoolDbn: mentionedSchool.school.dbn,
        suggestedFollowUps: [
          `What are the active flags for ${mentionedSchool.school.dbn}?`,
          `What crops are grown at ${mentionedSchool.school.dbn}?`,
          `Draft an intervention email to Principal of ${mentionedSchool.school.name}`,
          'Generate comprehensive network executive summary report'
        ]
      };
    } else if (focusedSchool && (cleanQ.includes('this school') || cleanQ.includes('current school') || cleanQ.includes('executive brief') || cleanQ.includes('full report'))) {
      // Focused school active
      return {
        answer: generateSchoolExecutiveReport(focusedSchool),
        focusedSchoolDbn: focusedSchool.school.dbn,
        suggestedFollowUps: [
          `What are the active flags for ${focusedSchool.school.dbn}?`,
          `What crops are grown at ${focusedSchool.school.dbn}?`,
          `Draft an intervention email to Principal of ${focusedSchool.school.name}`,
          'Generate comprehensive network executive summary report'
        ]
      };
    } else {
      // Master Network Executive Status Report
      return {
        answer: generateNetworkExecutiveReport(allSchools, flaggedReports),
        suggestedFollowUps: [
          'Show top list schools',
          'Show bottom schools needing intervention',
          'Show all flagged schools on the watchlist',
          `Generate report for ${allSchools[0]?.school.dbn || 'K089'}`
        ]
      };
    }
  }

  // 6. Intent: Borough Specific Queries
  const boroughMatches = ['manhattan', 'brooklyn', 'bronx', 'queens', 'staten island'];
  const matchedBorough = boroughMatches.find(b => cleanQ.includes(b));
  if (matchedBorough) {
    const properBorough = matchedBorough === 'staten island' ? 'Staten Island' : matchedBorough.charAt(0).toUpperCase() + matchedBorough.slice(1);
    const bSchools = allSchools.filter(s => s.school.borough.toLowerCase() === matchedBorough);
    const bAvg = bSchools.length > 0 ? (bSchools.reduce((acc, s) => acc + s.score.overallScore, 0) / bSchools.length).toFixed(1) : '0';
    const bFlags = bSchools.reduce((acc, s) => acc + s.flags.length, 0);

    let answer = `### 🏙️ Borough Operational Summary: ${properBorough}\n\n` +
      `* **Partner Schools in Borough:** **${bSchools.length} schools**\n` +
      `* **Borough Mean Score:** **${bAvg} / 100**\n` +
      `* **Active Warning Flags:** **${bFlags} alerts**\n\n` +
      `| School Name | DBN | Grade | Overall | Bucket 1 | Bucket 2 | Active Flags | Assigned GST |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    bSchools.forEach(s => {
      const flagSummary = s.flags.length > 0 ? `\`${s.flags.map(f => f.title).join(', ')}\`` : '✅ Clear';
      answer += `| **${s.school.name}** | \`${s.school.dbn}\` | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)}** | ${s.score.bucket1.earnedPoints.toFixed(1)}/42 | ${s.score.bucket2.earnedPoints.toFixed(1)}/40 | ${flagSummary} | ${s.school.assignedGst} |\n`;
    });

    return {
      answer,
      suggestedFollowUps: [
        `Generate report for ${bSchools[0]?.school.dbn || 'K089'}`,
        'Compare all boroughs',
        'Show top list schools'
      ]
    };
  }

  // 7. Intent: Ed Team Specialists & Staffing Queries
  if (
    cleanQ.includes('ed team') ||
    cleanQ.includes('curriculum specialist') ||
    cleanQ.includes('heather holz') ||
    cleanQ.includes('becky fox') ||
    cleanQ.includes('shakira provasoli') ||
    cleanQ.includes('megan roberts') ||
    cleanQ.includes('who is assigned') ||
    cleanQ.includes('staffing') ||
    cleanQ.includes('workload') ||
    cleanQ.includes('gst')
  ) {
    const uniqueEdSpecialists = Array.from(
      new Set(allSchools.map(s => s.school.curriculumSpecialist).filter((cs): cs is string => Boolean(cs && cs !== 'Unassigned')))
    ).sort();

    let queriedSpecialist: string | null = null;
    for (const spec of uniqueEdSpecialists) {
      const parts = spec.toLowerCase().split(' ');
      if (parts.some(p => p.length >= 3 && cleanQ.includes(p))) {
        queriedSpecialist = spec;
        break;
      }
    }

    if (queriedSpecialist) {
      const assigned = allSchools.filter(s => s.school.curriculumSpecialist === queriedSpecialist);
      const avg = (assigned.reduce((acc, s) => acc + s.score.overallScore, 0) / (assigned.length || 1)).toFixed(1);
      const flagCount = assigned.reduce((acc, s) => acc + s.flags.length, 0);

      let answer = `### 👩‍🏫 Ed Team Portfolio: ${queriedSpecialist}\n\n` +
        `* **Role:** Curriculum Specialist, New York Sun Works\n` +
        `* **Assigned Portfolio:** **${assigned.length} partner schools**\n` +
        `* **Portfolio Average Score:** **${avg} / 100**\n` +
        `* **Schools with Active Alerts:** **${flagCount} flags**\n\n` +
        `| School Name | DBN | Borough | Grade | Score | Active Flags | GST Team |\n` +
        `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      assigned.forEach(s => {
        const flagText = s.flags.length > 0 ? s.flags.map(f => f.title).join(', ') : '✅ Clear';
        answer += `| **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | **${s.score.letterGrade}** | **${s.score.overallScore.toFixed(1)}** | ${flagText} | ${s.school.assignedGst} |\n`;
      });

      return {
        answer,
        suggestedFollowUps: [
          `Generate report for ${assigned[0]?.school.dbn || 'K089'}`,
          'Compare all Ed Team specialists',
          'Show top list schools'
        ]
      };
    } else {
      // Overview of all real Ed Team Specialists
      let answer = `### 👥 Ed Team Curriculum Specialists Portfolio Distribution\n\n` +
        `The New York Sun Works Education Team supports partner schools through teacher training, portal tracking, and curriculum implementation:\n\n` +
        `| Specialist | Assigned Schools | Average Score | Active Flags | Key Focus Area |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n`;

      uniqueEdSpecialists.forEach(spec => {
        const list = allSchools.filter(s => s.school.curriculumSpecialist === spec);
        const avg = list.length > 0 ? (list.reduce((acc, s) => acc + s.score.overallScore, 0) / list.length).toFixed(1) : '0';
        const flags = list.reduce((acc, s) => acc + s.flags.length, 0);
        answer += `| **${spec}** | ${list.length} schools | **${avg} / 100** | ${flags} alerts | Teacher PD & Unit Logs |\n`;
      });

      answer += `\n*Ask "Show schools assigned to [Specialist Name]" to view any specialist's individual roster.*`;

      return {
        answer,
        suggestedFollowUps: uniqueEdSpecialists.map(s => `Show schools assigned to ${s}`)
      };
    }
  }

  // 8. Intent: Agricultural Crops & Harvests
  if (
    cleanQ.includes('crop') ||
    cleanQ.includes('crops') ||
    cleanQ.includes('harvest') ||
    cleanQ.includes('harvests') ||
    cleanQ.includes('grow') ||
    cleanQ.includes('plant') ||
    cleanQ.includes('produce') ||
    cleanQ.includes('vegetable') ||
    cleanQ.includes('basil') ||
    cleanQ.includes('kale')
  ) {
    if (targetSchool) {
      const s = targetSchool;
      return {
        answer: `### 🌱 Agricultural Crop Profile: ${s.school.name} (${s.school.dbn})\n\n` +
          `* **Crops Currently Cultivated:** ${s.snapshot.cropsHarvested.join(', ')}\n` +
          `* **Next Forecasted Harvest Date:** **${s.snapshot.nextHarvestEstimate || 'Pending schedule'}**\n` +
          `* **Produce Distribution Destination:** ${s.snapshot.distributionDestinations.join(', ')}\n` +
          `* **Hands-on Student Experiments:** ${s.snapshot.studentExperimentFrequency}\n` +
          `* **Lab Systems Installed:** ${s.school.systemsInstalled} hydroponic systems${s.school.hasAquaponics ? ' + Aquaponics AQX fish tank' : ''}\n\n` +
          `*Qualitative Note:* "${s.snapshot.generalNotes}"`,
        focusedSchoolDbn: s.school.dbn,
        suggestedFollowUps: [
          `Generate report for ${s.school.dbn}`,
          `What are the active flags for ${s.school.dbn}?`,
          'Show all schools with Aquaponics'
        ]
      };
    } else {
      return {
        answer: `### 🌱 NYSW Agricultural Science Network Crops Overview\n\n` +
          `Across our 33 active partner schools, hydroponic labs cultivate a variety of nutrient-dense greens and culinary herbs:\n\n` +
          `* **Core Cultivars:** Genovese Basil, Curly Kale, Spearmint, Romaine Lettuce, Cherry Tomatoes, Rainbow Chard.\n` +
          `* **Harvest Cadence:** Standard production targets 2.5 harvests per month per lab after initial November germination.\n` +
          `* **Community Distribution:** 100% of produce goes to school cafeteria salad bars, local food pantries, and student families.\n` +
          `* **Next Harvest Window:** May 12–20, 2026 across active operational schools.\n\n` +
          `*Tip: Select any school above or ask "What crops are grown at [School Name]?" for lab-specific data.*`,
        suggestedFollowUps: [
          `What crops are grown at PS 089?`,
          `What crops are grown at PS 130?`,
          'Show all schools with Aquaponics',
          'Show top list schools'
        ]
      };
    }
  }

  // 9. Intent: Aquaponics / Fish / AQX
  if (cleanQ.includes('aquaponics') || cleanQ.includes('aqx') || cleanQ.includes('fish') || cleanQ.includes('tilapia') || cleanQ.includes('tank')) {
    const aqxSchools = allSchools.filter(s => s.school.hasAquaponics);
    let answer = `### 🐟 Aquaponics Science Classrooms (AQX Setups)\n\n` +
      `**${aqxSchools.length} partner schools** operate recirculating aquaponics systems where tilapia fish and hydroponic crops grow in a closed biological nitrogen cycle:\n\n` +
      `| School Name | DBN | Borough | Program Status | Systems | Live AQX Status |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    aqxSchools.forEach(s => {
      answer += `| **${s.school.name}** | \`${s.school.dbn}\` | ${s.school.borough} | ${s.school.programYear} | ${s.school.systemsInstalled} systems | ${s.snapshot.aquaponicsNotes || 'Active Tilapia Tank; normal bio-filtration'} |\n`;
    });

    answer += `\n**Aquaponic Lab Health Parameters:**\n` +
      `* Water Temperature: 72–76°F\n` +
      `* pH Range: 6.8–7.4\n` +
      `* Ammonia & Nitrite: < 0.25 ppm\n` +
      `* Biological Integration: Nitrogen cycle lessons integrated into 7th/8th grade and HS biology.`;

    return {
      answer,
      focusedSchoolDbn: aqxSchools[0]?.school.dbn,
      suggestedFollowUps: [
        `Generate report for ${aqxSchools[0]?.school.dbn || 'K130'}`,
        `What crops are grown at ${aqxSchools[0]?.school.dbn || 'K130'}?`,
        'Show top list schools'
      ]
    };
  }

  // 10. Intent: Draft Principal / GST Intervention Email
  if (cleanQ.includes('email') || cleanQ.includes('draft') || cleanQ.includes('letter')) {
    const s = targetSchool || allSchools.find(item => item.flags.length > 0) || allSchools[0];
    const emailDraft = `### ✉️ Draft Intervention Email
**To:** Principal of ${s.school.name}  
**From:** ${s.school.areaManager} (Area Manager, New York Sun Works)  
**CC:** ${s.school.assignedGst} (Assigned GST), ${s.school.curriculumSpecialist || 'Heather Holz'} (Curriculum Specialist)  
**Subject:** Collaborative Support & Next Steps for Hydroponic Science Classroom (${s.school.dbn})

Dear Principal,

I hope your school year is going smoothly! I am writing on behalf of New York Sun Works regarding your hydroponic greenhouse classroom program at **${s.school.name}**.

Our weekly monitoring system tracks system uptime, crop harvest cycles, and teacher curriculum implementation across our partner schools. Currently, ${s.school.name} has an overall program score of **${s.score.overallScore.toFixed(1)}/100 (Grade ${s.score.letterGrade})**${s.flags.length > 0 ? `, with an active early-warning notice regarding: **${s.flags.map(f => f.title).join(', ')}**` : ''}.

**Proposed Collaborative Support Plan:**
1. Our Green Scientist Teacher, **${s.school.assignedGst}**, will conduct an on-site calibration visit this coming week to check pumps, nutrient balances, and seedling inventory.
2. Curriculum Specialist **${s.school.curriculumSpecialist || 'Heather Holz'}** is available to provide 1-on-1 pedagogical support for your lead science teacher.
3. We would love to schedule a brief 10-minute check-in with your administrative team to ensure your lab has everything needed to thrive.

Please let us know if Tuesday or Thursday morning works best for a brief call. We deeply appreciate your partnership in bringing climate science and sustainable agriculture to your students!

Warm regards,  
**${s.school.areaManager}**  
Area Manager | New York Sun Works`;

    return {
      answer: emailDraft,
      focusedSchoolDbn: s.school.dbn,
      suggestedFollowUps: [
        `Generate report for ${s.school.dbn}`,
        `What are the specific flags for ${s.school.dbn}?`,
        'Show bottom schools needing intervention'
      ]
    };
  }

  // 11. Intent: Scoring Formula & Methodology
  if (cleanQ.includes('how is') || cleanQ.includes('calculated') || cleanQ.includes('formula') || cleanQ.includes('rubric') || cleanQ.includes('bucket 1')) {
    return {
      answer: `### 📐 NYSW 100-Point Scoring Methodology & Rubric Architecture\n\n` +
        `The Partner School Success Dashboard scores schools on a **100-Point Maximum Scale** split across three operational pillars:\n\n` +
        `1. **Bucket 1: Classroom Maintenance & GST (42 Max Pts)**\n` +
        `   - Asset Completion Rate (15 pts) · Systems & Branding (14 pts) · Harvest & Distribution (8 pts) · Usability & Cleanliness (5 pts).\n\n` +
        `2. **Bucket 2: Teacher & Student Engagement (40 Max Pts)**\n` +
        `   - Teacher PD Attendance & Completion (15 pts) · Curriculum Implementation & Portal (15 pts) · Student Comprehension & Growth (10 pts).\n\n` +
        `3. **Bucket 3: Administration Support (18 Max Pts)**\n` +
        `   - Leadership Engagement, Signed Letters of Support & Maintenance Continuation Agreement (18 pts).\n\n` +
        `**Universal Mathematical Formula:**\n` +
        `$$\\text{KPI Score} = \\text{Max Points} \\times \\text{clamp}\\left(\\frac{\\text{Actual} - \\text{Floor}}{\\text{Target} - \\text{Floor}}, 0, 1\\right)$$\n` +
        `* Below Floor = 0 pts. Above Target = Full Points. Linearly scaled in between with zero extra credit.*`,
      suggestedFollowUps: [
        'Show top list schools',
        'Show bottom schools needing intervention',
        'Generate network executive summary report'
      ]
    };
  }

  // 12. Specific School Inquiries (if targetSchool exists)
  if (targetSchool) {
    const s = targetSchool;
    return {
      answer: `### 📊 Operational Overview: ${s.school.name} (${s.school.dbn})\n\n` +
        `* **Overall Composite Score:** **${s.score.overallScore.toFixed(1)} / 100** (Grade **${s.score.letterGrade}** — *${s.score.tier}*)\n` +
        `* **Borough & Status:** ${s.school.borough} · ${s.school.programYear} (Installed ${s.school.installationDate})\n` +
        `* **Bucket 1 (Classroom/GST):** ${s.score.bucket1.earnedPoints.toFixed(1)} / 42.0 pts (${Math.round(s.score.bucket1.percentage * 100)}%)\n` +
        `* **Bucket 2 (Teacher/PD):** ${s.score.bucket2.earnedPoints.toFixed(1)} / 40.0 pts (${Math.round(s.score.bucket2.percentage * 100)}%)\n` +
        `* **Bucket 3 (Admin Support):** ${s.score.bucket3.earnedPoints.toFixed(1)} / 18.0 pts (${Math.round(s.score.bucket3.percentage * 100)}%)\n` +
        `* **Data Completeness Gate:** **${s.score.completeness.status}** (${(s.score.completeness.rate * 100).toFixed(0)}% records submitted)\n` +
        `* **Active Flags:** ${s.flags.length > 0 ? s.flags.map(f => `\`${f.title} (${f.weeksActive}w)\``).join(', ') : '✅ None (Clear)'}\n` +
        `* **Field Staffing:** GST ${s.school.assignedGst} · Ed Team ${s.school.curriculumSpecialist || 'Heather Holz'} · Area Mgr ${s.school.areaManager}\n\n` +
        `*Ask "Generate full report for ${s.school.dbn}" for a 6-part executive briefing.*`,
      focusedSchoolDbn: s.school.dbn,
      suggestedFollowUps: [
        `Generate report for ${s.school.dbn}`,
        `What crops are grown at ${s.school.dbn}?`,
        `Draft intervention email to ${s.school.name}`,
        'Show top list schools'
      ]
    };
  }

  // 13. Comprehensive Fallback / Default response
  return {
    answer: generateNetworkExecutiveReport(allSchools, flaggedReports),
    suggestedFollowUps: [
      'Show top list schools',
      'Show bottom schools needing intervention',
      'Show all flagged schools on the watchlist',
      `Generate report for ${allSchools[0]?.school.dbn || 'K089'}`
    ]
  };
}
