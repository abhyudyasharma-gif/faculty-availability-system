import type {
  AcademicCalendarEvent,
  AppData,
  ChangeLog,
  Course,
  Day,
  Faculty,
  Room,
  RoomBooking,
  Settings,
  Slot,
  SubstitutionRequest,
  SystemNotification,
  UserProfile,
} from '../types'
import { SAMPLE_TERMS, evenSlots, oddExtraSlots, registerOddSlots } from './terms'

function buildSeedSlots(): Slot[] {
  registerOddSlots(seedSlots)
  return [...seedSlots, ...oddExtraSlots(), ...evenSlots()]
}

export { SAMPLE_TERMS } from './terms'

export const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const DAY_NAMES: Record<Day, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
}

export const PERIODS: { period: number; start: string; end: string; label: string }[] = [
  { period: 1, start: '09:00', end: '10:00', label: '09:00 – 10:00' },
  { period: 2, start: '10:00', end: '11:00', label: '10:00 – 11:00' },
  { period: 3, start: '11:15', end: '12:15', label: '11:15 – 12:15' },
  { period: 4, start: '12:15', end: '13:15', label: '12:15 – 13:15' },
  { period: 5, start: '14:00', end: '15:00', label: '14:00 – 15:00' },
  { period: 6, start: '15:00', end: '16:00', label: '15:00 – 16:00' },
  { period: 7, start: '16:15', end: '17:15', label: '16:15 – 17:15' },
]

export const BREAK_AFTER_PERIOD = 4

export const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Humanities']

export const SECTIONS = ['CSE-2A', 'CSE-2B', 'CSE-2C', 'CSE-3A', 'CSE-3B', 'IT-2A', 'IT-3A', 'ECE-3A']

export const STATUS_LABELS = ['Today', 'This week', 'All']

export const seedFaculty: Faculty[] = [
  { id: 'f1', name: 'Dr. Anita Sharma', initials: 'AS', empNo: 'CSE-1042', department: 'Computer Science', designation: 'Associate Professor', email: 'anita.sharma@kce.ac.in', phone: '+91 98765 40112', office: 'C-112', maxHours: 16, status: 'Active' },
  { id: 'f2', name: 'Prof. Rajesh Iyer', initials: 'RI', empNo: 'CSE-1057', department: 'Computer Science', designation: 'Assistant Professor', email: 'rajesh.iyer@kce.ac.in', phone: '+91 98765 40318', office: 'C-208', maxHours: 18, status: 'Active' },
  { id: 'f3', name: 'Dr. Meera Nair', initials: 'MN', empNo: 'CSE-1019', department: 'Computer Science', designation: 'Professor', email: 'meera.nair@kce.ac.in', phone: '+91 98765 40221', office: 'C-105', maxHours: 14, status: 'On leave' },
  { id: 'f4', name: 'Prof. Vikram Desai', initials: 'VD', empNo: 'IT-2033', department: 'Information Technology', designation: 'Assistant Professor', email: 'vikram.desai@kce.ac.in', phone: '+91 98765 40554', office: 'B-206', maxHours: 18, status: 'Active' },
  { id: 'f5', name: 'Dr. Pooja Kulkarni', initials: 'PK', empNo: 'CSE-1078', department: 'Computer Science', designation: 'Assistant Professor', email: 'pooja.kulkarni@kce.ac.in', phone: '+91 98765 40765', office: 'C-210', maxHours: 16, status: 'Active' },
  { id: 'f6', name: 'Prof. Sanjay Patil', initials: 'SP', empNo: 'ECE-3011', department: 'Electronics', designation: 'Assistant Professor', email: 'sanjay.patil@kce.ac.in', phone: '+91 98765 40621', office: 'D-118', maxHours: 16, status: 'Active' },
  { id: 'f7', name: 'Ms. Farah Khan', initials: 'FK', empNo: 'IT-2045', department: 'Information Technology', designation: 'Lecturer', email: 'farah.khan@kce.ac.in', phone: '+91 98765 40812', office: 'B-202', maxHours: 20, status: 'Active' },
  { id: 'f8', name: 'Dr. Arun Menon', initials: 'AM', empNo: 'MECH-4007', department: 'Mechanical', designation: 'Professor', email: 'arun.menon@kce.ac.in', phone: '+91 98765 40903', office: 'E-102', maxHours: 12, status: 'Active' },
  { id: 'f9', name: 'Prof. Nandini Rao', initials: 'NR', empNo: 'CSE-1083', department: 'Computer Science', designation: 'Assistant Professor', email: 'nandini.rao@kce.ac.in', phone: '+91 98765 41024', office: 'C-214', maxHours: 18, status: 'Active' },
  { id: 'f10', name: 'Mr. Karthik Reddy', initials: 'KR', empNo: 'ECE-3026', department: 'Electronics', designation: 'Lecturer', email: 'karthik.reddy@kce.ac.in', phone: '+91 98765 41136', office: 'D-121', maxHours: 20, status: 'Inactive' },
  { id: 'f11', name: 'Ms. Sneha Kamath', initials: 'SK', empNo: 'IT-2051', department: 'Information Technology', designation: 'Assistant Professor', email: 'sneha.kamath@kce.ac.in', phone: '+91 98765 41247', office: 'B-209', maxHours: 18, status: 'Active' },
]

export const seedCourses: Course[] = [
  { id: 'c1', code: 'CS301', title: 'Database Management Systems', department: 'Computer Science', semester: '6', credits: 4, weeklyHours: 4, facultyId: 'f1' },
  { id: 'c2', code: 'CS301P', title: 'DBMS Laboratory', department: 'Computer Science', semester: '6', credits: 2, weeklyHours: 2, facultyId: 'f1' },
  { id: 'c3', code: 'CS302', title: 'Operating Systems', department: 'Computer Science', semester: '6', credits: 4, weeklyHours: 4, facultyId: 'f2' },
  { id: 'c4', code: 'CS303', title: 'Computer Networks', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f5' },
  { id: 'c5', code: 'CS304', title: 'Design & Analysis of Algorithms', department: 'Computer Science', semester: '6', credits: 4, weeklyHours: 4, facultyId: 'f9' },
  { id: 'c6', code: 'CS305', title: 'Software Engineering', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f3' },
  { id: 'c7', code: 'IT201', title: 'Data Structures with C', department: 'Information Technology', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f4' },
  { id: 'c8', code: 'IT202', title: 'Object Oriented Programming', department: 'Information Technology', semester: '4', credits: 3, weeklyHours: 3, facultyId: 'f7' },
  { id: 'c9', code: 'EC201', title: 'Digital Electronics', department: 'Electronics', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f6' },
  { id: 'c10', code: 'ME204', title: 'Thermodynamics', department: 'Mechanical', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f8' },
  { id: 'c11', code: 'HS102', title: 'Technical Communication', department: 'Humanities', semester: '4', credits: 2, weeklyHours: 2, facultyId: 'f3' },
  { id: 'c12', code: 'IT301', title: 'Web Technologies', department: 'Information Technology', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f11' },
  { id: 'c13', code: 'CS306', title: 'Theory of Computation', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f9' },
  // Even-semester curriculum (see terms.ts): kept in the registry so the
  // selected semester always shows its own subjects.
  { id: 'e1', code: 'CS402', title: 'Advanced Database Systems', department: 'Computer Science', semester: '6', credits: 4, weeklyHours: 4, facultyId: 'f1' },
  { id: 'e2', code: 'CS403', title: 'Distributed Computing', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f2' },
  { id: 'e3', code: 'CS404', title: 'Artificial Intelligence', department: 'Computer Science', semester: '6', credits: 4, weeklyHours: 4, facultyId: 'f9' },
  { id: 'e4', code: 'CS405', title: 'Cloud Computing', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f5' },
  { id: 'e5', code: 'CS406P', title: 'AI & Data Laboratory', department: 'Computer Science', semester: '6', credits: 2, weeklyHours: 2, facultyId: 'f9' },
  { id: 'e6', code: 'CS407', title: 'Information Security', department: 'Computer Science', semester: '6', credits: 3, weeklyHours: 3, facultyId: 'f3' },
  { id: 'e7', code: 'IT204', title: 'Java Programming', department: 'Information Technology', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f7' },
  { id: 'e8', code: 'IT205', title: 'Computer Organization', department: 'Information Technology', semester: '4', credits: 3, weeklyHours: 3, facultyId: 'f11' },
  { id: 'e9', code: 'EC204', title: 'Signals & Systems', department: 'Electronics', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f6' },
  { id: 'e10', code: 'ME206', title: 'Fluid Mechanics', department: 'Mechanical', semester: '4', credits: 4, weeklyHours: 4, facultyId: 'f8' },
  { id: 'e11', code: 'HS204', title: 'Professional Ethics', department: 'Humanities', semester: '4', credits: 2, weeklyHours: 2, facultyId: 'f4' },
]

export const seedRooms: Room[] = [
  { id: 'r1', name: 'B-204', building: 'B Block', floor: '2nd floor', capacity: 60, kind: 'Lecture hall', resources: ['Projector', 'Smart board'] },
  { id: 'r2', name: 'B-206', building: 'B Block', floor: '2nd floor', capacity: 60, kind: 'Lecture hall', resources: ['Projector'] },
  { id: 'r3', name: 'B-101', building: 'B Block', floor: '1st floor', capacity: 72, kind: 'Lecture hall', resources: ['Projector', 'Audio system'] },
  { id: 'r4', name: 'C-305', building: 'C Block', floor: '3rd floor', capacity: 48, kind: 'Classroom', resources: ['Whiteboard'] },
  { id: 'r5', name: 'Lab-2', building: 'C Block', floor: '1st floor', capacity: 45, kind: 'Laboratory', resources: ['40 desktops', 'Projector', 'PostgreSQL'] },
  { id: 'r6', name: 'Lab-4', building: 'C Block', floor: '2nd floor', capacity: 40, kind: 'Laboratory', resources: ['36 desktops', 'Linux image'] },
  { id: 'r7', name: 'D-112', building: 'D Block', floor: '1st floor', capacity: 56, kind: 'Classroom', resources: ['Projector'] },
]

export const seedSlots: Slot[] = [
  // Monday — CSE-2B
  { id: 's1', day: 'Mon', period: 1, courseId: 'c1', facultyId: 'f1', roomId: 'r1', section: 'CSE-2B' },
  { id: 's2', day: 'Mon', period: 2, courseId: 'c3', facultyId: 'f2', roomId: 'r1', section: 'CSE-2B' },
  { id: 's3', day: 'Mon', period: 3, courseId: 'c4', facultyId: 'f5', roomId: 'r1', section: 'CSE-2B' },
  { id: 's4', day: 'Mon', period: 4, courseId: 'c5', facultyId: 'f9', roomId: 'r1', section: 'CSE-2B' },
  { id: 's5', day: 'Mon', period: 5, courseId: 'c2', facultyId: 'f1', roomId: 'r5', section: 'CSE-2B' },
  { id: 's6', day: 'Mon', period: 6, courseId: 'c2', facultyId: 'f1', roomId: 'r5', section: 'CSE-2B' },
  // Tuesday — CSE-2B
  { id: 's7', day: 'Tue', period: 1, courseId: 'c3', facultyId: 'f2', roomId: 'r1', section: 'CSE-2B' },
  { id: 's8', day: 'Tue', period: 2, courseId: 'c6', facultyId: 'f3', roomId: 'r1', section: 'CSE-2B' },
  { id: 's9', day: 'Tue', period: 3, courseId: 'c1', facultyId: 'f1', roomId: 'r1', section: 'CSE-2B' },
  { id: 's10', day: 'Tue', period: 5, courseId: 'c4', facultyId: 'f5', roomId: 'r1', section: 'CSE-2B' },
  { id: 's11', day: 'Tue', period: 6, courseId: 'c6', facultyId: 'f3', roomId: 'r1', section: 'CSE-2B' },
  // Wednesday — CSE-2B
  { id: 's12', day: 'Wed', period: 1, courseId: 'c5', facultyId: 'f9', roomId: 'r1', section: 'CSE-2B' },
  { id: 's13', day: 'Wed', period: 2, courseId: 'c1', facultyId: 'f1', roomId: 'r1', section: 'CSE-2B' },
  { id: 's14', day: 'Wed', period: 3, courseId: 'c3', facultyId: 'f2', roomId: 'r1', section: 'CSE-2B' },
  { id: 's15', day: 'Wed', period: 4, courseId: 'c4', facultyId: 'f5', roomId: 'r1', section: 'CSE-2B' },
  { id: 's16', day: 'Wed', period: 5, courseId: 'c6', facultyId: 'f3', roomId: 'r1', section: 'CSE-2B' },
  // Thursday — CSE-2B
  { id: 's17', day: 'Thu', period: 1, courseId: 'c1', facultyId: 'f1', roomId: 'r1', section: 'CSE-2B' },
  { id: 's18', day: 'Thu', period: 2, courseId: 'c5', facultyId: 'f9', roomId: 'r1', section: 'CSE-2B' },
  { id: 's19', day: 'Thu', period: 4, courseId: 'c2', facultyId: 'f1', roomId: 'r5', section: 'CSE-2B' },
  { id: 's20', day: 'Thu', period: 5, courseId: 'c3', facultyId: 'f2', roomId: 'r1', section: 'CSE-2B' },
  { id: 's21', day: 'Thu', period: 7, courseId: 'c11', facultyId: 'f7', roomId: 'r1', section: 'CSE-2B' },
  // Friday — CSE-2B
  { id: 's22', day: 'Fri', period: 2, courseId: 'c5', facultyId: 'f9', roomId: 'r1', section: 'CSE-2B' },
  { id: 's23', day: 'Fri', period: 3, courseId: 'c4', facultyId: 'f5', roomId: 'r1', section: 'CSE-2B' },
  { id: 's24', day: 'Fri', period: 5, courseId: 'c6', facultyId: 'f3', roomId: 'r1', section: 'CSE-2B' },
  { id: 's25', day: 'Fri', period: 7, courseId: 'c1', facultyId: 'f1', roomId: 'r1', section: 'CSE-2B' },
  // Other sections (context for conflict checks)
  { id: 's26', day: 'Mon', period: 1, courseId: 'c7', facultyId: 'f4', roomId: 'r2', section: 'IT-2A' },
  { id: 's27', day: 'Mon', period: 2, courseId: 'c8', facultyId: 'f7', roomId: 'r2', section: 'IT-2A' },
  { id: 's28', day: 'Tue', period: 2, courseId: 'c9', facultyId: 'f6', roomId: 'r7', section: 'ECE-3A' },
  { id: 's29', day: 'Wed', period: 1, courseId: 'c10', facultyId: 'f8', roomId: 'r4', section: 'CSE-3A' },
  { id: 's30', day: 'Thu', period: 2, courseId: 'c7', facultyId: 'f4', roomId: 'r2', section: 'IT-2A' },
  { id: 's31', day: 'Fri', period: 4, courseId: 'c8', facultyId: 'f7', roomId: 'r2', section: 'IT-2A' },

  // CSE-2A — shares B-204 with CSE-2B, so the grid has real, visible gaps
  { id: 's32', day: 'Mon', period: 2, courseId: 'c13', facultyId: 'f9', roomId: 'r4', section: 'CSE-2A' },
  { id: 's33', day: 'Mon', period: 3, courseId: 'c3', facultyId: 'f2', roomId: 'r4', section: 'CSE-2A' },
  { id: 's34', day: 'Mon', period: 5, courseId: 'c4', facultyId: 'f5', roomId: 'r4', section: 'CSE-2A' },
  { id: 's35', day: 'Tue', period: 1, courseId: 'c13', facultyId: 'f9', roomId: 'r4', section: 'CSE-2A' },
  { id: 's36', day: 'Tue', period: 7, courseId: 'c1', facultyId: 'f1', roomId: 'r4', section: 'CSE-2A' },
  { id: 's37', day: 'Tue', period: 4, courseId: 'c2', facultyId: 'f1', roomId: 'r5', section: 'CSE-2A' },
  { id: 's38', day: 'Wed', period: 2, courseId: 'c3', facultyId: 'f2', roomId: 'r4', section: 'CSE-2A' },
  { id: 's39', day: 'Wed', period: 5, courseId: 'c6', facultyId: 'f3', roomId: 'r4', section: 'CSE-2A' },
  { id: 's40', day: 'Thu', period: 1, courseId: 'c13', facultyId: 'f9', roomId: 'r4', section: 'CSE-2A' },
  { id: 's41', day: 'Thu', period: 3, courseId: 'c1', facultyId: 'f1', roomId: 'r4', section: 'CSE-2A' },
  { id: 's42', day: 'Thu', period: 6, courseId: 'c4', facultyId: 'f5', roomId: 'r4', section: 'CSE-2A' },
  { id: 's43', day: 'Fri', period: 2, courseId: 'c6', facultyId: 'f3', roomId: 'r4', section: 'CSE-2A' },
  { id: 's44', day: 'Fri', period: 3, courseId: 'c3', facultyId: 'f2', roomId: 'r4', section: 'CSE-2A' },
  { id: 's45', day: 'Fri', period: 5, courseId: 'c1', facultyId: 'f1', roomId: 'r4', section: 'CSE-2A' },
  { id: 's46', day: 'Mon', period: 4, courseId: 'c12', facultyId: 'f11', roomId: 'r6', section: 'IT-3A' },
]


// Sample change history. The timestamps are fixed demo values (not real user
// activity) and sit inside the odd-semester window from SAMPLE_TERMS.
export const seedLog: ChangeLog[] = [
  { id: 'l1', timestamp: '2026-10-19T08:42:00', action: 'updated', summary: 'CS303 moved to B-204', detail: 'Tuesday P5 · Computer Networks · CSE-2B', actor: 'S. Raghavan', term: 'odd' },
  { id: 'l2', timestamp: '2026-10-18T16:10:00', action: 'added', summary: 'CS301P lab added', detail: 'Thursday P4 · Lab-2 · DBMS Laboratory · CSE-2B', actor: 'S. Raghavan', term: 'odd' },
  { id: 'l3', timestamp: '2026-10-18T11:25:00', action: 'updated', summary: 'Faculty on leave marked', detail: 'Dr. Meera Nair — leave until 24 Oct 2026', actor: 'A. Sharma', term: 'odd' },
  { id: 'l4', timestamp: '2026-10-17T15:05:00', action: 'removed', summary: 'Duplicate slot removed', detail: 'Wednesday P5 · CS302 · CSE-2B (clash with lab)', actor: 'S. Raghavan', term: 'odd' },
  { id: 'l5', timestamp: '2026-10-16T10:32:00', action: 'added', summary: 'HS102 scheduled', detail: 'Thursday P7 · B-204 · Technical Communication', actor: 'A. Sharma', term: 'odd' },
]

export const seedSettings: Settings = {
  institution: 'Kavya College of Engineering',
  department: 'Computer Science & Engineering',
  term: 'Odd Semester · 2026–27',
  maxFacultyHours: 18,
  maxPeriodsPerDay: 7,
  showSaturday: false,
  notifyConflicts: true,
  activeTerm: 'odd',
  academicYear: '2026–27',
  terms: SAMPLE_TERMS,
}

export const seedData: AppData = {
  faculty: seedFaculty,
  courses: seedCourses,
  rooms: seedRooms,
  // Built after the module is initialised so the even-semester grid can avoid
  // the odd-semester lectures above: every section period has one lecture.
  slots: buildSeedSlots(),
  log: seedLog,
}



export const SUBJECT_COLORS = ['blue', 'violet', 'teal', 'amber', 'rose', 'slate', 'green'] as const


export const DEMO_USERS: UserProfile[] = [
  {
    id: 'u-admin',
    name: 'Dr. Vikram Malhotra',
    email: 'admin@kce.ac.in',
    role: 'Admin',
    department: 'University Administration',
    title: 'Dean of Academic Affairs',
    avatar: 'VM',
    empOrRollNo: 'ADM-001',
    phone: '+91 98765 10001',
    bio: 'Oversees overall institution schedules, infrastructure allocations and cross-departmental coordination.',
  },
  {
    id: 'u-hod',
    name: 'Dr. Anita Sharma',
    email: 'hod.cse@kce.ac.in',
    role: 'HOD',
    department: 'Computer Science',
    title: 'Head of Department & Professor',
    avatar: 'AS',
    empOrRollNo: 'CSE-1042',
    phone: '+91 98765 40112',
    bio: 'HOD of Computer Science and Engineering. Manages faculty allotments, room approvals and curriculum planning.',
  },
  {
    id: 'u-faculty',
    name: 'Prof. Rajesh Iyer',
    email: 'rajesh.iyer@kce.ac.in',
    role: 'Faculty',
    department: 'Computer Science',
    title: 'Assistant Professor',
    avatar: 'RI',
    empOrRollNo: 'CSE-1057',
    phone: '+91 98765 40318',
    bio: 'Teaches Operating Systems and Systems Architecture. Active coordinator of Linux & Open Source labs.',
  },
]

export const SEED_BOOKINGS: RoomBooking[] = [
  {
    id: 'bk-1',
    roomId: 'r3',
    roomName: 'B-101',
    date: '2026-10-22',
    period: 4,
    startTime: '12:15',
    endTime: '13:15',
    purpose: 'Guest Lecture: Distributed Systems at Scale',
    bookedBy: 'Dr. Anita Sharma',
    department: 'Computer Science',
    status: 'Confirmed',
    equipmentRequested: ['Projector', 'Audio system'],
  },
  {
    id: 'bk-2',
    roomId: 'r5',
    roomName: 'Lab-2',
    date: '2026-10-23',
    period: 6,
    startTime: '15:00',
    endTime: '16:00',
    purpose: 'ACM Student Chapter Hackathon Mentoring',
    bookedBy: 'Prof. Vikram Desai',
    department: 'Information Technology',
    status: 'Confirmed',
    equipmentRequested: ['40 desktops', 'PostgreSQL', 'Projector'],
  },
  {
    id: 'bk-3',
    roomId: 'r1',
    roomName: 'B-204',
    date: '2026-10-24',
    period: 3,
    startTime: '11:15',
    endTime: '12:15',
    purpose: 'Departmental Faculty Board Meeting',
    bookedBy: 'Dr. Vikram Malhotra',
    department: 'University Administration',
    status: 'Confirmed',
    equipmentRequested: ['Projector', 'Smart board'],
  },
]

export const SEED_SUBSTITUTIONS: SubstitutionRequest[] = [
  {
    id: 'sub-1',
    timetableId: 's8',
    term: 'odd',
    facultyId: 'f3',
    facultyName: 'Dr. Meera Nair',
    substituteFacultyId: 'f9',
    substituteFacultyName: 'Prof. Nandini Rao',
    day: 'Tue',
    period: 2,
    date: '2026-10-27',
    courseCode: 'CS305',
    section: 'CSE-2B',
    roomName: 'B-204',
    reason: 'Attending IEEE International Conference on AI & Systems',
    status: 'Pending',
    appliedAt: '2026-10-20 14:30',
  },
  {
    id: 'sub-2',
    timetableId: 's16',
    term: 'odd',
    facultyId: 'f3',
    facultyName: 'Dr. Meera Nair',
    substituteFacultyId: 'f1',
    substituteFacultyName: 'Dr. Anita Sharma',
    day: 'Wed',
    period: 6,
    date: '2026-10-28',
    courseCode: 'CS305',
    section: 'CSE-2B',
    roomName: 'B-204',
    reason: 'Medical consultation / On leave',
    status: 'Approved',
    appliedAt: '2026-10-19 11:15',
  },
  {
    id: 'sub-3',
    timetableId: 's28',
    term: 'odd',
    facultyId: 'f10',
    facultyName: 'Mr. Karthik Reddy',
    substituteFacultyId: 'f6',
    substituteFacultyName: 'Prof. Sanjay Patil',
    day: 'Fri',
    period: 4,
    date: '2026-10-30',
    courseCode: 'EC201',
    section: 'ECE-3A',
    roomName: 'D-112',
    reason: 'Department Workshop Coordination',
    status: 'Pending',
    appliedAt: '2026-10-21 09:20',
  },
]

export const SEED_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-1',
    title: 'Schedule Change: CS301 Laboratory',
    message: 'DBMS Laboratory for CSE-2B relocated to Lab-2 (1st floor C Block) due to hardware maintenance.',
    timestamp: '10 mins ago',
    read: false,
    type: 'room',
    priority: 'high',
  },
  {
    id: 'notif-2',
    title: 'Substitution Request Awaiting HOD Approval',
    message: 'Dr. Meera Nair nominated Prof. Nandini Rao for CS305 (Tue P2, Room B-204).',
    timestamp: '42 mins ago',
    read: false,
    type: 'substitution',
    priority: 'normal',
  },
  {
    id: 'notif-3',
    title: 'Semester Midterm Examination Schedule Released',
    message: 'Academic Council has published the odd semester midterm evaluation dates commencing Nov 12.',
    timestamp: '2 hours ago',
    read: true,
    type: 'schedule',
    priority: 'normal',
  },
  {
    id: 'notif-4',
    title: 'Classroom B-101 Booking Confirmed',
    message: 'Dean Academic Affairs confirmed B-101 for tomorrow 12:15 PM Guest Lecture.',
    timestamp: '5 hours ago',
    read: true,
    type: 'room',
    priority: 'low',
  },
]

// Every event lies inside its semester's window from SAMPLE_TERMS (data/terms.ts).
// Registration starts on the configured even-semester start date (11 Jan 2027) so
// the calendar and the Settings → Academic term dates never disagree.
export const SEED_CALENDAR_EVENTS: AcademicCalendarEvent[] = [
  {
    id: 'cal-0',
    title: 'Semester commencement',
    date: '2026-07-20',
    category: 'Academic Milestone',
    description: 'Odd semester instruction begins for all B.Tech semesters.',
    term: 'odd',
  },
  {
    id: 'cal-1',
    title: 'Midterm Examination Week',
    date: '2026-11-09',
    endDate: '2026-11-14',
    category: 'Exam',
    description: 'Centralized continuous internal assessment for all B.Tech semesters across campus halls.',
    location: 'B, C & D Block Examination Halls',
    startTime: '09:30',
    endTime: '12:30',
    term: 'odd',
  },
  {
    id: 'cal-2',
    title: 'Deepavali & Festival Break',
    date: '2026-11-01',
    endDate: '2026-11-04',
    category: 'Holiday',
    description: 'University holiday observed. All regular classes and lab sessions remain suspended.',
    term: 'odd',
  },
  {
    id: 'cal-3',
    title: 'National Conference on NextGen Computing (NCNC 2026)',
    date: '2026-10-29',
    endDate: '2026-10-30',
    category: 'Seminar',
    description: 'Keynotes by industry leaders from IEEE and ACM. Paper presentations in Raman Auditorium.',
    department: 'Computer Science & IT',
    location: 'Central Academic Tower Auditorium',
    startTime: '10:00',
    endTime: '16:00',
    term: 'odd',
  },
  {
    id: 'cal-4',
    title: 'Faculty Pedagogy & Curriculum Workshop',
    date: '2026-11-21',
    category: 'Workshop',
    description: 'Hands-on curriculum review and modern outcome-based assessment methodologies.',
    department: 'Academic Development Cell',
    location: 'Ramanujan Seminar Hall, B-101',
    startTime: '14:00',
    endTime: '17:00',
    term: 'odd',
  },
  {
    id: 'cal-5',
    title: 'Last Working Day for Odd Semester',
    date: '2026-12-18',
    category: 'Academic Milestone',
    description: 'Completion of instruction, laboratory practical evaluations and student feedback submission.',
    term: 'odd',
  },
  {
    id: 'cal-6',
    title: 'Even semester registration',
    date: '2027-01-11',
    endDate: '2027-01-14',
    category: 'Academic Milestone',
    description: 'Course registration and elective confirmation for the even semester.',
    location: 'Department Offices',
    term: 'even',
  },
  {
    id: 'cal-7',
    title: 'Republic Day',
    date: '2027-01-26',
    category: 'Holiday',
    description: 'National holiday. Campus offices and academic activities remain closed.',
    term: 'even',
  },
  {
    id: 'cal-8',
    title: 'Even Semester Midterm Assessments',
    date: '2027-03-15',
    endDate: '2027-03-20',
    category: 'Exam',
    description: 'Continuous internal assessment for all even-semester sections.',
    location: 'B, C & D Block Examination Halls',
    startTime: '09:30',
    endTime: '12:30',
    term: 'even',
  },
  {
    id: 'cal-9',
    title: 'Industry Workshop: Cloud & DevOps',
    date: '2027-02-18',
    category: 'Workshop',
    description: 'Hands-on workshop with engineering mentors from the campus industry network.',
    location: 'Lab-2, C Block',
    startTime: '10:00',
    endTime: '13:00',
    term: 'even',
  },
  {
    id: 'cal-10',
    title: 'Research Seminar: Trustworthy AI',
    date: '2027-04-08',
    category: 'Seminar',
    description: 'Invited talk on evaluation and safety for applied machine learning systems.',
    location: 'Raman Auditorium',
    startTime: '11:00',
    endTime: '12:30',
    term: 'even',
  },
  {
    id: 'cal-11',
    title: 'Last working day for even semester',
    date: '2027-05-28',
    category: 'Academic Milestone',
    description: 'Instruction ends; practical evaluations and feedback close.',
    term: 'even',
  },
]
