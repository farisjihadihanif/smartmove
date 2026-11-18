/**
 * Bar aksi bawah bertekstur ungu tua (mockup hal. 4–7).
 * `actions`: [{ label, icon: KomponenIkon, onClick, variant: 'light' | 'pill', disabled }]
 * - `light` = kapsul putih #F4F0F0, teks ungu (Rute · Play · Share)
 * - `pill`  = kapsul gradasi (Pay Now · Share di Digital Payment)
 * `children` tampil di atas tombol (mis. pita "Simulasi").
 */
export default function BottomActionBar({ actions = [], children, className = '' }) {
  return (
    <nav
      aria-label="Aksi"
      className={`bg-bar-dark px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 ${className}`}
    >
      {children}
      {actions.length > 0 && (
        <div className="flex items-center justify-around gap-2">
          {actions.map(({ label, icon: Icon, onClick, variant = 'light', disabled }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={`flex h-12 min-w-0 max-w-[8.5rem] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[17px] shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform active:scale-[0.97] disabled:opacity-50 ${
                variant === 'pill' ? 'bg-pill font-semibold text-white' : 'bg-action-pill text-ink-violet'
              }`}
            >
              <span className="truncate">{label}</span>
              {Icon && <Icon size={22} strokeWidth={2} className="shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
