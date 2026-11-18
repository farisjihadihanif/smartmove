/**
 * Keadaan kosong: ikon di medali lilac, judul Bree Serif, satu kalimat arahan, aksi opsional.
 * Kalimat menjelaskan apa yang bisa dilakukan, bukan suasana (mis. "Simpan rute pertamamu…").
 */
export default function EmptyState({ icon: Icon, title, message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      {Icon && (
        <span className="bg-lilac-wash grid size-20 place-items-center rounded-full text-ink-violet ring-4 ring-white shadow-[0_2px_8px_rgb(65_57_111/0.2)]">
          <Icon size={34} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <h2 className="mt-5 font-serif text-xl text-ink">{title}</h2>
      {message && <p className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-ink/70">{message}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="bg-pill mt-6 min-h-touch rounded-full px-6 text-base font-semibold text-white shadow-[0_2px_4px_rgb(59_11_100/0.25)]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
