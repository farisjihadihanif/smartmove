import { MapPin, Search } from 'lucide-react'

/**
 * Kolom "Telusuri di sini" (mockup hal. 3–7): kapsul abu muda, pin kiri, kaca pembesar kanan.
 * Beranda memakai `leading={<Search />}` + `showSubmit={false}` (hal. 3).
 */
export default function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = 'Telusuri di sini',
  label = 'Cari tempat',
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
      className={`flex h-touch items-center gap-2 rounded-full bg-search pl-2 pr-1 shadow-[0_1px_3px_rgb(65_57_111/0.18)] ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-ink-violet ${className}`}
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
        className="h-full min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink [&::-webkit-search-cancel-button]:hidden"
      />
      {showSubmit && (
        <button
          type="submit"
          aria-label="Cari"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-black/5"
        >
          <Search size={26} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </form>
  )
}

function DefaultPin() {
  return (
    <span className="grid size-9 place-items-center rounded-md bg-white">
      <MapPin size={22} strokeWidth={2.25} className="fill-traffic-macet text-[#8E1B12]" aria-hidden="true" />
    </span>
  )
}
