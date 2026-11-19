import TrafficReport from '../models/TrafficReport.js';
import { denganCache } from './cache.js';
import { publicLaporan } from './trafficReports.js';

/*
 * Antarmuka penyedia info lalu lintas (Keputusan Final #4).
 *
 * Penyedia = objek dengan:
 *   nama: string
 *   kejadianDiArea(bbox) → Promise<Kejadian[]>
 *       bbox { minLng, minLat, maxLng, maxLat }; Kejadian = bentuk `publicLaporan` + `sumber`.
 *   estimasiKoridor(koridor) → Promise<Estimasi | null>
 *       koridor = dokumen RoadCorridor (geometri dari OSM, `npm run impor:jalan`);
 *       Estimasi lihat `estimasiDariLaporan`; null = waktu tempuh tidak bisa dihitung.
 *
 * MVP: penyedia "komunitas" (laporan pengguna seperti Waze + waktu tempuh OSRM).
 * Layanan berbayar (mis. TomTom) cukup ditambah di PENYEDIA lalu dipilih lewat
 * TRAFFIC_PROVIDER; rute /traffic tidak perlu diubah.
 */

// Pengali waktu tempuh per laporan. Kejadian dinilai minimal setara tingkatnya.
export const FAKTOR_TINGKAT = { lancar: 1, padat: 1.6, macet: 3 };
export const FAKTOR_KEJADIAN = {
  none: 1,
  perbaikan_jalan: 1.6,
  kecelakaan: 2,
  banjir: 3,
  penutupan: 3,
};
export const JARAK_KE_RUTE_M = 75; // laporan dianggap di koridor bila ≤ 75 m dari garisnya
export const PENGARUH_M = 250; // satu laporan memengaruhi ±250 m ruas jalan
const BIN_M = 50;

// Proyeksi datar dengan lintang acuan Medan (cukup untuk skala kota) → meter.
// Lintang acuan harus tetap; memakai cos lintang tiap titik membuat x melenceng.
const COS_MEDAN = Math.cos((3.6 * Math.PI) / 180);
const keXY = ([lng, lat]) => [lng * 111320 * COS_MEDAN, lat * 110574];

// Posisi titik terdekat di polyline: { jarakM (ke garis), sepanjangM (dari awal garis) }.
export function proyeksiKeGaris(garis, titik) {
  const p = keXY(titik);
  let terbaik = { jarakM: Infinity, sepanjangM: 0 };
  let kumulatif = 0;
  for (let i = 1; i < garis.length; i++) {
    const a = keXY(garis[i - 1]);
    const b = keXY(garis[i]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    const jarak = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    const len = Math.sqrt(len2);
    if (jarak < terbaik.jarakM) terbaik = { jarakM: jarak, sepanjangM: kumulatif + t * len };
    kumulatif += len;
  }
  return terbaik;
}

const faktorLaporan = (r) => Math.max(FAKTOR_TINGKAT[r.tingkat] ?? 1, FAKTOR_KEJADIAN[r.kejadian] ?? 1);
const tingkatDariFaktor = (f) => (f >= FAKTOR_TINGKAT.macet ? 'macet' : f >= FAKTOR_TINGKAT.padat ? 'padat' : 'lancar');

// Potongan garis antara jarak a..b (meter dari awal), dengan titik ujung diinterpolasi.
function potongGaris(garis, a, b) {
  const out = [];
  let kumulatif = 0;
  for (let i = 1; i < garis.length; i++) {
    const p = garis[i - 1];
    const q = garis[i];
    const [ax, ay] = keXY(p);
    const [bx, by] = keXY(q);
    const len = Math.hypot(bx - ax, by - ay);
    const akhir = kumulatif + len;
    const titikPada = (s) => {
      const t = len ? (s - kumulatif) / len : 0;
      return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
    };
    if (akhir >= a && kumulatif <= b) {
      if (!out.length) out.push(titikPada(Math.max(a, kumulatif)));
      if (akhir <= b) out.push(q);
      else {
        out.push(titikPada(b));
        break;
      }
    }
    kumulatif = akhir;
  }
  return out;
}

/*
 * Rute dasar OSRM + laporan aktif → estimasi koridor.
 * Garis dibagi per 50 m; tiap potongan memakai faktor terberat dari laporan yang
 * berjarak ≤ 250 m sepanjang jalan. Tanpa laporan: tingkat `null` (belum ada data),
 * waktu = waktu tempuh normal OSRM.
 */
export function estimasiDariLaporan(rute, laporan) {
  const { jarakM, durasiS, garis } = rute;
  const terkait = laporan
    .map((r) => ({ r, ...proyeksiKeGaris(garis, r.lokasi.coordinates) }))
    .filter((x) => x.jarakM <= JARAK_KE_RUTE_M);

  const kejadian = [...new Set(terkait.map((x) => x.r.kejadian).filter((k) => k && k !== 'none'))];
  const dasar = { jarakM, durasiNormalS: durasiS, laporan: terkait.length, kejadian, ditutup: kejadian.includes('penutupan') };
  if (!terkait.length || !jarakM) {
    return { ...dasar, durasiS, tingkat: terkait.length ? tingkatDariFaktor(Math.max(...terkait.map((x) => faktorLaporan(x.r)))) : null, segmen: [] };
  }

  const jumlahBin = Math.max(1, Math.ceil(jarakM / BIN_M));
  const panjangBin = jarakM / jumlahBin;
  const faktor = new Array(jumlahBin).fill(1);
  for (const x of terkait) {
    const f = faktorLaporan(x.r);
    const awal = Math.max(0, Math.floor((x.sepanjangM - PENGARUH_M) / panjangBin));
    const akhir = Math.min(jumlahBin - 1, Math.floor((x.sepanjangM + PENGARUH_M) / panjangBin));
    for (let i = awal; i <= akhir; i++) faktor[i] = Math.max(faktor[i], f);
  }

  const total = faktor.reduce((s, f) => s + f, 0);
  const durasi = Math.round((durasiS * total) / jumlahBin);

  // Ruas padat/macet berurutan → segmen berwarna untuk peta.
  const segmen = [];
  for (let i = 0; i < jumlahBin; i++) {
    const t = tingkatDariFaktor(faktor[i]);
    if (t === 'lancar') continue;
    const akhir = segmen.at(-1);
    if (akhir && akhir.tingkat === t && akhir.binAkhir === i - 1) akhir.binAkhir = i;
    else segmen.push({ tingkat: t, binAwal: i, binAkhir: i });
  }
  const rasio = durasi / (durasiS || 1);
  return {
    ...dasar,
    durasiS: durasi,
    tingkat: rasio >= 2 ? 'macet' : rasio >= 1.25 ? 'padat' : 'lancar',
    segmen: segmen.map((s) => ({
      tingkat: s.tingkat,
      garis: potongGaris(garis, s.binAwal * panjangBin, (s.binAkhir + 1) * panjangBin),
    })),
  };
}

const kotakDariGaris = (garis, padM) => {
  const padLat = padM / 110574;
  const padLng = padM / 111320;
  const lngs = garis.map((c) => c[0]);
  const lats = garis.map((c) => c[1]);
  return {
    minLng: Math.min(...lngs) - padLng,
    minLat: Math.min(...lats) - padLat,
    maxLng: Math.max(...lngs) + padLng,
    maxLat: Math.max(...lats) + padLat,
  };
};

const poligonKotak = ({ minLng, minLat, maxLng, maxLat }) => ({
  type: 'Polygon',
  coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
});

// Laporan yang belum kedaluwarsa di dalam kotak (TTL MongoDB bisa telat ±1 menit).
async function laporanAktif(bbox, batas) {
  return TrafficReport.find({
    lokasi: { $geoWithin: { $geometry: poligonKotak(bbox) } },
    expiresAt: { $gt: new Date() },
  })
    .sort({ updatedAt: -1 })
    .limit(batas)
    .lean();
}

const JARAK_SAMPEL_M = 1500;
const SAMPEL_MAKS = 25;

// Titik-titik di sepanjang garis (tiap ±1,5 km, termasuk kedua ujung) beserta arah
// jalannya, untuk dilewati OSRM.
export function titikSampel(garis, antar = JARAK_SAMPEL_M, maks = SAMPEL_MAKS) {
  const cum = [0];
  for (let i = 1; i < garis.length; i++) {
    const [ax, ay] = keXY(garis[i - 1]);
    const [bx, by] = keXY(garis[i]);
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = cum.at(-1);
  const n = Math.min(maks, Math.max(2, Math.round(total / antar) + 1));
  const out = [];
  let i = 1;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / (n - 1);
    while (i < garis.length - 1 && cum[i] < s) i++;
    const [p, q] = [garis[i - 1], garis[i]];
    const t = cum[i] > cum[i - 1] ? Math.min(1, Math.max(0, (s - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 0;
    const [px, py] = keXY(p);
    const [qx, qy] = keXY(q);
    const arah = ((Math.atan2(qx - px, qy - py) * 180) / Math.PI + 360) % 360;
    out.push({ lng: p[0] + t * (q[0] - p[0]), lat: p[1] + t * (q[1] - p[1]), arah });
  }
  return out;
}

export function createKomunitasProvider(cfg, { osrm }) {
  // Waktu tempuh normal (tanpa laporan) dari OSRM. Kecepatan rata-rata OSRM dikalikan
  // panjang garis OSM supaya selisih kecil akibat titik yang "menempel" tidak berpengaruh.
  async function durasiNormal(k) {
    const versi = new Date(k.diperbaruiPada || k.updatedAt || 0).getTime();
    const hasil = await denganCache(`traffic:koridor:${k.kode}:${versi}`, async () => {
      const body = await osrm.routeLewat(titikSampel(k.jalur.coordinates), 'driving');
      const r = body?.code === 'Ok' ? body.routes?.[0] : null;
      if (!r || !(r.distance > 0)) return undefined;
      return { durasiS: Math.round((r.duration * k.panjangM) / r.distance) };
    });
    return hasil?.durasiS ?? null;
  }

  return {
    nama: 'komunitas',

    async kejadianDiArea(bbox) {
      const items = await laporanAktif(bbox, 500);
      return items.map((r) => ({ ...publicLaporan(r), sumber: 'komunitas' }));
    },

    async estimasiKoridor(k) {
      const garis = k.jalur?.coordinates || [];
      if (garis.length < 2) return null;
      const durasiS = await durasiNormal(k);
      if (durasiS === null) return null;
      const laporan = await laporanAktif(kotakDariGaris(garis, JARAK_KE_RUTE_M * 2), 1000);
      return { ...estimasiDariLaporan({ jarakM: k.panjangM, durasiS, garis }, laporan), garis, sumber: 'komunitas' };
    },
  };
}

export const PENYEDIA = { komunitas: createKomunitasProvider };

export function createTrafficProvider(cfg, deps) {
  const nama = cfg.trafficProvider || 'komunitas';
  const buat = PENYEDIA[nama];
  if (!buat) throw new Error(`TRAFFIC_PROVIDER tidak dikenal: ${nama} (pilihan: ${Object.keys(PENYEDIA).join(', ')})`);
  return buat(cfg, deps);
}
