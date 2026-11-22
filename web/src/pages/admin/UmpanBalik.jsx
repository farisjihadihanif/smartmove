import { useState } from 'react'
import { Star } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import { Halaman, Judul, TombolHapus, kelasInput } from '../../components/admin/ui.jsx'
import { api } from '../../lib/api.js'
import { FITUR } from '../../lib/kampanye.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { jamAtauTanggal } from '../../lib/wib.js'
import { tr } from '../../lib/i18n.js'

const LABEL_FITUR = Object.fromEntries(FITUR.map((f) => [f.value, f.label]))

// Umpan balik pengguna: baca, saring per rating, hapus yang spam.
export default function UmpanBalik() {
  const [rating, setRating] = useState('')
  const [page, setPage] = useState(1)
  const [galat, setGalat] = useState(null)
  const { data, error, muatUlang } = useApiGet('/admin/feedback', rating ? { rating, page } : { page })
  const [now] = useState(() => Date.now())

  return (
    <>
      <Judul
        aksi={
          <label className="flex items-center gap-2 text-sm font-semibold">
            {tr('Rating')}
            <select
              value={rating}
              onChange={(e) => {
                setRating(e.target.value)
                setPage(1)
              }}
              className={`${kelasInput} w-auto`}
            >
              <option value="">{tr('Semua')}</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} {tr('bintang')}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {tr('Umpan balik')}
      </Judul>
      {(error || galat) && <ErrorBanner error={error || galat} onRetry={error ? muatUlang : undefined} className="mb-4" />}
      <ul className="divide-y divide-ink/[0.06]">
        {data?.items.map((f) => (
          <li key={f.id} className="flex flex-wrap items-start gap-4 py-4">
            <span className="flex shrink-0 items-center gap-0.5" role="img" aria-label={tr("{0} dari 5", { 0: f.rating })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={16} aria-hidden="true" className={n <= f.rating ? 'fill-traffic-padat text-[#B26A00]' : 'text-ink/20'} />
              ))}
            </span>
            <div className="min-w-0 flex-1 basis-60">
              <p className="text-[15px] leading-relaxed">{f.komentar || <span className="text-ink/45">{tr('Tanpa komentar')}</span>}</p>
              <p className="mt-1 text-xs text-ink/55">
                {f.pengguna?.username ?? tr('akun dihapus')}, {jamAtauTanggal(f.createdAt, now)}
                {f.fitur && tr(", tentang {0}", { 0: LABEL_FITUR[f.fitur] ?? f.fitur })}
              </p>
            </div>
            <TombolHapus
              onHapus={async () => {
                setGalat(null)
                try {
                  await api.del(`/admin/feedback/${f.id}`)
                  muatUlang()
                } catch (e) {
                  setGalat(e)
                }
              }}
            />
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink/60">{tr('Belum ada umpan balik.')}</p>}
      {data && <Halaman page={data.page} total={data.total} onPage={setPage} />}
    </>
  )
}
