import RoadCorridor from '../models/RoadCorridor.js';

/*
 * Koridor jalan utama Medan dari OpenStreetMap (Keputusan Final #4, tab Estimasi Waktu).
 *
 * Alur: Overpass (way trunk/primary/secondary bernama tertentu di dalam batas Kota Medan)
 * → graf simpul OSM → sambungkan celah kecil → jalur terpanjang (dua kali Dijkstra)
 * → disederhanakan → disimpan per `kode`. Jalan dua jalur (one-way kiri & kanan) otomatis
 * menjadi satu garis karena jalur terpanjang hanya melewati salah satunya.
 */

// Relasi batas administratif "Kota Medan" (admin_level 5). Area Overpass = 3600000000 + id.
export const RELASI_MEDAN = 8484616;
export const KELAS_JALAN = ['trunk', 'primary', 'secondary'];

// Nama di OSM dicocokkan persis (tanpa beda huruf besar/kecil). Jalan layang/akses
// (mis. "Overpass Jamin Ginting") sengaja tidak ikut.
// `cari` = kata kunci untuk kueri Overpass (longgar), `pola` = penyaring tepat di JS.
export const KORIDOR_JALAN = [
  { kode: 'GATSU', nama: 'Jl. Gatot Subroto', cari: 'Gatot Subroto', pola: /^Jalan (Jenderal )?Gatot Subroto$/i },
  { kode: 'SMRAJA', nama: 'Jl. Sisingamangaraja', cari: 'Sisingamangaraja', pola: /^Jalan Sisingamangaraja$/i },
  { kode: 'JAMINGINTING', nama: 'Jl. Jamin Ginting', cari: 'Jamin Ginting', pola: /^Jalan Jamin Ginting$/i },
  { kode: 'RINGROAD', nama: 'Jl. Gagak Hitam (Ring Road)', cari: 'Gagak Hitam', pola: /^Jalan Gagak Hitam$/i },
  {
    kode: 'PUTRIHIJAU',
    nama: 'Jl. Putri Hijau – Yos Sudarso',
    cari: 'Putri Hijau|Yos Sudarso',
    pola: /^Jalan (Putri Hijau|K\. ?L\. Yos Sudarso)$/i,
  },
  { kode: 'KATAMSO', nama: 'Jl. Brigjend Katamso', cari: 'Katamso', pola: /^Jalan Brigjen(d)? Katamso$/i },
  {
    kode: 'AHNASUTION',
    nama: 'Jl. A.H. Nasution',
    cari: 'Nasution',
    pola: /^Jalan (Jenderal )?(Abdul Haris|A\. ?H\.) Nasution$/i,
  },
];

export const CELAH_MAKS_M = 300; // bagian ruas yang terputus ≤ 300 m disambung
const TOLERANSI_SEDERHANA_M = 5;

export function kueriKoridorJalan(defs = KORIDOR_JALAN, relasi = RELASI_MEDAN) {
  // Satu regex longgar untuk Overpass; penyaringan tepat per koridor di JS.
  const nama = defs.map((d) => d.cari).join('|');
  return [
    '[out:json][timeout:180];',
    `area(id:${3600000000 + relasi})->.medan;`,
    `way["highway"~"^(${KELAS_JALAN.join('|')})$"]["name"~"${nama}",i](area.medan);`,
    'out body geom;',
    // Batas kota untuk memotong way yang menjulur ke luar Medan (filter area mengembalikan
    // way utuh selama sebagian di dalam).
    `rel(${relasi});`,
    'out geom;',
  ].join('\n');
}

const COS = Math.cos((3.6 * Math.PI) / 180);
const meter = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * COS, (a[1] - b[1]) * 110574);

export const panjangGaris = (c) => c.reduce((t, p, i) => (i ? t + meter(c[i - 1], p) : 0), 0);

// Douglas–Peucker (meter, proyeksi datar).
export function sederhanakan(c, tol = TOLERANSI_SEDERHANA_M) {
  if (c.length < 3) return c;
  const jarakKeRuas = (p, a, b) => {
    const k = (q) => [q[0] * 111320 * COS, q[1] * 110574];
    const [px, py] = k(p);
    const [ax, ay] = k(a);
    const [bx, by] = k(b);
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const simpan = new Uint8Array(c.length);
  simpan[0] = simpan[c.length - 1] = 1;
  const tumpuk = [[0, c.length - 1]];
  while (tumpuk.length) {
    const [i, j] = tumpuk.pop();
    let maks = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = jarakKeRuas(c[k], c[i], c[j]);
      if (d > maks) [maks, idx] = [d, k];
    }
    if (maks > tol) {
      simpan[idx] = 1;
      tumpuk.push([i, idx], [idx, j]);
    }
  }
  return c.filter((_, i) => simpan[i]);
}

// Dijkstra dari `awal`; graf = Map<simpul, Map<tetangga, meter>>.
function dijkstra(graf, awal) {
  const jarak = new Map([[awal, 0]]);
  const asal = new Map();
  const heap = [[0, awal]];
  const naik = (i) => {
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const turun = (i) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  };
  while (heap.length) {
    const [d, u] = heap[0];
    const akhir = heap.pop();
    if (heap.length) {
      heap[0] = akhir;
      turun(0);
    }
    if (d > jarak.get(u)) continue;
    for (const [v, w] of graf.get(u)) {
      const nd = d + w;
      if (nd < (jarak.get(v) ?? Infinity)) {
        jarak.set(v, nd);
        asal.set(v, u);
        heap.push([nd, v]);
        naik(heap.length - 1);
      }
    }
  }
  let jauh = awal;
  for (const [v, d] of jarak) if (d > jarak.get(jauh)) jauh = v;
  return { jarak, asal, jauh };
}

/*
 * Way OSM (dengan `nodes` + `geometry`) → satu garis [[lng, lat], …].
 * → { garis, panjangM, tidakTerpakai } atau null bila tidak ada ruas.
 */
export function gabungRuas(ways, celahM = CELAH_MAKS_M) {
  const posisi = new Map();
  const graf = new Map();
  const sambung = (a, b, w) => {
    if (a === b) return;
    graf.get(a).set(b, Math.min(w, graf.get(a).get(b) ?? Infinity));
    graf.get(b).set(a, Math.min(w, graf.get(b).get(a) ?? Infinity));
  };
  for (const w of ways) {
    const n = w.nodes || [];
    const g = w.geometry || [];
    if (n.length < 2 || n.length !== g.length) continue;
    n.forEach((id, i) => {
      if (!posisi.has(id)) {
        posisi.set(id, [g[i].lon, g[i].lat]);
        graf.set(id, new Map());
      }
    });
    for (let i = 1; i < n.length; i++) sambung(n[i - 1], n[i], meter(posisi.get(n[i - 1]), posisi.get(n[i])));
  }
  if (!graf.size) return null;

  // Komponen terhubung.
  const komp = new Map();
  let jumlahKomp = 0;
  for (const s of graf.keys()) {
    if (komp.has(s)) continue;
    const antre = [s];
    komp.set(s, jumlahKomp);
    while (antre.length) {
      const u = antre.pop();
      for (const v of graf.get(u).keys()) {
        if (komp.has(v)) continue;
        komp.set(v, jumlahKomp);
        antre.push(v);
      }
    }
    jumlahKomp++;
  }

  // Sambungkan celah: tiap pasangan komponen disambung lewat dua simpul terdekatnya
  // bila jaraknya ≤ celahM (persimpangan yang namanya lain, data OSM yang terputus).
  if (jumlahKomp > 1) {
    const semua = [...graf.keys()];
    const terdekat = new Map(); // "ka|kb" → [meter, u, v]
    for (let i = 0; i < semua.length; i++) {
      const u = semua[i];
      for (let j = i + 1; j < semua.length; j++) {
        const v = semua[j];
        const [ka, kb] = [komp.get(u), komp.get(v)];
        if (ka === kb) continue;
        const d = meter(posisi.get(u), posisi.get(v));
        if (d > celahM) continue;
        const kunci = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (!terdekat.has(kunci) || d < terdekat.get(kunci)[0]) terdekat.set(kunci, [d, u, v]);
      }
    }
    for (const [d, u, v] of terdekat.values()) sambung(u, v, d);
  }

  // Ujung koridor = pasangan ujung ruas yang terjauh secara garis lurus dan masih
  // terhubung; garis = jalur terpendek di antaranya. (Jalur "terpanjang" di graf justru
  // berputar balik lewat jalur seberang pada jalan dua arah.)
  // Kandidat ujung: simpul berderajat 1 + simpul paling luar tiap komponen ke 8 arah
  // (jalan dua jalur yang tersambung di kedua ujung tidak punya simpul berderajat 1).
  const kandidatSet = new Set([...graf.keys()].filter((v) => graf.get(v).size === 1));
  const arah = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ekstrem = new Map();
  for (const v of graf.keys()) {
    const [x, y] = posisi.get(v);
    arah.forEach(([ax, ay], i) => {
      const kunci = `${komp.get(v)}|${i}`;
      const nilai = ax * x + ay * y;
      if (!ekstrem.has(kunci) || nilai > ekstrem.get(kunci)[0]) ekstrem.set(kunci, [nilai, v]);
    });
  }
  for (const [, v] of ekstrem.values()) kandidatSet.add(v);
  const kandidat = [...kandidatSet];
  const pasangan = [];
  for (let i = 0; i < kandidat.length; i++) {
    for (let j = i + 1; j < kandidat.length; j++) {
      pasangan.push([meter(posisi.get(kandidat[i]), posisi.get(kandidat[j])), kandidat[i], kandidat[j]]);
    }
  }
  pasangan.sort((x, y) => y[0] - x[0]);
  const cache = new Map();
  let hasil = null;
  for (const [, u, v] of pasangan) {
    if (!cache.has(u)) cache.set(u, dijkstra(graf, u));
    const d = cache.get(u);
    if (!d.jarak.has(v)) continue; // beda komponen (celah terlalu lebar)
    hasil = { d, awal: u, akhir: v };
    break;
  }
  const komponen = new Set([...komp.values()]).size;
  const urut = [];
  if (!hasil) return null;
  for (let v = hasil.akhir; v !== undefined; v = hasil.d.asal.get(v)) urut.push(v);
  urut.reverse(); // dari ujung awal ke ujung akhir
  // Arah konsisten: dari selatan/barat ke utara/timur supaya impor ulang stabil.
  let garis = urut.map((v) => posisi.get(v));
  const [p, q] = [garis[0], garis.at(-1)];
  if (p[1] + p[0] > q[1] + q[0]) garis = garis.reverse();
  garis = sederhanakan(garis);
  // Bagian (komponen awal) yang tidak tersambung ke garis dan tidak ikut dipakai.
  const terpakai = new Set(urut.map((v) => komp.get(v)));
  return { garis, panjangM: Math.round(panjangGaris(garis)), tidakTerpakai: komponen - terpakai.size };
}

// Ruas-ruas batas (outer & inner) relasi → fungsi titik-di-dalam (aturan genap-ganjil;
// cukup dengan kumpulan ruas, tanpa merangkai cincin). null bila relasi tidak ada.
export function pembatasWilayah(rel) {
  const ruas = [];
  for (const m of rel?.members || []) {
    if (m.type !== 'way' || !Array.isArray(m.geometry)) continue;
    for (let i = 1; i < m.geometry.length; i++) {
      const a = m.geometry[i - 1];
      const b = m.geometry[i];
      ruas.push([a.lon, a.lat, b.lon, b.lat]);
    }
  }
  if (!ruas.length) return null;
  return ([x, y]) => {
    let dalam = false;
    for (const [x1, y1, x2, y2] of ruas) {
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) dalam = !dalam;
    }
    return dalam;
  };
}

// Potong way ke dalam wilayah: tiap rangkaian simpul berurutan yang di dalam jadi way sendiri.
function potongKeWilayah(ways, diDalam) {
  if (!diDalam) return ways;
  const out = [];
  for (const w of ways) {
    let nodes = [];
    let geom = [];
    const simpan = () => {
      if (nodes.length >= 2) out.push({ ...w, nodes, geometry: geom });
      nodes = [];
      geom = [];
    };
    (w.nodes || []).forEach((id, i) => {
      const g = w.geometry?.[i];
      if (g && diDalam([g.lon, g.lat])) {
        nodes.push(id);
        geom.push(g);
      } else simpan();
    });
    simpan();
  }
  return out;
}

// Respons Overpass → daftar koridor siap disimpan + catatan.
export function olahKoridorJalan(data, defs = KORIDOR_JALAN, relasi = RELASI_MEDAN) {
  const el = data?.elements || [];
  const diDalam = pembatasWilayah(el.find((e) => e.type === 'relation' && e.id === relasi));
  const semuaWay = el.filter((e) => e.type === 'way' && e.tags?.name);
  const ways = potongKeWilayah(semuaWay, diDalam);
  const koridor = [];
  const catatan = [];
  defs.forEach((d, urutan) => {
    const milik = ways.filter((w) => d.pola.test(w.tags.name) && KELAS_JALAN.includes(w.tags.highway));
    const g = gabungRuas(milik);
    if (!g || g.garis.length < 2) {
      catatan.push({ kode: d.kode, pesan: 'tidak ada ruas OSM yang cocok' });
      return;
    }
    if (g.tidakTerpakai > 0) {
      catatan.push({ kode: d.kode, pesan: `${g.tidakTerpakai} potongan ruas terpisah tidak ikut dipakai` });
    }
    koridor.push({
      kode: d.kode,
      nama: d.nama,
      urutan,
      jalur: { type: 'LineString', coordinates: g.garis },
      panjangM: g.panjangM,
      namaOsm: [...new Set(milik.map((w) => w.tags.name))].sort(),
      jumlahWay: new Set(milik.map((w) => w.id)).size,
    });
  });
  if (!diDalam) catatan.push({ kode: '-', pesan: 'batas Kota Medan tidak ada di respons; ruas tidak dipotong' });
  return { koridor, catatan };
}

const bulat6 = (c) => c.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);

// Simpan hasil `olahKoridorJalan`. Aman diulang: kunci = `kode`; koreksi admin tidak ditimpa;
// koridor yang hilang dari OSM tidak dihapus. → statistik.
export async function imporKoridorJalan({ koridor }, sekarang = new Date()) {
  const s = { baru: 0, diperbarui: 0, tetap: 0, dikunciAdmin: 0 };
  for (const k of koridor) {
    const jalur = { type: 'LineString', coordinates: bulat6(k.jalur.coordinates) };
    const ada = await RoadCorridor.findOne({ kode: k.kode }).lean();
    if (!ada) {
      await RoadCorridor.create({ ...k, jalur, sumber: 'osm', diperbaruiPada: sekarang });
      s.baru++;
      continue;
    }
    if (ada.dikoreksiAdmin) {
      s.dikunciAdmin++;
      continue;
    }
    const sama =
      ada.nama === k.nama &&
      ada.urutan === k.urutan &&
      JSON.stringify(ada.jalur.coordinates) === JSON.stringify(jalur.coordinates) &&
      JSON.stringify(ada.namaOsm) === JSON.stringify(k.namaOsm);
    if (sama) {
      s.tetap++;
      continue;
    }
    await RoadCorridor.updateOne(
      { _id: ada._id },
      {
        $set: {
          nama: k.nama,
          urutan: k.urutan,
          jalur,
          panjangM: k.panjangM,
          namaOsm: k.namaOsm,
          jumlahWay: k.jumlahWay,
          diperbaruiPada: sekarang,
        },
      },
    );
    s.diperbarui++;
  }
  return s;
}
