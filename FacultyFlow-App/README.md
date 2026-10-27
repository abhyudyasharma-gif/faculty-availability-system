# FacultyFlow

Faculty availability and timetable management for a college: faculty registry,
student roster, course registry, rooms and labs, the odd/even semester timetable,
faculty workload, the substitution desk and the student portal.

* **Frontend** — React 19 + TypeScript + Vite (`src/`)
* **Backend** — Node.js + Express REST API on MySQL 8, using `express`, `mysql2`,
  `cors` and `dotenv` (`backend/`)
* **No Python** — the API is plain Node.js; the browser never receives database
  credentials.

```
facultyflow/
├─ backend/
│  ├─ server.js          Express API
│  ├─ schema.sql         MySQL schema + demo data (run in MySQL Workbench)
│  ├─ package.json
│  ├─ .env.example       copy to .env and set DB_PASSWORD
│  └─ test-api.js        49-check end-to-end API test
├─ src/                  React application
├─ dist/                 production build (npm run build)
└─ qa/                   Playwright scripts used to verify the UI end to end
```

---

## 1. Create the database (MySQL Workbench)

1. Open **MySQL Workbench** and connect to your local MySQL server.
2. **File → Open SQL Script…** → `facultyflow/backend/schema.sql`.
3. Click **⚡ Execute** (`Ctrl+Shift+Enter`).
4. Refresh **SCHEMAS**: `facultyflow_db` now contains every table and the demo
   data for both semesters.

> ⚠️ The script starts with `DROP DATABASE IF EXISTS facultyflow_db;`. Remove that
> line if you need to keep existing data.

## 2. Start the backend

```powershell
cd facultyflow\backend
npm install
Copy-Item .env.example .env
notepad .env            # set DB_PASSWORD to your MySQL password
npm start
```

The API listens on <http://127.0.0.1:5000>. Check it with
<http://127.0.0.1:5000/api/health> — it should answer
`{ "status": "ok", "database": "connected" }`.

`npm run dev` restarts the server on file changes. Full backend notes are in
[`backend/README.md`](backend/README.md).

## 3. Start the frontend

In a second PowerShell window:

```powershell
cd facultyflow
npm install
npm run dev             # → http://localhost:5173
```

The footer shows **Connected to MySQL** when the API answers; otherwise the app
opens its last local copy but **refuses to pretend a save succeeded**.

### Frontend configuration (optional) — `facultyflow/.env.local`

```
VITE_API_URL=http://127.0.0.1:5000/api
# VITE_DISABLE_API=1      # run with no backend (offline demo)
```

The API allows the Vite dev server (5173/5174) and preview server
(4173/4174/5199). For another port, add it to `CORS_ORIGINS` in `backend/.env`.

## 4. Production build

```powershell
cd facultyflow
npm run build           # type-checks with tsc and writes dist/
npm run preview -- --port 4173   # serves dist/ on http://localhost:4173
```

Because the API only exposes `/api/*`, the static build in `dist/` can be served
by any host; point it at a different API with `VITE_API_URL` at build time.

## What is stored in MySQL

| Screen | Table(s) |
| --- | --- |
| Faculty directory | `Faculty` |
| Student portal | `Student`, `Section` |
| Course registry | `Course` |
| Classrooms & labs | `Room`, `RoomResource` |
| Timetable / drag-and-drop builder | `Timetable` |
| Leave & substitution desk | `Substitution` (+ `Timetable`, `Faculty`) |

Every add, edit and delete on those screens is an API call; the UI updates from
the server's answer and the app reloads the affected collections afterwards.
Timetable saves are validated on the server: a faculty member, room or section can
only appear once per period, per semester, and clashes are shown with the server's
own explanation. Deleting a room or a lecturer who is still timetabled is refused.

Academic calendar entries, notifications and institution settings are presentation
data and remain in the browser.

## Verify everything yourself

```powershell
# Terminal 1
cd facultyflow\backend; npm start

# Terminal 2 — API suite (creates and removes its own rows)
cd facultyflow\backend; npm test
```

The browser flow was verified with Playwright (`qa/qa-db-crud.mjs`): it adds and
edits a lecturer, adds a course and a room, schedules a lecture, attempts a
duplicate that must be rejected, approves a substitution and deletes the lecturer,
checking each change both in the UI and through the API.

## Roles

The role selector (Admin / HOD / Faculty / Student) changes which screens are
shown. It is a frontend demonstration and is not authentication.
