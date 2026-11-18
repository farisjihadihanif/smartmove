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
        className={`group flex flex-col items-center gap-3 rounded-3xl p-2 ${className}`}
      >
        <span className="grid size-24 place-items-center transition-transform group-active:scale-95" aria-hidden="true">
          {icon}
        </span>
        <span className="bg-pill flex min-h-touch min-w-[8.5rem] items-center justify-center whitespace-nowrap rounded-full px-4 text-[15px] font-semibold tracking-[0.02em] text-white shadow-[0_2px_4px_rgb(59_11_100/0.25)]">
          {label}
        </span>
      </Tag>
    )
  }

  return (
    <Tag
      {...linkProps}
      className={`group flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center hover:bg-black/[0.03] ${className}`}
    >
      <span
        className={`grid size-16 place-items-center rounded-full transition-transform group-active:scale-95 ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[15px] leading-snug text-ink">{label}</span>
    </Tag>
  )
}
