import TransitLine from '../models/TransitLine.js';
import TransitStop from '../models/TransitStop.js';
import { tarifKoridor } from './tarif.js';

// Perencana rute transportasi umum (ARCHITECTURE §5.2).
//
// Dua cara naik-turun:
// - koridor yang punya halte (Trans Metro Deli, kereta, …): hanya di halte, urut `urutan`;
// - koridor tanpa halte (angkot Medan): di mana saja sepanjang garis trayek, jadi titik
//   naik/turun = titik terdekat di garis dari asal/tujuan. Kereta tanpa stasiun dilewati.
// Arah selalu mengikuti urutan garis (relasi OSM satu arah), maksimal 1 transfer.
// Semua hitungan geometri memakai proyeksi datar lokal (meter) di sekitar Medan.

export const JALAN_MAKS = 800; // jalan kaki garis lurus ke titik naik / dari titik turun
export const TRANSFER_MAKS = 400; // jalan kaki garis lurus saat pindah koridor
export const NAIK_MIN = 300;
// Jalan kaki sebenarnya (OSRM) bisa lebih panjang dari garis lurus; opsi yang melewati
// batas ini dibuang (sungai, tembok kampus, jalan tol, dll.).
export const JALAN_NYATA_MAKS = 1000;
export const TRANSFER_NYATA_MAKS = 600;
const SAMA_M = 150; // dua kaki naik dianggap sama bila titik naik & turunnya sedekat ini // jarak naik minimal supaya tidak ada "naik 50 m"
export const OPSI_MAKS = 5;
export const PENALTI_TRANSFER_S = 600; // hanya untuk urutan (menunggu kendaraan kedua)
export const KECEPATAN_JALAN = 1.3; // m/s (±4,7 km/j), untuk perkiraan
export const FAKTOR_JALAN = 1.3; // garis lurus → jarak jalan sebenarnya, untuk perkiraan
const JARAK_SIMPUL = 100; // titik contoh di garis angkot untuk mencari tempat transfer

const LAT0 = 3.6;
const LNG0 = 98.67;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
const keXY = (lng, lat) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
const keLngLat = (x, y) => [Number((x / KX + LNG0).toFixed(6)), Number((y / KY + LAT0).toFixed(6))];
const jarak = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const perkiraanJalanS = (m) => (m * FAKTOR_JALAN) / KECEPATAN_JALAN;

function proyeksi(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { t, q, d: jarak(p, q) };
}

// Titik pada jarak `s` meter dari awal garis.
function titikPada(L, s) {
  const { pts, cum } = L;
  if (s <= 0) return pts[0];
  if (s >= cum.at(-1)) return pts.at(-1);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= s) lo = m;
    else hi = m;
  }
  const seg = cum[hi] - cum[lo];
  const t = seg ? (s - cum[lo]) / seg : 0;
  return [pts[lo][0] + t * (pts[hi][0] - pts[lo][0]), pts[lo][1] + t * (pts[hi][1] - pts[lo][1])];
}

// Potongan garis dari s1 ke s2 sebagai [[lng, lat]].
function irisan(L, s1, s2) {
  const out = [keLngLat(...titikPada(L, s1))];
  for (let i = 0; i < L.cum.length; i++) {
    if (L.cum[i] > s1 && L.cum[i] < s2) out.push(keLngLat(...L.pts[i]));
  }
  out.push(keLngLat(...titikPada(L, s2)));
  return out;
}

// Proyeksi terdekat ke garis, hanya segmen yang yang mencapai `sMin`.
function proyeksiGaris(L, p, sMin = 0) {
  let best = null;
  for (let i = 0; i < L.pts.length - 1; i++) {
    if (L.cum[i + 1] < sMin) continue;
    const r = proyeksi(p, L.pts[i], L.pts[i + 1]);
    const s = L.cum[i] + r.t * (L.cum[i + 1] - L.cum[i]);
    if (s < sMin) continue;
    if (!best || r.d < best.d) best = { s, d: r.d, q: r.q };
  }
  return best;
}

// Lintasan PERTAMA (sejak `sMin`) yang lewat dalam `tol` meter dari p. Relasi OSM
// sering pulang-pergi, jadi titik terdekat bisa jatuh di lintasan balik. Dicek lewat
// titik contoh tiap 25 m supaya segmen panjang tidak menyatukan dua lintasan.
function proyeksiPertama(L, p, sMin, tol = 200) {
  let best = null;
  for (let s = sMin; s <= L.cum.at(-1); s += 25) {
    const d = jarak(p, titikPada(L, s));
    if (d <= tol) {
      if (!best || d < best.d) best = { s, d };
    } else if (best) {
      break; // lintasan pertama sudah lewat
    }
  }
  return best || proyeksiGaris(L, p, sMin);
}

const kunciSel = (x, y) => `${Math.floor(x / TRANSFER_MAKS)}:${Math.floor(y / TRANSFER_MAKS)}`;

// Data koridor aktif + halte → struktur siap hitung.
export function bangunIndeks(lines, stops) {
  const haltePer = new Map();
  for (const s of stops) {
    for (const l of s.lines || []) {
      const k = String(l.line);
      if (!haltePer.has(k)) haltePer.set(k, []);
      const [lng, lat] = s.lokasi.coordinates;
      haltePer.get(k).push({ id: String(s._id), nama: s.nama, lng, lat, urutan: l.urutan });
    }
  }

  const hasil = [];
  for (const l of lines) {
    const halte = (haltePer.get(String(l._id)) || []).sort((a, b) => a.urutan - b.urutan);
    const bebas = halte.length === 0;
    if (bebas && l.jenis === 'kereta') continue; // kereta hanya berhenti di stasiun
    let coords = l.jalur?.coordinates;
    if (!coords || coords.length < 2) {
      if (halte.length < 2) continue; // tanpa garis dan tanpa halte: tidak bisa dihitung
      coords = halte.map((h) => [h.lng, h.lat]);
    }
    const pts = coords.map(([lng, lat]) => keXY(lng, lat));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + jarak(pts[i - 1], pts[i]));

    const L = {
      kode: l.kode,
      nama: l.nama,
      jenis: l.jenis,
      warna: l.warna ?? null,
      ...tarifKoridor(l),
      v: (l.kecepatanRataKmj || 20) / 3.6,
      bebas,
      pts,
      cum,
    };
    if (bebas) {
      L.simpul = [];
      for (let s = 0; s <= cum.at(-1); s += JARAK_SIMPUL) {
        const [x, y] = titikPada(L, s);
        L.simpul.push({ s, x, y });
      }
    } else {
      // Posisi halte di garis, maju mengikuti urutan (garis bisa berputar balik).
      let sMin = 0;
      L.simpul = halte.map((h) => {
        const p = keXY(h.lng, h.lat);
        let pr = proyeksiPertama(L, p, sMin);
        if (!pr || pr.d > TRANSFER_MAKS) pr = proyeksiGaris(L, p, 0) || { s: sMin };
        sMin = Math.max(sMin, pr.s);
        return { s: pr.s, x: p[0], y: p[1], halte: h };
      });
    }
    hasil.push(L);
  }
  return hasil;
}

// Tempat naik/turun dalam JALAN_MAKS dari titik p.
function titikAkses(L, p) {
  if (!L.bebas) {
    return L.simpul
      .map((n) => ({ s: n.s, x: n.x, y: n.y, jarak: jarak(p, [n.x, n.y]), halte: n.halte }))
      .filter((a) => a.jarak <= JALAN_MAKS);
  }
  // Angkot: titik terdekat di tiap segmen dalam radius, disaring jadi satu titik
  // terdekat per 200 m trayek. Trayek yang lewat dua kali (pulang-pergi di jalan
  // paralel) tetap punya pilihan di tiap lintasan; planner memilih yang tercepat.
  const per = new Map();
  for (let i = 0; i < L.pts.length - 1; i++) {
    const r = proyeksi(p, L.pts[i], L.pts[i + 1]);
    if (r.d > JALAN_MAKS) continue;
    const s = L.cum[i] + r.t * (L.cum[i + 1] - L.cum[i]);
    const k = Math.floor(s / 200);
    const lama = per.get(k);
    if (!lama || r.d < lama.jarak) per.set(k, { s, x: r.q[0], y: r.q[1], jarak: r.d });
  }
  return [...per.values()];
}

const naikS = (L, ds) => ds / L.v;

// Cari opsi (belum termasuk jalan kaki OSRM). Hasil diurutkan dari perkiraan tercepat.
export function cariOpsi(indeks, asal, tujuan) {
  const pa = keXY(asal.lng, asal.lat);
  const pt = keXY(tujuan.lng, tujuan.lat);
  const naik = new Map();
  const turun = new Map();
  indeks.forEach((L, i) => {
    const a = titikAkses(L, pa);
    if (a.length) naik.set(i, a);
    const b = titikAkses(L, pt);
    if (b.length) turun.set(i, b);
  });

  const opsi = [];
  // Langsung (tanpa transfer).
  for (const [i, bs] of naik) {
    const as = turun.get(i);
    if (!as) continue;
    const L = indeks[i];
    let best = null;
    for (const b of bs) {
      for (const a of as) {
        const ds = a.s - b.s;
        if (ds < NAIK_MIN) continue;
        const biaya = perkiraanJalanS(b.jarak) + naikS(L, ds) + perkiraanJalanS(a.jarak);
        if (!best || biaya < best.biaya) best = { biaya, kaki: [{ L, dari: b, ke: a }] };
      }
    }
    if (best) opsi.push(best);
  }

  // Satu transfer. Per simpul: biaya terbaik dari asal sampai simpul itu (koridor
  // pertama) dan dari simpul sampai tujuan (koridor kedua); simpul kedua koridor yang
  // berdekatan (≤ TRANSFER_MAKS) dicari lewat grid.
  const terbaikKe = (L, bs) =>
    L.simpul.map((n) => {
      let best = null;
      for (const b of bs) {
        const ds = n.s - b.s;
        if (ds < NAIK_MIN) continue;
        const biaya = perkiraanJalanS(b.jarak) + naikS(L, ds);
        if (!best || biaya < best.biaya) best = { biaya, titik: b };
      }
      return best;
    });
  const terbaikDari = (L, as) =>
    L.simpul.map((n) => {
      let best = null;
      for (const a of as) {
        const ds = a.s - n.s;
        if (ds < NAIK_MIN) continue;
        const biaya = naikS(L, ds) + perkiraanJalanS(a.jarak);
        if (!best || biaya < best.biaya) best = { biaya, titik: a };
      }
      return best;
    });
  const simpulKe = (n) => ({ s: n.s, x: n.x, y: n.y, halte: n.halte });

  const grid = new Map();
  for (const [j, as] of turun) {
    const akhir = terbaikDari(indeks[j], as);
    indeks[j].simpul.forEach((n, k) => {
      if (!akhir[k]) return;
      const key = kunciSel(n.x, n.y);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ j, n, akhir: akhir[k] });
    });
  }
  const perPasangan = new Map();
  for (const [i, bs] of naik) {
    const A = indeks[i];
    const mulai = terbaikKe(A, bs);
    A.simpul.forEach((nA, k) => {
      const m = mulai[k];
      if (!m) return;
      const cx = Math.floor(nA.x / TRANSFER_MAKS);
      const cy = Math.floor(nA.y / TRANSFER_MAKS);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const { j, n: nB, akhir } of grid.get(`${gx}:${gy}`) || []) {
            if (j === i) continue;
            const dT = Math.hypot(nA.x - nB.x, nA.y - nB.y);
            if (dT > TRANSFER_MAKS) continue;
            const biaya = m.biaya + perkiraanJalanS(dT) + akhir.biaya + PENALTI_TRANSFER_S;
            const key = `${i}:${j}`;
            const lama = perPasangan.get(key);
            if (!lama || biaya < lama.biaya) {
              perPasangan.set(key, {
                biaya,
                kaki: [
                  { L: A, dari: m.titik, ke: simpulKe(nA) },
                  { L: indeks[j], dari: simpulKe(nB), ke: akhir.titik },
                ],
              });
            }
          }
        }
      }
    });
  }

  // Transfer hanya ditawarkan bila lebih cepat dari opsi langsung terbaik.
  const langsungTerbaik = Math.min(...opsi.map((o) => o.biaya));
  for (const o of perPasangan.values()) if (o.biaya < langsungTerbaik) opsi.push(o);
  return kelompokkan(opsi.sort((a, b) => a.biaya - b.biaya));
}

// Banyak angkot berbagi ruas jalan yang sama. Opsi dengan titik naik/turun sama
// digabung; koridor lain masuk `lain` supaya pengguna tahu bisa naik yang mana saja.
function kelompokkan(opsi) {
  const dekat = (p, q) => jarak([p.x, p.y], [q.x, q.y]) <= SAMA_M;
  const sama = (k1, k2) => {
    const d1 = k1.ke.s - k1.dari.s;
    const d2 = k2.ke.s - k2.dari.s;
    if (k1.L.bebas !== k2.L.bebas || k1.L.jenis !== k2.L.jenis) return false;
    return dekat(k1.dari, k2.dari) && dekat(k1.ke, k2.ke) && Math.abs(d1 - d2) <= 0.15 * d1;
  };
  const grup = [];
  for (const o of opsi) {
    const g = grup.find((x) => x.kaki.length === o.kaki.length && x.kaki.every((k, i) => sama(k, o.kaki[i])));
    if (!g) {
      grup.push({ biaya: o.biaya, kaki: o.kaki.map((k) => ({ ...k, lain: [] })) });
      continue;
    }
    g.kaki.forEach((k, i) => {
      const L = o.kaki[i].L;
      if (L !== k.L && !k.lain.includes(L)) k.lain.push(L);
    });
  }
  return grup;
}

const ringkasKoridor = (L) => ({
  kode: L.kode,
  nama: L.nama,
  jenis: L.jenis,
  warna: L.warna,
  tarif: L.tarif,
  tarifPerkiraan: L.tarifPerkiraan,
});

export const lokasiTitik = (t) => {
  const [lng, lat] = keLngLat(t.x, t.y);
  return { lat, lng };
};

// Satu kaki naik kendaraan → bagian respons (nama titik bebas diisi pemanggil).
export function bagianNaik({ L, dari, ke, lain = [] }) {
  const ds = ke.s - dari.s;
  const titik = (t) => ({
    nama: t.halte?.nama ?? null,
    halteId: t.halte?.id ?? null,
    lokasi: lokasiTitik(t),
  });
  return {
    jenis: 'naik',
    koridor: ringkasKoridor(L),
    koridorLain: lain.map(ringkasKoridor), // melayani ruas yang sama
    naikDiMana: L.bebas, // true = angkot, boleh naik-turun di mana saja sepanjang trayek
    dari: titik(dari),
    ke: titik(ke),
    jumlahHalte: L.bebas ? null : ke.halte.urutan - dari.halte.urutan,
    jarakM: Math.round(ds),
    durasiS: Math.round(naikS(L, ds)),
    tarif: L.tarif,
    tarifPerkiraan: L.tarifPerkiraan, // true = bukan dari admin; klien menulis "Tarif perkiraan"
    garis: irisan(L, dari.s, ke.s),
  };
}

export const formatTarif = (n) =>
  n === null ? 'Tarif belum tersedia' : `Rp ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

// Indeks disimpan di memori; dibangun ulang bila data koridor/halte berubah.
let simpanan = { versi: null, indeks: null };

export function lupakanIndeksTransit() {
  simpanan = { versi: null, indeks: null };
}

export async function muatIndeks() {
  const terakhir = (M) => M.findOne({}, 'updatedAt').sort({ updatedAt: -1 }).lean();
  const [nl, ul, ns, us] = await Promise.all([
    TransitLine.countDocuments(),
    terakhir(TransitLine),
    TransitStop.countDocuments(),
    terakhir(TransitStop),
  ]);
  const versi = `${nl}:${ul?.updatedAt?.getTime()}:${ns}:${us?.updatedAt?.getTime()}`;
  if (simpanan.versi === versi) return simpanan.indeks;
  const [lines, stops] = await Promise.all([
    TransitLine.find({ aktif: { $ne: false } }, 'kode nama jenis operator warna tarif tarifSumber kecepatanRataKmj jalur').lean(),
    TransitStop.find({}, 'nama lokasi lines').lean(),
  ]);
  const indeks = bangunIndeks(lines, stops);
  simpanan = { versi, indeks };
  return indeks;
}
