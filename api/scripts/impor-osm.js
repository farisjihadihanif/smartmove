// Impor koridor & halte transportasi umum Medan dari OpenStreetMap (Overpass API).
//
//   npm run impor:osm                         tarik dari Overpass lalu simpan ke MongoDB
//   npm run impor:osm -- --simpan data.json   sekaligus simpan respons mentah ke file
//   npm run impor:osm -- --file data.json     pakai file tersimpan (tanpa permintaan ke Overpass)
//
// Aman diulang: data dikenali lewat osmId, dan data yang dikoreksi admin tidak ditimpa
// (lihat services/transitImport.js). Jangan dijadwalkan lebih sering dari sekali sehari.
import dns from 'node:dns';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import config from '../src/config.js';
import { TransitLine, TransitStop } from '../src/models/index.js';
import { createOverpass, kueriTransit } from '../src/services/overpass.js';
import { olahOverpass } from '../src/services/osmTransit.js';
import { imporTransit } from '../src/services/transitImport.js';

const { values: arg } = parseArgs({
  options: { file: { type: 'string' }, simpan: { type: 'string' } },
});

async function ambilData() {
  if (arg.file) {
    console.log(`Membaca data OSM dari ${arg.file}`);
    return JSON.parse(await fs.readFile(arg.file, 'utf8'));
  }
  const overpass = createOverpass(config, { log: (m) => console.log(m) });
  console.log(`Menarik relasi transportasi umum Mebidang dari ${overpass.url} …`);
  const data = await overpass.ambil(kueriTransit());
  if (arg.simpan) {
    await fs.writeFile(arg.simpan, JSON.stringify(data));
    console.log(`Respons mentah disimpan di ${arg.simpan}`);
  }
  return data;
}

const baris = (label, s) =>
  `${label}: ${s.baru} baru, ${s.diperbarui} diperbarui, ${s.tetap} tetap, ${s.dikunciAdmin} dikunci admin`;

async function main() {
  if (!config.mongoUrl) throw new Error('MONGO_URL belum diisi');
  const data = await ambilData(); // ambil dulu: koneksi DB tidak menganggur selama menunggu Overpass
  const hasil = olahOverpass(data);
  console.log(`Data OSM: ${hasil.koridor.length} koridor, ${hasil.halte.size} halte di wilayah Mebidang`);

  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  await mongoose.connect(config.mongoUrl);
  await Promise.all([TransitLine.init(), TransitStop.init()]);

  const r = await imporTransit(hasil);
  console.log(baris('Koridor', r.koridor));
  console.log(baris('Halte  ', r.halte));
  if (r.koridorTanpaHalte) console.log(`Koridor tanpa halte di OSM (perlu dilengkapi admin): ${r.koridorTanpaHalte}`);
  if (r.hilangDariOsm) console.log(`Koridor OSM lama yang tidak ada lagi di OSM (tidak dihapus): ${r.hilangDariOsm}`);
  for (const d of r.dilewati) console.log(`Dilewati ${d.osmId} "${d.nama}": ${d.alasan}`);

  const [koridor, halte] = await Promise.all([
    TransitLine.countDocuments({ sumber: 'osm' }),
    TransitStop.countDocuments({ sumber: 'osm' }),
  ]);
  console.log(`Total di database (sumber OSM): ${koridor} koridor, ${halte} halte`);
}

main()
  .catch((err) => {
    console.error(`Impor gagal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
