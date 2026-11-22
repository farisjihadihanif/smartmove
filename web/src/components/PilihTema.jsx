import { Moon, MonitorSmartphone, Palette, Sun } from 'lucide-react'
import Dropdown from './Dropdown.jsx'
import { PILIHAN_TEMA, useTema } from '../lib/tema.js'
import { tr } from '../lib/i18n.js'

const IKON = { sistem: MonitorSmartphone, terang: Sun, gelap: Moon }

/**
 * Baris pengaturan Tampilan (T-110, dropdown T-115): ikon + label di kiri, dropdown di kanan
 * (pola `D:\project\chemistry`). Disimpan di perangkat ini.
 */
export default function PilihTema({ className = '' }) {
  const [pilihan, setPilihan] = useTema()
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <span className="flex flex-1 items-center gap-3 text-[15px] font-semibold">
        <Palette size={20} className="text-ink-violet" aria-hidden="true" />
        {tr('Tampilan')}
      </span>
      <Dropdown
        label={tr('Tampilan')}
        value={pilihan}
        onChange={setPilihan}
        options={PILIHAN_TEMA.map((o) => ({ ...o, icon: IKON[o.value] }))}
        className="w-full sm:w-auto"
      />
    </div>
  )
}
