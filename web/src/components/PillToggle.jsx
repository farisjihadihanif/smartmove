import { Check } from 'lucide-react'

const TONE = {
  pill: 'bg-pill',
  deep: 'bg-pill-deep',
  soft: 'bg-pill-soft',
}

/**
 * Deretan kapsul (mockup hal. 4, 6). Yang aktif bergradasi ungu → magenta (warna mockup),
 * yang tidak aktif putih tembus pandang – gradasi hanya untuk pilihan yang sedang dipakai.
 * - Tunggal (tab, mis. Estimasi Waktu · Peta Interaktif): `value` string.
 * - `multiple` (lapisan, mis. Traffic · Transportasi umum · Street view): `value` array.
 * `fitDesktop`: di desktop (lg) lebar kapsul mengikuti teks, satu baris (toolbar header).
 * Yang aktif juga diberi ikon centang + teks tebal (penanda bentuk, bukan warna saja) dan aria-pressed.
 */
export default function PillToggle({
  options,
  value,
  onChange,
  multiple = false,
  tone = 'pill',
  label,
  fitDesktop = false,
  className = '',
}) {
  const isOn = (v) => (multiple ? (value ?? []).includes(v) : value === v)

  function toggle(v) {
    if (!multiple) return onChange?.(v)
    const cur = value ?? []
    onChange?.(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
  }

  return (
    <div role="group" aria-label={label} className={`flex justify-between gap-2 ${className}`}>
      {options.map((opt) => {
        const on = isOn(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(opt.value)}
            className={`flex min-h-touch min-w-0 max-w-[10rem] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-center text-[0.875rem] leading-tight transition ${
              fitDesktop ? 'lg:max-w-none lg:flex-none lg:whitespace-nowrap lg:px-4' : ''
            } ${
              on
                ? `${TONE[tone]} font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]`
                : 'bg-white/80 text-ink-violet ring-1 ring-ink-violet/15 hover:bg-white'
            }`}
          >
            {on && <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
