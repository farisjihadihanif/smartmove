// Pemetaan galat → teks pengguna (DESIGN §5). Dipakai ErrorBanner dan layar lain.
const BY_CODE = {
  JARINGAN: 'Kamu sedang offline. Periksa koneksi, lalu coba lagi.',
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

/** True bila galat berasal dari jaringan (tidak terhubung ke server). */
export const isOffline = (err) => err?.code === 'JARINGAN' || err?.status === 0
