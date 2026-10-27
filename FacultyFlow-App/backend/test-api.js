/**
 * End-to-end smoke test for the FacultyFlow API against the real MySQL database.
 *
 *   npm start            (terminal 1)
 *   npm test             (terminal 2)
 *
 * Every record it creates is removed again, so it can run repeatedly. Point it
 * at another server with API_URL=http://127.0.0.1:5000/api.
 */

'use strict';

const BASE = process.env.API_URL || 'http://127.0.0.1:5000/api';

let passed = 0;
const failures = [];

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// Digits only: employee numbers are CSE-#### and generated course codes ZZ###.
const stamp = String(Date.now()).slice(-4);

async function main() {
  console.log(`FacultyFlow API test suite → ${BASE}\n`);

  // ---------------------------------------------------------------- health
  const health = await call('GET', '/health');
  check('GET /health reports a connected database', health.status === 200 && health.data?.database === 'connected', health.data);
  if (health.status !== 200) {
    console.log('\nDatabase not reachable — run backend/schema.sql in MySQL Workbench first.');
    process.exit(1);
  }
  check('GET /health hides database credentials', !/password|DB_/i.test(JSON.stringify(health.data)), health.data);

  // --------------------------------------------------------------- faculty
  const facultyList = await call('GET', '/faculty');
  check('GET /faculty returns the seed roster', facultyList.status === 200 && facultyList.data.length >= 11, facultyList.data?.length);

  const empNo = `CSE-${stamp}`;
  const createdFaculty = await call('POST', '/faculty', {
    empNo,
    name: 'Dr. Test Automation',
    department: 'Computer Science',
    email: `test.${stamp}@kce.ac.in`,
    office: 'C-999',
    designation: 'Assistant Professor',
    maxHours: 16,
    status: 'Active',
  });
  check('POST /faculty creates a row', createdFaculty.status === 201 && createdFaculty.data?.emp_no === empNo, createdFaculty.data);

  const duplicate = await call('POST', '/faculty', {
    empNo,
    name: 'Dr. Duplicate',
    department: 'Computer Science',
    email: `dup.${stamp}@kce.ac.in`,
  });
  check('POST /faculty rejects a duplicate employee number (409)', duplicate.status === 409, duplicate.data);

  const invalidEmail = await call('POST', '/faculty', {
    empNo: `CSE-1${stamp}`,
    name: 'Dr. Bad Email',
    department: 'Computer Science',
    email: 'not-an-email',
  });
  check('POST /faculty validates the email (400)', invalidEmail.status === 400, invalidEmail.data);

  const updatedFaculty = await call('PUT', `/faculty/${encodeURIComponent(empNo)}`, {
    status: 'On leave',
    maxHours: 20,
  });
  check(
    'PUT /faculty updates fields and keeps the rest',
    updatedFaculty.status === 200 &&
      updatedFaculty.data?.status === 'On leave' &&
      updatedFaculty.data?.max_hours === 20 &&
      updatedFaculty.data?.name === 'Dr. Test Automation',
    updatedFaculty.data,
  );

  // --------------------------------------------------------------- students
  const studentId = `TS${stamp}`;
  const student = await call('POST', '/students', {
    student_id: studentId,
    name: 'Test Student',
    email: `student.${stamp}@kce.ac.in`,
    department: 'Computer Science',
    semester: '6',
    section: 'CSE-2B',
  });
  check('POST /students creates a row', student.status === 201 && student.data?.student_id === studentId, student.data);

  const studentUpdate = await call('PUT', `/students/${studentId}`, { section: 'CSE-2A' });
  check(
    'PUT /students updates the section and keeps the name',
    studentUpdate.status === 200 && studentUpdate.data?.section === 'CSE-2A' && studentUpdate.data?.name === 'Test Student',
    studentUpdate.data,
  );

  // ---------------------------------------------------------------- courses
  const course = await call('POST', '/courses', {
    code: `ZZ${stamp}`,
    title: 'API Test Course',
    department: 'Computer Science',
    semester: '6',
    credits: 3,
    weeklyHours: 3,
    facultyId: 'CSE-1042',
  });
  const courseId = course.data?.course_id;
  check('POST /courses creates a row with a generated id', course.status === 201 && Boolean(courseId), course.data);
  check('POST /courses accepts the UI field names', course.data?.course_name === 'API Test Course' && course.data?.weekly_hours === 3, course.data);

  const courseUpdate = await call('PUT', `/courses/${courseId}`, { title: 'API Test Course (edited)', credits: 4 });
  check(
    'PUT /courses updates the title and credits',
    courseUpdate.status === 200 && courseUpdate.data?.course_name.includes('edited') && courseUpdate.data?.credits === 4,
    courseUpdate.data,
  );

  // ------------------------------------------------------------------ rooms
  const room = await call('POST', '/rooms', {
    name: `T-${stamp.slice(0, 3)}`,
    building: 'B Block',
    floor: '1st floor',
    kind: 'Classroom',
    capacity: 50,
    resources: ['Projector', 'Whiteboard'],
  });
  const roomId = room.data?.room_id;
  check('POST /rooms stores its facilities', room.status === 201 && room.data?.resources?.length === 2, room.data);

  const roomUpdate = await call('PUT', `/rooms/${roomId}`, { capacity: 55, resources: ['Projector'] });
  check(
    'PUT /rooms rewrites the facilities',
    roomUpdate.status === 200 && roomUpdate.data?.capacity === 55 && roomUpdate.data?.resources.length === 1,
    roomUpdate.data,
  );

  const roomList = await call('GET', '/rooms');
  check(
    'GET /rooms returns facilities for every room',
    roomList.status === 200 && roomList.data.every((r) => Array.isArray(r.resources)),
    roomList.data?.[0],
  );

  // -------------------------------------------------------------- timetable
  // Friday P8 is unused in the seed data, so these slots always start clean.
  // (Friday P5 and P7 already hold CSE-1042 lectures.)
  const created = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId,
    facultyId: 'CSE-1042',
    courseId,
    section: 'CSE-2A',
    term: 'odd',
  });
  const slotId = created.data?.timetable_id;
  const slotIdSeed = 's8'; // CS305 (CSE-2B), Tue P2 — CSE-1078 teaches then too
  check('POST /timetable creates a free slot', created.status === 201, created.data);
  check('POST /timetable derives the standard clock', created.data?.start_time === '17:15' && created.data?.end_time === '18:15', created.data);

  const facultyClash = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId: 'r2',
    facultyId: 'CSE-1042',
    courseId,
    section: 'CSE-2B',
    term: 'odd',
  });
  check(
    'POST /timetable blocks a faculty clash (409 + conflicts)',
    facultyClash.status === 409 && Array.isArray(facultyClash.data?.conflicts) && facultyClash.data.conflicts.length > 0,
    facultyClash.data,
  );

  const roomClash = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId,
    facultyId: 'CSE-1057',
    courseId,
    section: 'CSE-3B',
    term: 'odd',
  });
  check('POST /timetable blocks a room clash', roomClash.status === 409, roomClash.data);

  const sectionClash = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId: 'r2',
    facultyId: 'CSE-1057',
    courseId,
    section: 'CSE-2A',
    term: 'odd',
  });
  check('POST /timetable blocks a section clash', sectionClash.status === 409, sectionClash.data);

  const movedClash = await call('PUT', `/timetable/${slotId}`, { period: 5 });
  check('PUT /timetable blocks moving into a slot the faculty already teaches', movedClash.status === 409, movedClash.data);

  const invalidPeriod = await call('PUT', `/timetable/${slotId}`, { period: 9 });
  check('PUT /timetable rejects an out-of-range period (400)', invalidPeriod.status === 400, invalidPeriod.data);

  const unknownRoom = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId: 'no-such-room',
    facultyId: 'CSE-1057',
    courseId,
    section: 'CSE-3B',
    term: 'odd',
  });
  check('POST /timetable validates foreign keys (400)', unknownRoom.status === 400, unknownRoom.data);

  const sameSlotOtherTerm = await call('POST', '/timetable', {
    day: 'Fri',
    period: 8,
    roomId,
    facultyId: 'CSE-1042',
    courseId,
    section: 'CSE-2A',
    term: 'even',
  });
  check('POST /timetable allows the same slot in the other semester', sameSlotOtherTerm.status === 201, sameSlotOtherTerm.data);

  const secondSlot = await call('POST', '/timetable', {
    day: 'Fri',
    period: 6,
    roomId: 'r2',
    facultyId: 'CSE-1042',
    courseId,
    section: 'CSE-3B',
    term: 'odd',
  });
  check('POST /timetable accepts a second lecture in another period', secondSlot.status === 201, secondSlot.data);

  const filtered = await call('GET', '/timetable?term=odd&section=CSE-2A');
  check(
    'GET /timetable filters by term + section',
    filtered.status === 200 && filtered.data.length > 0 && filtered.data.every((s) => s.term === 'odd' && s.section === 'CSE-2A'),
    filtered.data?.length,
  );

  // ----------------------------------------------------------- substitutions
  const sub = await call('POST', '/substitutions', {
    date: '2026-11-10',
    reason: 'API test cover',
    substituteFacultyId: 'CSE-1078',
    timetableId: slotId,
  });
  const subId = sub.data?.substitution_id;
  check(
    'POST /substitutions takes the original lecturer from the timetable',
    sub.status === 201 && sub.data?.status === 'Pending' && sub.data?.original_emp_no === 'CSE-1042',
    sub.data,
  );

  const selfSub = await call('PUT', `/substitutions/${subId}`, { substituteFacultyId: 'CSE-1042' });
  check('PUT /substitutions rejects the original lecturer as substitute (400)', selfSub.status === 400, selfSub.data);

  const approved = await call('PATCH', `/substitutions/${subId}/status`, { status: 'Approved' });
  check('PATCH /substitutions/:id/status approves', approved.status === 200 && approved.data?.status === 'Approved', approved.data);

  // The covered lecture is Fri P8 and the second lecture Fri P7: one substitute
  // cannot take both on the same date at all, so POST must be refused.
  const doubleBook = await call('POST', '/substitutions', {
    date: '2026-11-10',
    reason: 'Same date, another period',
    substituteFacultyId: 'CSE-1078',
    timetableId: slotId,
    status: 'Approved',
  });
  check('POST /substitutions blocks a substitute already covering that date', doubleBook.status === 409, doubleBook.data);

  // The seed lecture s42 (CS303, CSE-2A) runs Fri P6 and CSE-1078 teaches it, so\n  // they cannot be nominated to cover the Fri P8 lecture the same day.
  const teachingSub = await call('POST', '/substitutions', {
    date: '2026-11-11',
    reason: 'Substitute already teaches then',
    substituteFacultyId: 'CSE-1078',
    timetableId: slotIdSeed,
  });
  check('GET /substitutions returns rows keyed by substitution_id', (await call('GET', '/substitutions')).data?.every((s) => s.substitution_id && s.timetable_id), 'id collision');
  check('POST /substitutions rejects a substitute who teaches that period (409)', teachingSub.status === 409, teachingSub.data);

  const onLeaveSub = await call('POST', '/substitutions', {
    date: '2026-11-12',
    reason: 'Substitute is on leave',
    substituteFacultyId: 'CSE-1019',
    timetableId: slotId,
  });
  check('POST /substitutions rejects a substitute who is on leave (400)', onLeaveSub.status === 400, onLeaveSub.data);

  const placeholders = await call('POST', '/substitutions', {
    date: '2026-11-13',
    reason: 'Department workshop cover',
    substituteFacultyId: 'ECE-3026',
    timetableId: slotId,
  });
  check('POST /substitutions accepts an inactive part-time substitute', placeholders.status === 201, placeholders.data);
  if (placeholders.data?.substitution_id) await call('DELETE', `/substitutions/${placeholders.data.substitution_id}`);

  const pendingCover = await call('POST', '/substitutions', {
    date: '2026-11-10',
    reason: 'Pending cover for a later check',
    substituteFacultyId: 'CSE-1083',
    timetableId: slotId,
  });
  check('POST /substitutions accepts pending cover', pendingCover.status === 201, pendingCover.data);

  check('GET /substitutions returns rows keyed by substitution_id', (await call('GET', '/substitutions')).data?.every((s) => s.substitution_id && s.timetable_id), 'id collision');
  // Patching with a timetable id must not find a substitution by accident.
  const wrongId = await call('PATCH', `/substitutions/${slotId}/status`, { status: 'Approved' });
  check('PATCH looks up the substitution by its own id (not the slot id)', wrongId.status === 404, wrongId.data);
  const pendingApproved = await call('PATCH', `/substitutions/${pendingCover.data?.substitution_id}/status`, { status: 'Approved' });
  check('PATCH approval succeeds for a clean pending request', pendingApproved.status === 200, pendingApproved.data);
  if (pendingCover.data?.substitution_id) await call('DELETE', `/substitutions/${pendingCover.data.substitution_id}`);

  const subUpdate = await call('PUT', `/substitutions/${subId}`, { reason: 'API test cover (edited)' });
  check(
    'PUT /substitutions updates the reason and keeps the date',
    subUpdate.status === 200 && subUpdate.data?.reason.includes('edited') && subUpdate.data?.sub_date === '2026-11-10',
    subUpdate.data,
  );

  const cancelled = await call('PATCH', `/substitutions/${subId}/status`, { status: 'Cancelled' });
  check('PATCH /substitutions/:id/status cancels', cancelled.status === 200 && cancelled.data?.status === 'Cancelled', cancelled.data);

  // ------------------------------------------------------ guarded deletes
  const facultyDelete = await call('DELETE', `/faculty/${encodeURIComponent(empNo)}`);
  check('DELETE /faculty removes a lecturer with no lectures', facultyDelete.status === 200, facultyDelete.data);

  const missingFaculty = await call('GET', `/faculty/${encodeURIComponent(empNo)}`);
  check('GET /faculty/:empNo returns 404 after deletion', missingFaculty.status === 404, missingFaculty.data);

  const roomDeleteInUse = await call('DELETE', '/rooms/r1');
  check('DELETE /rooms blocks a room that is still timetabled (409)', roomDeleteInUse.status === 409, roomDeleteInUse.data);

  const facultyDeleteInUse = await call('DELETE', '/faculty/CSE-1042');
  check('DELETE /faculty blocks a lecturer who still teaches (409)', facultyDeleteInUse.status === 409, facultyDeleteInUse.data);

  const missingSlot = await call('GET', '/timetable/does-not-exist');
  check('GET /timetable/:id returns 404 for an unknown slot', missingSlot.status === 404, missingSlot.data);

  const unknownPath = await call('GET', '/not-a-route');
  check('Unknown API paths return JSON 404', unknownPath.status === 404 && typeof unknownPath.data?.error === 'string', unknownPath.data);

  // --------------------------------------------------------------- cleanup
  await call('DELETE', `/substitutions/${subId}`);
  for (const id of [slotId, secondSlot.data?.timetable_id, sameSlotOtherTerm.data?.timetable_id]) {
    if (id) await call('DELETE', `/timetable/${id}`);
  }
  const courseDelete = await call('DELETE', `/courses/${courseId}`);
  check('DELETE /courses reports the timetable rows it released', courseDelete.status === 200, courseDelete.data);
  await call('DELETE', `/rooms/${roomId}`);
  await call('DELETE', `/students/${studentId}`);

  const leftover = await call('GET', `/timetable?section=CSE-2A&room=${roomId}`);
  check('Cleanup removed every test timetable row', leftover.status === 200 && leftover.data.length === 0, leftover.data?.length);

  const finalFaculty = await call('GET', '/faculty');
  check('Cleanup restored the seed roster', finalFaculty.data?.length === facultyList.data.length, finalFaculty.data?.length);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
