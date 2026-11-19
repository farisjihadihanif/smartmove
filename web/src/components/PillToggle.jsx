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
 *
 * Opsi boleh punya `icon` (komponen lucide) dan `short` (label pendek di bawah lg, label lengkap
 * jadi aria-label). Bila salah satu opsi punya ikon, kapsul selalu satu baris: centang menggantikan
 * ikon saat aktif (lebar tidak berubah), dan bila tetap tidak muat (mis. huruf diperbesar) baris
 * bisa digeser ke samping, bukan turun ke dua baris.
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
  const satuBaris = options.some((o) => o.icon)

  function toggle(v) {
    if (!multiple) return onChange?.(v)
    const cur = value ?? []
    onChange?.(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={`flex justify-between gap-2 ${
        satuBaris ? '-my-2 overflow-x-auto py-2 [scrollbar-width:none] lg:my-0 lg:overflow-visible lg:py-0' : ''
      } ${className}`}
    >
      {options.map((opt) => {
        const on = isOn(opt.value)
        const Ikon = on ? Check : opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            aria-label={opt.short ? opt.label : undefined}
            onClick={() => toggle(opt.value)}
            className={`flex min-h-touch items-center justify-center gap-1.5 rounded-full py-1 text-center text-[0.875rem] leading-tight transition ${
              satuBaris
                ? 'shrink-0 grow basis-auto whitespace-nowrap px-3'
                : 'min-w-0 max-w-[10rem] flex-auto px-3'
            } ${fitDesktop ? 'lg:max-w-none lg:flex-none lg:grow-0 lg:whitespace-nowrap lg:px-4' : ''} ${
              on
                ? `${TONE[tone]} font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]`
                : 'bg-white/80 text-ink-violet ring-1 ring-ink-violet/15 hover:bg-white'
            }`}
          >
            {Ikon && <Ikon size={16} strokeWidth={on ? 3 : 2.25} className="shrink-0" aria-hidden="true" />}
            {opt.short ? (
              <>
                <span className="lg:hidden">{opt.short}</span>
                <span className="hidden lg:inline">{opt.label}</span>
              </>
            ) : (
              opt.label
            )}
          </button>
        )
      })}
    </div>
  )
}
