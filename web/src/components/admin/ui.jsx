import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tr } from '../../lib/i18n.js'

// Komponen kecil dasbor admin (T-208).

export function Judul({ children, aksi }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-serif text-[1.75rem] leading-tight">{children}</h1>
      {aksi}
    </div>
  )
}

const NADA = {
  netral: 'bg-ink/[0.06] text-ink/75',
  ungu: 'bg-lilac-wash/45 text-ink-violet',
  kuning: 'bg-traffic-padat/20 text-[#7A4A00]',
  merah: 'bg-traffic-macet/15 text-[#B71C1C]',
  hijau: 'bg-traffic-lancar/15 text-[#1B6B3C]',
}
/** Chip status berlabel (bukan warna saja). */
export function Chip({ nada = 'netral', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${NADA[nada]}`}>{children}</span>
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/55">{hint}</span>}
    </label>
  )
}

export const kelasInput =
  'w-full min-h-touch rounded-xl bg-search px-3.5 text-[15px] outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-pill-via'

export function Tombol({ jenis = 'utama', memuat = false, children, className = '', ...rest }) {
  const k = {
    utama: 'bg-pill text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]',
    biasa: 'bg-card text-ink-violet ring-1 ring-ink-violet/25 hover:bg-ink-violet/5',
    bahaya: 'bg-card text-[#B71C1C] ring-1 ring-traffic-macet/40 hover:bg-traffic-macet/5',
  }[jenis]
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || memuat}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50 ${k} ${className}`}
    >
      {memuat && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

/** Tombol hapus dua langkah: ketuk "Hapus" → "Yakin hapus?". */
export function TombolHapus({ onHapus, label = tr('Hapus'), className = '' }) {
  const [yakin, setYakin] = useState(false)
  const [memuat, setMemuat] = useState(false)
  if (!yakin) {
    return (
      <Tombol jenis="bahaya" className={className} onClick={() => setYakin(true)}>
        {label}
      </Tombol>
    )
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Tombol
        jenis="bahaya"
        memuat={memuat}
        onClick={async () => {
          setMemuat(true)
          try {
            await onHapus()
          } finally {
            setMemuat(false)
            setYakin(false)
          }
        }}
      >
        {tr('Yakin')} {label.toLowerCase()}?
      </Tombol>
      <Tombol jenis="biasa" onClick={() => setYakin(false)}>
        {tr('Batal')}
      </Tombol>
    </span>
  )
}

export function Halaman({ page, total, limit = 20, onPage }) {
  const akhir = Math.max(1, Math.ceil(total / limit))
  if (akhir <= 1) return null
  return (
    <nav aria-label={tr('Halaman')} className="mt-4 flex items-center gap-3 text-sm">
      <Tombol jenis="biasa" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {tr('Sebelumnya')}
      </Tombol>
      <span className="tabular-nums text-ink/70">
        {page} / {akhir}
      </span>
      <Tombol jenis="biasa" disabled={page >= akhir} onClick={() => onPage(page + 1)}>
        {tr('Berikutnya')}
      </Tombol>
    </nav>
  )
}

/** Tabel bergaris tipis; di ponsel bisa digeser ke samping. */
export function Tabel({ kolom, children, label }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <table aria-label={label} className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-xs text-ink/60">
            {kolom.map((k) => (
              <th key={k} scope="col" className="px-3 py-2 font-semibold">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/[0.06]">{children}</tbody>
      </table>
    </div>
  )
}
