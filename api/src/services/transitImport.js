import TransitLine from '../models/TransitLine.js';
import TransitStop from '../models/TransitStop.js';
import { buatKode } from './osmTransit.js';

// Menyimpan hasil `olahOverpass()` ke MongoDB. Aman dijalankan berulang:
// - identitas data = `osmId` (index unik), jadi impor ulang memperbarui, tidak menggandakan;
// - dokumen `dikoreksiAdmin: true` tidak disentuh sama sekali (termasuk daftar halte koridornya);
// - kolom milik admin (`tarif`, `kecepatanRataKmj`, `aktif`, `kode`) tidak pernah ditimpa;
//   tarif dari tag OSM `charge` hanya dipakai bila tarif masih kosong;
// - koridor yang hilang dari OSM tidak dihapus, hanya dilaporkan.

const KOLOM_OSM = ['nama', 'jenis', 'operator', 'warna', 'jamOperasi', 'jalur'];
const samaNilai = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const jalurPolos = (j) => (j ? { type: j.type, coordinates: j.coordinates } : undefined);
const lokasiPolos = (l) => ({ type: l.type, coordinates: l.coordinates });

const hitung = () => ({ baru: 0, diperbarui: 0, tetap: 0, dikunciAdmin: 0 });

async function imporHalte(daftar, statistik) {
  const ada = new Map(
    (await TransitStop.find({ osmId: { $in: daftar.map((h) => h.osmId) } }).lean()).map((s) => [s.osmId, s]),
  );
  const baru = [];
  const ops = [];
  const idPerOsm = new Map(); // osmId → _id, hanya halte yang boleh diatur impor
  const diubah = new Set();

  for (const h of daftar) {
    const e = ada.get(h.osmId);
    if (!e) {
      baru.push({ ...h, sumber: 'osm', lines: [] });
    } else if (e.dikoreksiAdmin) {
      statistik.dikunciAdmin++;
    } else {
      idPerOsm.set(h.osmId, e._id);
      if (e.nama !== h.nama || !samaNilai(lokasiPolos(e.lokasi), h.lokasi)) {
        ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { nama: h.nama, lokasi: h.lokasi } } } });
        diubah.add(String(e._id));
      }
    }
  }
  if (baru.length) {
    const dibuat = await TransitStop.insertMany(baru);
    for (const s of dibuat) idPerOsm.set(s.osmId, s._id);
  }
  if (ops.length) await TransitStop.bulkWrite(ops, { ordered: false });
  statistik.baru += baru.length;
  return { idPerOsm, diubah, idBaru: new Set(baru.map((h) => h.osmId)) };
}

async function imporKoridor(daftar, statistik, sekarang) {
  const ada = new Map(
    (await TransitLine.find({ osmId: { $in: daftar.map((k) => k.osmId) } }).lean()).map((l) => [l.osmId, l]),
  );
  const terpakai = new Set(await TransitLine.distinct('kode'));
  const baru = [];
  const ops = [];
  const dikelola = []; // { _id, halte } koridor yang daftar haltenya diatur impor

  for (const k of daftar) {
    const e = ada.get(k.osmId);
    const nilai = k;
    if (!e) {
      const doc = {
        kode: buatKode(k, terpakai),
        sumber: 'osm',
        osmId: k.osmId,
        tarif: k.tarif ?? null,
        diperbaruiPada: sekarang,
      };
      for (const f of KOLOM_OSM) if (nilai[f] !== undefined) doc[f] = nilai[f];
      baru.push({ doc, halte: k.halte });
      continue;
    }
    if (e.dikoreksiAdmin) {
      statistik.dikunciAdmin++;
      continue;
    }
    dikelola.push({ _id: e._id, halte: k.halte });
    const $set = {};
    const $unset = {};
    for (const f of KOLOM_OSM) {
      const lama = f === 'jalur' ? jalurPolos(e.jalur) : e[f];
      if (samaNilai(lama, nilai[f])) continue;
      if (nilai[f] === undefined) $unset[f] = '';
      else $set[f] = nilai[f];
    }
    if ((e.tarif === null || e.tarif === undefined) && k.tarif) $set.tarif = k.tarif;
    if (Object.keys($set).length || Object.keys($unset).length) {
      $set.diperbaruiPada = sekarang;
      const update = { $set };
      if (Object.keys($unset).length) update.$unset = $unset;
      ops.push({ updateOne: { filter: { _id: e._id }, update } });
      statistik.diperbarui++;
    } else {
      statistik.tetap++;
    }
  }

  if (baru.length) {
    const dibuat = await TransitLine.insertMany(baru.map((b) => b.doc));
    dibuat.forEach((l, i) => dikelola.push({ _id: l._id, halte: baru[i].halte }));
  }
  if (ops.length) await TransitLine.bulkWrite(ops, { ordered: false });
  statistik.baru += baru.length;
  return dikelola;
}

// Susun ulang `lines[]` halte untuk koridor yang dikelola impor. Entri koridor lain
// (buatan admin / dikunci admin) di halte yang sama dibiarkan.
async function aturKeanggotaan(dikelola, { idPerOsm }) {
  const idKelola = dikelola.map((k) => k._id);
  const kelola = new Set(idKelola.map(String));
  const ingin = new Map(); // stopId → [{ line, urutan }]
  for (const k of dikelola) {
    k.halte.forEach((osmId, urutan) => {
      const sid = idPerOsm.get(osmId);
      if (!sid) return; // halte dikunci admin
      const key = String(sid);
      if (!ingin.has(key)) ingin.set(key, []);
      ingin.get(key).push({ line: k._id, urutan });
    });
  }

  const halte = await TransitStop.find(
    {
      dikoreksiAdmin: { $ne: true },
      $or: [{ _id: { $in: [...idPerOsm.values()] } }, { 'lines.line': { $in: idKelola } }],
    },
    { lines: 1 },
  ).lean();

  const kunci = (ls) =>
    ls
      .map((l) => `${l.line}:${l.urutan}`)
      .sort()
      .join('|');
  const ops = [];
  const diubah = new Set();
  for (const s of halte) {
    const tetap = (s.lines || []).filter((l) => !kelola.has(String(l.line)));
    const berikut = [...tetap, ...(ingin.get(String(s._id)) || [])];
    if (kunci(berikut) === kunci(s.lines || [])) continue;
    ops.push({ updateOne: { filter: { _id: s._id }, update: { $set: { lines: berikut } } } });
    diubah.add(String(s._id));
  }
  if (ops.length) await TransitStop.bulkWrite(ops, { ordered: false });
  return diubah;
}

/**
 * @param {{ koridor: object[], halte: Map, dilewati: object[] }} hasil keluaran olahOverpass()
 */
export async function imporTransit(hasil, { sekarang = new Date() } = {}) {
  const statKoridor = hitung();
  const statHalte = hitung();
  const daftarHalte = [...hasil.halte.values()];

  const h = await imporHalte(daftarHalte, statHalte);
  const dikelola = await imporKoridor(hasil.koridor, statKoridor, sekarang);
  const keanggotaan = await aturKeanggotaan(dikelola, h);

  // Halte yang berubah (nama/lokasi atau daftar koridornya), tanpa menghitung halte baru.
  const idBaru = new Set(
    daftarHalte.filter((x) => h.idBaru.has(x.osmId)).map((x) => String(h.idPerOsm.get(x.osmId))),
  );
  const berubah = new Set([...h.diubah, ...keanggotaan].filter((id) => !idBaru.has(id)));
  statHalte.diperbarui = berubah.size;
  statHalte.tetap = daftarHalte.length - statHalte.baru - statHalte.dikunciAdmin - statHalte.diperbarui;

  const osmIds = hasil.koridor.map((k) => k.osmId);
  const hilangDariOsm = await TransitLine.countDocuments({ sumber: 'osm', osmId: { $nin: osmIds } });

  return {
    koridor: statKoridor,
    halte: statHalte,
    koridorTanpaHalte: hasil.koridor.filter((k) => !k.halte.length).length,
    hilangDariOsm,
    dilewati: hasil.dilewati,
  };
}
