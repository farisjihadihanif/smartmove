/*
 * Tarif bawaan per golongan angkutan, dipakai otomatis bila tarif koridor masih `null`.
 * Semua tarif yang bukan diisi admin (`tarifSumber !== 'admin'`) ditandai perkiraan,
 * dan klien menampilkan "Tarif perkiraan".
 *
 * Sumber (dicek 19 November 2026):
 * - Bus listrik / Trans Metro Deli: Rp5.000 umum, Keputusan Wali Kota Medan No. 550/16.K,
 *   berlaku 1 Januari 2025 (portal.medan.go.id, Antara Sumut). Pelajar/lansia/difabel
 *   Rp3.000 — belum dipakai karena aplikasi belum membedakan penumpang.
 * - Angkot: aturan tarif resmi terbaru tidak ditemukan. Perwal Medan 24/2013 menetapkan
 *   Rp4.500 per estafet (sudah lama); berita Okt 2022 (program Sibonas) menyebut penumpang
 *   membayar Rp5.000 per estafet. Dipakai Rp5.000 sebagai PERKIRAAN.
 * - Kereta: tarif berbeda per lintas/kelas, tidak ada bawaan (tetap "Tarif belum tersedia").
 */
export const TARIF_BAWAAN = {
  bus_listrik: { tarif: 5000, dasar: 'Keputusan Wali Kota Medan No. 550/16.K (berlaku 1 Januari 2025)' },
  angkot: { tarif: 5000, dasar: 'Perkiraan; tarif resmi angkot terbaru tidak ditemukan' },
};

const TMD = /trans\s*metro\s*deli|bus\s*listrik/i;

// Golongan tarif. Trans Metro Deli di data OSM ada yang bertanda angkot, jadi dikenali
// dari kode/operator/nama, bukan dari `jenis`. Bus lain di Medan = angkutan kota.
export function golonganTarif(l) {
  if (l.jenis === 'kereta') return null;
  if (/^TMD-/i.test(l.kode || '') || TMD.test(`${l.operator || ''} ${l.nama || ''}`)) return 'bus_listrik';
  return 'angkot';
}

// → { tarif: number|null, tarifPerkiraan: boolean }
export function tarifKoridor(l) {
  if (l.tarif !== null && l.tarif !== undefined) {
    return { tarif: l.tarif, tarifPerkiraan: l.tarifSumber !== 'admin' };
  }
  const bawaan = TARIF_BAWAAN[golonganTarif(l)];
  return bawaan ? { tarif: bawaan.tarif, tarifPerkiraan: true } : { tarif: null, tarifPerkiraan: false };
}
