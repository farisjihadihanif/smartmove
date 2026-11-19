// Isi awal tips keselamatan berlalu lintas (T-206). Aman dijalankan berulang:
// tips yang judulnya sudah ada dilewati. Admin bisa mengubah/menonaktifkan dari dasbor.
//   npm run isi:kampanye
import dns from 'node:dns';
import mongoose from 'mongoose';
import config from '../src/config.js';
import Content from '../src/models/Content.js';

const TIPS_AWAL = [
  {
    judul: 'Pakai helm SNI dan kencangkan talinya',
    isi: 'Helm yang talinya tidak dikunci bisa lepas saat benturan. Pastikan pembonceng juga memakai helm.',
  },
  {
    judul: 'Jaga jarak aman tiga detik',
    isi: 'Pilih patokan di pinggir jalan. Saat kendaraan di depan melewatinya, hitung sampai tiga sebelum kamu sampai di patokan yang sama. Tambah jaraknya saat hujan.',
  },
  {
    judul: 'Simpan ponsel saat berkendara',
    isi: 'Atur rute di SmartMove sebelum berangkat. Kalau perlu mengubah tujuan, menepilah dulu di tempat yang aman.',
  },
  {
    judul: 'Nyalakan lampu sein lebih awal',
    isi: 'Beri tanda sekitar 30 meter sebelum berbelok atau pindah lajur supaya pengendara di belakang sempat menyesuaikan.',
  },
  {
    judul: 'Hati-hati di genangan',
    isi: 'Saat banjir, pelankan kendaraan dan hindari genangan yang dasarnya tidak terlihat. Laporkan banjir di Live Traffic supaya warga lain bisa memilih jalan lain.',
  },
  {
    judul: 'Utamakan pejalan kaki di zebra cross',
    isi: 'Berhenti sebelum garis saat ada orang menyeberang, dan jangan mendahului kendaraan yang sedang berhenti di depan penyeberangan.',
  },
];

async function main() {
  if (config.dnsServers) dns.setServers(config.dnsServers);
  await mongoose.connect(config.mongoUrl);
  let baru = 0;
  for (const [i, t] of TIPS_AWAL.entries()) {
    const ada = await Content.exists({ jenis: 'tips', judul: t.judul });
    if (ada) continue;
    await Content.create({ jenis: 'tips', ...t, urutan: i + 1 });
    baru++;
  }
  console.log(`Tips ditambahkan: ${baru}, dilewati: ${TIPS_AWAL.length - baru}`);
  await mongoose.disconnect();
}

await main();
