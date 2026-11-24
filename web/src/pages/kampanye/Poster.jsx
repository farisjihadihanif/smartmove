import { useEffect, useRef, useState } from 'react'
import { Download, ImageIcon, Share2, X } from 'lucide-react'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import { fileUrl } from '../../lib/api.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr } from '../../lib/i18n.js'
import { revealList } from '../../lib/reveal.js'

// Poster kampanye (T-207): galeri poster aktif; ketuk → tampilan penuh + Bagikan / Unduh.
export default function Poster() {
  const { status, data, error, muatUlang } = useApiGet('/campaign/contents', { jenis: 'poster' })
  const [buka, setBuka] = useState(null)
  const items = data?.items ?? []

  return (
    <PageShell title={tr('Poster')} backTo="/kampanye" backLabel={tr('Kembali ke Kampanye')}>
      <div className="pt-6 lg:pt-10">
        {status === 'memuat' && <p className="py-6 text-sm text-ink/70">{tr('Memuat poster…')}</p>}
        {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} />}
        {status === 'ok' && items.length === 0 && (
          <EmptyState icon={ImageIcon} title={tr('Belum ada poster')} message={tr('Poster kampanye keselamatan dari pengelola SmartMove akan muncul di sini.')} />
        )}
        {items.length > 0 && (
          <ul ref={revealList} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {items.map((p) => (
              <li key={p.id} className="fx-card rounded-2xl">
                <button
                  type="button"
                  onClick={() => setBuka(p)}
                  className="block w-full overflow-hidden rounded-2xl bg-surface-nav text-left ring-1 ring-ink/[0.06]"
                >
                  {p.gambar ? (
                    <span className="fx-zoom block overflow-hidden">
                      <img src={fileUrl(p.gambar)} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                    </span>
                  ) : (
                    <span className="grid aspect-[3/4] place-items-center text-ink/30">
                      <ImageIcon size={40} aria-hidden="true" />
                    </span>
                  )}
                  <span className="block px-3 py-2.5 text-[14px] font-semibold leading-snug">{p.judul}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {buka && <Penampil poster={buka} onTutup={() => setBuka(null)} />}
    </PageShell>
  )
}

function Penampil({ poster, onTutup }) {
  const tutup = useRef(null)
  const [pesan, setPesan] = useState('')
  const url = fileUrl(poster.gambar)

  useEffect(() => {
    tutup.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  async function bagikan() {
    const teks = tr("{0}{1}\n\nKampanye keselamatan SmartMove Medan", { 0: poster.judul, 1: poster.isi ? `\n${poster.isi}` : '' })
    try {
      if (navigator.share) return await navigator.share({ title: poster.judul, text: teks, url: url ?? undefined })
      await navigator.clipboard.writeText(url ? `${teks}\n${url}` : teks)
      setPesan(tr('Tautan poster disalin.'))
    } catch (e) {
      if (e?.name !== 'AbortError') setPesan(tr('Belum bisa dibagikan dari peramban ini.'))
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={poster.judul} className="sheet-fade fixed inset-0 z-50 flex flex-col bg-bar-dark/95 text-white">
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="min-w-0 flex-1 truncate font-serif text-xl">{poster.judul}</h2>
        <button
          ref={tutup}
          type="button"
          onClick={onTutup}
          aria-label={tr('Tutup poster')}
          className="grid size-touch shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {url ? (
          <img src={url} alt={poster.judul} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
        ) : (
          <ImageIcon size={64} className="text-white/40" aria-hidden="true" />
        )}
      </div>
      {poster.isi && <p className="mx-auto max-w-2xl px-5 text-center text-[15px] leading-relaxed text-white/85">{poster.isi}</p>}
      {pesan && (
        <p role="status" className="mt-2 text-center text-sm font-semibold">
          {pesan}
        </p>
      )}
      <div className="flex justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={bagikan}
          className="flex h-12 min-w-[8rem] items-center justify-center gap-2 rounded-full bg-action-pill px-5 font-semibold text-ink-violet"
        >
          {tr('Share')} <Share2 size={18} aria-hidden="true" />
        </button>
        {url && (
          <a
            href={url}
            download
            target="_blank"
            rel="noreferrer"
            className="bg-pill flex h-12 min-w-[8rem] items-center justify-center gap-2 rounded-full px-5 font-semibold text-white"
          >
            {tr('Unduh')} <Download size={18} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
