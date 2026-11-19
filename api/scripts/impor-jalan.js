// Impor geometri koridor jalan utama Medan dari OpenStreetMap (Overpass API).
//
//   npm run impor:jalan                         tarik dari Overpass lalu simpan ke MongoDB
//   npm run impor:jalan -- --simpan data.json   sekaligus simpan respons mentah ke file
//   npm run impor:jalan -- --file data.json     pakai file tersimpan (tanpa permintaan ke Overpass)
//
// Aman diulang: dikenali lewat `kode`, koridor yang dikoreksi admin tidak ditimpa, dan
// koridor yang tidak ditemukan tidak dihapus (lihat services/roadCorridors.js).
import dns from 'node:dns';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import config from '../src/config.js';
import RoadCorridor from '../src/models/RoadCorridor.js';
import { createOverpass } from '../src/services/overpass.js';
import { imporKoridorJalan, kueriKoridorJalan, olahKoridorJalan } from '../src/services/roadCorridors.js';

const { values: arg } = parseArgs({
  options: { file: { type: 'string' }, simpan: { type: 'string' } },
});

async function ambilData() {
  if (arg.file) {
    console.log(`Membaca data OSM dari ${arg.file}`);
    return JSON.parse(await fs.readFile(arg.file, 'utf8'));
  }
  const overpass = createOverpass(config, { log: (m) => console.log(m) });
  console.log(`Menarik ruas jalan utama Kota Medan dari ${overpass.url} …`);
  const data = await overpass.ambil(kueriKoridorJalan());
  if (arg.simpan) {
    await fs.writeFile(arg.simpan, JSON.stringify(data));
    console.log(`Respons mentah disimpan di ${arg.simpan}`);
  }
  return data;
}

async function main() {
  if (!config.mongoUrl) throw new Error('MONGO_URL belum diisi');
  const data = await ambilData();
  const hasil = olahKoridorJalan(data);
  for (const k of hasil.koridor) {
    console.log(`${k.kode.padEnd(13)} ${(k.panjangM / 1000).toFixed(1).padStart(5)} km  ${k.jumlahWay} way  (${k.namaOsm.join(', ')})`);
  }
  for (const c of hasil.catatan) console.log(`Catatan ${c.kode}: ${c.pesan}`);

  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  await mongoose.connect(config.mongoUrl);
  await RoadCorridor.init();
  const s = await imporKoridorJalan(hasil);
  console.log(`Koridor jalan: ${s.baru} baru, ${s.diperbarui} diperbarui, ${s.tetap} tetap, ${s.dikunciAdmin} dikunci admin`);
}

main()
  .catch((err) => {
    console.error(`Impor gagal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
