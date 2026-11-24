import { useLayoutEffect, useRef, useState } from 'react'
import { kurangiGerak } from '../lib/reveal.js'
import { locale } from '../lib/i18n.js'

const DURASI = 900

/**
 * Angka naik sekali saat pertama terlihat. Nilai akhir selalu ada di DOM (pembaca layar, lebar tetap);
 * angka berjalan hanya lapisan di atasnya. Perubahan nilai berikutnya langsung tampil.
 */
export default function CountUp({ value }) {
  const ref = useRef(null)
  const [jalan, setJalan] = useState(null)
  const awal = useRef(value)

  useLayoutEffect(() => {
    const el = ref.current
    const target = awal.current
    if (!(target > 0) || typeof IntersectionObserver === 'undefined' || kurangiGerak()) return undefined
    let raf = 0
    const mulai = () => {
      const t0 = performance.now()
      const langkah = (t) => {
        const p = Math.max(0, Math.min(1, (t - t0) / DURASI))
        setJalan(p < 1 ? Math.round(target * (1 - (1 - p) ** 3)) : null)
        if (p < 1) raf = requestAnimationFrame(langkah)
      }
      raf = requestAnimationFrame(langkah)
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      mulai()
    })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      setJalan(null)
    }
  }, [])

  return (
    <span ref={ref} className="relative inline-block tabular-nums">
      <span className={jalan === null ? undefined : 'opacity-0'}>{value.toLocaleString(locale)}</span>
      {jalan !== null && (
        <span aria-hidden="true" className="absolute inset-0">
          {jalan.toLocaleString(locale)}
        </span>
      )}
    </span>
  )
}
