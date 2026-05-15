'use client'

import { useState, useEffect } from 'react'

/**
 * Lightweight hook that evaluates a CSS media query and returns whether it
 * currently matches. Defaults to `false` during SSR so server and client
 * hydration agree.
 *
 * @param query - A valid CSS media query string, e.g. `(min-width: 640px)`
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
