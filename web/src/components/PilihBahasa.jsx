import { Languages } from 'lucide-react'
import Dropdown from './Dropdown.jsx'
import { PILIHAN_BAHASA, bacaPilihanBahasa, simpanPilihanBahasa, tr } from '../lib/i18n.js'

/** Baris pengaturan Bahasa (T-111): Ikuti perangkat · Bahasa Indonesia · English. Halaman dimuat ulang. */
export default function PilihBahasa({ className = '' }) {
  const pilihan = bacaPilihanBahasa()
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <span className="flex flex-1 items-center gap-3 text-[15px] font-semibold">
        <Languages size={20} className="text-ink-violet" aria-hidden="true" />
        {tr('Bahasa')}
      </span>
      <Dropdown label={tr('Bahasa')} value={pilihan} onChange={simpanPilihanBahasa} options={PILIHAN_BAHASA} className="w-full sm:w-auto" />
    </div>
  )
}
