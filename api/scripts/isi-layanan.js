// Isi awal katalog pemesanan (BookableService, T-301). SEMUA data simulasi: harga & jadwal
// hanya contoh untuk Digital Payment (Keputusan #3), bukan jadwal resmi operator.
// Aman dijalankan berulang: kode yang sudah ada dilewati (perubahan admin tidak ditimpa).
//   npm run isi:layanan
import dns from 'node:dns';
import mongoose from 'mongoose';
import config from '../src/config.js';
import BookableService from '../src/models/BookableService.js';

const LAYANAN_AWAL = [
  {
    kode: 'RAILINK-KNO',
    jenis: 'kereta',
    operator: 'Railink',
    nama: 'Kereta Bandara Medan → Kualanamu',
    asal: 'Stasiun Medan',
    tujuan: 'Bandara Kualanamu',
    jadwal: ['05:20', '06:40', '08:00', '09:45', '11:30', '13:15', '15:00', '16:45', '18:30', '20:15'],
    harga: 35000,
  },
  {
    kode: 'RAILINK-MDN',
    jenis: 'kereta',
    operator: 'Railink',
    nama: 'Kereta Bandara Kualanamu → Medan',
    asal: 'Bandara Kualanamu',
    tujuan: 'Stasiun Medan',
    jadwal: ['06:30', '08:10', '09:50', '11:35', '13:20', '15:05', '16:50', '18:35', '20:20', '22:00'],
    harga: 35000,
  },
  {
    kode: 'KRL-BINJAI',
    jenis: 'kereta',
    operator: 'KAI Commuter',
    nama: 'Sri Lelawangsa Medan → Binjai',
    asal: 'Stasiun Medan',
    tujuan: 'Stasiun Binjai',
    jadwal: ['05:45', '07:15', '09:30', '12:00', '14:30', '17:00', '19:10'],
    harga: 5000,
  },
  {
    kode: 'BUS-KNO',
    jenis: 'bus',
    operator: 'Bus Bandara',
    nama: 'Bus Bandara Lapangan Merdeka → Kualanamu',
    asal: 'Lapangan Merdeka',
    tujuan: 'Bandara Kualanamu',
    jadwal: ['04:30', '06:00', '07:30', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'],
    harga: 30000,
  },
  {
    kode: 'ANTARKOTA-PARAPAT',
    jenis: 'bus_antarkota',
    operator: 'Bus antarkota',
    nama: 'Medan → Parapat (Danau Toba)',
    asal: 'Terminal Amplas',
    tujuan: 'Parapat',
    jadwal: ['07:00', '09:00', '13:00', '20:00'],
    harga: 75000,
  },
  {
    kode: 'TRAVEL-BERASTAGI',
    jenis: 'travel',
    operator: 'Travel Medan–Karo',
    nama: 'Travel Medan → Berastagi',
    asal: 'Padang Bulan',
    tujuan: 'Berastagi',
    jadwal: ['06:00', '08:00', '10:00', '13:00', '16:00'],
    harga: 40000,
  },
  {
    kode: 'TRAVEL-SIANTAR',
    jenis: 'travel',
    operator: 'Travel Medan–Siantar',
    nama: 'Travel Medan → Pematangsiantar',
    asal: 'Jl. Sisingamangaraja',
    tujuan: 'Pematangsiantar',
    jadwal: ['06:30', '09:30', '12:30', '15:30', '18:30'],
    harga: 60000,
  },
  {
    kode: 'PARKIR-MERDEKA',
    jenis: 'parkir',
    operator: 'Parkir kota',
    nama: 'Parkir Lapangan Merdeka (mobil)',
    asal: 'Lapangan Merdeka',
    jadwal: [],
    harga: 5000,
  },
  {
    kode: 'PARKIR-KNO',
    jenis: 'parkir',
    operator: 'Parkir bandara',
    nama: 'Parkir Bandara Kualanamu (mobil)',
    asal: 'Bandara Kualanamu',
    jadwal: [],
    harga: 8000,
  },
];

async function main() {
  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  await mongoose.connect(config.mongoUrl);
  let baru = 0;
  for (const l of LAYANAN_AWAL) {
    if (await BookableService.exists({ kode: l.kode })) continue;
    await BookableService.create(l);
    baru++;
  }
  console.log(`Layanan ditambahkan: ${baru}, dilewati: ${LAYANAN_AWAL.length - baru}`);
  await mongoose.disconnect();
}

await main();
