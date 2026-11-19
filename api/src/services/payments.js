// Pembayaran (simulasi). Bagian lain (Snap, notifikasi, cron) menyusul di T-301.

export const LABEL_PENGGUNA_DIHAPUS = 'Pengguna dihapus';

/**
 * Pemilik transaksi untuk tampilan admin (`/admin/payments`, T-304). Akun yang sudah dihapus
 * admin → `{ id: null, username: null, label: "Pengguna dihapus" }`; transaksinya tetap utuh.
 * `p.user` boleh berupa id atau dokumen hasil populate('user', 'username').
 */
export function pemilikPembayaran(p) {
  if (p.penggunaDihapus || !p.user) return { id: null, username: null, label: LABEL_PENGGUNA_DIHAPUS };
  const username = p.user.username ?? null;
  return { id: String(p.user._id ?? p.user), username, label: username };
}
