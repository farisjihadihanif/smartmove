import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { bboxDari } from './lalulintas.js'

const SEGARKAN_MS = 2 * 60 * 1000

/**
 * Data lalu lintas untuk peta: koridor jalan utama (GET /traffic/corridors, disegarkan tiap 2 menit)
 * dan laporan warga di area peta (GET /traffic?bbox). `aktif = false` → tidak memuat apa pun.
 */
export function useLaluLintas(aktif = true) {
  const [koridor, setKoridor] = useState({ status: 'memuat', items: [], error: null, diperbaruiPada: null })
  const [laporan, setLaporan] = useState([])
  const [coba, setCoba] = useState(0)
  const area = useRef(null)
  const ctrlLaporan = useRef(null)

  useEffect(() => {
    if (!aktif) return
    let batal = false
    const ctrl = new AbortController()
    const muat = () =>
      api.get('/traffic/corridors', { signal: ctrl.signal }).then(
        ({ items, diperbaruiPada }) => !batal && setKoridor({ status: 'ok', items, error: null, diperbaruiPada }),
        (error) => !batal && error.name !== 'AbortError' && setKoridor((k) => ({ ...k, status: 'galat', error })),
      )
    muat()
    const t = setInterval(muat, SEGARKAN_MS)
    return () => {
      batal = true
      ctrl.abort()
      clearInterval(t)
    }
  }, [aktif, coba])

  const muatLaporan = useCallback(() => {
    if (!area.current) return
    ctrlLaporan.current?.abort()
    const ctrl = new AbortController()
    ctrlLaporan.current = ctrl
    api.get('/traffic', { query: { bbox: area.current }, signal: ctrl.signal }).then(
      ({ items }) => setLaporan(items),
      () => {}, // Laporan bersifat tambahan; galat koridor sudah ditampilkan.
    )
  }, [])

  const onArea = useCallback(
    (bounds) => {
      area.current = bboxDari(bounds)
      if (aktif) muatLaporan()
    },
    [aktif, muatLaporan],
  )

  useEffect(() => {
    if (!aktif) return
    muatLaporan()
    const t = setInterval(muatLaporan, SEGARKAN_MS)
    return () => {
      clearInterval(t)
      ctrlLaporan.current?.abort()
    }
  }, [aktif, muatLaporan])

  const muatUlang = useCallback(() => {
    setKoridor((k) => ({ ...k, status: 'memuat' }))
    setCoba((n) => n + 1)
    muatLaporan()
  }, [muatLaporan])

  /** Setelah mengirim laporan: tampilkan langsung, lalu segarkan estimasi koridor. */
  const terimaLaporan = useCallback(
    (l) => {
      setLaporan((xs) => [l, ...xs.filter((x) => x.id !== l.id)])
      setCoba((n) => n + 1)
    },
    [],
  )

  return { koridor, laporan, onArea, muatUlang, terimaLaporan }
}
