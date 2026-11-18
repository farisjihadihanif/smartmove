// Klien API web. Autentikasi lewat cookie httpOnly (credentials: 'include').
// Alamat dasar: VITE_API_URL (bila API beda domain) atau '' (dev via proxy Vite / satu domain).
const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`

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
  if (status === 401) return 'Sesi berakhir, silakan masuk lagi'
  if (status === 403) return 'Kamu tidak punya akses'
  if (status === 404) return 'Data tidak ditemukan'
  if (status === 429) return 'Terlalu banyak permintaan, coba lagi nanti'
  if (status >= 500) return 'Terjadi kesalahan pada server'
  return 'Permintaan gagal'
}

let onUnauthorized = null
/** Daftarkan penangan 401 global (mis. kosongkan sesi & arahkan ke /masuk). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

/**
 * Panggil API. Melempar ApiError { status, message, code } bila gagal
 * (format galat API_SPECS §1). `body` objek dikirim sebagai JSON; FormData apa adanya.
 */
export async function request(path, { method = 'GET', query, body, signal, headers } = {}) {
  const init = {
    method,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json', ...headers },
  }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(buildUrl(path, query), init)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.', 'JARINGAN')
  }

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
