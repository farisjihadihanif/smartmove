import kota from '../cities/index.js';

/*
 * Tarif bawaan per golongan angkutan, dipakai otomatis bila tarif koridor masih `null`.
 * Semua tarif yang bukan diisi admin (`tarifSumber !== 'admin'`) ditandai perkiraan,
 * dan klien menampilkan "Tarif perkiraan".
 *
 * Nilai, sumber, dan aturan golongan per kota ada di config kota (src/cities/<kota>.js `tarif`).
 */
export const TARIF_BAWAAN = kota.tarif.bawaan;

// Golongan tarif dari kode/operator/nama koridor (aturan di config kota). Kereta tanpa bawaan.
export function golonganTarif(l, aturan = kota.tarif) {
  if (l.jenis === 'kereta') return null;
  const teks = `${l.operator || ''} ${l.nama || ''}`;
  const g = aturan.golongan.find((x) => x.kode?.test(l.kode || '') || x.pola?.test(teks));
  return g ? g.golongan : aturan.golonganLain;
}

// → { tarif: number|null, tarifPerkiraan: boolean }
export function tarifKoridor(l) {
  if (l.tarif !== null && l.tarif !== undefined) {
    return { tarif: l.tarif, tarifPerkiraan: l.tarifSumber !== 'admin' };
  }
  const bawaan = TARIF_BAWAAN[golonganTarif(l)];
  return bawaan ? { tarif: bawaan.tarif, tarifPerkiraan: true } : { tarif: null, tarifPerkiraan: false };
}
