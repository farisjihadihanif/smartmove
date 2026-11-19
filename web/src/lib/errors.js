// Pemetaan galat → teks pengguna (DESIGN §5). Dipakai ErrorBanner dan layar lain.
const BY_CODE = {
  OFFLINE: 'Kamu sedang offline',
  SERVER_TAK_TERJANGKAU: 'Tidak bisa terhubung ke server SmartMove. Coba lagi sebentar.',
  DI_LUAR_WILAYAH: 'SmartMove baru melayani Medan dan sekitarnya.',
  LAYANAN_PETA_GAGAL: 'Rute belum bisa dihitung. Coba lagi atau buka di OpenStreetMap.',
  POIN_KURANG: 'Poinmu belum cukup untuk voucher ini.',
  RUTE_TIDAK_ADA: 'Tidak ada jalan untuk moda ini di antara kedua titik. Coba moda lain atau geser titiknya.',
  FOTO_JALAN_NONAKTIF: 'Foto jalan belum tersedia saat ini.',
}

/** Ambil pesan untuk galat API (ApiError) atau galat apa pun. */
export function errorMessage(err) {
  if (!err) return ''
  if (typeof err === 'string') return err
  return BY_CODE[err.code] || err.message || 'Terjadi kesalahan. Coba lagi.'
}

/** True bila perangkat tidak punya internet. */
export const isOffline = (err) => err?.code === 'OFFLINE'

/** True bila galat jaringan apa pun (offline atau server tak terjangkau). */
export const isNetworkError = (err) => err?.status === 0
