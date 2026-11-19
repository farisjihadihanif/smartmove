import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

/** GET sederhana: `{ status: memuat|ok|galat, data, error, muatUlang }`. */
export function useApiGet(path, query) {
  const kunci = `${path}?${new URLSearchParams(query ?? {}).toString()}`
  const [state, setState] = useState({ kunci: null, data: null, error: null })
  const [coba, setCoba] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    api.get(path, { query, signal: ctrl.signal }).then(
      (data) => setState({ kunci, data, error: null }),
      (error) => error.name !== 'AbortError' && setState({ kunci, data: null, error }),
    )
    return () => ctrl.abort()
    // `kunci` mewakili path + query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, coba])

  const muatUlang = useCallback(() => setCoba((n) => n + 1), [])
  const siap = state.kunci === kunci
  const status = !siap ? 'memuat' : state.error ? 'galat' : 'ok'
  return { status, data: siap ? state.data : null, error: siap ? state.error : null, muatUlang }
}
