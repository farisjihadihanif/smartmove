import { FlaskConical } from 'lucide-react'
import { LABEL_SIMULASI } from '../../lib/pembayaran.js'
import { tr } from '../../lib/i18n.js'

/**
 * Pita "Simulasi" (AGENTS aturan 7): wajib ada di setiap layar pembayaran & e-tiket.
 * `gelap`: di atas bar aksi ungu tua (lebih ringkas, satu baris).
 */
export default function PitaSimulasi({ gelap = false, className = '' }) {
  return (
    <p
      className={`flex items-center justify-center gap-2 rounded-full px-4 font-semibold ${
        gelap ? 'bg-white/12 py-1 text-[12px] text-white ring-1 ring-white/25' : 'bg-traffic-padat/15 py-1.5 text-[13px] text-[#7A4A00] ring-1 ring-traffic-padat/40'
      } ${className}`}
    >
      <FlaskConical size={15} aria-hidden="true" className="shrink-0" />
      {LABEL_SIMULASI}
      {!gelap && tr('. Tidak ada uang sungguhan.')}
    </p>
  )
}
