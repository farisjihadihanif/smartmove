import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { tr } from '../../lib/i18n.js'

/** QR kode e-tiket simulasi sebagai SVG (tajam di semua ukuran, bisa dicetak). */
export default function KodeQR({ value, size = 168, label }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    }
    return { n, path: d }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label ?? tr("Kode QR {0}", { 0: value })}
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-xl bg-white"
    >
      <path d={path} fill="#1D1640" />
    </svg>
  )
}
