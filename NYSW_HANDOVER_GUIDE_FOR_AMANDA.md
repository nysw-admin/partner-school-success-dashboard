# 🌿 NY Sun Works — Partner School Success Dashboard
## Handover & Autonomous Operations Manual for Amanda & Megan (Railway Cloud Edition)

> **Welcome Amanda & Megan!**  
> This guide outlines everything you need to **own, operate, and update the Partner School Success Dashboard completely on your own—without needing a developer.**  
> 
> **No technical background or coding required!** Every task is performed using standard web clicks in your browser.  
> ⏱️ **Initial Setup Time:** ~10 to 12 minutes.  
> 🔄 **Bi-Weekly Data Updates:** ~2 minutes (100% self-service).  
> 🚀 **Platform Architecture:** **GitHub** (Permanent Safe Storage) + **Railway** (High-Speed Cloud Engine).

---

## 📌 Executive Overview: How the Dashboard Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HOW THE DASHBOARD WORKS                         │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│    1. GitHub (Storage)   │   2. Railway (Hosting)   │  3. Your Browser │
│                          │                          │                  │
│  Where the dashboard     │  Runs the dashboard live │  You & Megan     │
│  code & data live safely │  24/7 with instant fast  │  open your saved │
│  under NYSW ownership.   │  loading and zero delay. │  bookmark link!  │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

* **100% NYSW Ownership:** Your team holds the keys to the GitHub code and Railway cloud accounts.
* **Pedro as Backup Admin:** Pedro remains added as an Admin so he can jump in to answer questions or provide maintenance whenever requested.
* **Instant Loading 24/7:** Unlike older free servers that go to sleep after 15 minutes of inactivity and take 40+ seconds to wake up, **Railway keeps your dashboard active 24/7 with millisecond response times.**
* **Universal Access:** Viewable on any Mac, Windows laptop, or iPad without installing any software.

---

## 📋 Table of Contents
1. [Initial Transition: Handover in 5 Simple Steps](#initial-transition-handover-in-5-simple-steps-10-minutes)
2. [⭐ HOW AMANDA UPDATES DATA ON HER OWN (BI-WEEKLY WORKFLOW)](#-how-amanda-updates-data-on-her-own-bi-weekly-workflow)
3. [Day-to-Day Operations & End-of-Year Trend Snapshots](#day-to-day-operations--end-of-year-trend-snapshots)
4. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
5. [Final Handover Checklist](#final-handover-checklist)

---

## Initial Transition: Handover in 5 Simple Steps (~10 minutes)

### Step 1: Create your Free NYSW GitHub Account (3 minutes)
GitHub is NYSW's permanent safe-deposit box for the dashboard code and data backups.
1. Open your web browser (Chrome, Safari, or Edge) and go to: **[https://github.com/signup](https://github.com/signup)**
2. Enter your NYSW work email (e.g. `amanda@nysunworks.org`) and create a password.
3. Choose an operations username (e.g. `nysunworks-ops` or `amanda-nysw`).
4. Type `n` for marketing emails, complete the quick visual human puzzle, and enter the 8-digit verification code sent to your email.
5. Send your new username to Pedro via Slack or email.

### Step 2: Accept Ownership & Re-Add Pedro as Admin (3 minutes)
1. Pedro initiates the transfer from his account to yours.
2. Check your email for **`[GitHub] Transfer repository request`** and click the green button: **"Accept transfer"**.
3. Now add Pedro as Admin so he can support you in the background:
   * Open the repository on GitHub: `https://github.com/<your-username>/partner-school-success-dashboard`
   * Click **Settings** (gear icon ⚙️ along the top navigation bar).
   * In the left sidebar, click **Collaborators** $\rightarrow$ Click the green **"Add people"** button.
   * Type Pedro's username: **`Pamf1973`**, select the role **Admin**, and click **Add to this repository**.

### Step 3: Create your Railway Account via 1-Click with GitHub (1 minute)
Railway is the cloud service that keeps the dashboard running online 24/7.
1. Open your web browser and go to: **[https://railway.com](https://railway.com)**
2. Click **"Log In"** in the top right corner.
3. Click the button: 👉 **"Continue with GitHub"** (one click, no new password needed).
4. Click the green button: **"Authorize Railway"**.

### Step 4: Launch the Live Dashboard on Railway (2 minutes)
1. In Railway, click the purple button: **"+ New Project"**.
2. Select **"Deploy from GitHub repo"**.
3. Select **`partner-school-success-dashboard`** and click **"Deploy Now"**.
4. Railway will automatically build and launch the site in ~60 seconds.
5. Click on the dashboard service box on your screen $\rightarrow$ click the **"Settings"** tab (or **Networking** section).
6. Under **Public Networking**, click **"Generate Domain"**.
7. Railway creates your permanent HTTPS web address, like:  
   🌐 **`https://partner-school-success-dashboard-production.up.railway.app`**

### Step 5: Invite Pedro as Railway Admin for Backup Support (1 minute)
1. In your Railway project, click the **Settings** gear icon in the top right menu.
2. In the left menu, click **Members** $\rightarrow$ click **"Invite Member"**.
3. Type Pedro's handle **`Pamf1973`** (or his email), select **Admin**, and click **"Send Invite"**.

---

## ⭐ HOW AMANDA UPDATES DATA ON HER OWN (BI-WEEKLY WORKFLOW)

> **The Core Rule:** Amanda can update the dashboard completely on her own whenever she receives new partner visit spreadsheets, health checks, or teacher surveys. She does not need Pedro, and she does not need to know any programming.

### 🌐 Where is Amanda doing this?
Amanda does this **entirely inside her normal web browser** (Google Chrome, Safari, or Microsoft Edge) on the GitHub website.  
* She does **NOT** need to open any black coding windows, install Python, or use Git on her computer.  
* It is as simple as attaching a document to an email!

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AMANDA'S 5-CLICK BI-WEEKLY DATA UPDATE                          │
├──────────────────────┬──────────────────────┬──────────────────┬───────────────────────┤
│  1. Open Website     │  2. Click Folders    │  3. Click Add    │  4. Drag & Commit     │
│                      │                      │     File Button  │                       │
│  In Chrome, open     │  Click "data" folder │  Click top-right │  Drag Excel file into │
│  your GitHub repo    │  then click          │  button:         │  dashed box, click    │
│  web address.        │  "incoming" folder.  │  "Add file" ▾    │  green Commit button. │
└──────────────────────┴──────────────────────┴──────────────────┴───────────────────────┘
```

---

### Step-by-Step Visual Walkthrough (Exact Screen Landmarks):

#### Step 1: Open GitHub in your web browser
1. Open Google Chrome (or Safari/Edge).
2. Go to your repository link:  
   **`https://github.com/<your-username>/partner-school-success-dashboard`**  
   *(Tip: Save this GitHub link to your browser bookmarks!)*

#### Step 2: Navigate to the Intake Folder
1. In the middle of the screen, you will see a list of project files with blue folder icons 📁 next to them.
2. Scroll down that list and click directly on the blue folder named:  
   👉 **`data`**
3. The page will reload and show you what is inside. Now click on the blue folder named:  
   👉 **`incoming`**
4. *Visual Check:* You are now in the intake folder! The gray bar just above the file list will read:  
   `partner-school-success-dashboard / data / incoming`

#### Step 3: Find the "Add File" Button in the Top-Right Corner
1. Look directly above the list of files, on the **far right-hand side of the table**.
2. You will see a button labeled:  
   👉 **`Add file ▾`** *(with a small downward arrow)*.
3. Click on **`Add file ▾`**.
4. A small dropdown menu will appear with two choices:
   * *Create new file*
   * *Upload files*
5. Click on:  
   👉 **`Upload files`**

#### Step 4: Drag and Drop Your New Excel Spreadsheet
1. The screen will change to show a large dashed rectangular box with a document icon.
2. Inside the box, it says:  
   **"Drag files here to add them to your repository"** or **"choose your files"**.
3. Simply take your new Excel spreadsheet from your computer desktop or Downloads folder (for example: `Accelo GST Asset Export Jan 2026.xlsx`) and **drag it directly into that dashed box**.  
   *(Or click "choose your files" to pick the file from your computer).*
4. You will see your spreadsheet's name appear below the box with a small green progress bar.

#### Step 5: Save and Launch (The Big Green Button)
1. On that same screen, scroll down to the bottom.
2. You will see a section titled **"Commit changes"**.  
   *(You do NOT need to type anything in the comment boxes—you can leave them blank!)*
3. Click the solid **green button** at the bottom that says:  
   👉 **`Commit changes`**

---

### 🕒 What Happens Next (Automatic Cloud Processing):
* **You are completely done!**
* Behind the scenes, **Railway immediately notices the new file**.
* It runs the calculation engine automatically:
  * **It keeps all 3,974 past visits safe** (nothing is ever erased).
  * It adds the new visit records on top.
  * It automatically skips any duplicate rows.
  * It recalculates the 100-point rubric scores (Engagement, Operations, Sustainability) and early-warning flags for all 405 schools.
* Within **60 seconds**, Railway publishes the updated site.

### 🌐 Where Does Amanda See the Live Results?
1. Open a new tab in your web browser.
2. Click your bookmark for the **Live Dashboard** (`https://...up.railway.app`).
3. Press the browser **Refresh button (the circular arrow ↻ in the top-left of Chrome)**.
4. All the new school data, updated scores, and fresh flags will appear live on screen!

---

### 🔍 What is the "Upload Data" Button on the Dashboard Navbar For?

You will notice an **"Upload Data"** button in the top navigation bar of the live dashboard.

**Think of this button as your "Data Health & Audit Hub":**
1. **Verify Your Update Succeeded:** Click it anytime after uploading to GitHub to confirm your new data was processed. You will see:
   * **Cumulative Visits Count:** Displays the total count of historical visits safely retained (e.g., `3,974+ Cumulative Visits Preserved`).
   * **Last Ingestion Executed:** Shows the exact date and timestamp when Railway processed the latest spreadsheet.
   * **Active Schools:** Confirms all 405 partner schools are loaded and active across the 5 boroughs.
2. **Spreadsheet Checklist:** Shows green status badges confirming that all operational spreadsheets (visits, schedules, surveys) are loaded.
3. **Quick Summary:**
   * **GitHub** is where Amanda **drops the new spreadsheet** so it is saved permanently in NYSW's cloud archive.
   * **The Dashboard Button** is where Amanda and Megan **verify that the data updated successfully** and check the health of their records.

---

### Method 2: The 1-Click Desktop Shortcut (If Working on a Windows Laptop)
If Amanda ever has the project folder saved directly on her local Windows computer:
1. Open your computer's File Explorer and open the project folder.
2. Open the folder: **`data\incoming\`** and paste the new Excel spreadsheet there.
3. Double-click the green file named: **`run_data_ingestion.bat`**.
4. A green window will open for 3 seconds, process all records, and display:  
   `[SUCCESS] DATA INGESTION COMPLETED SUCCESSFULLY!`
5. Done! The local dashboard is immediately updated.

---

## 🛡️ Why This Data Process is 100% Safe

| Worry | How the System Protects Amanda & NYSW |
| :--- | :--- |
| **"Will my new file erase past visits?"** | **NO.** The system uses a persistent accumulator (`historical_visits.json`). It retains all historical records and only appends new visits. |
| **"What if the spreadsheet has duplicate rows?"** | **Automatic Deduplication.** Every visit has a unique fingerprint (School DBN + Visit Date + Staff Name). Duplicate entries are automatically skipped. |
| **"What if I upload the wrong file by mistake?"** | **Full Revision History.** GitHub saves every past version. You can roll back to any previous state with a single click. |
| **"Do I have to type any terminal commands?"** | **NO.** You only use standard drag-and-drop buttons in your web browser. |

---

## Day-to-Day Operations & End-of-Year Trend Snapshots

### 1. Daily / Weekly Dashboard Use:
* **Bookmark the Live Link:** Add your Railway link (e.g., `https://...up.railway.app`) to your browser bookmarks in Chrome or Safari.
* **Share with Leadership:** Share the link with Megan Roberts, Heather Nesle, Spencer, Nishy, or school principals.
* **AI School Copilot:** Click on any school row $\rightarrow$ click **"Ask AI Copilot"** to generate instant executive summaries, intervention emails to principals, and flag explanations.

### 2. End-of-Year Trend Snapshot (Every June):
At the end of each school year, Amanda can freeze the official closeout record:
1. Open the live dashboard.
2. In the top navigation bar, click **"📸 EOY Snapshots"**.
3. Type the label: `SY 2025–2026 (Final Closeout)` and add any audit notes.
4. Click **"💾 Freeze & Save Final Snapshot"**.
5. The system locks that year's final scores into permanent storage. Next year, you can compare multi-year historical trends side-by-side!

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: Can Amanda really do this without Pedro?
**Yes, 100%.** The bi-weekly update process was specifically engineered for non-technical users. Dropping an Excel file into GitHub's web interface requires zero coding knowledge, and Railway handles all building and deploying automatically behind the scenes.

### Q2: What if Amanda ever gets stuck or has a question?
Because Pedro is an **Admin** on your GitHub and Railway accounts, he can log in remotely from anywhere in the world, inspect what happened, and fix it in minutes. You are never left without backup support.

### Q3: What is the cost of running Railway?
Railway includes generous monthly starter credits ($5/month credit). Because this dashboard is extremely lightweight, it consumes less than ~$1/month of resources. It is virtually free or fully covered under standard credits.

### Q4: Can we connect our own web address like `dashboard.nysunworks.org`?
**Yes!** In Railway, click on your dashboard service $\rightarrow$ go to **Settings $\rightarrow$ Networking** $\rightarrow$ click **"Custom Domain"** $\rightarrow$ enter `dashboard.nysunworks.org`. Railway gives you a quick DNS record to give to your IT administrator, and your custom branded URL goes live with free automatic SSL certificates.

### Q5: Can the public see our dashboard?
On GitHub, your repository can be set to **Private** (Settings $\rightarrow$ General $\rightarrow$ Danger Zone $\rightarrow$ Change visibility $\rightarrow$ Private). This keeps the code and raw data accessible only to authorized NYSW team members. On Railway, the dashboard link is unlisted and accessible only to people who have the URL.

---

## 🤝 Final Handover Checklist

| Step | Action Item | Who Does It | Status |
| :---: | :--- | :---: | :---: |
| **1** | Create NYSW GitHub Account & share username with Pedro | Amanda | [ ] Done |
| **2** | Send repository transfer request to Amanda | Pedro | [ ] Done |
| **3** | Accept transfer & re-invite Pedro (`Pamf1973`) as Admin | Amanda | [ ] Done |
| **4** | Sign into Railway using "Continue with GitHub" | Amanda | [ ] Done |
| **5** | Deploy repository & click "Generate Domain" | Amanda | [ ] Done |
| **6** | Invite Pedro as Railway Admin for ongoing support | Amanda | [ ] Done |
| **7** | Amanda tests uploading a sample file to `data/incoming/` on GitHub | Amanda | [ ] Done |
| **8** | Bookmark live dashboard URL & celebrate! 🎉 | Amanda & Megan | [ ] Done |

---
*Created by Pedro A. Martins, PMP — Pursuit Fellow & Mizuho Bank Nonprofit Technology Partner for New York Sun Works.*
