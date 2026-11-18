import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/brand/logo.webp'

// Fitur unggulan, teks persis dari poster (mockup hal. 1).
const FITUR = [
  'Navigasi rute alternatif',
  'Pemantau lalu lintas real time',
  'Sistem pembayaran terintegrasi transportasi umum',
  'Kampanye kesadaran penggunaan transportasi umum',
]

/** Garis daun dekoratif dari poster: tepi daun + tulang daun + urat yang menyebar dari pangkal. */
function Leaf({ className }) {
  const veins = Array.from({ length: 15 }, (_, i) => {
    const a = Math.PI * (1.08 + (i / 14) * 0.84)
    return `M100 250L${(100 + Math.cos(a) * 130).toFixed(1)} ${(130 + Math.sin(a) * 150).toFixed(1)}`
  }).join('')
  return (
    <svg viewBox="0 0 200 310" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="leaf-clip">
          <path d="M100 250C30 205 2 120 40 52 70 0 140-4 172 46c40 66 8 160-72 204Z" />
        </clipPath>
      </defs>
      <path d="M100 250C30 205 2 120 40 52 70 0 140-4 172 46c40 66 8 160-72 204Z" />
      <path d="M100 250l14 56" />
      <path d={veins} clipPath="url(#leaf-clip)" />
    </svg>
  )
}

// Splash web = halaman sambutan untuk tamu (mockup hal. 1).
export default function Splash() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-splash-bg text-olive">
      <Leaf className="pointer-events-none absolute -left-10 top-16 w-36 -rotate-12 text-leaf sm:left-[8%] sm:w-48" />
      <Leaf className="pointer-events-none absolute -right-12 -top-4 w-44 rotate-[18deg] text-leaf sm:right-[8%] sm:w-60" />

      <main className="splash-in relative mx-auto flex min-h-dvh w-full max-w-[680px] flex-col items-center px-4 pb-8 pt-12 text-center sm:pt-16">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" width="84" height="65" className="h-auto w-[84px]" />
          <p className="text-left text-[1.0625rem] font-semibold leading-[1.1] text-olive-soft">
            Smart
            <br />
            Move.
            <br />
            Medan
          </p>
        </div>

        <h1 className="mt-8 text-[clamp(2.6rem,12.5vw,4.75rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.02em]">
          Permudah
          <br />
          Kegiatanmu
        </h1>
        <p className="mt-4 text-[clamp(1.05rem,4.4vw,1.5rem)] text-olive-soft">Dengan aplikasi rencana SmartMove</p>

        <ul className="mt-8 grid w-full gap-3 sm:grid-cols-2 sm:gap-4">
          {FITUR.map((f) => (
            <li
              key={f}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-olive py-2.5 pl-3 pr-4 text-left text-[0.95rem] leading-snug text-white"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-olive">
                <Check size={22} strokeWidth={3.5} aria-hidden="true" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex w-full max-w-sm flex-col gap-3 pt-12">
          <Link
            to="/masuk"
            className="flex min-h-14 items-center justify-center rounded-full bg-olive text-lg font-semibold text-white transition hover:brightness-110"
          >
            Masuk
          </Link>
          <Link
            to="/daftar"
            className="flex min-h-14 items-center justify-center rounded-full border-2 border-olive text-lg font-semibold transition hover:bg-olive/10"
          >
            Buat akun
          </Link>
        </div>
      </main>
    </div>
  )
}
