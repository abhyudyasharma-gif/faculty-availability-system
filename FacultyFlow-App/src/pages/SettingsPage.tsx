import { useState } from 'react'
import { DEPARTMENTS, seedSettings } from '../data/seed'
import { SAMPLE_TERMS } from '../data/terms'
import type { AppStore } from '../state/useAppData'
import type { Settings, TermKey } from '../types'
import { ConfirmDialog } from '../components/Modal'
import { Icon } from '../components/Icon'
import { TermSwitch } from '../components/TermSwitch'
import { useToast } from '../components/Toast'

interface SettingsPageProps {
  store: AppStore
}

export function SettingsPage({ store }: SettingsPageProps) {
  const { settings, setSettings, resetData, exportJson, activeTerm, setTerm, terms } = store
  const toast = useToast()
  const [draft, setDraft] = useState<Settings>(settings)
  const [resetOpen, setResetOpen] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setSettings(draft)
    setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    toast.success('Settings saved.')
  }

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'facultyflow-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.info('Backup file downloaded.')
  }

  const updateTerm = (term: TermKey, field: 'startDate' | 'endDate' | 'academicYear' | 'label', value: string) => {
    setDraft((d) => ({
      ...d,
      terms: { ...d.terms, [term]: { ...d.terms[term], [field]: value } },
      ...(field === 'academicYear' ? { [term === d.activeTerm ? 'academicYear' : 'academicYear']: value } : {}),
    }))
  }

  return (
    <div className="page stagger">
      <div className="page-head">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-sub">
            Institution details, semester date ranges, scheduling rules and the data stored in this browser.
          </p>
        </div>
        {savedAt && (
          <span className="saved-note">
            <Icon name="check" size={15} /> Saved at {savedAt}
          </span>
        )}
      </div>

      <form onSubmit={save} className="settings-grid">
        <div className="settings-col">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Academic term</h3>
                <p>The semester currently shown on every page. Dates are editable sample values.</p>
              </div>
            </header>
            <div className="panel-body form" style={{ padding: 0 }}>
              <TermSwitch
                value={draft.activeTerm}
                onChange={(term) =>
                  setDraft((d) => ({
                    ...d,
                    activeTerm: term,
                    term: `${d.terms[term].label} · ${d.terms[term].academicYear}`,
                  }))
                }
              />
              <div className="term-editor">
                {(['odd', 'even'] as TermKey[]).map((key) => (
                  <div key={key} className="term-card">
                    <h4>
                      <Icon name={key === 'odd' ? 'sun' : 'snow'} size={16} />
                      {draft.terms[key].label}
                      {draft.activeTerm === key && <span className="pill pill-ice">Active</span>}
                    </h4>
                    <label className="field">
                      <span>Start date</span>
                      <input type="date" value={draft.terms[key].startDate} onChange={(e) => updateTerm(key, 'startDate', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>End date</span>
                      <input type="date" value={draft.terms[key].endDate} onChange={(e) => updateTerm(key, 'endDate', e.target.value)} />
                    </label>
                  </div>
                ))}
              </div>
              <label className="field">
                <span>Academic year label</span>
                <input
                  value={draft.academicYear}
                  onChange={(e) => setDraft({ ...draft, academicYear: e.target.value })}
                  placeholder="2026–27"
                />
                <em className="field-hint">
                  Sample ranges — verify against the official academic calendar before publishing.
                </em>
              </label>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Institution</h3>
                <p>Shown in the header, printed timetables and reports</p>
              </div>
            </header>
            <div className="form">
              <label className="field">
                <span>College name</span>
                <input value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
              </label>
              <div className="form-row form-row-2">
                <label className="field">
                  <span>Department</span>
                  <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Current semester</span>
                  <select
                    value={draft.activeTerm}
                    onChange={(e) => {
                      const term = e.target.value as TermKey
                      setDraft((d) => ({
                        ...d,
                        activeTerm: term,
                        term: `${d.terms[term].label} · ${d.terms[term].academicYear}`,
                      }))
                    }}
                  >
                    <option value="odd">{draft.terms.odd.label} · {draft.terms.odd.academicYear}</option>
                    <option value="even">{draft.terms.even.label} · {draft.terms.even.academicYear}</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Timetable rules</h3>
                <p>Applied when a lecture is scheduled</p>
              </div>
            </header>
            <div className="form">
              <div className="form-row form-row-2">
                <label className="field">
                  <span>Default weekly maximum</span>
                  <input
                    type="number"
                    min={4}
                    max={30}
                    value={draft.maxFacultyHours}
                    onChange={(e) => setDraft({ ...draft, maxFacultyHours: Number(e.target.value) })}
                  />
                  <em className="field-hint">Periods per faculty member, unless overridden in the directory.</em>
                </label>
                <label className="field">
                  <span>Periods per day</span>
                  <input
                    type="number"
                    min={5}
                    max={7}
                    value={draft.maxPeriodsPerDay}
                    onChange={(e) => setDraft({ ...draft, maxPeriodsPerDay: Number(e.target.value) })}
                  />
                  <em className="field-hint">Includes laboratory double periods.</em>
                </label>
              </div>
              <label className="switch-row">
                <span>
                  <strong>Show Saturday in timetable</strong>
                  <small>Weekend periods appear in the grid and the week strip.</small>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={draft.showSaturday}
                  onChange={(e) => setDraft({ ...draft, showSaturday: e.target.checked })}
                />
              </label>
              <label className="switch-row">
                <span>
                  <strong>Warn about scheduling conflicts</strong>
                  <small>Shows faculty, room and section clashes before saving.</small>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={draft.notifyConflicts}
                  onChange={(e) => setDraft({ ...draft, notifyConflicts: e.target.checked })}
                />
              </label>
            </div>
            <footer className="panel-foot">
              <span className="muted">{dirty ? 'You have unsaved changes.' : 'All settings are up to date.'}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => setDraft(settings)}>
                  Discard
                </button>
                <button type="submit" className="btn btn-primary" disabled={!dirty}>
                  Save settings
                </button>
              </div>
            </footer>
          </section>
        </div>

        <div className="settings-col">


          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Data</h3>
                <p>Faculty, courses, rooms and the timetable are saved in MySQL; this browser keeps an offline copy</p>
              </div>
            </header>
            <div className="data-rows">
              <div className="data-row">
                <div>
                  <strong>Download backup</strong>
                  <p>Exports faculty, courses, rooms, timetable, substitutions and settings as JSON.</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
                  <Icon name="download" size={15} /> Download
                </button>
              </div>
              <div className="data-row">
                <div>
                  <strong>Restore sample data</strong>
                  <p>Replaces the current data with the odd and even semester sample sets.</p>
                </div>
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setResetOpen(true)}>
                  <Icon name="trash" size={15} /> Reset data
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Current term</h3>
                <p>Summary of the active semester</p>
              </div>
            </header>
            <div className="detail-facts">
              <div className="detail-fact">
                <span>Semester</span>
                <strong>{terms[activeTerm].label}</strong>
              </div>
              <div className="detail-fact">
                <span>Academic year</span>
                <strong>{terms[activeTerm].academicYear}</strong>
              </div>
              <div className="detail-fact">
                <span>Start</span>
                <strong>{terms[activeTerm].startDate}</strong>
              </div>
              <div className="detail-fact">
                <span>End</span>
                <strong>{terms[activeTerm].endDate}</strong>
              </div>
            </div>
            <footer className="panel-foot">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTerm(activeTerm === 'odd' ? 'even' : 'odd')}>
                <Icon name={activeTerm === 'odd' ? 'snow' : 'sun'} size={15} /> Switch to {activeTerm === 'odd' ? 'Even' : 'Odd'} now
              </button>
            </footer>
          </section>
        </div>
      </form>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all demo data?"
        message="Faculty, courses, rooms, scheduled lectures, substitutions and calendar events will be replaced with the sample dataset. Download a backup first if you need to keep the current timetable."
        confirmLabel="Reset data"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetData()
          setResetOpen(false)
          setDraft(seedSettings)
          toast.info('Sample data restored.')
        }}
      />

      <p className="stamp-line">
        FacultyFlow · Kavya College of Engineering · sample terms default to {SAMPLE_TERMS.odd.startDate} and{' '}
        {SAMPLE_TERMS.even.startDate}.
      </p>
    </div>
  )
}
