import { Loader2, MapPin } from 'lucide-react'
import ErrorBanner from './ErrorBanner.jsx'
import { formatJarak } from '../lib/navigasi.js'

/** Daftar hasil GET /places/search di bawah kolom cari (Smart Navigation, Live Traffic). */
export default function HasilCari({ hasil, onPilih, onTutup }) {
  return (
    <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(22rem,55dvh)] overflow-y-auto rounded-3xl bg-surface p-2 shadow-[0_18px_40px_-14px_rgb(65_57_111/0.6)] ring-1 ring-ink/[0.06]">
      {hasil.status === 'memuat' && (
        <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink/70">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Mencari tempat…
        </p>
      )}
      {hasil.status === 'galat' && <ErrorBanner error={hasil.error} onDismiss={onTutup} />}
      {hasil.status === 'ok' && hasil.items.length === 0 && (
        <p className="px-3 py-3 text-sm text-ink/70">Tempat tidak ditemukan di Medan dan sekitarnya. Coba nama lain atau ketuk peta.</p>
      )}
      {hasil.status === 'ok' && hasil.items.length > 0 && (
        <ul aria-label="Hasil pencarian">
          {hasil.items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPilih(t)}
                className="flex min-h-touch w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-ink/[0.04]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:rgb(218_184_246/0.45)] text-ink-violet">
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t.nama}</span>
                  {t.alamat && <span className="block truncate text-xs text-ink/60">{t.alamat}</span>}
                </span>
                {t.jarakM !== undefined && <span className="shrink-0 text-xs tabular-nums text-ink/55">{formatJarak(t.jarakM)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
