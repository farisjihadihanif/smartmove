import { useState } from 'react'
import { ChevronRight, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import PitaSimulasi from '../../components/pembayaran/PitaSimulasi.jsx'
import { IKON_JENIS } from '../../components/pembayaran/ikon.js'
import { STATUS, rupiah, waktuLengkap } from '../../lib/pembayaran.js'
import { useApiGet } from '../../lib/useApiGet.js'
import { tr } from '../../lib/i18n.js'
import { revealList } from '../../lib/reveal.js'

const WARNA_STATUS = {
  lancar: 'bg-traffic-lancar/12 text-[#1D6B3D] ring-traffic-lancar/40',
  padat: 'bg-traffic-padat/15 text-[#8A5300] ring-traffic-padat/45',
  macet: 'bg-traffic-macet/10 text-[#B42318] ring-traffic-macet/35',
  abu: 'bg-ink/[0.05] text-ink/65 ring-ink/15',
}

export function ChipStatus({ status }) {
  const s = STATUS[status] ?? { label: status, nada: 'abu' }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${WARNA_STATUS[s.nada]}`}
    >
      {s.label}
    </span>
  )
}

/** Riwayat pemesanan (simulasi) milik sendiri, terbaru dulu. */
export default function RiwayatPembayaran() {
  const [page, setPage] = useState(1)
  const { status, data, error, muatUlang } = useApiGet('/payments', {
    page,
    limit: 20,
  })
  const habis = data ? page * 20 >= data.total : true

  return (
    <PageShell title={tr('Riwayat pemesanan')} backTo="/pembayaran" backLabel={tr('Kembali ke Digital Payment')}>
      <div className="mx-auto w-full max-w-2xl pt-6 lg:pt-10">
        <PitaSimulasi className="mb-4" />
        {status === 'galat' && <ErrorBanner error={error} onRetry={muatUlang} />}
        {status === 'memuat' && <div className="h-64 animate-pulse rounded-3xl bg-ink/[0.06]" aria-label={tr('Memuat riwayat')} />}
        {status === 'ok' && data.items.length === 0 && (
          <EmptyState
            icon={Ticket}
            title={tr('Belum ada pemesanan')}
            message={tr('Pesan tiket kereta, bus, travel, atau parkir dari Digital Payment.')}
            action={
              <Link
                to="/pembayaran"
                className="bg-pill inline-flex min-h-touch items-center rounded-full px-6 font-semibold text-white"
              >
                {tr('Pesan tiket')}
              </Link>
            }
            className="mt-8"
          />
        )}
        {status === 'ok' && data.items.length > 0 && (
          <>
            <ul ref={revealList}>
              {data.items.map((p) => {
                const Ikon = IKON_JENIS[p.layanan.jenis] ?? Ticket
                return (
                  <li key={p.orderId} className="border-b border-ink/[0.07] last:border-b-0">
                    <Link
                      to={`/pembayaran/${p.orderId}`}
                      className="fx-row grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 py-4 [--fx-inset:-0.75rem]"
                    >
                      <span className="grid size-11 place-items-center rounded-full bg-icon-blue text-white">
                        <Ikon size={22} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.layanan.nama}</span>
                        <span className="block truncate text-[13px] text-ink/60">
                          {p.jadwal ? waktuLengkap(p.jadwal) : p.orderId}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <ChipStatus status={p.status} />
                          <span className="text-[13px] font-semibold">{rupiah(p.jumlah)}</span>
                        </span>
                      </span>
                      <ChevronRight size={18} className="text-ink/35" aria-hidden="true" />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="min-h-touch rounded-full px-4 font-semibold text-ink-violet disabled:opacity-35"
              >
                {tr('Sebelumnya')}
              </button>
              <button
                type="button"
                disabled={habis}
                onClick={() => setPage(page + 1)}
                className="min-h-touch rounded-full px-4 font-semibold text-ink-violet disabled:opacity-35"
              >
                {tr('Berikutnya')}
              </button>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
