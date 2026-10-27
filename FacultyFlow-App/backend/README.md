# FacultyFlow — Backend (Node.js + Express + MySQL)

REST API for the FacultyFlow React app. It owns every faculty, student, course,
room, timetable and substitution record in MySQL — the browser never talks to the
database directly and never sees a database password.

| Piece | File |
| --- | --- |
| API server | `server.js` |
| Dependency list | `package.json` (`express`, `mysql2`, `cors`, `dotenv`) |
| Database schema + demo data | `schema.sql` |
| Environment template | `.env.example` |
| End-to-end API test | `test-api.js` (`npm test`) |

## 1. Create the database (MySQL Workbench)

1. Open **MySQL Workbench** and connect to your local server.
2. **File → Open SQL Script…** → `facultyflow/backend/schema.sql`.
3. Click **⚡ Execute** (or `Ctrl+Shift+Enter`).

The script drops and recreates `facultyflow_db`, then loads demo data that matches
the frontend seed for **both** semesters: 11 faculty, 8 sections, 5 students,
24 courses, 7 rooms with facilities, ~140 timetable slots and 3 substitutions.
It finishes with a row-count report so you can see what was created.

> ⚠️ The first statement is `DROP DATABASE IF EXISTS facultyflow_db;`.
> Comment it out if you need to keep existing data.

## 2. Install, configure, run (Windows PowerShell)

```powershell
cd facultyflow\backend
npm install
Copy-Item .env.example .env
notepad .env            # set DB_PASSWORD to your MySQL root password
npm start               # → http://127.0.0.1:5000
```

`npm run dev` restarts on file changes. Health check:
<http://127.0.0.1:5000/api/health> → `{ "status": "ok", "database": "connected" }`.

### Environment variables (`backend/.env`)

| Name | Default | Meaning |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | *(empty)* | MySQL password — **never commit** |
| `DB_NAME` | `facultyflow_db` | Database created by `schema.sql` |
| `DB_SSL` | *(off)* | `true` for hosted MySQL that requires TLS |
| `PORT` | `5000` | API port |
| `CORS_ORIGINS` | *(none)* | Extra browser origins, comma separated |

`backend/.env` is listed in `.gitignore`; only `.env.example` is committed. If a
`DB_PASSWORD` is already exported in a PowerShell session, the value in `.env`
still wins, so the project file is always the source of truth.

## 3. Frontend

```powershell
cd facultyflow
npm install
npm run dev             # → http://localhost:5173
```

The footer shows **Connected to MySQL** when the API answers. The API accepts the
Vite dev server on ports 5173/5174 and the preview server on 4173/4174/5199 by
default; for any other port add it to `CORS_ORIGINS` in `.env`.

Optional `facultyflow/.env.local`:

```
VITE_API_URL=http://127.0.0.1:5000/api
# VITE_DISABLE_API=1      # run with no backend at all (offline demo)
```

## Database model (ER)

```
Faculty ──< Course ──< Timetable >── Room ──< RoomResource
   │                      │
   │                      >── Section ──< Student
   └────────< Substitution >── Faculty      (original → substitute)
                            └── Timetable
```

* `Faculty.emp_no`, `Course.course_id`, `Room.room_id`, `Section.section_id`
  and `Student.student_id` are natural primary keys.
* `Timetable` has three UNIQUE keys — `(term, section, day, period)`,
  `(term, faculty_emp_no, day, period)` and `(term, room_id, day, period)` — so MySQL
  itself refuses overlapping bookings.
* `RoomResource` stores the multi-valued facilities list (projector, 40 desktops…).
* Foreign keys: deleting a course cascades its timetable rows; deleting a faculty
  member or room that is still timetabled is blocked (`RESTRICT`).

## API

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity check |
| GET / POST | `/api/faculty` | `empNo` (or `emp_no`) is the key |
| GET / PUT / DELETE | `/api/faculty/:empNo` | delete blocked while teaching |
| GET / POST | `/api/students` | |
| PUT / DELETE | `/api/students/:studentId` | |
| GET | `/api/sections` | read-only, used to validate sections |
| GET / POST | `/api/courses` | |
| PUT / DELETE | `/api/courses/:courseId` | delete cascades timetable rows |
| GET / POST | `/api/rooms` | `resources` array is stored in `RoomResource` |
| PUT / DELETE | `/api/rooms/:roomId` | delete blocked while booked |
| GET / POST | `/api/timetable` | filters: `?term=odd\|even&section=&faculty=&room=` |
| GET / PUT / DELETE | `/api/timetable/:timetableId` | |
| GET / POST | `/api/substitutions` | filters: `?status=&date=&faculty=` |
| PUT / DELETE | `/api/substitutions/:substitutionId` | |
| PATCH | `/api/substitutions/:substitutionId/status` | `{ "status": "Approved" \| "Declined" \| "Cancelled" }` |

All SQL uses parameterised queries. Request bodies accept the frontend's camelCase
names (`empNo`, `maxHours`, `facultyId`, `roomId`, `timetableId`…) and the database's
snake_case names. Errors are JSON: `{ "error": "…" }` with `400` (validation),
`404` (missing), `409` (duplicate / foreign key / conflict) or `500`.

### Timetable validation

`POST` / `PUT /api/timetable` reject faculty, room and section overlaps with **409**:

```json
{
  "error": "Timetable conflict",
  "conflicts": [
    "Faculty CSE-1042 is already teaching CS302 to CSE-2B in this period",
    "Room r1 is occupied by CS302 (CSE-2B)",
    "Section CSE-2B already has CS302 in this period"
  ]
}
```

Start/end times follow the standard period clock (P1 09:00, P2 10:00, P3 11:15,
P4 12:15, P5 14:00, P6 15:00, P7 16:15, P8 17:15), so clients send only `day` and
`period`. A room smaller than the section's strength returns a `warnings` array.

### Substitution rules

The original lecturer is always taken from the timetable entry, never from the
request. The API also refuses to nominate someone who is on leave, who teaches in
that period, or who is already covering another lecture on that date.

## Tests

```powershell
npm start        # terminal 1
npm test         # terminal 2 — 49 checks, creates and deletes its own records
```

The suite exercises every endpoint, the conflict rules and the guarded deletes,
and prints `49 passed, 0 failed`.

## Quick manual check (PowerShell)

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
Invoke-RestMethod http://127.0.0.1:5000/api/faculty | Format-Table emp_no, name

# Conflict check — CSE-1042 already teaches s1 in Monday P1, CSE-2B
$body = @{
  day='Mon'; period=1; roomId='r1'; facultyId='CSE-1042'
  courseId='c1'; section='CSE-2A'; term='odd'
} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:5000/api/timetable -Method Post -Body $body -ContentType 'application/json'
```

## Notes

* There is no authentication; role switching is a frontend demonstration.
* Academic calendar, notifications and institution settings stay in the browser
  (they are presentation data, not part of the timetable database).
* If the API is offline the app still opens with its last copy so you can see the
  UI, but every save is refused with a message instead of pretending to succeed.
