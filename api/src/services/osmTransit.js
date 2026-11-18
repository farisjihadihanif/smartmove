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

// Rangkai geometri way anggota relasi menjadi satu garis [lng, lat].
// Arah tiap way disesuaikan dengan ujung garis sebelumnya.
export function rangkaiJalur(segmen) {
  let out = [];
  let jumlahWay = 0;
  for (const seg of segmen) {
    if (seg.length < 2) continue;
    jumlahWay++;
    if (!out.length) {
      out = seg.slice();
      continue;
    }
    const awal = out[0];
    const akhir = out[out.length - 1];
    const balik = seg.slice().reverse();
    if (sama(akhir, seg[0])) out.push(...seg.slice(1));
    else if (sama(akhir, balik[0])) out.push(...balik.slice(1));
    else if (jumlahWay === 2 && (sama(awal, seg[0]) || sama(awal, balik[0]))) {
      // way pertama ternyata terbalik
      out.reverse();
      out.push(...(sama(awal, seg[0]) ? seg : balik).slice(1));
    } else {
      // ada celah: pilih arah yang ujungnya paling dekat
      const d = (p) => (p[0] - akhir[0]) ** 2 + (p[1] - akhir[1]) ** 2;
      out.push(...(d(seg[0]) <= d(balik[0]) ? seg : balik));
    }
  }
  return out.filter((p, i) => i === 0 || !sama(p, out[i - 1]));
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
 * @returns {{ koridor: object[], halte: Map<string, {osmId, nama, lokasi}>, dilewati: {osmId, nama, alasan}[] }}
 * `koridor[].halte` = daftar osmId halte berurutan.
 */
export function olahOverpass(data) {
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const nodes = new Map();
  for (const e of elements) if (e.type === 'node' && Number.isFinite(e.lat)) nodes.set(e.id, e);

  const relasi = elements.filter((e) => e.type === 'relation').sort((a, b) => a.id - b.id);
  const koridor = [];
  const halte = new Map();
  const dilewati = [];

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
    const garis = rangkaiJalur(segmen);

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

    koridor.push({
      osmId,
      ref: bersih(t.ref, 30),
      nama,
      jenis,
      operator: bersih(t.operator) || bersih(t.network),
      warna: warna(t.colour),
      jamOperasi: bersih(t.opening_hours, 100),
      tarif: bacaTarif(t.charge),
      jalur: garis.length >= 2 ? { type: 'LineString', coordinates: garis } : undefined,
      jaringan: [t.network, t.operator, t.name].filter(Boolean).join(' '),
      halte: urutHalte,
    });
  }

  return { koridor, halte, dilewati };
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
  const dasar = ref ? `${awalan}-${ref}` : `OSM-${k.osmId.split('/')[1]}`;
  let kode = dasar;
  for (let i = 2; terpakai.has(kode); i++) kode = `${dasar}-${i}`;
  terpakai.add(kode);
  return kode;
}
