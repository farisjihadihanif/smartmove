import { TANPA_DATA, TINGKAT } from '../lib/lalulintas.js'
import { tr } from '../lib/i18n.js'

const ITEMS = [TINGKAT.lancar, TINGKAT.padat, TINGKAT.macet, TANPA_DATA]

/** Legenda warna lalu lintas (DESIGN §4, §8): garis berwarna + label teks, tidak mengandalkan warna saja. */
export default function TrafficLegend({ className = '' }) {
  return (
    <ul aria-label={tr('Legenda lalu lintas')} className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink/75 ${className}`}>
      {ITEMS.map((t) => (
        <li key={t.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-5 rounded-full" style={{ backgroundColor: t.warna }} />
          {t.label}
        </li>
      ))}
    </ul>
  )
}
