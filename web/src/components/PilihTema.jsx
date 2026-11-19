import { Check, Moon, MonitorSmartphone, Sun } from 'lucide-react'
import { PILIHAN_TEMA, useTema } from '../lib/tema.js'

const IKON = { sistem: MonitorSmartphone, terang: Sun, gelap: Moon }

/** Pilihan tampilan (T-110): Ikuti sistem · Terang · Gelap. Disimpan di perangkat ini. */
export default function PilihTema({ className = '' }) {
  const [pilihan, setPilihan] = useTema()
  return (
    <fieldset className={className}>
      <legend className="text-sm font-semibold">Tampilan</legend>
      <div role="radiogroup" aria-label="Tampilan" className="mt-2 grid grid-cols-3 gap-2">
        {PILIHAN_TEMA.map(({ value, label }) => {
          const on = pilihan === value
          const Ikon = on ? Check : IKON[value]
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPilihan(value)}
              className={`flex min-h-touch flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[13px] font-semibold transition ${
                on ? 'bg-pill text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]' : 'bg-card text-ink/80 ring-1 ring-ink/15 hover:bg-ink/[0.04]'
              }`}
            >
              <Ikon size={20} strokeWidth={on ? 2.75 : 2} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
