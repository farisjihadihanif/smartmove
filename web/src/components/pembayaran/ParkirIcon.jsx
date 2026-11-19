/** Rambu parkir "P" bergaya garis yang sama dengan lucide (mockup: ikon Pay for parking). */
export default function ParkirIcon({ size = 24, strokeWidth = 2, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5" />
    </svg>
  )
}
