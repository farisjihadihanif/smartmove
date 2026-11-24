import { tr } from '../lib/i18n.js'
/**
 * Bar aksi bawah bertekstur ungu tua (mockup hal. 4–7).
 * `actions`: [{ label, short?, icon: KomponenIkon, onClick, variant: 'light' | 'pill', disabled }]
 *   `short` = label pendek di ponsel (< sm) bila label penuh tidak muat; label penuh tetap dibacakan.
 * - `light` = kapsul putih #F4F0F0, teks ungu (Rute · Play · Share)
 * - `pill`  = kapsul gradasi (Pay Now · Share di Digital Payment)
 * `children` tampil di atas tombol (mis. pita "Simulasi").
 */
export default function BottomActionBar({ actions = [], children, className = '' }) {
  return (
    <nav
      aria-label={tr('Aksi')}
      className={`bg-bar-dark relative z-10 rounded-t-[1.75rem] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 ${className}`}
    >
      {children}
      {actions.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          {actions.map(({ label, short, icon: Icon, onClick, variant = 'light', disabled }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={`flex h-12 min-w-0 max-w-[10rem] flex-1 items-center justify-center gap-2 rounded-full px-3 text-[0.9375rem] font-semibold shadow-[0_4px_12px_rgb(0_0_0/0.25)] disabled:opacity-50 ${
                variant === 'pill' ? 'bg-pill text-white' : 'bg-action-pill text-ink-violet'
              }`}
            >
              {short ? (
                <>
                  <span className="truncate sm:hidden" aria-hidden="true">{short}</span>
                  <span className="sr-only sm:not-sr-only sm:truncate">{label}</span>
                </>
              ) : (
                <span className="truncate">{label}</span>
              )}
              {Icon && <Icon size={20} strokeWidth={2} className="shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
