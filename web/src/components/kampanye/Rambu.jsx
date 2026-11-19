/**
 * Rambu peringatan belah ketupat kuning (dari ilustrasi "SAFETY FIRST" mockup hal. 7),
 * penanda tiap tips keselamatan. Dekoratif.
 */
export default function Rambu({ kecil = false, className = '' }) {
  const s = kecil ? 28 : 44
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="7" y="7" width="30" height="30" rx="4" transform="rotate(45 22 22)" fill="#FFC20E" stroke="#1A1A1A" strokeWidth="2.5" />
      <rect x="10.5" y="10.5" width="23" height="23" rx="2" transform="rotate(45 22 22)" fill="none" stroke="#1A1A1A" strokeWidth="1.2" />
      <path d="M22 14.5v9.5" stroke="#1A1A1A" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="22" cy="29" r="2" fill="#1A1A1A" />
    </svg>
  )
}
