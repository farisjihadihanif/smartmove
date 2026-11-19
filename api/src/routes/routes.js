import express from 'express';
import { httpError } from '../lib/httpError.js';
import { str } from '../lib/validate.js';
import { parseLatLng, wajibDalamWilayah } from '../lib/wilayah.js';
import { denganCache } from '../services/cache.js';
import { createOsrm, keRute, PROFIL } from '../services/osrm.js';
import {
  bagianNaik,
  cariOpsi,
  formatTarif,
  JALAN_NYATA_MAKS,
  muatIndeks,
  OPSI_MAKS,
  PENALTI_TRANSFER_S,
  perkiraanJalanS,
  TRANSFER_NYATA_MAKS,
} from '../services/transitPlanner.js';

// Titik dibulatkan 4 desimal (±11 m) untuk kunci cache dan permintaan OSRM.
const bulat = ({ lat, lng }) => ({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });
const JALAN_MIN = 20; // jalan kaki lebih pendek dari ini tidak ditampilkan

// Jarak garis lurus (m) dua titik {lat,lng}, cukup untuk wilayah sekecil Medan.
// Nama jalan bernama pertama (arah 1) / terakhir (arah -1) di langkah OSRM.
function namaLangkah(body, arah) {
  const steps = (body.routes?.[0]?.legs || []).flatMap((l) => l.steps || []);
  if (arah < 0) steps.reverse();
  return steps.find((st) => st.name)?.name;
}
const garisLurus = (a, b) => Math.hypot((a.lng - b.lng) * 111130, (a.lat - b.lat) * 110574);

export function routesRouter(cfg) {
  const r = express.Router();
  const osrm = cfg.osrm || createOsrm(cfg, { fetch: cfg.fetch });

  // GET /routes?from=lat,lng&to=lat,lng&mode=driving|motorcycle|walking
  r.get('/', async (req, res) => {
    const mode = str(req.query.mode) || 'driving';
    if (!PROFIL[mode]) throw httpError(400, 'Moda harus driving, motorcycle, atau walking');
    const from = bulat(wajibDalamWilayah(parseLatLng(req.query.from, 'Parameter from')));
    const to = bulat(wajibDalamWilayah(parseLatLng(req.query.to, 'Parameter to')));

    const kunci = `routes:${mode}:${from.lat},${from.lng};${to.lat},${to.lng}`;
    const rute = await denganCache(kunci, async () => {
      const hasil = keRute(await osrm.route(from, to, PROFIL[mode]), mode);
      if (!hasil) throw httpError(404, 'Rute tidak ditemukan', 'RUTE_TIDAK_ADA');
      return hasil;
    });
    res.json(rute);
  });

  // Jalan kaki satu ruas (OSRM foot, dicache). Bila OSRM gagal / tak ada rute, pakai
  // perkiraan garis lurus supaya rute transit tetap bisa ditampilkan (`perkiraan: true`).
  async function jalanKaki(dari, ke) {
    const a = bulat(dari);
    const b = bulat(ke);
    const kunci = `transit:jalan:${a.lat},${a.lng};${b.lat},${b.lng}`;
    let hasil;
    try {
      hasil = await denganCache(kunci, async () => {
        const body = await osrm.route(a, b, 'foot');
        const rute = keRute(body, 'walking');
        if (!rute) return undefined;
        return {
          jarakM: rute.jarakM,
          durasiS: rute.durasiS,
          garis: rute.garis,
          namaAwal: body.waypoints?.[0]?.name || namaLangkah(body, 1) || null,
          namaAkhir: body.waypoints?.at(-1)?.name || namaLangkah(body, -1) || null,
        };
      });
    } catch (err) {
      if (err?.code !== 'LAYANAN_PETA_GAGAL') throw err;
    }
    if (hasil) return { ...hasil, perkiraan: false };
    const lurus = garisLurus(dari, ke);
    return {
      jarakM: Math.round(lurus * 1.3),
      durasiS: Math.round(perkiraanJalanS(lurus)),
      garis: [[dari.lng, dari.lat], [ke.lng, ke.lat]],
      namaAwal: null,
      namaAkhir: null,
      perkiraan: true,
    };
  }

  const bagianJalan = (dari, ke, j) => ({
    jenis: 'jalan',
    dari,
    ke,
    jarakM: j.jarakM,
    durasiS: j.durasiS,
    perkiraan: j.perkiraan,
    garis: j.garis,
  });

  // Opsi mentah planner → bagian lengkap dengan jalan kaki OSRM.
  // `null` bila jalan kaki sebenarnya melebihi batas (opsi dibuang).
  async function susunOpsi(o, asal, tujuan) {
    const naik = o.kaki.map(bagianNaik);
    const titik = [{ nama: 'Lokasi asal', lokasi: asal }];
    for (const n of naik) titik.push(n.dari, n.ke);
    titik.push({ nama: 'Tujuan', lokasi: tujuan });

    // Ruas jalan kaki: asal→naik1, (turun1→naik2), turunAkhir→tujuan.
    const pasangan = [];
    for (let k = 0; k < titik.length; k += 2) pasangan.push([titik[k], titik[k + 1]]);
    const ruas = await Promise.all(
      pasangan.map(([dari, ke]) =>
        garisLurus(dari.lokasi, ke.lokasi) < JALAN_MIN ? null : jalanKaki(dari.lokasi, ke.lokasi),
      ),
    );
    const terlaluJauh = ruas.some((j, k) => {
      if (!j || j.perkiraan) return false;
      const transfer = k > 0 && k < ruas.length - 1;
      return j.jarakM > (transfer ? TRANSFER_NYATA_MAKS : JALAN_NYATA_MAKS);
    });
    if (terlaluJauh) return null;

    // Titik angkot tanpa halte diberi nama jalan dari OSRM; bila tanpa jalan kaki,
    // titik itu sama dengan asal/tujuan/titik transfer.
    ruas.forEach((j, k) => {
      const [dari, ke] = pasangan[k];
      if (j) {
        dari.nama ||= j.namaAwal;
        ke.nama ||= j.namaAkhir;
      } else {
        dari.nama ||= ke.nama;
        ke.nama ||= dari.nama;
      }
    });
    naik.forEach((n, k) => {
      n.dari.nama ||= k === 0 ? 'Titik naik terdekat' : 'Titik pindah';
      n.ke.nama ||= k === naik.length - 1 ? 'Titik turun terdekat' : 'Titik pindah';
    });

    const bagian = [];
    ruas.forEach((j, k) => {
      if (j) bagian.push(bagianJalan(...pasangan[k], j));
      if (naik[k]) bagian.push(naik[k]);
    });
    const tarif = naik.every((n) => n.tarif !== null) ? naik.reduce((t, n) => t + n.tarif, 0) : null;
    const jalan = bagian.filter((b) => b.jenis === 'jalan');
    return {
      totalS: bagian.reduce((t, b) => t + b.durasiS, 0),
      jalanM: jalan.reduce((t, b) => t + b.jarakM, 0),
      transfer: naik.length - 1,
      tarif, // null = ada koridor yang tarifnya belum diisi; jangan dianggap 0
      tarifTeks: formatTarif(tarif),
      perkiraan: jalan.some((b) => b.perkiraan),
      bagian,
    };
  }

  const skor = (o) => o.totalS + o.transfer * PENALTI_TRANSFER_S;

  // GET /routes/transit?from=lat,lng&to=lat,lng
  r.get('/transit', async (req, res) => {
    const from = wajibDalamWilayah(parseLatLng(req.query.from, 'Parameter from'));
    const to = wajibDalamWilayah(parseLatLng(req.query.to, 'Parameter to'));
    const kandidat = cariOpsi(await muatIndeks(), from, to);
    // Periksa jalan kaki OSRM satu opsi per giliran (paling banyak 3 permintaan bersamaan
    // ke server OSRM publik) sampai terkumpul OPSI_MAKS opsi; maks. 3×OPSI_MAKS kandidat.
    const opsi = [];
    for (const o of kandidat.slice(0, OPSI_MAKS * 3)) {
      if (opsi.length >= OPSI_MAKS) break;
      const hasil = await susunOpsi(o, from, to);
      if (hasil) opsi.push(hasil);
    }
    opsi.sort((a, b) => skor(a) - skor(b));
    res.json({ opsi: opsi.slice(0, OPSI_MAKS) });
  });

  return r;
}
