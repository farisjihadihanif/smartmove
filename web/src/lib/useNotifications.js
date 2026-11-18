import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { countUnread, readLastSeen, writeLastSeen } from './notifications.js'

/**
 * Status panel notifikasi (lonceng) dari data GET /home.
 * `data`: hasil /home bila halaman sudah memuatnya (Beranda); bila `null` dan `fetchOwn`,
 * hook memuatnya sendiri (layar lain di desktop). Tamu tidak punya notifikasi.
 */
export function useNotifications(user, data = null, { fetchOwn = false } = {}) {
  const [own, setOwn] = useState(null)
  const userId = user?.id
  // Dibaca ulang saat pengguna berganti / sesi baru selesai dimuat (awalnya `user` bisa null).
  const [seen, setSeen] = useState(() => ({ id: userId, v: readLastSeen(userId) }))
  const lastSeen = seen.id === userId ? seen.v : readLastSeen(userId)
  const [sheet, setSheet] = useState(null) // { lastSeen } saat panel terbuka

  useEffect(() => {
    if (!fetchOwn || !userId) return
    const ctrl = new AbortController()
    api.get('/home', { signal: ctrl.signal }).then(setOwn, () => {
      /* lonceng tanpa angka bila gagal; tidak menghalangi layar */
    })
    return () => ctrl.abort()
  }, [fetchOwn, userId])

  const src = data ?? own
  const items = user ? (src?.notifikasi ?? []) : []
  const unread = countUnread(items, lastSeen)

  const open = useCallback(() => {
    setSheet({ lastSeen, openedAt: Date.now() })
    if (src && user) {
      writeLastSeen(user.id, src.sapaan.waktuServer)
      setSeen({ id: user.id, v: new Date(src.sapaan.waktuServer).getTime() })
    }
  }, [src, user, lastSeen])
  const close = useCallback(() => setSheet(null), [])

  return { items, unread, open, close, isOpen: !!sheet, lastSeen: sheet?.lastSeen ?? null, openedAt: sheet?.openedAt ?? 0 }
}

/** True bila lebar layar memenuhi media query (mis. desktop `(min-width: 64rem)`). */
export function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}
