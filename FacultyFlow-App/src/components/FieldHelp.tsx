import { useId, useRef, useState } from 'react'
import { Icon } from './Icon'

interface FieldHelpProps {
  title: string
  items: string[]
  label?: string
}

/**
 * An inline, click-to-open note about scheduling rules. It is a button with a
 * real accessible name, so keyboard and screen-reader users get the same
 * explanation as a mouse user hovering the icon.
 */
export function FieldHelp({ title, items, label = 'Scheduling rules' }: FieldHelpProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <div
      className="field-help"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="field-help-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="info" size={14} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="field-help-pop" id={id} role="region" aria-label={title}>
          <p className="field-help-title">{title}</p>
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
