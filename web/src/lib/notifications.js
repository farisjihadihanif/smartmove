// "Belum dibaca" untuk lonceng Beranda, dihitung di perangkat (API_SPECS §5):
// simpan kapan panel notifikasi terakhir dibuka, lalu hitung notifikasi yang `muncul` setelahnya.
// Samakan dengan mobile/lib/notifications.dart.

export const seenKey = (userId) => `smartmove:notif-dibuka:${userId}`

/** Waktu terakhir dibuka (ms) atau null bila belum pernah / penyimpanan tidak bisa dibaca. */
export function readLastSeen(userId) {
  try {
    const v = Number(localStorage.getItem(seenKey(userId)))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** Simpan waktu server saat panel dibuka. Gagal simpan (mode privat) diabaikan. */
export function writeLastSeen(userId, iso) {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return
  try {
    localStorage.setItem(seenKey(userId), String(ms))
  } catch {
    /* penyimpanan diblokir: angka kembali muncul di kunjungan berikutnya */
  }
}

const shownAt = (n) => new Date(n.muncul ?? n.waktu).getTime()

/** True bila notifikasi muncul setelah `lastSeen` (ms). Belum pernah dibuka = semua belum dibaca. */
export const isUnread = (n, lastSeen) => lastSeen == null || shownAt(n) > lastSeen

export const countUnread = (list, lastSeen) => (list || []).filter((n) => isUnread(n, lastSeen)).length
