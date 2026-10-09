# 🌿 New York Sun Works — Operational Data Ingestion Manual
## Partner School Success Dashboard & Decision-Support System
**Target Audience:** NYSW Operations Leadership, Program Leads (Megan & Amanda), Field Managers, and Non-Technical Stakeholders.

---

## 📌 1. Executive Summary

This manual provides non-technical instructions for updating and regenerating the **NY Sun Works Partner School Success Dashboard** with new operational data. 

The dashboard ingests **7 operational Excel spreadsheets** across NYC public schools, executes the **100-Point Scoring Engine** across the **3 operational buckets**, evaluates **early-warning alerts**, and automatically synchronizes the live dashboard.

> [!NOTE]
> For the comprehensive engineering architecture, mathematical formulas, and data flow diagrams, see [DATA_INGESTION_PLAN.md](file:///c:/Users/pedro/Documents/PAMF/Pessoal/Professional/AI_Native_Journey/Mizuho%20Bank%20SMB%20Docs/Patner%20School%20Success%20Dashboard/DATA_INGESTION_PLAN.md).

No coding, terminal knowledge, or technical setup is required to run data ingestion.

---

## 🏗️ 2. The Established Intake Folder (Universal for Any Computer)

Regardless of what computer this project runs on, all operational spreadsheets must be placed into the standardized intake folder:

📁 **`data/incoming/`** *(located inside the dashboard project root)*

> [!TIP]
> **Universal Intake Folder:**
> * On any computer, place your 7 operational Excel files into **`data\incoming\`** inside the project folder.
> * Or on your Windows Desktop: Double-click the **`Open NYSW Data Folder`** shortcut to instantly open `data\incoming\`.
> *(Backward Compatibility: The pipeline will also automatically read from `1st slice of data SY 25-26\` if `data/incoming/` is not yet populated).*

### The 7 Operational Data Sources to Place in `data/incoming/`:

| # | Exact File Name | Primary Purpose | Required? |
|:---:|:---|:---|:---:|
| **1** | `Accelo Partner Schools Export.xls` | **Master School Registry:** Canonical DBNs, school names, boroughs, program years, lab types, and installation dates. | **Yes** |
| **2** | `GST Schedule SY 25_26 - Visit Cadence.xlsx` | **Visit Cadence:** Defines expected visit frequencies (Weekly, Twice-weekly, Bi-weekly, Monthly) per school. | **Yes** |
| **3** | `Copy of GST Schedule SY 25_26.xlsx` | **Weekly Schedule & Assigned GSTs:** 53 weekly tabs.<br>• **Column A:** Identifies the assigned Green Scientist Teacher (GST) for that school.<br>• **Monday–Friday Columns:** Tracks scheduled visits for on-time completion scoring ($C1a / C1b$). | **Yes** |
| **4** | `Accelo GST Asset Export Sept-Dec 2025.xlsx` | **Field Support Visit Logs:** Ingests weekly reports, system uptime ($C2$), seedlings ($C9$), pest incidents ($C10$), crop harvests ($C6$), yields in lbs ($C7$), crop varieties, and technician field notes. | **Yes** |
| **5** | `Area Manager Asset Sep-Dec 2025.xlsx` | **Area Manager Observations:** Cleanliness ($C8$), teacher involvement ($T11$), curriculum usage ($T4$), and principal engagement ($A9$). | *Optional* |
| **6** | `HC Performance Asset Sep25-Jun26.xls` | **Health Check Performance Assets:** Custodian involvement ($A3$), lab usability ($C4$), visitor readiness ($C8$), NYSW signage ($C3$), and budget/continuation risk flags. | *Optional* |
| **7** | `Teacher Survey 25_26.xlsx` | **Annual Teacher Satisfaction Survey:** Teacher confidence & curriculum ease ($T1–T3$), and GST staff ratings ($C5$). | *Optional* |

> [!IMPORTANT]
> **Key Rule for Assigned GST:** The dashboard assigns each school's field technician strictly from **Column A** of `Copy of GST Schedule SY 25_26.xlsx`. Ensure GST staff names are maintained in Column A for each scheduled row.

---

## 🚀 3. How to Ingest Data (Two Easy Methods)

### Method A: One-Click Inside the Dashboard (Recommended)

1. Open your dashboard in the browser: **[http://localhost:5173/](http://localhost:5173/)**
2. In the top navigation bar, click the **🔄 Data Ingestion** button.
3. The **Data Ingestion & Pipeline Hub** modal will appear:
   * View the status of the 7 files (green checkmark 🟢 means ready).
   * Review file sizes and last modified timestamps.
4. Click **🚀 Run Data Ingestion Pipeline Now**.
5. The live terminal window will show the progress in real time:
   * Aggregating field visits
   * Calculating 100-point scores
   * Evaluating flags
6. Once complete, the data ingestion window automatically closes and the live dashboard displays all 405 partner schools, updated metrics ribbon, and a green success notification banner!

---

### Method B: Double-Click Desktop Runner (No Browser Needed)

If the dashboard is closed or you want to pre-process data before launching:
1. Open the project folder in Windows File Explorer.
2. Double-click the file:
   👉 **`run_data_ingestion.bat`**
3. A green terminal window will open, automatically verify your Python libraries, execute the pipeline, and report the results:
   * Letter grade distribution (A, B, C, D, F)
   * Status tiers (Thriving, Healthy, Watch, Intervene, At Risk)
   * Early-warning flag counts
4. Press any key to close the window.
5. Double-click **`launch_dashboard.bat`** to start the dashboard server and open your browser!

---

## 📊 4. The 3-Bucket Scoring & Gating Architecture

Every quantitative KPI is calculated with bounded linear interpolation:
$$\text{Score} = \text{Max Points} \times \text{clamp}\left(\frac{\text{Actual} - \text{Floor}}{\text{Target} - \text{Floor}}, 0, 1\right)$$

* **Bucket 1: Classroom Maintenance & GST (42 Pts):** Systems uptime, harvest yield, pest-free visits, seedling presence, and asset completion.
* **Bucket 2: Teacher & Student Engagement (40 Pts):** Curriculum adoption, teacher relationship ratings, training completion, and in-person conversations.
* **Bucket 3: Administration Support (18 Pts):** Maintenance contract acceptance, custodian involvement, and principal engagement.

### Completeness Gate
To protect schools with reporting delays from being penalized:
* **$\ge 85\%$ completeness:** Normal Letter Grade & Tier.
* **70% – 84% completeness:** Marked as **"Provisional"**.
* **$< 70\%$ completeness:** Marked as **"Incomplete"** (freezing penalties until reports are submitted).

---

## 🛠️ 5. Troubleshooting & FAQ

#### Q: What if a new school is added mid-year?
* Ensure the school is listed in `Accelo Partner Schools Export.xls` with its DBN or School Code.
* Add its scheduled visits in `Copy of GST Schedule SY 25_26.xlsx` under the assigned GST's name in Column A.
* Re-run the ingestion pipeline.

#### Q: The Ingestion Hub displays "Missing" for an optional file?
* Optional files (Area Manager, HC Performance, Teacher Survey) are not strictly required. The pipeline will apply neutral midpoint benchmarks for any missing optional file without crashing.

#### Q: How do I know if the pipeline ran successfully?
* Check the bottom summary in the console or modal:
  * Look for: `[SUCCESS] Data ingestion completed successfully!`
  * Verify that `data\cohort.json` has an updated timestamp.

#### Q: Who should I contact for technical questions?
* **Builder:** Pedro A. Martins, PMP ([pedro.martins@pursuit.org](mailto:pedro.martins@pursuit.org))
* **Pursuit Program:** Mizuho Bank Nonprofit Builder Program
