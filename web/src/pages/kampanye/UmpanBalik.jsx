import { useState } from 'react'
import { Loader2, LogIn, Send, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PageShell from '../../components/PageShell.jsx'
import { api } from '../../lib/api.js'
import { FITUR, LABEL_RATING } from '../../lib/kampanye.js'
import { useAuth } from '../../lib/useAuth.js'

// Umpan Balik (T-207): rating 1–5, fitur (opsional), komentar ≤ 1000 → POST /campaign/feedback.
// Tamu melihat ajakan masuk (umpan balik tercatat per pengguna).
export default function UmpanBalik() {
  const { user } = useAuth()
  return (
    <PageShell title="Umpan Balik" backTo="/kampanye" backLabel="Kembali ke Kampanye">
      <div className="mx-auto w-full max-w-xl pt-6 lg:pt-10">{user ? <Form /> : <AjakMasuk />}</div>
    </PageShell>
  )
}

function AjakMasuk() {
  return (
    <div className="rounded-3xl bg-lilac-wash/25 p-6 text-center">
      <h2 className="font-serif text-[1.375rem]">Masuk dulu untuk memberi masukan</h2>
      <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink/70">
        Satu akun bisa mengirim beberapa masukan, jadi kami bisa menindaklanjutinya.
      </p>
      <Link
        to="/masuk"
        state={{ from: '/kampanye/umpan-balik' }}
        className="mt-5 inline-flex min-h-touch items-center gap-2 rounded-full bg-login-button px-6 font-semibold text-white"
      >
        <LogIn size={18} aria-hidden="true" /> Masuk
      </Link>
    </div>
  )
}

function Form() {
  const [rating, setRating] = useState(0)
  const [fitur, setFitur] = useState(null)
  const [komentar, setKomentar] = useState('')
  const [status, setStatus] = useState({ kirim: false, error: null, selesai: false, poin: 0 })

  async function kirim(e) {
    e.preventDefault()
    if (!rating) return
    setStatus({ kirim: true, error: null, selesai: false })
    try {
      const res = await api.post('/campaign/feedback', { rating, komentar: komentar.trim() || undefined, fitur: fitur ?? undefined })
      setStatus({ kirim: false, error: null, selesai: true, poin: res?.poin ?? 0 })
    } catch (error) {
      setStatus({ kirim: false, error, selesai: false })
    }
  }

  if (status.selesai) {
    return (
      <div role="status" className="sheet-fade rounded-3xl bg-lilac-wash/25 p-6 text-center">
        <h2 className="font-serif text-[1.5rem]">Terima kasih!</h2>
        <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink/70">
          Masukanmu sudah terkirim dan akan dibaca tim SmartMove Medan.
          {status.poin > 0 && ` Kamu dapat +${status.poin} poin.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/kampanye" className="inline-flex min-h-touch items-center rounded-full bg-login-button px-6 font-semibold text-white">
            Kembali ke Kampanye
          </Link>
          <button
            type="button"
            onClick={() => {
              setRating(0)
              setFitur(null)
              setKomentar('')
              setStatus({ kirim: false, error: null, selesai: false })
            }}
            className="min-h-touch rounded-full px-5 font-semibold text-ink-violet ring-1 ring-ink-violet/30 hover:bg-ink-violet/5"
          >
            Kirim masukan lain
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={kirim} className="flex flex-col gap-7">
      <fieldset>
        <legend className="font-serif text-[1.375rem] leading-tight">Seberapa membantu SmartMove buatmu?</legend>
        <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Nilai">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} dari 5, ${LABEL_RATING[n].toLowerCase()}`}
              onClick={() => setRating(n)}
              className="grid size-12 place-items-center rounded-full transition hover:bg-traffic-padat/10 active:scale-90"
            >
              <Star
                size={34}
                strokeWidth={1.6}
                aria-hidden="true"
                className={n <= rating ? 'fill-traffic-padat text-[#B26A00]' : 'text-ink/30'}
              />
            </button>
          ))}
          <span className="ml-2 text-[15px] font-semibold text-ink/75" aria-live="polite">
            {LABEL_RATING[rating]}
          </span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Tentang fitur apa? (boleh dilewati)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FITUR.map((f) => {
            const on = fitur === f.value
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFitur(on ? null : f.value)}
                className={`min-h-touch rounded-full px-4 text-sm font-semibold transition ${
                  on ? 'bg-ink-violet text-white' : 'bg-white text-ink/80 ring-1 ring-ink/15 hover:bg-ink/[0.04]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Ceritakan lebih lanjut (boleh kosong)</span>
        <textarea
          value={komentar}
          onChange={(e) => setKomentar(e.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Apa yang sudah bagus, apa yang perlu diperbaiki?"
          className="mt-2 w-full resize-y rounded-2xl bg-search px-4 py-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-pill-via"
        />
        <span className="mt-1 block text-right text-xs tabular-nums text-ink/50">{komentar.length}/1000</span>
      </label>

      {status.error && <ErrorBanner error={status.error} />}

      <button
        type="submit"
        disabled={!rating || status.kirim}
        className="flex min-h-touch items-center justify-center gap-2 rounded-full bg-login-button text-base font-semibold text-white shadow-[0_6px_18px_-6px_rgb(115_36_169/0.7)] transition hover:brightness-110 disabled:opacity-50"
      >
        {status.kirim ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        Kirim umpan balik
      </button>
      {!rating && <p className="-mt-4 text-center text-[13px] text-ink/55">Pilih bintang dulu untuk mengirim.</p>}
    </form>
  )
}
