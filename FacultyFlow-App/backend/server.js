/**
 * FacultyFlow API — Node.js + Express + MySQL.
 *
 *   npm install
 *   npm start          → http://127.0.0.1:5000
 *
 * Every database setting comes from backend/.env (see .env.example).
 * Credentials are never sent to the browser: the React app only talks to this
 * HTTP API, and CORS is restricted to the local Vite dev server.
 */

'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// backend/.env wins; a missing file simply means "use the defaults below".
const DOTENV = dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * Precedence: a variable exported in the shell > backend/.env > MySQL defaults.
 * Values coming from .env are marked below so a stray OS-level DB_PASSWORD (a
 * very common Windows setup) can never override the file that ships with the
 * project.
 */
const FROM_FILE = new Set(Object.keys(DOTENV.parsed || {}));
const setting = (name, fallback) => {
  const fromEnv = process.env[name];
  if (fromEnv && !FROM_FILE.has(name)) return fromEnv;
  const fromDotenv = DOTENV.parsed?.[name];
  if (fromDotenv !== undefined) return fromDotenv;
  return fromEnv || fallback;
};

const PORT = Number(setting('PORT', '') || setting('API_PORT', '') || 5000);
const DB_CONFIG = {
  host: setting('DB_HOST', '127.0.0.1'),
  port: Number(setting('DB_PORT', '') || 3306),
  user: setting('DB_USER', 'root'),
  password: setting('DB_PASSWORD', ''),
  database: setting('DB_NAME', 'facultyflow_db'),
  waitForConnections: true,
  connectionLimit: Number(setting('DB_POOL_SIZE', '') || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: ['DATE', 'DATETIME'],
  timezone: setting('DB_TIMEZONE', 'local'),
};

// Managed MySQL instances (Aiven, PlanetScale, …) require TLS: set DB_SSL=true.
if (String(setting('DB_SSL', '')).toLowerCase() === 'true') {
  DB_CONFIG.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(DB_CONFIG);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// The Vite dev server runs on 5173 (or the next free port). Extra origins can be
// added with CORS_ORIGINS="http://127.0.0.1:5174,http://localhost:4173".
// Vite dev server (5173+), `vite preview` (4173) and any extra port the preview
// may be started on (5199 is used by the browser test).
const DEFAULT_ORIGINS = [5173, 5174, 4173, 4174, 5199].flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);
const ALLOWED_ORIGINS = [
  ...DEFAULT_ORIGINS,
  ...String(setting('CORS_ORIGINS', ''))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin, curl, Postman or the test script.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // Refuse quietly: the request gets no CORS headers (the browser blocks it)
      // and the API logs a hint instead of throwing a stack trace.
      console.warn(`[api] Blocked browser origin ${origin} — add it to CORS_ORIGINS in backend/.env`);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const bad = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);
const conflict = (message, extra) => new HttpError(409, message, extra);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

async function insert(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/** Run `fn(connection)` inside one transaction (used where two tables change). */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Wrap an async route so rejections reach the error handler. */
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function str(value, { min = 1, max = 255, label = 'value' } = {}) {
  if (typeof value !== 'string') throw bad(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw bad(`${label} is required`);
  if (trimmed.length > max) throw bad(`${label} must be at most ${max} characters`);
  return trimmed;
}

function optionalStr(value, opts = {}) {
  if (value === undefined || value === null || value === '') return null;
  return str(value, opts);
}

function int(value, { min = -Infinity, max = Infinity, label = 'value', fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) throw bad(`${label} must be a whole number`);
  if (n < min || n > max) throw bad(`${label} must be between ${min} and ${max}`);
  return n;
}

function enumOf(value, allowed, label, fallback) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) throw bad(`${label} must be one of: ${allowed.join(', ')}`);
  return value;
}

function email(value) {
  const e = str(value, { max: 120, label: 'email' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('email must be a valid address');
  return e;
}


const isoDate = (value, label = 'date') => {
  const s = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw bad(`${label} must be a date (YYYY-MM-DD)`);
  }
  return s;
};

const newId = (prefix) => `${prefix}-${crypto.randomBytes(6).toString('hex')}`;

/**
 * Read a field that the React app sends in camelCase (and can also be sent in
 * snake_case). Undefined means "not supplied", so UPDATEs keep the stored value.
 */
const pick = (source, camel, snake = camel) => {
  if (source[camel] !== undefined) return source[camel];
  if (source[snake] !== undefined) return source[snake];
  return undefined;
};

/** Treat empty optional fields on PUT as "keep the stored value". */
const keepIfEmpty = (value, fallback) => (value === undefined || value === '' ? fallback : value);

/**
 * Turn mysql2 errors into readable HTTP errors. The most common ones are a
 * duplicate key (409) and a foreign key violation (409 with an explanation).
 */
function translateDbError(error) {
  if (error instanceof HttpError) return error;
  if (error && error.code === 'ER_DUP_ENTRY') {
    const detail = String(error.sqlMessage || '');
    let message = 'That record already exists';
    if (detail.includes('uq_faculty_email')) message = 'A faculty member with this email already exists';
    else if (detail.includes('uq_student_email')) message = 'A student with this email already exists';
    else if (detail.includes('uq_course_code')) message = 'A course with this code already exists';
    else if (detail.includes('uq_room_name')) message = 'A room with this label already exists';
    else if (detail.includes('uq_tt_')) message = 'That slot is already booked (faculty, room or section clash)';
    else if (detail.includes('PRIMARY')) message = 'A record with this identifier already exists';
    return conflict(message);
  }
  if (error && error.code === 'ER_NO_REFERENCED_ROW_2') {
    return conflict('A referenced record (faculty, course, room or section) does not exist');
  }
  if (error && error.code === 'ER_ROW_IS_REFERENCED_2') {
    return conflict('This record is still used elsewhere; reassign or remove the dependants first');
  }
  if (error && error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return bad('A database constraint rejected these values');
  }
  return error;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get(
  '/api/health',
  route(async (_req, res) => {
    try {
      await query('SELECT 1 AS ok');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      res.status(503).json({
        status: 'degraded',
        database: 'unavailable',
        detail: error.message,
      });
    }
  }),
);

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------

const FACULTY_STATUS = ['Active', 'On leave', 'Inactive'];

const facultySelect = `
  SELECT emp_no, name, department, email, phone, office, designation, max_hours, status
  FROM Faculty`;

function facultyInput(body, existing = null) {
  const keep = (value, field) => (existing ? keepIfEmpty(value, existing[field]) : value);
  const out = {
    name: str(existing ? keep(body.name, 'name') : body.name, { max: 120, label: 'name' }),
    department: str(existing ? keep(body.department, 'department') : body.department, {
      max: 80,
      label: 'department',
    }),
    email: email(existing ? keep(body.email, 'email') : body.email),
    phone: optionalStr(existing ? keep(body.phone, 'phone') : body.phone, { max: 30, label: 'phone' }),
    office: optionalStr(existing ? keep(body.office, 'office') : body.office, { max: 40, label: 'office' }),
    designation: optionalStr(existing ? keep(body.designation, 'designation') : body.designation, {
      max: 60,
      label: 'designation',
    }),
    max_hours: int(existing ? keep(pick(body, 'maxHours', 'max_hours') ?? existing.max_hours, 'max_hours') : pick(body, 'maxHours', 'max_hours'), {
      min: 1,
      max: 40,
      label: 'maxHours',
      fallback: 18,
    }),
    status: enumOf(existing ? keep(body.status, 'status') : body.status, FACULTY_STATUS, 'status', 'Active'),
  };
  return out;
}

app.get(
  '/api/faculty',
  route(async (_req, res) => {
    res.json(await query(`${facultySelect} ORDER BY name`));
  }),
);

app.get(
  '/api/faculty/:empNo',
  route(async (req, res) => {
    const row = await one(`${facultySelect} WHERE emp_no = ?`, [req.params.empNo]);
    if (!row) throw notFound('Faculty not found');
    res.json(row);
  }),
);

app.post(
  '/api/faculty',
  route(async (req, res) => {
    const d = facultyInput(req.body ?? {});
    const empNo = str(req.body?.empNo ?? req.body?.emp_no, { max: 20, label: 'empNo' }).toUpperCase();
    if (!/^[A-Z]{2,5}-\d{3,5}$/.test(empNo)) {
      throw bad('empNo must follow the college format, e.g. CSE-1042');
    }
    await insert(
      `INSERT INTO Faculty (emp_no, name, department, email, phone, office, designation, max_hours, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empNo, d.name, d.department, d.email, d.phone, d.office, d.designation, d.max_hours, d.status],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json(await one(`${facultySelect} WHERE emp_no = ?`, [empNo]));
  }),
);

app.put(
  '/api/faculty/:empNo',
  route(async (req, res) => {
    const empNo = req.params.empNo;
    const existing = await one(`${facultySelect} WHERE emp_no = ?`, [empNo]);
    if (!existing) throw notFound('Faculty not found');
    const d = facultyInput(req.body ?? {}, existing);
    await insert(
      `UPDATE Faculty
          SET name = ?, department = ?, email = ?, phone = ?, office = ?,
              designation = ?, max_hours = ?, status = ?
        WHERE emp_no = ?`,
      [d.name, d.department, d.email, d.phone, d.office, d.designation, d.max_hours, d.status, empNo],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await one(`${facultySelect} WHERE emp_no = ?`, [empNo]));
  }),
);

app.delete(
  '/api/faculty/:empNo',
  route(async (req, res) => {
    const empNo = req.params.empNo;
    if (!(await one('SELECT emp_no FROM Faculty WHERE emp_no = ?', [empNo]))) {
      throw notFound('Faculty not found');
    }
    const periods = await one(
      'SELECT COUNT(*) AS n FROM Timetable WHERE faculty_emp_no = ?',
      [empNo],
    );
    if (Number(periods.n) > 0) {
      throw conflict(
        `This faculty member still teaches ${periods.n} period(s). Reassign or remove those timetable entries first.`,
        { periods: Number(periods.n) },
      );
    }
    await insert('DELETE FROM Faculty WHERE emp_no = ?', [empNo]);
    res.json({ deleted: empNo });
  }),
);

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

const studentSelect = `SELECT student_id, name, email, department, semester, section FROM Student`;

function studentInput(body, existing = null) {
  const keep = (value, field) => (existing ? keepIfEmpty(value, existing[field]) : value);
  return {
    name: str(keep(body.name, 'name'), { max: 120, label: 'name' }),
    email: email(keep(body.email, 'email')),
    department: str(keep(body.department, 'department'), { max: 80, label: 'department' }),
    semester: String(int(keep(body.semester, 'semester'), { min: 1, max: 8, label: 'semester' })),
    section: optionalStr(keep(body.section, 'section'), { max: 20, label: 'section' }),
  };
}

app.get(
  '/api/students',
  route(async (_req, res) => {
    res.json(await query(`${studentSelect} ORDER BY name`));
  }),
);

app.post(
  '/api/students',
  route(async (req, res) => {
    const d = studentInput(req.body ?? {});
    const studentId = str(req.body?.student_id ?? req.body?.studentId, {
      max: 20,
      label: 'student_id',
    }).toUpperCase();
    await insert(
      'INSERT INTO Student (student_id, name, email, department, semester, section) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, d.name, d.email, d.department, d.semester, d.section],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json(await one(`${studentSelect} WHERE student_id = ?`, [studentId]));
  }),
);

app.put(
  '/api/students/:studentId',
  route(async (req, res) => {
    const id = req.params.studentId;
    const existing = await one(`${studentSelect} WHERE student_id = ?`, [id]);
    if (!existing) throw notFound('Student not found');
    const d = studentInput(req.body ?? {}, existing);
    await insert(
      'UPDATE Student SET name = ?, email = ?, department = ?, semester = ?, section = ? WHERE student_id = ?',
      [d.name, d.email, d.department, d.semester, d.section, id],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await one(`${studentSelect} WHERE student_id = ?`, [id]));
  }),
);

app.delete(
  '/api/students/:studentId',
  route(async (req, res) => {
    const result = await insert('DELETE FROM Student WHERE student_id = ?', [req.params.studentId]);
    if (result.affectedRows === 0) throw notFound('Student not found');
    res.json({ deleted: req.params.studentId });
  }),
);

// ---------------------------------------------------------------------------
// Sections (read-only: the timetable validates against them)
// ---------------------------------------------------------------------------

app.get(
  '/api/sections',
  route(async (_req, res) => {
    res.json(
      await query(
        `SELECT s.section_id, s.department, s.semester, s.strength,
                COUNT(st.student_id) AS students
           FROM Section s
           LEFT JOIN Student st ON st.section = s.section_id
          GROUP BY s.section_id, s.department, s.semester, s.strength
          ORDER BY s.section_id`,
      ),
    );
  }),
);

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

const courseSelect = `
  SELECT course_id, code, course_name, department, semester, credits, weekly_hours, faculty_emp_no
  FROM Course`;

function courseInput(body, existing = null) {
  const keep = (value, field) => (existing ? keepIfEmpty(value, existing[field]) : value);
  return {
    code: str(keep(body.code, 'code'), { max: 20, label: 'code' }).toUpperCase(),
    course_name: str(keep(pick(body, 'title', 'course_name'), 'course_name'), {
      max: 160,
      label: 'course title',
    }),
    department: str(keep(body.department, 'department'), { max: 80, label: 'department' }),
    semester: String(int(keep(body.semester, 'semester'), { min: 1, max: 8, label: 'semester' })),
    credits: int(keep(body.credits, 'credits'), { min: 1, max: 8, label: 'credits', fallback: 3 }),
    weekly_hours: int(keep(pick(body, 'weeklyHours', 'weekly_hours'), 'weekly_hours'), {
      min: 1,
      max: 10,
      label: 'weeklyHours',
      fallback: 3,
    }),
    // faculty may be cleared deliberately by sending "" → NULL
    faculty_emp_no: optionalStr(
      body.facultyId !== undefined || body.faculty_emp_no !== undefined
        ? pick(body, 'facultyId', 'faculty_emp_no')
        : existing?.faculty_emp_no,
      { max: 20, label: 'faculty' },
    ),
  };
}

async function assertFacultyExists(empNo) {
  if (!empNo) return null;
  const row = await one('SELECT emp_no FROM Faculty WHERE emp_no = ?', [empNo]);
  if (!row) throw bad(`Faculty ${empNo} does not exist`);
  return empNo;
}

app.get(
  '/api/courses',
  route(async (_req, res) => {
    res.json(await query(`${courseSelect} ORDER BY code`));
  }),
);

app.post(
  '/api/courses',
  route(async (req, res) => {
    const body = req.body ?? {};
    const courseId = body.course_id ?? body.courseId ?? body.id;
    const id = courseId && String(courseId).trim() ? str(courseId, { max: 20, label: 'course_id' }) : newId('course');
    const d = courseInput(body);
    await assertFacultyExists(d.faculty_emp_no);
    await insert(
      `INSERT INTO Course (course_id, code, course_name, department, semester, credits, weekly_hours, faculty_emp_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, d.code, d.course_name, d.department, d.semester, d.credits, d.weekly_hours, d.faculty_emp_no],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json(await one(`${courseSelect} WHERE course_id = ?`, [id]));
  }),
);

app.put(
  '/api/courses/:courseId',
  route(async (req, res) => {
    const id = req.params.courseId;
    const existing = await one(`${courseSelect} WHERE course_id = ?`, [id]);
    if (!existing) throw notFound('Course not found');
    const d = courseInput(req.body ?? {}, existing);
    await assertFacultyExists(d.faculty_emp_no);
    await insert(
      `UPDATE Course SET code = ?, course_name = ?, department = ?, semester = ?, credits = ?,
              weekly_hours = ?, faculty_emp_no = ?
        WHERE course_id = ?`,
      [d.code, d.course_name, d.department, d.semester, d.credits, d.weekly_hours, d.faculty_emp_no, id],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await one(`${courseSelect} WHERE course_id = ?`, [id]));
  }),
);

app.delete(
  '/api/courses/:courseId',
  route(async (req, res) => {
    const id = req.params.courseId;
    if (!(await one('SELECT course_id FROM Course WHERE course_id = ?', [id]))) {
      throw notFound('Course not found');
    }
    // Timetable rows cascade (fk_tt_course ON DELETE CASCADE).
    const removed = await transaction(async (conn) => {
      const [slots] = await conn.execute('SELECT COUNT(*) AS n FROM Timetable WHERE course_id = ?', [id]);
      await conn.execute('DELETE FROM Course WHERE course_id = ?', [id]);
      return Number(slots[0].n);
    });
    res.json({ deleted: id, timetable_entries_removed: removed });
  }),
);

// ---------------------------------------------------------------------------
// Rooms (+ their facilities)
// ---------------------------------------------------------------------------

const ROOM_KINDS = ['Lecture hall', 'Classroom', 'Laboratory'];

async function resourcesFor(roomIds) {
  if (roomIds.length === 0) return new Map();
  const placeholders = roomIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT room_id, resource FROM RoomResource WHERE room_id IN (${placeholders}) ORDER BY resource`,
    roomIds,
  );
  const map = new Map(roomIds.map((id) => [id, []]));
  for (const r of rows) map.get(r.room_id)?.push(r.resource);
  return map;
}

async function fetchRooms(where = '', params = []) {
  const rooms = await query(
    `SELECT room_id, name, building, floor, kind, capacity FROM Room ${where} ORDER BY name`,
    params,
  );
  const resources = await resourcesFor(rooms.map((r) => r.room_id));
  return rooms.map((r) => ({ ...r, resources: resources.get(r.room_id) ?? [] }));
}

async function fetchRoom(roomId) {
  const [room] = await fetchRooms('WHERE room_id = ?', [roomId]);
  return room ?? null;
}

function roomInput(body, existing = null) {
  const keep = (value, field) => (existing ? keepIfEmpty(value, existing[field]) : value);
  return {
    name: str(keep(body.name, 'name'), { max: 40, label: 'room label' }),
    building: str(keep(body.building, 'building'), { max: 40, label: 'building' }),
    floor: optionalStr(keep(body.floor, 'floor'), { max: 20, label: 'floor' }),
    kind: enumOf(keep(body.kind, 'kind'), ROOM_KINDS, 'kind', 'Lecture hall'),
    capacity: int(keep(body.capacity, 'capacity'), { min: 1, max: 500, label: 'capacity', fallback: 40 }),
  };
}

function resourceList(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw bad('resources must be a list of names');
  const seen = new Set();
  const list = [];
  for (const item of value) {
    const name = str(item, { max: 40, label: 'resource' });
    if (!seen.has(name)) {
      seen.add(name);
      list.push(name);
    }
  }
  return list;
}

app.get(
  '/api/rooms',
  route(async (_req, res) => {
    res.json(await fetchRooms());
  }),
);

app.post(
  '/api/rooms',
  route(async (req, res) => {
    const body = req.body ?? {};
    const roomId = body.room_id ?? body.roomId ?? body.id;
    const id = roomId && String(roomId).trim() ? str(roomId, { max: 20, label: 'room_id' }) : newId('room');
    const d = roomInput(body);
    const resources = resourceList(body.resources) ?? [];
    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO Room (room_id, name, building, floor, kind, capacity) VALUES (?, ?, ?, ?, ?, ?)',
        [id, d.name, d.building, d.floor, d.kind, d.capacity],
      );
      for (const resource of resources) {
        await conn.execute('INSERT INTO RoomResource (room_id, resource) VALUES (?, ?)', [id, resource]);
      }
    }).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json(await fetchRoom(id));
  }),
);

app.put(
  '/api/rooms/:roomId',
  route(async (req, res) => {
    const id = req.params.roomId;
    const existing = await fetchRoom(id);
    if (!existing) throw notFound('Room not found');
    const d = roomInput(req.body ?? {}, existing);
    const resources = resourceList(req.body?.resources);
    await transaction(async (conn) => {
      await conn.execute(
        'UPDATE Room SET name = ?, building = ?, floor = ?, kind = ?, capacity = ? WHERE room_id = ?',
        [d.name, d.building, d.floor, d.kind, d.capacity, id],
      );
      if (resources !== null) {
        await conn.execute('DELETE FROM RoomResource WHERE room_id = ?', [id]);
        for (const resource of resources) {
          await conn.execute('INSERT INTO RoomResource (room_id, resource) VALUES (?, ?)', [id, resource]);
        }
      }
    }).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await fetchRoom(id));
  }),
);

app.delete(
  '/api/rooms/:roomId',
  route(async (req, res) => {
    const id = req.params.roomId;
    if (!(await one('SELECT room_id FROM Room WHERE room_id = ?', [id]))) {
      throw notFound('Room not found');
    }
    const used = await one('SELECT COUNT(*) AS n FROM Timetable WHERE room_id = ?', [id]);
    if (Number(used.n) > 0) {
      throw conflict(
        `This room is booked for ${used.n} period(s). Move those lectures to another room first.`,
        { periods: Number(used.n) },
      );
    }
    // RoomResource rows cascade (fk_resource_room ON DELETE CASCADE).
    await insert('DELETE FROM Room WHERE room_id = ?', [id]);
    res.json({ deleted: id });
  }),
);

// ---------------------------------------------------------------------------
// Timetable (+ conflict validation)
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TERMS = ['odd', 'even'];

/** Standard period clock, so callers may omit start/end or only send `period`. */
const PERIOD_CLOCK = {
  1: ['09:00', '10:00'],
  2: ['10:00', '11:00'],
  3: ['11:15', '12:15'],
  4: ['12:15', '13:15'],
  5: ['14:00', '15:00'],
  6: ['15:00', '16:00'],
  7: ['16:15', '17:15'],
  8: ['17:15', '18:15'], // optional extra period (the UI offers 7)
};

const slotSelect = `
  SELECT t.timetable_id, t.day, t.period, TIME_FORMAT(t.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(t.end_time, '%H:%i') AS end_time, t.room_id, t.faculty_emp_no,
         t.course_id, t.section, t.term
    FROM Timetable t`;

/** Find every clash for a proposed slot. `ignoreId` excludes the row being edited. */
async function findConflicts(slot) {
  const clashes = [];
  const params = [slot.term, slot.day, slot.period];
  const exclude = slot.ignoreId ? ' AND t.timetable_id <> ?' : '';
  const base = `t.term = ? AND t.day = ? AND t.period = ?${exclude}`;
  const rest = slot.ignoreId ? [slot.ignoreId] : [];

  const facultyClash = await one(
    `SELECT t.timetable_id, t.section, c.code
       FROM Timetable t JOIN Course c ON c.course_id = t.course_id
      WHERE ${base} AND t.faculty_emp_no = ? LIMIT 1`,
    [...params, ...rest, slot.faculty_emp_no],
  );
  if (facultyClash) {
    clashes.push(
      `Faculty ${slot.faculty_emp_no} is already teaching ${facultyClash.code} to ${facultyClash.section} in this period`,
    );
  }

  const roomClash = await one(
    `SELECT t.timetable_id, t.section, c.code
       FROM Timetable t JOIN Course c ON c.course_id = t.course_id
      WHERE ${base} AND t.room_id = ? LIMIT 1`,
    [...params, ...rest, slot.room_id],
  );
  if (roomClash) {
    clashes.push(`Room ${slot.room_id} is occupied by ${roomClash.code} (${roomClash.section})`);
  }

  const sectionClash = await one(
    `SELECT t.timetable_id, c.code
       FROM Timetable t JOIN Course c ON c.course_id = t.course_id
      WHERE ${base} AND t.section = ? LIMIT 1`,
    [...params, ...rest, slot.section],
  );
  if (sectionClash) {
    clashes.push(`Section ${slot.section} already has ${sectionClash.code} in this period`);
  }

  return clashes;
}

/** Validate the referenced faculty / course / room / section rows exist. */
async function assertSlotRefs(slot) {
  const faculty = await one('SELECT emp_no, status FROM Faculty WHERE emp_no = ?', [slot.faculty_emp_no]);
  if (!faculty) throw bad(`Faculty ${slot.faculty_emp_no} does not exist`);
  if (faculty.status === 'Inactive') throw bad(`${slot.faculty_emp_no} is inactive and cannot be scheduled`);
  const course = await one('SELECT course_id FROM Course WHERE course_id = ?', [slot.course_id]);
  if (!course) throw bad(`Course ${slot.course_id} does not exist`);
  const room = await one('SELECT kind, capacity FROM Room WHERE room_id = ?', [slot.room_id]);
  if (!room) throw bad(`Room ${slot.room_id} does not exist`);
  const section = await one('SELECT section_id, strength FROM Section WHERE section_id = ?', [slot.section]);
  if (!section) throw bad(`Section ${slot.section} does not exist`);
  // Capacity is reported as a warning and rejected only when capacityChecked is
  // requested, because labs routinely share seats between lab batches.
  if (room.kind !== 'Laboratory' && Number(room.capacity) < Number(section.strength)) {
    slot.warnings = [
      `Room ${slot.room_id} seats ${room.capacity}, but section ${slot.section} has ${section.strength} students`,
    ];
  }
}

function slotInput(body, existing = {}) {
  // PUT sends the fields being changed; anything absent keeps its stored value.
  const value = (camel, snake = camel) => pick(body, camel, snake) ?? existing[snake];
  const period = int(value('period'), { min: 1, max: 8, label: 'period' });
  // Period 8 is optional; it may carry explicit times if the college extends the day.
  const clock = PERIOD_CLOCK[period];
  // Only an explicit time overrides the standard clock for that period.
    // A position derived from the top of the hour would silently mislabel the
  // slot (P3 starts at 11:15), so always follow the standard clock.
  const start_time = clock[0];
  const end_time = clock[1];
  if (end_time <= start_time) throw bad('end_time must be after start_time');
  return {
    day: enumOf(value('day'), DAYS, 'day'),
    period,
    start_time,
    end_time,
    room_id: str(value('roomId', 'room_id'), { max: 20, label: 'room_id' }),
    faculty_emp_no: str(value('facultyId', 'faculty_emp_no'), { max: 20, label: 'faculty_emp_no' }),
    course_id: str(value('courseId', 'course_id'), { max: 20, label: 'course_id' }),
    section: str(value('section'), { max: 20, label: 'section' }),
    term: enumOf(value('term'), TERMS, 'term', 'odd'),
  };
}

app.get(
  '/api/timetable',
  route(async (req, res) => {
    const { term, section, faculty, room } = req.query;
    const where = [];
    const params = [];
    if (term) {
      where.push('t.term = ?');
      params.push(enumOf(term, TERMS, 'term'));
    }
    if (section) {
      where.push('t.section = ?');
      params.push(String(section));
    }
    if (faculty) {
      where.push('t.faculty_emp_no = ?');
      params.push(String(faculty));
    }
    if (room) {
      where.push('t.room_id = ?');
      params.push(String(room));
    }
    const sql = `${slotSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
      ORDER BY FIELD(t.day, 'Mon','Tue','Wed','Thu','Fri','Sat'), t.period, t.section`;
    res.json(await query(sql, params));
  }),
);

app.get(
  '/api/timetable/:timetableId',
  route(async (req, res) => {
    const row = await one(`${slotSelect} WHERE t.timetable_id = ?`, [req.params.timetableId]);
    if (!row) throw notFound('Timetable entry not found');
    res.json(row);
  }),
);

app.post(
  '/api/timetable',
  route(async (req, res) => {
    const body = req.body ?? {};
    const slot = slotInput(body);
    const id =
      body.timetable_id ?? body.timetableId ?? body.id
        ? str(body.timetable_id ?? body.timetableId ?? body.id, { max: 40, label: 'timetable_id' })
        : newId('slot');

    await assertSlotRefs(slot);
    const clashes = await findConflicts(slot);
    if (clashes.length > 0) throw conflict('Timetable conflict', { conflicts: clashes });

    await insert(
      `INSERT INTO Timetable (timetable_id, day, period, start_time, end_time, room_id,
                              faculty_emp_no, course_id, section, term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, slot.day, slot.period, slot.start_time, slot.end_time, slot.room_id,
        slot.faculty_emp_no, slot.course_id, slot.section, slot.term],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json({ ...(await one(`${slotSelect} WHERE t.timetable_id = ?`, [id])), warnings: slot.warnings ?? [] });
  }),
);

app.put(
  '/api/timetable/:timetableId',
  route(async (req, res) => {
    const id = req.params.timetableId;
    const existing = await one(`${slotSelect} WHERE t.timetable_id = ?`, [id]);
    if (!existing) throw notFound('Timetable entry not found');
    // slotInput keeps stored values for anything the request does not send and
    // re-derives start/end from the standard clock when the period changes.
    const slot = slotInput(req.body ?? {}, existing);

    await assertSlotRefs(slot);
    const clashes = await findConflicts({ ...slot, ignoreId: id });
    if (clashes.length > 0) throw conflict('Timetable conflict', { conflicts: clashes });

    await insert(
      `UPDATE Timetable SET day = ?, period = ?, start_time = ?, end_time = ?, room_id = ?,
              faculty_emp_no = ?, course_id = ?, section = ?, term = ?
        WHERE timetable_id = ?`,
      [slot.day, slot.period, slot.start_time, slot.end_time, slot.room_id,
        slot.faculty_emp_no, slot.course_id, slot.section, slot.term, id],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await one(`${slotSelect} WHERE t.timetable_id = ?`, [id]));
  }),
);

app.delete(
  '/api/timetable/:timetableId',
  route(async (req, res) => {
    const result = await insert('DELETE FROM Timetable WHERE timetable_id = ?', [req.params.timetableId]);
    if (result.affectedRows === 0) throw notFound('Timetable entry not found');
    res.json({ deleted: req.params.timetableId });
  }),
);

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

const SUB_STATUS = ['Pending', 'Approved', 'Declined', 'Cancelled'];

// mysql2 keys rows by column name and the LAST duplicate wins, so the list of
// substitution ids is aliased `sub_id` — otherwise `timetable_id` overwrites
// the key the API uses to identify the substitution being validated.
const substitutionSelect = `
  SELECT s.substitution_id AS sub_id, s.sub_date, s.reason, s.status, s.original_emp_no,
         s.substitute_emp_no, s.timetable_id, DATE_FORMAT(s.applied_at, '%Y-%m-%d %H:%i') AS applied_at
    FROM Substitution s`;

/** Map the aliased key back to `substitution_id` for API responses. */
const subRow = (row) => {
  if (!row) return row;
  const { sub_id: id, ...rest } = row;
  return { substitution_id: id, ...rest };
};
const subRows = (rows) => rows.map(subRow);
const fetchSubstitution = async (id) => subRow(await one(`${substitutionSelect} WHERE s.substitution_id = ?`, [id]));

/**
 * A substitute cannot cover two lectures on the same date and period, and all
 * lecturer data is derived from the referenced timetable entry.
 */
async function validateSubstitution(d, ignoreId = null) {
  const slot = await one(
    `SELECT timetable_id, faculty_emp_no, day, period, term FROM Timetable WHERE timetable_id = ?`,
    [d.timetable_id],
  );
  if (!slot) throw bad('timetable_id does not refer to a scheduled lecture');
  if (d.substitute_emp_no === slot.faculty_emp_no) {
    throw bad('The substitute must be a different faculty member from the original lecturer');
  }
  const substitute = await one('SELECT emp_no, name, status FROM Faculty WHERE emp_no = ?', [d.substitute_emp_no]);
  if (!substitute) throw bad(`Faculty ${d.substitute_emp_no} does not exist`);
  // Inactive staff (e.g. retired but still on campus) may cover lectures as long
  // as they are not already booked; someone marked On leave cannot.
  if (substitute.status === 'On leave') throw bad(`${substitute.name} is on leave and cannot cover lectures`);
  // A substitute cannot already be teaching this period on the timetable.
  const teaching = await one(
    'SELECT timetable_id FROM Timetable WHERE faculty_emp_no = ? AND term = ? AND day = ? AND period = ?',
    [d.substitute_emp_no, slot.term, slot.day, slot.period],
  );
  if (teaching) throw conflict(`${substitute.name} already teaches a scheduled lecture in ${slot.day} period ${slot.period}`);

  // One approved substitute per date: a lecturer covering a lecture outside the
  // college on a given day cannot also be the nominated cover for another one.
  // The UI enforces the same rule before saving.
  const clash = await one(
    `SELECT s.substitution_id AS sub_id, t.day, t.period
       FROM Substitution s JOIN Timetable t ON t.timetable_id = s.timetable_id
      WHERE s.sub_date = ? AND s.status = 'Approved' AND s.substitute_emp_no = ?
        ${ignoreId ? 'AND s.substitution_id <> ?' : ''}
      LIMIT 1`,
    [d.sub_date, d.substitute_emp_no, ...(ignoreId ? [ignoreId] : [])],
  );
  if (clash) {
    throw conflict(
      `${d.substitute_emp_no} is already covering ${clash.day} period ${clash.period} on ${d.sub_date}`,
      { substitution_id: clash.sub_id },
    );
  }
  return slot;
}

function substitutionInput(body, existing = null) {
  const keep = (value, field) => (existing ? keepIfEmpty(value, existing[field]) : value);
  return {
    sub_date: isoDate(keep(pick(body, 'date', 'sub_date'), 'sub_date'), 'sub_date'),
    reason: str(keep(body.reason, 'reason'), { max: 255, label: 'reason' }),
    // Accepted from the client but always replaced by the timetable's lecturer.
    original_emp_no: existing?.original_emp_no ?? null,
    substitute_emp_no: str(keep(pick(body, 'substituteFacultyId', 'substitute_emp_no'), 'substitute_emp_no'), {
      max: 20,
      label: 'substitute_emp_no',
    }),
    timetable_id: str(keep(pick(body, 'timetableId', 'timetable_id'), 'timetable_id'), {
      max: 40,
      label: 'timetable_id',
    }),
    status: enumOf(keep(body.status, 'status'), SUB_STATUS, 'status', 'Pending'),
  };
}

app.get(
  '/api/substitutions',
  route(async (req, res) => {
    const { status, date, faculty } = req.query;
    const where = [];
    const params = [];
    if (status) {
      where.push('s.status = ?');
      params.push(enumOf(status, SUB_STATUS, 'status'));
    }
    if (date) {
      where.push('s.sub_date = ?');
      params.push(isoDate(date));
    }
    if (faculty) {
      where.push('(s.original_emp_no = ? OR s.substitute_emp_no = ?)');
      params.push(String(faculty), String(faculty));
    }
    const sql = `${substitutionSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
      ORDER BY s.sub_date DESC, s.substitution_id`;
    res.json(subRows(await query(sql, params)));
  }),
);

app.post(
  '/api/substitutions',
  route(async (req, res) => {
    const body = req.body ?? {};
    const d = substitutionInput(body);
    const id =
      body.substitution_id ?? body.substitutionId ?? body.id
        ? str(body.substitution_id ?? body.substitutionId ?? body.id, { max: 24, label: 'substitution_id' })
        : newId('sub');
    const slot = await validateSubstitution(d);
    // The original lecturer always comes from the timetable entry — never the client.
    const original = slot.faculty_emp_no;
    await insert(
      `INSERT INTO Substitution (substitution_id, sub_date, reason, original_emp_no,
                                 substitute_emp_no, timetable_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, d.sub_date, d.reason, original, d.substitute_emp_no, d.timetable_id, d.status],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.status(201).json(await fetchSubstitution(id));
  }),
);

app.put(
  '/api/substitutions/:substitutionId',
  route(async (req, res) => {
    const id = req.params.substitutionId;
    const existing = await fetchSubstitution(id);
    if (!existing) throw notFound('Substitution not found');
    const d = substitutionInput(req.body ?? {}, existing);
    const slot = await validateSubstitution(d, id);
    await insert(
      `UPDATE Substitution SET sub_date = ?, reason = ?, original_emp_no = ?, substitute_emp_no = ?,
              timetable_id = ?, status = ?
        WHERE substitution_id = ?`,
      [d.sub_date, d.reason, slot.faculty_emp_no, d.substitute_emp_no, d.timetable_id, d.status, id],
    ).catch((e) => {
      throw translateDbError(e);
    });
    res.json(await fetchSubstitution(id));
  }),
);

/**
 * Approve or decline cover. Only Approved rows count as live cover in the UI,
 * so the same substitute-clash rule is applied when approving.
 */
app.patch(
  '/api/substitutions/:substitutionId/status',
  route(async (req, res) => {
    const id = req.params.substitutionId;
    const existing = await fetchSubstitution(id);
    if (!existing) throw notFound('Substitution not found');
    const status = enumOf(req.body?.status, ['Approved', 'Declined', 'Cancelled'], 'status');
    if (!status) throw bad('status is required');
    const d = { ...existing, status };
    if (status === 'Approved') await validateSubstitution(d, id);
    await insert('UPDATE Substitution SET status = ? WHERE substitution_id = ?', [status, id]);
    res.json(await fetchSubstitution(id));
  }),
);

app.delete(
  '/api/substitutions/:substitutionId',
  route(async (req, res) => {
    const result = await insert('DELETE FROM Substitution WHERE substitution_id = ?', [
      req.params.substitutionId,
    ]);
    if (result.affectedRows === 0) throw notFound('Substitution not found');
    res.json({ deleted: req.params.substitutionId });
  }),
);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Unknown API endpoint' });
});

app.use((error, _req, res, _next) => {
  const mapped = translateDbError(error);
  if (mapped instanceof HttpError) {
    return res.status(mapped.status).json({ error: mapped.message, ...(mapped.extra ?? {}) });
  }
  if (mapped && (mapped.type === 'entity.parse.failed' || mapped.status === 400)) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error('[api]', error);
  return res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Startup — verify the database before accepting traffic
// ---------------------------------------------------------------------------

async function start() {
  try {
    await query('SELECT 1 AS ok');
    const [{ tables }] = await query(
      `SELECT COUNT(*) AS tables FROM information_schema.tables
        WHERE table_schema = ? AND table_name IN ('Faculty','Course','Timetable','Substitution','Student','Room')`,
      [DB_CONFIG.database],
    );
    if (Number(tables) < 6) {
      console.warn(
        `[api] Database "${DB_CONFIG.database}" is missing tables (${tables}/6). ` +
          'Run backend/schema.sql in MySQL Workbench first.',
      );
    }
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.warn(`[api] Database "${DB_CONFIG.database}" does not exist — run backend/schema.sql first.`);
    } else {
      console.warn(`[api] MySQL is not reachable yet: ${error.message}`);
    }
  }

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`FacultyFlow API listening on http://127.0.0.1:${PORT}`);
    console.log(`Health check: http://127.0.0.1:${PORT}/api/health`);
    console.log(`MySQL: ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) start();

module.exports = { app, pool, start };
