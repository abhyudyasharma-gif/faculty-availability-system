import { useState } from 'react'

/**
 * FacultyFlow brand mark.
 *
 * Uses the product logo (`/facultyflow-logo.png`, falling back to the bundled
 * SVG) and, if neither can be loaded, the simple capital "F" so the brand is
 * never blank or broken.
 */
export function BrandMark({ className = 'brand-mark', alt = false }: { className?: string; alt?: boolean }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className={className} aria-hidden="true">
        F
      </span>
    )
  }

  return (
    <span className={className}>
      <img
        src="/facultyflow-logo.png"
        alt={alt ? 'FacultyFlow logo' : ''}
        aria-hidden={alt ? undefined : 'true'}
        onError={({ currentTarget }) => {
          // Try the vector logo once, then fall back to the capital F.
          if (!currentTarget.dataset.fallback) {
            currentTarget.dataset.fallback = '1'
            currentTarget.src = '/facultyflow-logo.svg'
          } else {
            setFailed(true)
          }
        }}
      />
    </span>
  )
}
