import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Dropdown pilihan tunggal (T-115, pola `D:\project\chemistry`: tombol + daftar `listbox`).
 * Dipakai untuk Tampilan dan Bahasa di Akun. Keyboard: ↑/↓ pindah, Enter/Spasi pilih, Esc tutup.
 * `options`: [{ value, label, icon? }]
 */
export default function Dropdown({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [aktif, setAktif] = useState(0)
  const ref = useRef(null)
  const tombol = useRef(null)
  const id = useId()
  const pilihan = options.find((o) => o.value === value) ?? options[0]
  const IkonPilihan = pilihan?.icon

  useEffect(() => {
    if (!open) return undefined
    const tutup = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', tutup)
    return () => document.removeEventListener('mousedown', tutup)
  }, [open])

  function buka() {
    setAktif(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function pilih(v) {
    onChange(v)
    setOpen(false)
    tombol.current?.focus()
  }

  function tombolKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !open) {
      e.preventDefault()
      buka()
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAktif((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktif((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pilih(options[aktif].value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={tombol}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-daftar`}
        aria-label={`${label}: ${pilihan?.label ?? ''}`}
        aria-activedescendant={open ? `${id}-${aktif}` : undefined}
        onClick={() => (open ? setOpen(false) : buka())}
        onKeyDown={tombolKey}
        className="flex min-h-touch w-full min-w-[11rem] items-center gap-2 rounded-xl bg-search px-3.5 text-left text-[15px] font-semibold ring-1 ring-ink/10 transition hover:ring-ink-violet/30 focus-visible:ring-2 focus-visible:ring-pill-via"
      >
        {IkonPilihan && <IkonPilihan size={18} className="shrink-0 text-ink-violet" aria-hidden="true" />}
        <span className="flex-1 truncate">{pilihan?.label}</span>
        <ChevronDown size={18} className={`shrink-0 text-ink/55 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={`${id}-daftar`}
          role="listbox"
          aria-label={label}
          className="sheet-fade absolute right-0 z-30 mt-1.5 w-full min-w-[11rem] overflow-hidden rounded-xl bg-card p-1 shadow-[0_14px_32px_-12px_rgb(65_57_111/0.55)] ring-1 ring-ink/10"
        >
          {options.map((o, i) => {
            const on = o.value === value
            const Ikon = o.icon
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={on}
                onMouseEnter={() => setAktif(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pilih(o.value)}
                className={`flex min-h-touch cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[15px] ${
                  i === aktif ? 'bg-lilac-wash/30' : ''
                } ${on ? 'font-semibold text-ink-violet' : 'text-ink/85'}`}
              >
                {Ikon && <Ikon size={18} aria-hidden="true" className="shrink-0" />}
                <span className="flex-1">{o.label}</span>
                {on && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
