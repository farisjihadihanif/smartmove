import bcrypt from 'bcrypt';

// Cost lebih rendah saat tes supaya cepat; produksi 12.
const rounds = () => (process.env.NODE_ENV === 'test' ? 4 : 12);

export const hashPassword = (plain) => bcrypt.hash(plain, rounds());
export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Hash tiruan untuk menyamakan waktu respons saat akun tidak ditemukan.
let dummyHash;
export async function checkDummy(plain) {
  dummyHash ??= await bcrypt.hash('bukan-password-siapa-pun', rounds());
  await bcrypt.compare(plain, dummyHash);
  return false;
}
