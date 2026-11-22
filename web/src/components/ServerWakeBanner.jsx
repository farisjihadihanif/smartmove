import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { onServerWaking } from '../lib/api.js'
import { tr } from '../lib/i18n.js'

/**
 * Status "Membangunkan server…" (T-305). API gratis di Render tidur setelah ±15 menit;
 * selama bangun (±1 menit) permintaan dicoba ulang otomatis oleh lib/api.js.
 */
export default function ServerWakeBanner() {
  const [bangun, setBangun] = useState(false)
  useEffect(() => onServerWaking(setBangun), [])
  if (!bangun) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-card py-2 pl-2 pr-4 text-ink shadow-lg ring-1 ring-ink-violet/15"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-violet/10 text-ink-violet">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        </span>
        <p className="text-sm leading-snug">
          <span className="font-semibold">{tr('Membangunkan server…')}</span>
          <br />
          <span className="text-ink/70">{tr('Server gratis sedang bangun, biasanya kurang dari 1 menit.')}</span>
        </p>
      </div>
    </div>
  )
}
