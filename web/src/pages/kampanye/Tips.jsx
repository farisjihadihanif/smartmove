import { useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import Rambu from '../../components/kampanye/Rambu.jsx'
import { useApiGet } from '../../lib/useApiGet.js'

// Tips Keselamatan (T-207): konten `tips` aktif dari admin, urut `urutan`.
export default function Tips() {
  const { status, data, error, muatUlang } = useApiGet('/campaign/contents', { jenis: 'tips' })
  const { hash } = useLocation()
  const items = data?.items ?? []

  // Dari hasil cari di hub (#id): gulir ke tips itu.
  useEffect(() => {
    if (status !== 'ok' || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [status, hash])

  return (
    <PageShell title="Tips Keselamatan" backTo="/kampanye" backLabel="Kembali ke Kampanye">
      <div className="mx-auto w-full max-w-2xl pt-6 lg:pt-10">
        {status === 'memuat' && <p className="py-6 text-sm text-ink/70">Memuat tips…</p>}
        {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} />}
        {status === 'ok' && items.length === 0 && (
          <EmptyState icon={ShieldAlert} title="Belum ada tips" message="Tips keselamatan dari pengelola SmartMove akan muncul di sini." />
        )}
        <ul className="divide-y divide-ink/[0.07]">
          {items.map((t) => (
            <li key={t.id} id={t.id} className={`flex gap-4 py-5 ${hash === `#${t.id}` ? 'rounded-2xl bg-lilac-wash/20 px-3' : ''}`}>
              <Rambu className="mt-0.5" />
              <div className="min-w-0">
                <h2 className="font-serif text-[1.25rem] leading-snug">{t.judul}</h2>
                {t.isi && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink/75">{t.isi}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  )
}
