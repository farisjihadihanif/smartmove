import { useMemo, useState } from 'react'
import { CalendarClock, ChevronRight, ClipboardList, ImageIcon, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner.jsx'
import MenuTile from '../components/MenuTile.jsx'
import PageShell from '../components/PageShell.jsx'
import SearchField from '../components/SearchField.jsx'
import Rambu from '../components/kampanye/Rambu.jsx'
import { cocok, infoJenisEvent, rentangEvent } from '../lib/kampanye.js'
import { useApiGet } from '../lib/useApiGet.js'
import { tr } from '../lib/i18n.js'

// Traffic Mitigation Campaign (mockup hal. 7, PRD §6.5, T-207): grid 2×2 menu kampanye,
// kolom cari menyaring tips & EventAlert, dan event yang sedang berlangsung.

const MENU = [
  { to: '/kampanye/tips', label: tr('Tips Keselamatan'), icon: <ShieldAlert size={64} strokeWidth={1.6} className="text-traffic-padat" /> },
  { to: '/kampanye/poster', label: tr('Poster'), icon: <ImageIcon size={64} strokeWidth={1.6} className="text-indigo" /> },
  { to: '/kampanye/event', label: tr('EventAlert'), icon: <CalendarClock size={64} strokeWidth={1.6} className="text-traffic-macet" /> },
  { to: '/kampanye/umpan-balik', label: tr('Umpan Balik'), icon: <ClipboardList size={64} strokeWidth={1.6} className="text-icon-blue" /> },
]

export default function Kampanye() {
  const [q, setQ] = useState('')
  const tips = useApiGet('/campaign/contents', { jenis: 'tips' })
  const events = useApiGet('/campaign/events')
  const [now] = useState(() => Date.now())

  const berlangsung = (events.data?.items ?? []).filter((e) => e.status === 'berlangsung')
  const hasil = useMemo(() => {
    if (!q.trim()) return null
    return {
      tips: (tips.data?.items ?? []).filter((t) => cocok(q, t.judul, t.isi)),
      events: (events.data?.items ?? []).filter((e) => cocok(q, e.judul, e.isi)),
    }
  }, [q, tips.data, events.data])

  return (
    <PageShell
      title={tr('Traffic Mitigation Campaign')}
      toolbar={
        <div className="lg:max-w-md lg:flex-1">
          <SearchField value={q} onChange={setQ} onSubmit={setQ} placeholder={tr('Telusuri di sini')} label={tr('Cari tips atau event')} />
        </div>
      }
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12 lg:pt-10">
        <nav aria-label={tr('Menu kampanye')} className="grid grid-cols-2 gap-x-2 gap-y-4 pt-6 lg:pt-0">
          {MENU.map((m) => (
            <MenuTile key={m.to} variant="pill" to={m.to} label={m.label} icon={m.icon} />
          ))}
        </nav>

        <div className="pt-8 lg:pt-2">
          {hasil ? (
            <HasilCari q={q} hasil={hasil} now={now} />
          ) : (
            <section aria-labelledby="judul-berlangsung">
              <h2 id="judul-berlangsung" className="font-serif text-[1.375rem] leading-tight">
                {tr('Sedang berlangsung')}
              </h2>
              {events.status === 'galat' && <ErrorBanner error={events.error} onRetry={events.muatUlang} className="mt-3" />}
              {events.status === 'ok' && berlangsung.length === 0 && (
                <p className="mt-2 text-[15px] leading-relaxed text-ink/65">
                  {tr('Tidak ada event lalu lintas saat ini.')}{' '}
                  <Link to="/kampanye/event" className="font-semibold text-ink-violet underline-offset-2 hover:underline">
                    {tr('Lihat jadwal mendatang')}
                  </Link>
                </p>
              )}
              <ul className="mt-2">
                {berlangsung.map((e) => (
                  <BarisEvent key={e.id} e={e} now={now} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function BarisEvent({ e, now }) {
  const j = infoJenisEvent(e.jenis)
  return (
    <li>
      <Link
        to={`/kampanye/event?id=${e.id}`}
        className="-mx-2 flex min-h-touch items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-ink/[0.035]"
      >
        <span aria-hidden="true" className="relative grid size-3 shrink-0 place-items-center">
          {e.status === 'berlangsung' && <span className="absolute size-3 animate-ping rounded-full opacity-40 motion-reduce:animate-none" style={{ backgroundColor: j.warna }} />}
          <span className="size-2.5 rounded-full" style={{ backgroundColor: j.warna }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{e.judul}</span>
          <span className="block text-[13px] text-ink/60">
            {j.label}, {rentangEvent(e, now)}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink/40" aria-hidden="true" />
      </Link>
    </li>
  )
}

function HasilCari({ q, hasil, now }) {
  const kosong = !hasil.tips.length && !hasil.events.length
  return (
    <section aria-label={tr("Hasil pencarian {0}", { 0: q })}>
      {kosong && <p className="text-[15px] leading-relaxed text-ink/65">{tr('Tidak ada tips atau event yang cocok dengan “')}{q.trim()}”.</p>}
      {hasil.tips.length > 0 && (
        <>
          <h2 className="font-serif text-[1.375rem] leading-tight">{tr('Tips')}</h2>
          <ul className="mt-2">
            {hasil.tips.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/kampanye/tips#${t.id}`}
                  className="-mx-2 flex min-h-touch items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-ink/[0.035]"
                >
                  <Rambu kecil />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{t.judul}</span>
                  <ChevronRight size={18} className="shrink-0 text-ink/40" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {hasil.events.length > 0 && (
        <>
          <h2 className="mt-6 font-serif text-[1.375rem] leading-tight">{tr('Event')}</h2>
          <ul className="mt-2">
            {hasil.events.map((e) => (
              <BarisEvent key={e.id} e={e} now={now} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
