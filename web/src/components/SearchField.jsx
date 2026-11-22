import { MapPin, Search } from 'lucide-react'
import { tr } from '../lib/i18n.js'

/**
 * Kolom "Telusuri di sini" (mockup hal. 3–7): kapsul abu muda, pin kiri, kaca pembesar kanan.
 * Beranda memakai `leading={<Search />}` + `showSubmit={false}` (hal. 3).
 */
export default function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = tr('Telusuri di sini'),
  label = tr('Cari tempat'),
  leading = <DefaultPin />,
  showSubmit = true,
  autoFocus = false,
  className = '',
}) {
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit?.(value)
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`flex h-[3.25rem] items-center gap-2 rounded-full bg-search pl-2 pr-1 shadow-[0_6px_18px_-8px_rgb(65_57_111/0.45)] ring-1 ring-white/70 focus-within:ring-2 focus-within:ring-ink-violet ${className}`}
    >
      {leading && <span className="grid size-9 shrink-0 place-items-center">{leading}</span>}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {showSubmit && (
        <button
          type="submit"
          aria-label={tr('Cari')}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink-violet text-white transition hover:brightness-125"
        >
          <Search size={20} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </form>
  )
}

function DefaultPin() {
  return (
    <span className="grid size-9 place-items-center">
      <MapPin size={22} strokeWidth={2.25} className="fill-traffic-macet text-[#8E1B12]" aria-hidden="true" />
    </span>
  )
}
