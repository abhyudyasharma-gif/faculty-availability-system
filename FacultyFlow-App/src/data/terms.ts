import type { Course, Day, Slot, TermKey, TermConfig } from '../types'

/**
 * Editable sample academic terms. These are demonstration values (not verified
 * official dates) and are configurable from Settings → Academic term.
 */
export const SAMPLE_TERMS: Record<TermKey, TermConfig> = {
  odd: { label: 'Odd Semester', academicYear: '2026–27', startDate: '2026-07-20', endDate: '2026-12-18' },
  even: { label: 'Even Semester', academicYear: '2026–27', startDate: '2027-01-11', endDate: '2027-05-28' },
}

export const TERM_OPTIONS: { key: TermKey; short: string; description: string; icon: 'sun' | 'snow' }[] = [
  { key: 'odd', short: 'Odd', description: 'Semesters 1, 3, 5, 7', icon: 'sun' },
  { key: 'even', short: 'Even', description: 'Semesters 2, 4, 6, 8', icon: 'snow' },
]

/* ------------------------------------------------------------------ */
/* Even-semester curriculum                                           */
/* ------------------------------------------------------------------ */

/** Even-semester subjects. Kept separate from the odd-terms list in seed.ts. */
export const EVEN_COURSES: Course[] = [
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

type Cell = [period: number, courseId: string, facultyId: string, roomId: string]

/** Even-semester lecture grid for each section. */
const EVEN_GRID: Record<string, Record<string, Cell[]>> = {
  'CSE-2B': {
    Mon: [[1, 'e5', 'f9', 'r5'], [2, 'e1', 'f1', 'r1'], [3, 'e2', 'f2', 'r1'], [4, 'e3', 'f9', 'r1'], [5, 'e5', 'f9', 'r5']],
    Tue: [[1, 'e2', 'f2', 'r1'], [2, 'e1', 'f1', 'r1'], [3, 'e6', 'f3', 'r1'], [5, 'e4', 'f5', 'r1']],
    Wed: [[1, 'e1', 'f1', 'r1'], [3, 'e6', 'f3', 'r1'], [4, 'e3', 'f9', 'r1'], [5, 'e4', 'f5', 'r1']],
    Thu: [[1, 'e3', 'f9', 'r1'], [3, 'e5', 'f9', 'r5'], [4, 'e1', 'f1', 'r1'], [5, 'e11', 'f4', 'r1'], [7, 'e2', 'f2', 'r1']],
    Fri: [[1, 'e3', 'f9', 'r1'], [3, 'e1', 'f1', 'r1'], [5, 'e6', 'f3', 'r1'], [7, 'e4', 'f5', 'r1']],
  },
  'CSE-3B': {
    Mon: [[1, 'e11', 'f4', 'r4'], [3, 'e7', 'f7', 'r2'], [5, 'e8', 'f3', 'r4']],
    Tue: [[2, 'e8', 'f11', 'r2'], [4, 'e7', 'f7', 'r2'], [6, 'e9', 'f6', 'r7']],
    Wed: [[2, 'e9', 'f6', 'r7'], [4, 'e7', 'f7', 'r2'], [6, 'e8', 'f11', 'r2']],
    Thu: [[3, 'e6', 'f3', 'r4'], [5, 'e7', 'f7', 'r2'], [7, 'e11', 'f4', 'r4']],
    Fri: [[2, 'e10', 'f8', 'r2'], [5, 'e8', 'f11', 'r2']],
  },
  'IT-2A': {
    Mon: [[4, 'e7', 'f7', 'r2'], [5, 'e8', 'f11', 'r2'], [7, 'e9', 'f6', 'r7']],
    Tue: [[2, 'e7', 'f7', 'r2'], [5, 'e11', 'f4', 'r4']],
    Wed: [[2, 'e8', 'f11', 'r2'], [5, 'e9', 'f6', 'r7']],
    Thu: [[1, 'e10', 'f8', 'r7'], [5, 'e7', 'f7', 'r2']],
    Fri: [[1, 'e8', 'f11', 'r2'], [5, 'e7', 'f7', 'r2']],
  },
}

/** Split a course code into a paper code and a roster section suffix. */
export function rosterSection(courseCode: string): { code: string; section: string; isLab: boolean } {
  const isLab = /P$/i.test(courseCode)
  const code = courseCode.replace(/P$/i, '')
  return { code, section: isLab ? 'Lab roster B' : 'Roster A', isLab }
}

/** Teaching periods in the day, used to look for a free period in the same day. */
export const TEACHING_PERIODS = [1, 2, 3, 4, 5, 6, 7]

/** `section|day|period` keys already used by the odd-semester grid. */
const ODD_TAKEN = new Set<string>()

/**
 * Moves a lecture to a free period of the same day (never the lunch break),
 * which keeps its day, course, faculty and room intact.
 */
export function shiftWithinDay(period: number, offset: number): number {
  const index = Math.max(0, TEACHING_PERIODS.indexOf(period))
  return TEACHING_PERIODS[(index + offset) % TEACHING_PERIODS.length]
}

function buildGridSlots(
  grid: Record<string, Record<string, Cell[]>>,
  term: TermKey,
  idPrefix: string,
  avoid?: Set<string>,
): Slot[] {
  const list: Slot[] = []
  // Periods used by this grid, including lectures shifted to a free period.
  const used = new Set<string>(avoid ?? [])
  for (const [section, days] of Object.entries(grid)) {
    for (const [day, cells] of Object.entries(days)) {
      cells.forEach(([period, courseId, facultyId, roomId], i) => {
        let slotPeriod = period
        if (avoid) {
          const free = TEACHING_PERIODS.map((n) => shiftWithinDay(period, n)).find(
            (p) => !used.has(`${section}|${day}|${p}`),
          )
          if (free !== undefined) slotPeriod = free
        }
        used.add(`${section}|${day}|${slotPeriod}`)
        list.push({
          id: `${idPrefix}-${section}-${day}-${slotPeriod}-${i}`,
          day: day as Day,
          period: slotPeriod,
          courseId,
          facultyId,
          roomId,
          section,
          term,
        })
      })
    }
  }
  return list
}

export function evenSlots(): Slot[] {
  return buildGridSlots(EVEN_GRID, 'even', 'ev', ODD_TAKEN)
}

/* ------------------------------------------------------------------ */
/* Odd-semester lectures for the larger sections                      */
/* ------------------------------------------------------------------ */

const ODD_GRID: Record<string, Record<string, Cell[]>> = {
  'CSE-3A': {
    Mon: [[1, 'c3', 'f2', 'r4'], [3, 'c1', 'f1', 'r4'], [5, 'c12', 'f11', 'r6']],
    Tue: [[2, 'c4', 'f5', 'r4'], [4, 'c13', 'f9', 'r4']],
    Wed: [[1, 'c1', 'f1', 'r4'], [3, 'c2', 'f1', 'r5']],
    Thu: [[2, 'c5', 'f9', 'r4'], [5, 'c3', 'f2', 'r4']],
    Fri: [[1, 'c11', 'f3', 'r4'], [3, 'c12', 'f11', 'r6']],
  },
  'IT-3A': {
    Mon: [[2, 'c12', 'f11', 'r6'], [4, 'c7', 'f4', 'r2']],
    Tue: [[1, 'c8', 'f7', 'r2'], [3, 'c12', 'f11', 'r6']],
    Wed: [[2, 'c7', 'f4', 'r2'], [5, 'c9', 'f6', 'r7']],
    Thu: [[3, 'c8', 'f7', 'r2'], [6, 'c7', 'f4', 'r7']],
    Fri: [[2, 'c9', 'f6', 'r7'], [4, 'c12', 'f11', 'r6']],
  },
  'CSE-2C': {
    Mon: [[2, 'c5', 'f9', 'r3'], [4, 'c6', 'f3', 'r3']],
    Tue: [[1, 'c1', 'f1', 'r3'], [5, 'c4', 'f5', 'r3']],
    Wed: [[3, 'c13', 'f9', 'r3'], [6, 'c3', 'f2', 'r3']],
    Thu: [[2, 'c6', 'f3', 'r3'], [4, 'c2', 'f1', 'r5']],
    Fri: [[1, 'c1', 'f1', 'r3'], [5, 'c5', 'f9', 'r3']],
  },
  'ECE-3A': {
    Mon: [[2, 'c9', 'f6', 'r7'], [4, 'c9', 'f6', 'r7']],
    Tue: [[1, 'c9', 'f6', 'r7'], [5, 'c11', 'f3', 'r7']],
    Wed: [[1, 'c10', 'f8', 'r7'], [5, 'c9', 'f6', 'r7']],
    Thu: [[2, 'c10', 'f8', 'r7'], [6, 'c9', 'f6', 'r7']],
    Fri: [[2, 'c9', 'f6', 'r7'], [6, 'c11', 'f3', 'r7']],
  },
}

export function oddExtraSlots(): Slot[] {
  const list = buildGridSlots(ODD_GRID, 'odd', 'od')
  registerOddSlots(list)
  return list
}

/** Let the even-semester grid dodge the odd-semester lectures defined in seed.ts. */
export function registerOddSlots(slots: Pick<Slot, 'section' | 'day' | 'period'>[]) {
  for (const s of slots) ODD_TAKEN.add(`${s.section}|${s.day}|${s.period}`)
}

/** Sections that run in both semesters (used by the demo filter copy). */
export const SHARED_SECTIONS = ['CSE-2B', 'IT-2A']