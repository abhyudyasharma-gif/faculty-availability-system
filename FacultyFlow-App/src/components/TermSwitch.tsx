import { Icon } from './Icon'
import type { TermKey } from '../types'
import { TERM_OPTIONS } from '../data/terms'

interface TermSwitchProps {
  value: TermKey
  onChange: (term: TermKey) => void
  compact?: boolean
}

/** Odd / Even semester selector used on the dashboard, timetable and calendar. */
export function TermSwitch({ value, onChange, compact }: TermSwitchProps) {
  return (
    <div className="term-switch" role="radiogroup" aria-label="Semester">
      {TERM_OPTIONS.map((option) => {
        const active = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            className={`term-option${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.key)}
          >
            <Icon name={option.icon} size={17} />
            <span className="term-option-stack">
              <span className="term-option-label">{option.short} Semester</span>
              {!compact && <small>{option.description}</small>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
