# 🏡 Land Valuation System

A web application that manages the **complete land valuation process** — from a customer requesting a valuation, to a technical officer inspecting the land, to managers approving the report, and finally the bank viewing the finished report after payment.

Built as a group project by **ZV × FIT – Group 18**.

---

## 📖 About the Project (in simple words)

When someone applies for a **bank loan** using their land as security, the bank needs to know how much that land is really worth. This system handles that whole process online, step by step:

1. A **customer (Loan Applicant)** requests a land valuation.
2. A **Coordinator** registers the applicant, creates a project, and assigns the work.
3. A **Technical Officer** visits the site — records inspection details, marks GPS locations, takes photos, checks nearby land prices, and writes a draft report.
4. **Managers (Level 3 → Level 2 → Level 1)** review the report one stage at a time and approve it.
5. Once **Level 1 locks** the report, the applicant **pays the valuation fee**.
6. After payment, the **Bank** can view the final, official report.

Everyone logs in and only sees the tools meant for their own job.

---

## 👥 User Roles

| Role | What they do |
|------|--------------|
| **Loan Applicant** | Requests a valuation, uploads documents, makes the payment |
| **Coordinator** | Registers applicants & banks, creates projects, assigns technical officers |
| **Technical Officer** | Site inspection, GPS mapping, site photos, nearby-price analysis, writes the draft report |
| **Manager L3 / L2 / L1** | Review the draft report in stages and approve, reject, or lock it |
| **Bank** | Views the finished valuation report |
| **Admin** | Creates the staff accounts (all internal roles) |

---

## 🛠️ Technology Used

**Frontend**
- React 18 + TypeScript
- Vite (dev server & build tool)
- Tailwind CSS (styling)
- React Router (page navigation)
- Leaflet (maps)

**Backend**
- NestJS + TypeScript
- PostgreSQL (database)
- Nodemailer (sending emails)
- bcryptjs (password security)

---

## 📁 Project Structure

The project is split into **two parts** (two GitHub repositories):

```
Land-Valuation-Backend/     → NestJS API server (the "brain" + database)
  src/
    Home_Pages/    → login, contact, public valuation request
    Role_Pages/    → code for each role (coordinator, manager, etc.)
    Common_Pages/  → shared code (database, email, notifications)

Land-Valuation-Frontend/    → React website (what users see and click)
  src/
    Home_Pages/    → homepage, login pages, dashboard
    Role_Pages/    → screens for each role
    Common_Pages/  → shared UI components (buttons, cards, etc.)
```

---

## ✅ Before You Start (Requirements)

Install these on your computer first:

1. **[Node.js](https://nodejs.org/)** (version 18 or newer) — runs the project
2. **[PostgreSQL](https://www.postgresql.org/download/)** — the database (or a free cloud one like [Neon](https://neon.tech) / [Supabase](https://supabase.com))
3. **[Git](https://git-scm.com/)** — to download the code

---

## ⬇️ How to Download the Project

Open a terminal (Command Prompt / PowerShell / Terminal) and run:

```bash
# Download the backend
git clone https://github.com/Valuation-System-Project-ZV-x-FIT-G18/Land-Valuation-Backend.git

# Download the frontend
git clone https://github.com/Valuation-System-Project-ZV-x-FIT-G18/Land-Valuation-Frontend.git
```

> 💡 You need **both** the backend and the frontend to run the full app.

---

## ▶️ How to Run the Project

You will run the **backend** and the **frontend** in **two separate terminals**.

### Step 1 — Set up the Backend

```bash
cd Land-Valuation-Backend

# 1. Install the packages
npm install

# 2. Create a file named  .env  in this folder (see the example below)

# 3. Create the database tables (run this once)
psql "<your DATABASE_URL>" -f schema.sql

# 4. Create the first Admin login
node seed-admin.mjs

# 5. Start the backend
npm run start:dev
```

✅ The backend now runs at **http://localhost:4000/api**

### Step 2 — Set up the Frontend

Open a **new terminal**:

```bash
cd Land-Valuation-Frontend

# 1. Install the packages
npm install

# 2. Start the website
npm run dev
```

✅ The website now runs at **http://localhost:3000**

### Step 3 — Open the App

Go to **http://localhost:3000** in your browser. 🎉

> The frontend automatically sends `/api/...` requests to the backend on port 4000, so you don't need any extra setup.

---

## 🔑 Environment Variables (`.env` file)

The backend needs a `.env` file inside the `Land-Valuation-Backend` folder. Create it and fill in your own values:

```env
# Database connection (from your local PostgreSQL or a cloud provider)
DATABASE_URL=postgresql://user:password@localhost:5432/valuation

# Backend port (optional — defaults to 4000)
PORT=4000

# Email settings (for sending login details & notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-app-password
SMTP_FROM=your-email@gmail.com

# Optional AI features (land description & document reading)
GEMINI_API_KEY=your-gemini-key
OCR_SPACE_API_KEY=your-ocr-key
```

> ⚠️ **Never share or upload your `.env` file** — it holds passwords and secret keys. It is already ignored by Git.

---

## 👤 Default Login

After running `node seed-admin.mjs`, open the **internal login** page and sign in as **Admin**. The default password for the sample accounts is:

```
Test@123
```

Use the **Admin** account to create the other staff logins (Coordinator, Technical Officer, Managers, Bank).

---

## 📜 Useful Commands

**Backend** (`Land-Valuation-Backend`)
| Command | What it does |
|---------|--------------|
| `npm run start:dev` | Run the backend with auto-reload (development) |
| `npm run build` | Build the backend for production |
| `npm run start:prod` | Run the built backend |

**Frontend** (`Land-Valuation-Frontend`)
| Command | What it does |
|---------|--------------|
| `npm run dev` | Run the website (development) |
| `npm run build` | Build the website for production |
| `npm run preview` | Preview the production build |

---

## 👨‍💻 Team — ZV × FIT Group 18

Developed collaboratively, with each member owning specific parts:

| Area | Contributor |
|------|-------------|
| Coordinator | Radhika Narampanawa |
| Bank & Loan Applicant | Pranidi Methmini |
| Managers (L1 / L2 / L3) | Amandi Shanali |
| Technical Officer | Reshani Dilsara |
| Admin, Home & Setup | Chathu Hewage |
| Common / Shared code | Pranidi Methmini |

---

_© 2026 Land Valuation System — ZV × FIT Group 18. For academic purposes._
