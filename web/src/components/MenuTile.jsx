import { Link } from 'react-router-dom'

/**
 * Ubin menu.
 * - `plain` (Beranda, hal. 3): ikon dalam lingkaran + label hitam di bawahnya.
 * - `pill` (Traffic Mitigation Campaign, hal. 7): ilustrasi besar + label kapsul gradasi.
 * Isi `icon` dengan elemen (ikon lucide atau <img>); `iconClass` mengatur lingkaran.
 */
export default function MenuTile({
  icon,
  label,
  to,
  onClick,
  variant = 'plain',
  iconClass = 'bg-icon-blue text-white',
  className = '',
}) {
  const Tag = to ? Link : 'button'
  const linkProps = to ? { to } : { type: 'button', onClick }

  if (variant === 'pill') {
    return (
      <Tag
        {...linkProps}
        className={`fx-row group flex flex-col items-center gap-3 rounded-3xl p-3 [--fx-radius:1.5rem] ${className}`}
      >
        <span className="grid size-24 place-items-center rounded-full bg-lilac-wash/25 transition-transform motion-safe:group-active:scale-95" aria-hidden="true">
          {icon}
        </span>
        <span className="bg-pill flex min-h-touch min-w-[8.5rem] items-center justify-center whitespace-nowrap rounded-full px-4 text-[0.875rem] font-semibold text-white shadow-[0_6px_14px_-6px_rgb(114_13_129/0.8)]">
          {label}
        </span>
      </Tag>
    )
  }

  return (
    <Tag
      {...linkProps}
      className={`fx-row group flex flex-col items-center gap-2.5 rounded-3xl px-2 py-3 text-center [--fx-radius:1.5rem] ${className}`}
    >
      <span
        className={`grid size-16 place-items-center rounded-full shadow-[0_6px_14px_-8px_rgb(30_99_195/0.7)] transition-transform motion-safe:group-active:scale-95 ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[0.875rem] font-medium leading-snug text-ink">{label}</span>
    </Tag>
  )
}
