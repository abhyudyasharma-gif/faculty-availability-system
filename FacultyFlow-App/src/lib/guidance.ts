import type { AppData, Settings } from '../types'

/**
 * Plain-language explanations for the rules the scheduler enforces. These
 * mirror the checks in `detectConflicts` — wording only, no new logic.
 */
export function schedulingGuidance(data: AppData, settings: Settings): string[] {
  const notes: string[] = []
  notes.push(`A maximum of ${settings.maxPeriodsPerDay} periods can be scheduled per day.`)
  notes.push('A faculty member, a room and a section can each hold only one lecture per period.')
  notes.push('Faculty on leave or inactive cannot receive new allotments until their status changes.')
  notes.push(`Weekly teaching load is capped at the faculty member's own limit (typically ${settings.maxFacultyHours} periods).`)
  notes.push('Cross-department allotments are flagged unless the course sits in Humanities.')
  const clashProne = data.slots.filter((s) => s.section === 'CSE-2B').length
  if (clashProne > 0) notes.push('Conflicts are recalculated for every section as soon as the timetable changes.')
  return notes
}
