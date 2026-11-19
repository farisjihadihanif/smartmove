import { MEBIDANG, dalamWilayah } from '../lib/wilayah.js';

// Mengubah respons Overpass (relasi route + node halte) menjadi calon
// TransitLine/TransitStop. Murni (tanpa database) supaya mudah dites.

const JENIS = {
  bus: 'bus',
  trolleybus: 'bus',
  minibus: 'angkot',
  share_taxi: 'angkot',
  train: 'kereta',
  light_rail: 'kereta',
};

const PERAN_HALTE = /^(platform|stop)(_entry_only|_exit_only)?$/;
const MIN_DALAM_WILAYAH = 0.8; // rute antarkota (sebagian besar di luar Mebidang) dilewati

const bulat = (n) => Math.round(n * 1e6) / 1e6;
const titik = (lon, lat) => [bulat(lon), bulat(lat)];
const sama = (a, b) => Boolean(a && b) && a[0] === b[0] && a[1] === b[1];
const dalam = ([lng, lat]) => dalamWilayah({ lat, lng }, MEBIDANG);

function bersih(v, maks = 200) {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, maks) : undefined;
}

function warna(v) {
  const s = bersih(v);
  if (!s) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  const m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase() : undefined;
}

// "4000", "Rp 4.000", "IDR 4,000" → 4000. Selain itu (mis. "4000-6000") tidak dipakai.
export function bacaTarif(v) {
  const s = bersih(v);
  const m = s?.match(/^(?:rp\.?|idr)?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:rp|idr)?$/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.,]/g, ''));
  return n > 0 && n <= 1_000_000 ? n : undefined;
}

// Jarak kira-kira (meter) dua titik [lng, lat] di sekitar Medan.
const meter = (a, b) => Math.hypot((a[0] - b[0]) * 111130, (a[1] - b[1]) * 110574);
const panjang = (g) => g.reduce((t, p, i) => (i ? t + meter(g[i - 1], p) : 0), 0);

export const CELAH_MAKS = 1500; // celah antar-potongan yang masih disambung garis lurus
const UJUNG_SAMA = 300; // garis dianggap kembali ke awal / dua halte dianggap sama tempat

// Rangkai geometri way anggota relasi menjadi satu garis [lng, lat].
// 1. Way berurutan yang ujungnya bersambung → satu rantai (arah way disesuaikan;
//    rantai berisi satu way boleh dibalik).
// 2. Rantai yang ujungnya persis bertemu digabung, termasuk potongan yang di OSM
//    tercatat di urutan lain (mis. way penutup celah yang ditaruh di akhir relasi).
// 3. Sisa rantai disambung berurutan bila celahnya ≤ CELAH_MAKS; potongan yang butuh
//    lompatan lebih jauh dibuang (yang dipertahankan: kelompok terpanjang).
// Hasil `{ garis, dibuangM, celahM }`: panjang potongan dibuang & total celah disambung.
export function susunJalur(segmen) {
  const rantai = [];
  for (const seg of segmen) {
    if (seg.length < 2) continue;
    const cur = rantai.at(-1);
    if (cur) {
      const akhir = cur.g.at(-1);
      const balik = seg.slice().reverse();
      if (sama(akhir, seg[0]) || sama(akhir, balik[0])) {
        cur.g.push(...(sama(akhir, seg[0]) ? seg : balik).slice(1));
        cur.way++;
        continue;
      }
      if (cur.way === 1 && (sama(cur.g[0], seg[0]) || sama(cur.g[0], balik[0]))) {
        cur.g.reverse(); // way pertama ternyata terbalik
        cur.g.push(...(sama(cur.g.at(-1), seg[0]) ? seg : balik).slice(1));
        cur.way++;
        continue;
      }
    }
    rantai.push({ g: seg.slice(), way: 1, urut: rantai.length });
  }
  if (!rantai.length) return { garis: [], dibuangM: 0, celahM: 0 };

  // Gabung rantai yang ujungnya persis bertemu. Rantai hanya ditempel ke rantai yang
  // muncul lebih awal di relasi, supaya rute melingkar (ujung = awal) tidak berputar.
  for (let ubah = true; ubah; ) {
    ubah = false;
    for (let i = 0; i < rantai.length && !ubah; i++) {
      for (let j = 0; j < rantai.length && !ubah; j++) {
        const A = rantai[i];
        const B = rantai[j];
        if (B.urut <= A.urut) continue;
        let tempel = null;
        if (sama(A.g.at(-1), B.g[0])) tempel = B.g;
        else if (B.way === 1 && sama(A.g.at(-1), B.g.at(-1))) tempel = B.g.slice().reverse();
        if (!tempel) continue;
        A.g.push(...tempel.slice(1));
        A.way += B.way;
        rantai.splice(j, 1);
        ubah = true;
      }
    }
  }

  // Sambung sisa rantai berurutan selama celahnya wajar.
  const kelompok = [];
  let cur = null;
  for (const r of rantai) {
    if (!cur) {
      cur = { g: r.g.slice(), celah: 0 };
      continue;
    }
    const akhir = cur.g.at(-1);
    // Rantai satu way: pilih ujung terdekat. Rantai panjang hanya dibalik bila arah
    // aslinya tak tersambung tapi arah baliknya tersambung (way tercatat terbalik).
    const maju = meter(akhir, r.g[0]);
    const mundur = meter(akhir, r.g.at(-1));
    const balik = r.way === 1 ? mundur < maju : maju > CELAH_MAKS && mundur <= CELAH_MAKS;
    const g = balik ? r.g.slice().reverse() : r.g;
    const d = meter(akhir, g[0]);
    if (d <= CELAH_MAKS) {
      cur.g.push(...g);
      cur.celah += d;
    } else {
      kelompok.push(cur);
      cur = { g: g.slice(), celah: 0 };
    }
  }
  kelompok.push(cur);
  for (const k of kelompok) k.panjang = panjang(k.g);
  const utama = kelompok.reduce((a, b) => (b.panjang > a.panjang ? b : a));
  const garis = utama.g.filter((p, i) => i === 0 || !sama(p, utama.g[i - 1]));
  const dibuangM = kelompok.reduce((t, k) => (k === utama ? t : t + k.panjang), 0);
  return { garis, dibuangM: Math.round(dibuangM), celahM: Math.round(utama.celah) };
}

export const rangkaiJalur = (segmen) => susunJalur(segmen).garis;

// "K1M : Pinang Baris → Lapangan Merdeka" → "K1M : Lapangan Merdeka → Pinang Baris".
export function namaBalik(nama) {
  const m = nama.match(/^(?:(.*?:)\s*)?(.+?)\s*(→|–|-)\s*(.+)$/);
  if (!m) return `${nama} (arah pulang)`;
  const [, awalan, dari, panah, ke] = m;
  return `${awalan ? `${awalan} ` : ''}${ke} ${panah} ${dari}`;
}

// Relasi pulang-pergi dalam satu garis (kembali ke titik awal) yang haltenya hanya
// sampai tujuan → dipisah di halte terakhir jadi arah pergi dan arah pulang, supaya
// perjalanan balik tetap bisa naik di halte tujuan. `null` bila tidak perlu dipisah.
export function pisahPulangPergi(garis, lokasiHalte) {
  if (garis.length < 4 || lokasiHalte.length < 2) return null;
  const pertama = lokasiHalte[0];
  const terakhir = lokasiHalte.at(-1);
  if (meter(garis[0], garis.at(-1)) > UJUNG_SAMA) return null; // bukan pulang-pergi
  if (meter(pertama, terakhir) <= UJUNG_SAMA) return null; // halte sudah mencakup jalan pulang
  // Titik putar = titik terdekat ke halte terakhir di lintasan PERTAMA yang lewat ≤ 200 m.
  let k = -1;
  for (let i = 0; i < garis.length; i++) {
    const d = meter(garis[i], terakhir);
    if (d <= 200) {
      if (k < 0 || d < meter(garis[k], terakhir)) k = i;
    } else if (k >= 0) break;
  }
  if (k <= 0 || k >= garis.length - 1) return null;
  return { pergi: garis.slice(0, k + 1), pulang: garis.slice(k) };
}

function namaHalte(tags = {}) {
  return bersih(tags.name) || bersih(tags['name:id']) || bersih(tags.ref) || 'Halte tanpa nama';
}

const tampakHalte = (t = {}) =>
  t.highway === 'bus_stop' ||
  ['platform', 'stop_position', 'station'].includes(t.public_transport) ||
  ['station', 'halt', 'stop'].includes(t.railway) ||
  t.amenity === 'bus_station';

// Anggota halte suatu relasi, berurutan. PTv2 mencatat "stop" (di jalan) dan
// "platform" (tempat menunggu) untuk halte yang sama; pakai satu jenis saja agar
// tidak ganda: platform bila ada, selain itu stop, terakhir (PTv1) node bertag halte.
function anggotaHalte(rel, nodes) {
  const n = (rel.members || []).filter((m) => m.type === 'node' && nodes.has(m.ref));
  const peran = (p) => n.filter((m) => PERAN_HALTE.test(m.role || '') && m.role.startsWith(p));
  let pilih = peran('platform');
  if (!pilih.length) pilih = peran('stop');
  if (!pilih.length) pilih = n.filter((m) => !m.role && tampakHalte(nodes.get(m.ref).tags));
  const ids = pilih.map((m) => m.ref);
  return ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
}

function namaKoridor(t, id) {
  const nama = bersih(t.name);
  if (nama) return nama;
  const arah = t.from && t.to ? `${bersih(t.from)} – ${bersih(t.to)}` : undefined;
  if (t.ref) return [bersih(t.ref), arah].filter(Boolean).join(' ');
  return arah || `Rute OSM ${id}`;
}

/**
 * @returns {{ koridor: object[], halte: Map<string, {osmId, nama, lokasi}>,
 *   dilewati: {osmId, nama, alasan}[], catatan: {osmId, nama, pesan}[] }}
 * `koridor[].halte` = daftar osmId halte berurutan. Relasi pulang-pergi yang dipisah
 * menghasilkan dua koridor: `relation/<id>` (pergi) dan `relation/<id>#pulang`.
 */
export function olahOverpass(data) {
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const nodes = new Map();
  for (const e of elements) if (e.type === 'node' && Number.isFinite(e.lat)) nodes.set(e.id, e);

  const relasi = elements.filter((e) => e.type === 'relation').sort((a, b) => a.id - b.id);
  const koridor = [];
  const halte = new Map();
  const dilewati = [];
  const catatan = []; // peringatan kualitas data (bukan alasan melewati relasi)

  for (const rel of relasi) {
    const t = rel.tags || {};
    const osmId = `relation/${rel.id}`;
    const nama = namaKoridor(t, rel.id);
    // Angkot Medan di OSM banyak yang ditandai route=bus dengan network "Angkot Kota Medan".
    const jenis = /angkot|angkutan kota/i.test(`${t.network || ''} ${t.operator || ''}`) ? 'angkot' : JENIS[t.route];
    if (!jenis) {
      dilewati.push({ osmId, nama, alasan: `jenis route=${t.route} tidak didukung` });
      continue;
    }

    const segmen = (rel.members || [])
      .filter((m) => m.type === 'way' && Array.isArray(m.geometry) && !/platform/.test(m.role || ''))
      .map((m) => m.geometry.filter((g) => g && Number.isFinite(g.lat)).map((g) => titik(g.lon, g.lat)));
    const { garis, dibuangM, celahM } = susunJalur(segmen);
    if (dibuangM) catatan.push({ osmId, nama, pesan: `potongan jalur ${dibuangM} m tidak tersambung, dibuang` });
    if (celahM > 200) catatan.push({ osmId, nama, pesan: `celah jalur ${celahM} m disambung garis lurus` });

    const idHalte = anggotaHalte(rel, nodes);
    const lokasiHalte = idHalte.map((id) => {
      const nd = nodes.get(id);
      return titik(nd.lon, nd.lat);
    });

    const acuan = garis.length >= 2 ? garis : lokasiHalte;
    if (!acuan.length) {
      dilewati.push({ osmId, nama, alasan: 'tanpa jalur dan halte' });
      continue;
    }
    if (acuan.filter(dalam).length / acuan.length < MIN_DALAM_WILAYAH) {
      dilewati.push({ osmId, nama, alasan: 'sebagian besar di luar Mebidang' });
      continue;
    }

    const urutHalte = [];
    idHalte.forEach((id, i) => {
      if (!dalam(lokasiHalte[i])) return;
      const sid = `node/${id}`;
      if (!halte.has(sid)) {
        halte.set(sid, {
          osmId: sid,
          nama: namaHalte(nodes.get(id).tags),
          lokasi: { type: 'Point', coordinates: lokasiHalte[i] },
        });
      }
      urutHalte.push(sid);
    });

    const dasar = {
      ref: bersih(t.ref, 30),
      jenis,
      operator: bersih(t.operator) || bersih(t.network),
      warna: warna(t.colour),
      jamOperasi: bersih(t.opening_hours, 100),
      tarif: bacaTarif(t.charge),
      jaringan: [t.network, t.operator, t.name].filter(Boolean).join(' '),
    };
    const jalur = (g) => (g.length >= 2 ? { type: 'LineString', coordinates: g } : undefined);
    const lokasiUrut = urutHalte.map((sid) => halte.get(sid).lokasi.coordinates);
    const pisah = pisahPulangPergi(garis, lokasiUrut);
    if (pisah) {
      koridor.push({ ...dasar, osmId, nama, jalur: jalur(pisah.pergi), halte: urutHalte });
      const awalDekat = meter(pisah.pulang.at(-1), lokasiUrut[0]) <= UJUNG_SAMA;
      koridor.push({
        ...dasar,
        osmId: `${osmId}#pulang`,
        nama: namaBalik(nama),
        jalur: jalur(pisah.pulang),
        halte: awalDekat ? [urutHalte.at(-1), urutHalte[0]] : [urutHalte.at(-1)],
      });
      catatan.push({ osmId, nama, pesan: 'relasi pulang-pergi dipisah jadi arah pergi dan pulang' });
    } else {
      koridor.push({ ...dasar, osmId, nama, jalur: jalur(garis), halte: urutHalte });
    }
  }

  return { koridor, halte, dilewati, catatan };
}

// Kode koridor yang mudah dibaca: TMD-K1, RAILINK-…, BUS-12, ANGKOT-64.
// Bila sudah dipakai (mis. arah sebaliknya), diberi akhiran -2, -3, …
export function buatKode(k, terpakai) {
  const ref = (k.ref || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  let awalan = { bus: 'BUS', kereta: 'KA', angkot: 'ANGKOT' }[k.jenis];
  if (/trans\s*metro\s*deli/i.test(k.jaringan || '')) awalan = 'TMD';
  else if (/railink/i.test(k.jaringan || '')) awalan = 'RAILINK';
  const id = k.osmId.split('/')[1].replace('#pulang', '-P');
  const dasar = ref ? `${awalan}-${ref}` : `OSM-${id}`;
  let kode = dasar;
  for (let i = 2; terpakai.has(kode); i++) kode = `${dasar}-${i}`;
  terpakai.add(kode);
  return kode;
}
