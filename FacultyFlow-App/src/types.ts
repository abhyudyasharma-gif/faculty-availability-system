export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export type FacultyStatus = 'Active' | 'On leave' | 'Inactive'

/** The two teaching terms that each keep their own timetable data set. */
export type TermKey = 'odd' | 'even'

export interface Faculty {
  id: string
  name: string
  initials: string
  empNo: string
  department: string
  designation: string
  email: string
  phone: string
  office: string
  maxHours: number
  status: FacultyStatus
}

export interface Course {
  id: string
  code: string
  title: string
  department: string
  semester: string
  credits: number
  weeklyHours: number
  facultyId: string
}

export interface Room {
  id: string
  name: string
  building: string
  floor: string
  capacity: number
  kind: 'Lecture hall' | 'Classroom' | 'Laboratory'
  resources: string[]
}

export interface Slot {
  id: string
  day: Day
  period: number
  courseId: string
  facultyId: string
  roomId: string
  section: string
  /** Which semester timetable this entry belongs to. Legacy entries default to 'odd'. */
  term?: TermKey
}

/** The fields the timetable form collects; used for create and update calls. */
export type SlotDraftLike = Pick<Slot, 'day' | 'period' | 'courseId' | 'facultyId' | 'roomId' | 'section'>

export interface ChangeLog {
  id: string
  timestamp: string
  action: 'added' | 'updated' | 'removed'
  summary: string
  detail: string
  actor: string
  /** Semester the change belongs to. Legacy entries default to 'odd'. */
  term?: TermKey
}

export interface AppData {
  faculty: Faculty[]
  courses: Course[]
  rooms: Room[]
  slots: Slot[]
  log: ChangeLog[]
}

export interface TermConfig {
  label: string
  academicYear: string
  startDate: string
  endDate: string
}

export interface Settings {
  institution: string
  department: string
  term: string
  maxFacultyHours: number
  maxPeriodsPerDay: number
  showSaturday: boolean
  notifyConflicts: boolean
  /** Semester timetable currently shown across every page. */
  activeTerm: TermKey
  academicYear: string
  /** Editable sample date ranges — kept in Settings rather than hard-coded. */
  terms: Record<TermKey, TermConfig>
}


export type UserRole = 'Admin' | 'HOD' | 'Faculty'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  title: string
  avatar: string
  empOrRollNo: string
  phone?: string
  bio?: string
}

export interface RoomBooking {
  id: string
  roomId: string
  roomName: string
  date: string // YYYY-MM-DD
  period: number
  startTime: string
  endTime: string
  purpose: string
  bookedBy: string
  department: string
  status: 'Confirmed' | 'Pending' | 'Cancelled'
  equipmentRequested: string[]
}

export interface SubstitutionRequest {
  id: string
  /** ER: timetable_id — the lecture this substitution applies to. */
  timetableId?: string
  facultyId: string
  facultyName: string
  substituteFacultyId: string
  substituteFacultyName: string
  day: Day
  period: number
  date: string
  courseCode: string
  section: string
  roomName: string
  reason: string
  status: 'Pending' | 'Approved' | 'Declined' | 'Cancelled'
  appliedAt: string
  term?: TermKey
}

export type SubstitutionStatus = SubstitutionRequest['status']

/** A substitution request before the database assigns its id. */
export type SubstitutionDraft = Omit<SubstitutionRequest, 'id'>

export interface SystemNotification {
  id: string
  title: string
  message: string
  timestamp: string
  read: boolean
  type: 'schedule' | 'room' | 'substitution' | 'system'
  priority: 'low' | 'normal' | 'high'
}

export interface AcademicCalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  endDate?: string
  category: 'Exam' | 'Holiday' | 'Seminar' | 'Workshop' | 'Academic Milestone'
  description: string
  department?: string
  location?: string
  startTime?: string
  endTime?: string
  term?: TermKey
}


