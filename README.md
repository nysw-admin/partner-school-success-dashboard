# NY Sun Works — Partner School Success Dashboard

[![Builder](https://img.shields.io/badge/Builder-Pedro%20A.%20Martins%2C%20PMP-blue.svg)](#stakeholders--credits)
[![Program](https://img.shields.io/badge/Program-Pursuit%20%7C%20Mizuho%20Bank%20Nonprofit%20Builder-green.svg)](#stakeholders--credits)
[![Partner](https://img.shields.io/badge/Partner-New%20York%20Sun%20Works%20(NYSW)-orange.svg)](https://nysunworks.org)
[![Status](https://img.shields.io/badge/Status-Active%20Build-success.svg)](#milestones--timeline)

> A centralized, operational decision-support dashboard and automated grading system for **New York Sun Works (NYSW)**, evaluating hydroponic farm classrooms across 370+ NYC public schools to detect struggling programs early, optimize field interventions, and streamline funder reporting.

---

## 📌 Executive Summary & Context

**New York Sun Works (NYSW)** installs state-of-the-art hydroponic science farm classrooms in public schools across the five boroughs of New York City (currently serving 370+ schools, scaling to 400+), paired with a comprehensive PreK–12 sustainability and STEM curriculum.

### The Problem
NYSW has operated without an in-house technologist or a unified monitoring platform. Crucial operational, agronomic, and pedagogical data lives fragmented across:
* **Accelo CRM** (Weekly support reports, bi-annual health checks, training records, events, area manager visits)
* **SurveyMonkey** (Annual comprehensive teacher satisfaction surveys)
* **Google Drive & Sheets** (Maintenance agreements, school profiles, crop photography, story banks)
* **Email & Box** (Support letters, principal communications)

**The Consequence:** Struggling or disengaged schools previously went unnoticed until end-of-year funder reporting—long after the window for meaningful mid-year intervention had closed.

### The Solution
The **Partner School Success Dashboard** provides a single pane of glass for NYSW leadership, operations managers, and development teams. It calculates an objective, transparent **School Grade (0–100)** across three operational pillars, tracks longitudinal trends, surfaces real-time early-warning alerts, and provides a point-in-time classroom snapshot for every partner school.

---

## 🏗️ The 3-Bucket Grading Framework

The dashboard evaluates each partner school on a **100-Point Maximum Scale** distributed across three operational pillars:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 PARTNER SCHOOL SUCCESS SCORE (100 PTS)                   │
├──────────────────────────┬──────────────────────────┬────────────────────┤
│  Bucket 1: Classroom/GST │  Bucket 2: Engagement    │  Bucket 3: Admin   │
│         (42 pts)         │         (40 pts)         │      (18 pts)      │
└──────────────────────────┴──────────────────────────┴────────────────────┘
```

### Universal KPI Calculation Formula
Every quantitative metric is governed by a bounded, linear progression formula:

$$\text{KPI Score} = \text{Max Points} \times \text{clamp}\left(\frac{\text{Actual} - \text{Floor}}{\text{Target} - \text{Floor}}, 0, 1\right)$$

* **Floor**: The minimum acceptable performance threshold. Actual $\le$ Floor yields **0 points**.
* **Target**: The performance objective. Actual $\ge$ Target yields **full points**.
* **Linear Interpolation**: Performance between Floor and Target scales proportionally.
* **Clamp**: Guardrails ensure scores remain strictly between $0.0$ and $1.0$ (no negative values, no extra credit).

### Grade Bands & Performance Tiers
| Score Range | Letter Grade | Status Tier | Operational Action |
|:---:|:---:|:---:|:---|
| **90 – 100** | **A** | 🟢 Green — *Thriving* | Eligible for funder visits & showcase tours |
| **80 – 89** | **B** | 🟢 Green — *Healthy* | On track; standard support cadence |
| **65 – 79** | **C** | 🟡 Yellow — *Watch* | Emerging challenges; targeted check-ins |
| **50 – 64** | **D** | 🔴 Red — *Intervene* | Active performance breakdown; assigned field remediation |
| **Below 50** | **F** | 🔴 Red — *At Risk* | Critical risk of contract lapse or lab abandonment |

> **Structural Note:** Because of the midpoint math, a school performing halfway between floor and target across all metrics lands at exactly **50 points**, anchoring the failing boundary strictly at the midpoint of compliance.

### Completeness Gate
To ensure reporting lags are never misidentified as school failures:
* **$\ge 85\%$ data completeness**: Displays normal Grade & Tier.
* **70% – 84% data completeness**: Displays **"Provisional"** status.
* **$< 70\%$ data completeness**: Displays **"Incomplete"** status badge (freezing grading penalties until reporting gaps resolve).

---

## 📊 Detailed Rubric Architecture

### Bucket 1: Classroom Maintenance & GST (42 Points)
*Focus: Is the hydroponic laboratory operational, clean, productive, and consistently serviced?*
* **Group 1: Asset Reporting (15 pts)**
  * `C1a` On-Time Asset Completion Rate (12 pts | Floor: 65%, Target: 95%)
  * `C1b` Late-vs-Missing Rate (3 pts | Floor: 0%, Target: 100%)
* **Group 2: Systems & Lab Usability (14 pts)**
  * `C2` Systems Uptime (6 pts | Floor: 60%, Target: 100% | *May 15 seasonal wind-down cutoff; AQX excluded*)
  * `C3` Branding Present (4 pts | 2 pts NYSW stickers, 2 pts Partner School sign)
  * `C4` Lab Usability Rating (2 pts | Floor: 1, Target: 4 | Pooled HC Performance + Area Manager Visit)
  * `C5` GST Support Staff Rating (2 pts | Floor: 30%, Target: 85% | Teacher Survey)
* **Group 3: Harvests & Agronomics (8 pts)**
  * `C6` Harvest Frequency (6 pts | Floor: 0.5/mo, Target: 3/mo | *Clock starts Nov 1 for seedling cycle*)
  * `C7` Harvest Yield (2 pts | Floor: 0.5 lb, Target: 3.0 lb / month / system | *Clock starts Nov 1; AQX excluded*)
* **Group 4: Visitor Readiness & Environment (5 pts)**
  * `C8` Visitor-Readiness Rating (2 pts | Floor: 1, Target: 4 | HC Performance + AMV)
  * `C9` Seedlings Present (1 pt | Floor: 10%, Target: 50%)
  * `C10` Pest-Free Visit Rate (2 pts | Floor: 60%, Target: 95%)

---

### Bucket 2: Teacher & Student Engagement (40 Points)
*Focus: Are teachers actively utilizing the curriculum, attending training, and fostering student learning?*
* **Group 1: Curriculum Comprehension (20 pts)**
  * `T1` Curriculum Usage & Ease (6 pts | Survey Q14, Q16)
  * `T2` Helpfulness & Teacher Confidence (2 pts | Survey Q15, Q26)
  * `T3` Materials & Digital Resource Adoption (2 pts | Survey Q18, Q19, Q22)
  * `T4` Curriculum Use Confirmed via AMV (3 pts | Floor: 50%, Target: 100%)
  * `T5` Pedagogical Rubric Level (5 pts | Ed Team Training 5 domains | *PD sessions filtered out*)
  * `T6` Pedagogical Rubric Growth (2 pts | Longitudinal change from first to latest session)
* **Group 2: Training Sessions & Professional Development (11 pts)**
  * `T7` Training Session Completion (10 pts | Floor: 40%, Target: 100% | *Applies to Implementation / Op Y1*)
  * `T8` PD Attendance (1 pt | $\ge 1$ PD session attended)
* **Group 3: Hydroponic Classroom Engagement (9 pts)**
  * `T10` Teacher–GST In-Person Conversation Rate (4 pts | *Tiered*: Y1 Floor 40%/Target 90%; Y2+ Floor 10%/Target 30%)
  * `T11` Teacher Relationship Rating (5 pts | Floor: 1, Target: 4 | Pooled HC Performance + AMV)

---

### Bucket 3: Administration Support (18 Points)
*Focus: Is school leadership engaged, responsive, and committed to sustaining the lab partnership?*
* `A1` Maintenance Proposal Acceptance (10 pts | Full credit by Sept 30; linear daily decay across 365 days)
* `A3` Custodian Involvement Rating (3 pts | Floor: 1, Target: 4 | HC Performance)
* `A6` Support Letters Received (1 pt | 0.5 pt Fall Thank-You + 0.5 pt Spring Letter of Support)
* `A9` Principal & Leadership Engagement (4 pts | Floor: 25%, Target: 90% | Pooled Events + AMV interactions)

---

## 🚨 Early-Warning Flagging System

While the composite Grade provides a stable, long-term health indicator, the **Flagging System** operates in real time to catch acute operational disruptions:

| # | Trigger Condition | Operational Routing | Purpose |
|:---:|:---|:---|:---|
| **1** | **2 Consecutive weekly reports missing** | GST Operations Lead | Catches scheduling/access breakdowns early |
| **2** | **Completed Assets Rate $< 70\%$ by Dec 1** | Operations Check-in | Year-to-date compliance review |
| **3** | **Any system offline on 3 consecutive reports** | Maintenance Work Order | Rapid technical repair before crop loss |
| **4** | **$< 3$ total harvests logged by March 1** | Agronomy / GST Lead | Identifies stalled crop cycles |
| **5** | **Continuation / budget concern expressed** | Development Team | Proactive funding/contract intervention |
| **6** | **Any bucket score drops 10+ points MoM** | Program Leadership | Highlights rapid program deterioration |

---

## 🖥️ Core Dashboard Views

1. **School Grade View**: High-level letter grade, composite score (0–100), and breakdown across the 3 buckets with complete data provenance and click-to-source traceability.
2. **Grade Trend View**: Historical trajectory over the school year, tracking whether interventions are reversing declines.
3. **School Snapshot**: Real-time operational status as of the latest GST visit (active systems, seedlings, harvest estimates, pest alerts, and visit photos).
4. **School Profile**: Longitudinal context (assigned GST member, area manager, partner history, school year cohort, and contact directory).
5. **Flagged Schools Queue**: Dedicated triage feed filtering schools requiring immediate operational or administrative attention.
6. **AI Qualitative Summary**: Synthesized narrative summaries of unstructured visit notes, teacher comments, and feedback without hallucination.

---

## 📁 Repository Structure

```text
├── docs/                                          # Specifications and Requirements
│   ├── Partner_School_Success_Dashboard_PRD.docx  # Full Product Requirement Document
│   └── Partner School Success Dashboard Data Sources.xlsx # Master Rubric & KPI Workbook
├── DATA_INGESTION_PLAN.md                         # Complete Data Ingestion Architecture & Execution Plan
├── NYSW_DATA_INGESTION_MANUAL.md                  # Non-Technical User Manual for NYSW Staff
├── data/incoming/                                 # Universal Spreadsheet Intake Folder
├── src/                                           # Application & Engine Source Code
│   ├── engine/                                    # Grading engine, clamping, and rescaling logic
│   ├── pipeline/                                  # Ingestion, normalization, and deduplication
│   └── dashboard/                                 # Visual reporting UI and views
├── tests/                                         # Automated verification test suite
│   ├── test_grading_math.py                       # Validates scoring against worked examples
│   └── test_flags.py                              # Tests early-warning trigger edge cases
├── .gitignore                                     # Clean environment filters
└── README.md                                      # Project documentation
```

---

## 📸 End-of-Year Snapshots & Multi-Year Longitudinal Performance Trajectory

The dashboard incorporates a specialized **End-of-Year Snapshot & Longitudinal Trend System** that allows NYSW leadership and operations to archive final school-year performance records and track year-over-year (YoY) growth across multiple academic cycles:

### Key Capabilities:
1. **📸 Freeze & Archive End-of-Year Cohort:**
   - One-click snapshot generator captures all 405 schools, overall scores, letter grades, 3-bucket rubric diagnostics, harvest yields, and active early-warning flags.
   - Customizable school year title (e.g. `SY 2025–2026 (Final)`), archiver names (e.g. `Amanda Low & Megan Roberts`), and qualitative closeout audit notes.
   - Dual persistence: saved locally in the browser and written to disk under `data/snapshots/snapshot_<id>.json` for compliance, audit safety, and backup.

2. **📁 Historical Archive Library & Read-Only Viewing:**
   - An interactive **School Year Selector dropdown** in the navigation bar lets users switch between `SY 2025–2026 (Live Cohort)`, `SY 2024–2025 (Final Archive)`, `SY 2023–2024 (Final Baseline)`, and custom archived snapshots.
   - When an archived year is loaded, a prominent status banner confirms frozen read-only status and provides a 1-click **Return to Live Cohort** button.
   - The entire dashboard—including KPI ribbons, school directory, search filters, and detail drawers—renders the exact historical state of that school year.

3. **📈 Multi-Year Longitudinal Performance Trajectory:**
   - Every school drawer features an interactive **Multi-Year Longitudinal Performance Trajectory** card.
   - Compares up to 3 school years (`SY 2023–2024`, `SY 2024–2025`, `SY 2025–2026`).
   - Surfaces **Year-over-Year (YoY) point deltas** (e.g. `↗️ Significant Growth (+5.8 pts YoY)`, `📈 Steady Growth (+2.4 pts YoY)`, `🚨 High-Risk Decline`), **2-Year Net Growth**, and visual bucket score mini-bars for Maintenance, Engagement, and Admin Support.
   - Enables NYSW to verify program sustainability, measure the long-term impact of field interventions, and provide longitudinal growth narratives to institutional donors and DOE district superintendents.

---

## 📅 Milestones & Timeline

| Date / Phase | Milestone | Deliverable |
|:---|:---|:---|
| **Aug 26, 2026** | Scoping & PRD Workshop | Initial requirements gathered with NYSW leadership |
| **Week 1 (Sept 1–5)** | PRD & Technical Spec Sign-off | Finalized rubric, data inventory, and repo initialization |
| **Week 2 (Sept 8–12)** | Environment & First Slice | Repository structure, data ingestion pipeline, real NYSW data slice |
| **Week 3 (Sept 15–19)** | Core Architecture Checkpoint | End-to-end scoring pipeline functional on real data |
| **Week 5 (Sept 29)** | Midpoint Review | Scoring validation against anchor schools; demo narrative drafted |
| **Week 6 (Oct 6–12)** | Feature Complete | All views, flags, filters, and AI summaries functional |
| **Oct 13–24, 2026** | Client-Assisted UAT | Data sign-off with Megan & Amanda; user acceptance testing |
| **Oct 28, 2026** | **Demo Day at Mizuho Bank** | Live presentation of the working product at Mizuho's NYC offices |

---

## 👥 Stakeholders & Credits

* **Builder**: [Pedro A. Martins, PMP](https://github.com/Pamf1973) — Pursuit Fellow, Mizuho Bank Nonprofit Builder Program
* **Client Partner**: **New York Sun Works (NYSW)**
  * **Megan**: Primary Point of Contact & Program Co-lead
  * **Amanda**: De facto Tech Lead & Technical Co-lead
  * **Nishy & Shabiha**: Stakeholder Advisors & KPI Refinement
  * **Executive Director & Directors**: Organizational Governance & Data Access
* **Program Leadership**: **Stef Barros**, Pursuit Program Lead
* **Corporate Sponsor**: **Mizuho Bank, Ltd.**
