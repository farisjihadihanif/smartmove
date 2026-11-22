import config from '../config.js';
import medan from './medan.js';

// Registri kota (T-112). Satu deployment melayani satu kota aktif, dipilih lewat
// variabel lingkungan CITY (bawaan: medan). Rencana multi-kota: ARCHITECTURE §11.
export const KOTA = { [medan.id]: medan };

export function pilihKota(id = config.city) {
  const kota = KOTA[String(id).toLowerCase()];
  if (!kota) throw new Error(`Kota tidak dikenal: ${id} (tersedia: ${Object.keys(KOTA).join(', ')})`);
  return kota;
}

/** Kota aktif deployment ini. */
const kota = pilihKota();
export default kota;
