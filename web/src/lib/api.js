import { tr, bahasa } from './i18n.js'
// Klien API web. Autentikasi lewat cookie httpOnly (credentials: 'include').
// Alamat dasar: VITE_API_URL (bila API beda domain) atau '' (dev via proxy Vite / satu domain).
const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = `${ORIGIN}/api`

/** Alamat penuh berkas dari API (mis. foto profil `/uploads/avatars/…`). */
export const fileUrl = (path) => (!path ? null : /^https?:/.test(path) ? path : `${ORIGIN}${path}`)

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function buildUrl(path, query) {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

function defaultMessage(status) {
  if (status === 401) return tr('Sesi berakhir, silakan masuk lagi')
  if (status === 403) return tr('Kamu tidak punya akses')
  if (status === 404) return tr('Data tidak ditemukan')
  if (status === 429) return tr('Terlalu banyak permintaan, coba lagi nanti')
  if (status >= 500) return tr('Terjadi kesalahan pada server')
  return tr('Permintaan gagal')
}

let onUnauthorized = null
/** Daftarkan penangan 401 global (mis. kosongkan sesi & arahkan ke /masuk). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

/**
 * Galat jaringan (status 0): bedakan perangkat offline dari server SmartMove
 * yang tidak terjangkau. `navigator.onLine === false` berarti pasti tanpa jaringan.
 */
export function networkError(online = typeof navigator === 'undefined' || navigator.onLine !== false) {
  return online
    ? new ApiError(0, tr('Tidak bisa terhubung ke server SmartMove. Coba lagi sebentar.'), 'SERVER_TAK_TERJANGKAU')
    : new ApiError(0, tr('Kamu sedang offline'), 'OFFLINE')
}

// ── Server bangun tidur ─────────────────────────────────────────────────────
// API di Render free tidur setelah ±15 menit tanpa trafik; permintaan pertama sesudahnya
// bisa butuh ±60 detik. Selama itu klien menunggu lebih lama, menampilkan "Membangunkan
// server…" (lihat ServerWakeBanner), dan mencoba ulang otomatis — bukan langsung galat.
const MUNGKIN_TIDUR_MS = 14 * 60 * 1000 // tanpa respons selama ini → server mungkin tidur
const TIMEOUT_BANGUN_MS = 70_000 // batas satu percobaan saat server mungkin tidur
const BANGUN_MAKS_MS = 100_000 // total waktu mencoba ulang sebelum menyerah
const TAMPIL_BANGUN_MS = 4_000 // permintaan lambat selama ini → tampilkan status bangun
const JEDA_ULANG_MS = 3_000
const STATUS_SEMENTARA = new Set([502, 503, 504])

let terakhirOk = 0
let membangunkan = false
const pendengarBangun = new Set()

/** Langganan status "server sedang bangun" (true/false). Mengembalikan fungsi berhenti. */
export function onServerWaking(fn) {
  pendengarBangun.add(fn)
  fn(membangunkan)
  return () => pendengarBangun.delete(fn)
}
function aturBangun(v) {
  if (membangunkan === v) return
  membangunkan = v
  for (const fn of pendengarBangun) fn(v)
}

const tunggu = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })

/** Satu percobaan fetch. → Response, atau null bila gagal jaringan / habis waktu. */
async function sekali(url, init, signal, mungkinTidur) {
  const ctl = new AbortController()
  const hentikan = () => ctl.abort(signal.reason)
  if (signal?.aborted) hentikan()
  signal?.addEventListener('abort', hentikan, { once: true })
  const batas = mungkinTidur ? setTimeout(() => ctl.abort(), TIMEOUT_BANGUN_MS) : null
  const lambat = mungkinTidur ? setTimeout(() => aturBangun(true), TAMPIL_BANGUN_MS) : null
  try {
    return await fetch(url, { ...init, signal: ctl.signal })
  } catch (err) {
    if (signal?.aborted) throw err?.name === 'AbortError' ? err : new DOMException('Aborted', 'AbortError')
    return null
  } finally {
    clearTimeout(batas)
    clearTimeout(lambat)
    signal?.removeEventListener('abort', hentikan)
  }
}

/**
 * Panggil API. Melempar ApiError { status, message, code } bila gagal
 * (format galat API_SPECS §1). `body` objek dikirim sebagai JSON; FormData apa adanya.
 */
export async function request(path, { method = 'GET', query, body, signal, headers } = {}) {
  const init = {
    method,
    credentials: 'include',
    // Teks dari API (galat, sapaan, label) mengikuti bahasa pilihan (T-111).
    headers: { Accept: 'application/json', 'Accept-Language': bahasa, ...headers },
  }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const url = buildUrl(path, query)
  // GET aman diulang. Selain GET hanya diulang bila jelas belum diproses API (502/503/504).
  const bolehUlangGagalJaringan = method === 'GET' || method === 'HEAD'
  const mulai = Date.now()
  let res
  for (;;) {
    const mungkinTidur = Date.now() - terakhirOk > MUNGKIN_TIDUR_MS
    res = await sekali(url, init, signal, mungkinTidur)
    const sementara = !res || STATUS_SEMENTARA.has(res.status)
    const online = typeof navigator === 'undefined' || navigator.onLine !== false
    const masihBangun = mungkinTidur || membangunkan
    if (sementara && online && masihBangun && Date.now() - mulai < BANGUN_MAKS_MS && (res || bolehUlangGagalJaringan)) {
      aturBangun(true)
      await tunggu(JEDA_ULANG_MS, signal)
      continue
    }
    break
  }
  aturBangun(false)
  if (!res) throw networkError()
  if (!STATUS_SEMENTARA.has(res.status)) terakhirOk = Date.now()

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.()
    throw new ApiError(res.status, data?.message || defaultMessage(res.status), data?.code)
  }
  return data
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

/** Ubah { lat, lng } ke format query "lat,lng" (API_SPECS §1). */
export const latLng = (p) => `${p.lat},${p.lng}`
