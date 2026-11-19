import { useId, useRef, useState } from 'react'
import { Camera, Check, ChevronRight, Eye, EyeOff, LayoutDashboard, Loader2, LogOut, Receipt, Gift } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner.jsx'
import PageShell from '../components/PageShell.jsx'
import PilihTema from '../components/PilihTema.jsx'
import { api, fileUrl } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'

const FOTO_MAKS = 2 * 1024 * 1024
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const sejak = (iso) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return `${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
const kelasIsian =
  'mt-1.5 w-full min-h-touch rounded-2xl bg-search px-4 text-[15px] outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-pill-via'

/**
 * Akun (DESIGN §3, T-116): foto profil, nama & username, ganti password, pengaturan (Tampilan),
 * riwayat pemesanan, dasbor admin, keluar. API: PATCH /users/me, PUT /users/me/password.
 */
export default function Akun() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <PageShell title="Akun">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12 lg:pt-10">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Identitas user={user} />
          <Pengaturan user={user} />
        </aside>
        <div className="min-w-0 space-y-10">
          <FormProfil key={`${user.username}|${user.namaLengkap}`} user={user} />
          <FormPassword />
        </div>
      </div>
    </PageShell>
  )
}

function Identitas({ user }) {
  const { updateUser } = useAuth()
  const input = useRef(null)
  const [state, setState] = useState({ jalan: false, error: null })
  const foto = fileUrl(user.foto)
  const nama = user.namaLengkap || user.username
  const inisial = nama.trim().charAt(0).toUpperCase()

  async function unggah(file) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setState({ jalan: false, error: { message: 'Foto harus berupa gambar JPG, PNG, atau WEBP.' } })
      return
    }
    if (file.size > FOTO_MAKS) {
      setState({ jalan: false, error: { message: 'Ukuran foto maksimal 2 MB.' } })
      return
    }
    setState({ jalan: true, error: null })
    const data = new FormData()
    data.append('foto', file)
    try {
      const res = await api.patch('/users/me', data)
      updateUser(res.user)
      setState({ jalan: false, error: null })
    } catch (error) {
      setState({ jalan: false, error })
    }
  }

  return (
    <section aria-label="Profil" className="flex flex-col items-center text-center lg:items-start lg:text-left">
      <div className="relative">
        <div className="grid size-28 place-items-center overflow-hidden rounded-full bg-login-avatar font-serif text-[2.75rem] text-white ring-4 ring-card shadow-[0_10px_24px_-12px_rgb(65_57_111/0.7)]">
          {foto ? <img src={foto} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{inisial}</span>}
          {state.jalan && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
              <Loader2 size={28} className="animate-spin text-white" aria-label="Mengunggah foto" />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={state.jalan}
          aria-label={foto ? 'Ganti foto profil' : 'Tambah foto profil'}
          className="bg-pill absolute -bottom-1 -right-1 grid size-touch place-items-center rounded-full text-white ring-4 ring-surface disabled:opacity-60"
        >
          <Camera size={20} aria-hidden="true" />
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            unggah(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      <h2 className="mt-4 font-serif text-[1.75rem] leading-tight">{nama}</h2>
      <p className="text-[15px] text-ink/65">@{user.username}</p>
      <p className="text-[14px] text-ink/55">{user.email}</p>
      {user.createdAt && <p className="mt-1 text-[13px] text-ink/50">Bergabung {sejak(user.createdAt)}</p>}
      <p className="mt-2 text-[12px] text-ink/50">Foto JPG, PNG, atau WEBP, maksimal 2 MB.</p>
      {state.error && <ErrorBanner error={state.error} onDismiss={() => setState({ jalan: false, error: null })} className="mt-3 w-full" />}
    </section>
  )
}

function BarisTautan({ to, icon: Icon, children }) {
  return (
    <Link to={to} className="flex min-h-[3.5rem] items-center gap-3 border-t border-ink/[0.07] text-[15px] font-semibold hover:text-ink-violet">
      <Icon size={20} className="text-ink-violet" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      <ChevronRight size={18} className="text-ink/40" aria-hidden="true" />
    </Link>
  )
}

function Pengaturan({ user }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <section aria-label="Pengaturan" className="mt-8">
      <PilihTema className="pb-3" />
      <BarisTautan to="/pembayaran/riwayat" icon={Receipt}>
        Riwayat pemesanan
      </BarisTautan>
      <BarisTautan to="/rewards" icon={Gift}>
        Rewards
      </BarisTautan>
      {user.role === 'admin' && (
        <BarisTautan to="/admin" icon={LayoutDashboard}>
          Dasbor admin
        </BarisTautan>
      )}
      <button
        type="button"
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
        className="flex min-h-[3.5rem] w-full items-center gap-3 border-t border-ink/[0.07] text-left text-[15px] font-semibold text-[#B42318]"
      >
        <LogOut size={20} aria-hidden="true" />
        Keluar
      </button>
    </section>
  )
}

function Berhasil({ children }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[14px] font-semibold text-[#1D6B3D]">
      <Check size={18} aria-hidden="true" />
      {children}
    </p>
  )
}

function FormProfil({ user }) {
  const { updateUser } = useAuth()
  const [nama, setNama] = useState(user.namaLengkap ?? '')
  const [username, setUsername] = useState(user.username)
  const [state, setState] = useState({ jalan: false, error: null, ok: false })
  const berubah = nama.trim() !== (user.namaLengkap ?? '') || username.trim().toLowerCase() !== user.username

  async function simpan(e) {
    e.preventDefault()
    setState({ jalan: true, error: null, ok: false })
    try {
      const res = await api.patch('/users/me', { namaLengkap: nama.trim(), username: username.trim().toLowerCase() })
      setState({ jalan: false, error: null, ok: true })
      updateUser(res.user)
    } catch (error) {
      setState({ jalan: false, error, ok: false })
    }
  }

  return (
    <form onSubmit={simpan} aria-labelledby="judul-profil" className="max-w-xl">
      <h2 id="judul-profil" className="font-serif text-[1.5rem] leading-tight">
        Profil
      </h2>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold">Nama lengkap</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} autoComplete="name" className={kelasIsian} />
        </label>
        <div>
          <label htmlFor="isian-username" className="text-sm font-semibold">
            Username
          </label>
          <span className="mt-1.5 flex min-h-touch items-center rounded-2xl bg-search ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-pill-via">
            <span className="pl-4 text-ink/50" aria-hidden="true">
              @
            </span>
            <input
              id="isian-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9_.]{3,30}"
              autoComplete="username"
              className="h-full min-h-touch w-full flex-1 bg-transparent pr-4 pl-1 text-[15px] outline-none"
              aria-describedby="petunjuk-username"
            />
          </span>
          <span id="petunjuk-username" className="mt-1 block text-[12px] text-ink/55">
            3–30 karakter: huruf kecil, angka, titik, atau garis bawah. Dipakai untuk masuk.
          </span>
        </div>
      </div>
      {state.error && <ErrorBanner error={state.error} className="mt-4" />}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!berubah || state.jalan}
          className="flex min-h-touch items-center gap-2 rounded-full bg-login-button px-6 font-semibold text-white disabled:opacity-50"
        >
          {state.jalan && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          Simpan profil
        </button>
        {state.ok && !berubah && <Berhasil>Profil disimpan.</Berhasil>}
      </div>
    </form>
  )
}

function IsianPassword({ label, value, onChange, autoComplete, describedBy }) {
  const [lihat, setLihat] = useState(false)
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <span className="mt-1.5 flex min-h-touch items-center rounded-2xl bg-search ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-pill-via">
        <input
          id={id}
          type={lihat ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          maxLength={72}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          className="h-full min-h-touch w-full flex-1 bg-transparent pl-4 text-[15px] outline-none"
        />
        <button
          type="button"
          onClick={() => setLihat(!lihat)}
          aria-label={lihat ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
          className="grid size-touch shrink-0 place-items-center text-ink/55"
        >
          {lihat ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </span>
    </div>
  )
}

function FormPassword() {
  const { updateUser } = useAuth()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [state, setState] = useState({ jalan: false, error: null, ok: false })
  const beda = ulang.length > 0 && ulang !== baru
  const pendek = baru.length > 0 && baru.length < 8

  async function simpan(e) {
    e.preventDefault()
    if (beda || pendek) return
    setState({ jalan: true, error: null, ok: false })
    try {
      const res = await api.put('/users/me/password', { passwordLama: lama, passwordBaru: baru })
      updateUser(res.user)
      setLama('')
      setBaru('')
      setUlang('')
      setState({ jalan: false, error: null, ok: true })
    } catch (error) {
      setState({ jalan: false, error, ok: false })
    }
  }

  return (
    <form onSubmit={simpan} aria-labelledby="judul-password" className="max-w-xl border-t border-ink/[0.07] pt-8">
      <h2 id="judul-password" className="font-serif text-[1.5rem] leading-tight">
        Ganti password
      </h2>
      <p className="mt-1 text-[14px] text-ink/60">Setelah diganti, perangkat lain yang masuk dengan akun ini otomatis keluar.</p>
      <div className="mt-4 space-y-4">
        <IsianPassword label="Password lama" value={lama} onChange={setLama} autoComplete="current-password" />
        <IsianPassword label="Password baru" value={baru} onChange={setBaru} autoComplete="new-password" describedBy="petunjuk-pw" />
        <p id="petunjuk-pw" className={`-mt-2 text-[12px] ${pendek ? 'text-[#B42318]' : 'text-ink/55'}`}>
          Minimal 8 karakter.
        </p>
        <IsianPassword label="Ulangi password baru" value={ulang} onChange={setUlang} autoComplete="new-password" describedBy="petunjuk-ulang" />
        {beda && (
          <p id="petunjuk-ulang" className="-mt-2 text-[12px] text-[#B42318]">
            Belum sama dengan password baru.
          </p>
        )}
      </div>
      {state.error && <ErrorBanner error={state.error} className="mt-4" />}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!lama || !baru || !ulang || beda || pendek || state.jalan}
          className="flex min-h-touch items-center gap-2 rounded-full bg-login-button px-6 font-semibold text-white disabled:opacity-50"
        >
          {state.jalan && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          Simpan password
        </button>
        {state.ok && <Berhasil>Password diganti.</Berhasil>}
      </div>
    </form>
  )
}
