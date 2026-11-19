import { useEffect, useRef } from 'react'
import { Bell, CalendarClock, Coins, Route, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../EmptyState.jsx'
import { isUnread } from '../../lib/notifications.js'
import { hariWib, sejak } from '../../lib/wib.js'

const JENIS = {
  event: { icon: CalendarClock, to: '/kampanye/event', tint: 'bg-icon-blue/15 text-icon-blue-deep' },
  trip: { icon: Route, to: '/trip-planner', tint: 'bg-pill-soft/15 text-login-button' },
  poin: { icon: Coins, to: '/rewards', tint: 'bg-traffic-padat/15 text-[#9A5B00]' },
}

/**
 * Panel notifikasi Beranda: lembar bawah di ponsel, panel kanan di desktop.
 * `lastSeen` = waktu dibuka sebelumnya (ms) — dipakai menandai yang baru, bukan disimpan di sini.
 */
export default function NotificationSheet({ open, onClose, items, lastSeen, now }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-start lg:justify-end lg:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Tutup notifikasi"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-ink-violet/45"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className="sheet-rise relative flex max-h-[82dvh] w-full flex-col rounded-t-[1.75rem] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgb(65_57_111/0.45)] lg:max-h-[min(40rem,calc(100dvh-3rem))] lg:w-[25rem] lg:rounded-[1.75rem] lg:pb-0"
      >
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
        <header className="flex items-center gap-3 px-5 pb-2 pt-3 lg:pt-5">
          <h2 id="notif-title" className="flex-1 font-serif text-xl">
            Notifikasi
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-touch place-items-center rounded-full text-ink/70 transition hover:bg-ink/5"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Belum ada notifikasi"
            message="Pengingat perjalanan dan event lalu lintas dalam 24 jam ke depan akan muncul di sini."
            className="pb-12 pt-4"
          />
        ) : (
          <ul className="overflow-y-auto px-2 pb-4">
            {items.map((n) => {
              const j = JENIS[n.jenis] ?? JENIS.event
              const Icon = j.icon
              const baru = isUnread(n, lastSeen)
              const kapan = n.jenis === 'poin' ? sejak(n.waktu, now) : hariWib(n.waktu, now)
              return (
                <li key={n.id}>
                  <Link
                    to={n.jenis === 'event' && n.ref ? `${j.to}?id=${n.ref}` : j.to}
                    onClick={onClose}
                    className={`flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-ink/[0.04] ${baru ? 'bg-[color:rgb(218_184_246/0.22)]' : ''}`}
                  >
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full ${j.tint}`}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{n.judul}</span>
                        <span className="shrink-0 text-xs text-ink/60">{kapan}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-sm text-ink/70">
                        <span className="flex-1">{n.isi}</span>
                        {baru && (
                          <span className="size-2.5 shrink-0 rounded-full bg-pill-via">
                            <span className="sr-only">Baru</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
