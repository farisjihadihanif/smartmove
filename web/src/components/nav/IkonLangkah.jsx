import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, Navigation, RotateCw, Undo2 } from 'lucide-react'

/** Ikon langkah dari kalimat bahasa Indonesia API (api/src/services/osrm.js teksLangkah). */
export default function IkonLangkah({ teks = '', ...props }) {
  const t = teks.toLowerCase()
  if (t.startsWith('tiba')) return <Flag {...props} />
  if (t.startsWith('mulai')) return <Navigation {...props} />
  if (t.startsWith('putar balik')) return <Undo2 {...props} />
  if (t.includes('bundaran')) return <RotateCw {...props} />
  if (t.includes('kiri')) return <CornerUpLeft {...props} />
  if (t.includes('kanan')) return <CornerUpRight {...props} />
  return <ArrowUp {...props} />
}
