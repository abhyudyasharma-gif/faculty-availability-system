import { useCallback, useState } from 'react'

/**
 * A tiny first-visit walkthrough. It only ever highlights elements that are
 * already on the page — it never blocks a control or delays a form.
 */
export interface TourStep {
  target: string
  title: string
  body: string
  placement?: 'bottom' | 'right' | 'left'
}

export const TOUR_KEY = 'facultyflow.tour.version'
const TOUR_VERSION = '1'

export function useTour(steps: TourStep[], enabled = true) {
  const [open, setOpen] = useState(() => {
    if (!enabled) return false
    try {
      return localStorage.getItem(TOUR_KEY) !== TOUR_VERSION
    } catch {
      return false
    }
  })
  const [index, setIndex] = useState(0)

  const finish = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(TOUR_KEY, TOUR_VERSION)
    } catch {
      /* ignore */
    }
  }, [])

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finish()
        return i
      }
      return i + 1
    })
  }, [finish, steps.length])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  const start = useCallback(() => {
    setIndex(0)
    setOpen(true)
  }, [])

  return { open, index, step: steps[index], total: steps.length, next, back, finish, start }
}
