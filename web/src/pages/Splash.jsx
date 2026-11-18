import { Megaphone, Route, Ticket, TrafficCone } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/brand/logo.webp'

// Fitur unggulan, teks dari poster (mockup hal. 1); ikon garis menggantikan centang clip-art.
const FITUR = [
  [Route, 'Navigasi rute alternatif'],
  [TrafficCone, 'Pemantau lalu lintas real time'],
  [Ticket, 'Sistem pembayaran terintegrasi transportasi umum'],
  [Megaphone, 'Kampanye kesadaran penggunaan transportasi umum'],
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

// Splash web = halaman sambutan untuk tamu (identitas mockup hal. 1, dimodernkan).
// Ponsel: satu kolom; desktop: judul + tombol di kiri, panel fitur olive di kanan.
export default function Splash() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-splash-bg text-olive">
      <Leaf className="pointer-events-none absolute -left-12 top-24 w-36 -rotate-12 text-leaf lg:-bottom-10 lg:left-[1%] lg:top-auto lg:w-48" />
      <Leaf className="pointer-events-none absolute -right-14 -top-6 w-44 rotate-[18deg] text-leaf lg:right-[4%] lg:w-64" />

      <main className="splash-in relative mx-auto grid min-h-dvh w-full max-w-6xl content-start gap-x-16 px-5 pb-6 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:content-center lg:px-10 lg:py-16">
        <div className="flex items-center gap-3 lg:col-start-1">
          <img src={logo} alt="" width="72" height="56" className="h-auto w-[72px]" />
          <p className="font-serif text-xl leading-[1.05] text-olive-soft">
            SmartMove
            <br />
            Medan
          </p>
        </div>

        <div className="mt-10 lg:col-start-1 lg:mt-12">
          <h1 className="text-[clamp(2.6rem,13vw,4rem)] font-extrabold lg:text-[clamp(3rem,5vw,4.5rem)] uppercase leading-[0.9] tracking-[-0.025em]">
            Permudah
            <br />
            Kegiatanmu
          </h1>
          <p className="mt-4 max-w-[30ch] text-[clamp(1.05rem,4.2vw,1.35rem)] leading-snug text-olive-soft">
            Rute, lalu lintas, dan tiket transportasi umum Medan dalam satu aplikasi.
          </p>
        </div>

        <ul className="mt-8 rounded-[1.75rem] bg-olive px-5 py-2 text-white shadow-[0_18px_40px_-20px_rgb(74_68_40/0.7)] lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:self-center lg:px-8 lg:py-4">
          {FITUR.map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-4 border-b border-white/15 py-4 last:border-0 lg:py-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-olive lg:size-12">
                <Icon size={22} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="text-[0.975rem] leading-snug lg:text-lg">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 lg:col-start-1 lg:mt-12 lg:flex-row">
          <Link
            to="/masuk"
            className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full bg-olive px-8 text-base font-semibold text-white transition hover:brightness-110 lg:flex-none"
          >
            Masuk
          </Link>
          <Link
            to="/daftar"
            className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full border-2 border-olive px-8 text-base font-semibold transition hover:bg-olive/10 lg:flex-none"
          >
            Buat akun
          </Link>
        </div>
      </main>
    </div>
  )
}
