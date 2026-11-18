const TONE = {
  pill: 'bg-pill',
  deep: 'bg-pill-deep',
  soft: 'bg-pill-soft',
}

/**
 * Deretan kapsul gradasi ungu → magenta (mockup hal. 4, 6).
 * - Tunggal (tab, mis. Estimasi Waktu · Peta Interaktif): `value` string.
 * - `multiple` (lapisan, mis. Traffic · Transportasi umum · Street view): `value` array.
 * Yang aktif diberi cincin putih tebal + teks tebal (penanda bentuk, bukan warna saja) dan aria-pressed.
 */
export default function PillToggle({
  options,
  value,
  onChange,
  multiple = false,
  tone = 'pill',
  label,
  className = '',
}) {
  const isOn = (v) => (multiple ? (value ?? []).includes(v) : value === v)

  function toggle(v) {
    if (!multiple) return onChange?.(v)
    const cur = value ?? []
    onChange?.(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
  }

  return (
    <div role="group" aria-label={label} className={`flex justify-between gap-3 ${className}`}>
      {options.map((opt) => {
        const on = isOn(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(opt.value)}
            className={`${TONE[tone]} flex min-h-touch max-w-[9.5rem] flex-1 items-center justify-center gap-1 rounded-full px-3 py-1 text-center text-[15px] leading-tight text-white shadow-[0_2px_4px_rgb(59_11_100/0.25)] transition-shadow ${
              on ? 'font-semibold ring-[3px] ring-white ring-inset' : ''
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
