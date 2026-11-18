import { useState } from 'react'
import { Polyline } from 'react-leaflet'
import {
  Clock,
  CreditCard,
  Map as MapIcon,
  Megaphone,
  Play,
  Route,
  Search,
  Share2,
  ShieldAlert,
  CalendarClock,
  ClipboardList,
  Image as ImageIcon,
} from 'lucide-react'
import NebulaHeader from '../components/NebulaHeader.jsx'
import SearchField from '../components/SearchField.jsx'
import PillToggle from '../components/PillToggle.jsx'
import MenuTile from '../components/MenuTile.jsx'
import MapView from '../components/MapView.jsx'
import BottomActionBar from '../components/BottomActionBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import { ApiError } from '../lib/api.js'

// Pratinjau komponen bersama (hanya mode dev) – dibandingkan dengan docs/mockup/halaman-3,4,6,7.
const LAYERS = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'transit', label: 'Transportasi umum' },
  { value: 'street', label: 'Street view' },
]
const SAMPLE_ROUTE = [
  [3.5652, 98.6566],
  [3.5701, 98.6601],
  [3.5768, 98.6688],
  [3.5795, 98.6745],
  [3.5832, 98.6804],
  [3.5890, 98.6850],
]

export default function Komponen() {
  const [q, setQ] = useState('')
  const [layers, setLayers] = useState(['traffic'])
  const [tab, setTab] = useState('eta')
  const noop = () => {}

  return (
    <>
      {/* Layar Smart Navigation (hal. 4) */}
      <section className="flex h-dvh flex-col">
        <NebulaHeader
          leading={<MapIcon size={26} className="text-ink-violet" />}
          title="Smart Navigation"
          unread={2}
          onNotifications={noop}
        >
          <SearchField value={q} onChange={setQ} onSubmit={noop} />
          <PillToggle options={LAYERS} value={layers} onChange={setLayers} multiple label="Lapisan peta" />
        </NebulaHeader>
        <MapView capped className="-mt-3 flex-1">
          <Polyline positions={SAMPLE_ROUTE} pathOptions={{ color: '#0A11D8', weight: 9 }} />
          <Polyline positions={SAMPLE_ROUTE} pathOptions={{ color: '#0F53FF', weight: 6 }} />
        </MapView>
        <BottomActionBar
          actions={[
            { label: 'Rute', icon: Route, onClick: noop },
            { label: 'Play', icon: Play, onClick: noop },
            { label: 'Share', icon: Share2, onClick: noop },
          ]}
        />
      </section>

      {/* Beranda (hal. 3) */}
      <section>
        <NebulaHeader
          leading={<span className="grid size-12 place-items-center rounded-full bg-login-avatar font-serif text-lg">S</span>}
          title={<>Hallo! Selamat pagi<br />Sarah</>}
          serif
          unread={2}
          onNotifications={noop}
        >
          <SearchField value={q} onChange={setQ} leading={<Search size={26} strokeWidth={2.5} />} showSubmit={false} />
        </NebulaHeader>
        <div className="grid grid-cols-2 gap-y-2 bg-surface-menu px-4 py-5 shadow-[0_4px_6px_-2px_rgb(0_0_0/0.12)]">
          <MenuTile icon={<MapIcon size={30} />} label="Smart Navigation" iconClass="bg-white text-ink-violet ring-2 ring-ink-violet" onClick={noop} />
          <MenuTile icon={<Clock size={30} />} label="Live Traffic Information" iconClass="bg-white text-icon-blue ring-4 ring-icon-blue" onClick={noop} />
          <MenuTile icon={<CreditCard size={30} />} label="Digital Payment" onClick={noop} />
          <MenuTile icon={<Megaphone size={30} />} label="Traffic Mitigation Campaign" iconClass="bg-trip-1 text-white" onClick={noop} />
        </div>
      </section>

      {/* Live Traffic (hal. 6) – tab tunggal */}
      <section className="bg-lilac-wash px-4 py-5">
        <PillToggle
          options={[
            { value: 'eta', label: 'Estimasi Waktu' },
            { value: 'map', label: 'Peta Interaktif' },
          ]}
          value={tab}
          onChange={setTab}
          label="Tampilan"
        />
      </section>

      {/* Campaign (hal. 7) */}
      <section className="grid grid-cols-2 gap-6 px-4 py-8">
        <MenuTile variant="pill" icon={<ShieldAlert size={72} className="text-traffic-padat" />} label="Tips Keselamatan" onClick={noop} />
        <MenuTile variant="pill" icon={<ImageIcon size={72} className="text-indigo" />} label="Poster" onClick={noop} />
        <MenuTile variant="pill" icon={<CalendarClock size={72} className="text-traffic-macet" />} label="EventAlert" onClick={noop} />
        <MenuTile variant="pill" icon={<ClipboardList size={72} className="text-icon-blue" />} label="Umpan Balik" onClick={noop} />
      </section>

      {/* Galat & kosong */}
      <section className="flex flex-col gap-3 px-4 pb-4">
        <ErrorBanner error={new ApiError(0, 'x', 'JARINGAN')} onRetry={noop} />
        <ErrorBanner error={new ApiError(422, 'x', 'DI_LUAR_WILAYAH')} onDismiss={noop} />
      </section>
      <EmptyState
        icon={Route}
        title="Belum ada rencana perjalanan"
        message="Simpan rute ke kantor atau kampus supaya bisa dibuka sekali ketuk."
        action={{ label: 'Buat rencana', onClick: noop }}
      />
      <BottomActionBar
        actions={[
          { label: 'Pay Now', variant: 'pill', onClick: noop },
          { label: 'Share', icon: Share2, variant: 'pill', onClick: noop },
        ]}
      />
    </>
  )
}
