import { useEffect, useRef } from 'react'
import { trackToolEngagement } from '../lib/analytics.js'

/**
 * On unmount (or when `active` flips false), sends `tool_engagement` with session duration.
 * @param {string} tool - e.g. `edit_pdf`
 * @param {boolean} active - when false, stops the clock and sends (e.g. left editor)
 */
export function useToolEngagement(tool, active = true) {
  const startRef = useRef(0)
  const sentRef = useRef(false)

  useEffect(() => {
    if (!active || !tool) return undefined
    sentRef.current = false
    startRef.current = Date.now()
    return () => {
      if (sentRef.current || !startRef.current) return
      sentRef.current = true
      const seconds = Math.max(0, Math.round((Date.now() - startRef.current) / 1000))
      if (seconds >= 1) {
        trackToolEngagement(tool, seconds)
      }
    }
  }, [tool, active])
}
