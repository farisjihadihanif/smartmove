import { httpError } from '../lib/httpError.js';

const gagal = () => httpError(502, 'Layanan peta sedang bermasalah, coba lagi nanti', 'LAYANAN_PETA_GAGAL');

// Moda SmartMove → profil OSRM. Motor memakai jaringan jalan mobil.
export const PROFIL = { driving: 'driving', motorcycle: 'driving', walking: 'foot' };

// Server demo OSRM hanya punya profil mobil, jadi durasi jalan kaki dihitung
// dari jarak (±5 km/jam) agar tetap masuk akal di server mana pun.
const KECEPATAN_JALAN_MS = 5000 / 3600;

// Klien OSRM: User-Agent khusus aplikasi + batas waktu. Mengembalikan JSON mentah.
export function createOsrm(cfg, { fetch = globalThis.fetch } = {}) {
  const base = (cfg.osrmUrl || 'https://router.project-osrm.org').replace(/\/+$/, '');
  const timeout = cfg.osrmTimeoutMs ?? 10000;

  return {
    async route(from, to, profil) {
      const titik = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = new URL(`${base}/route/v1/${profil}/${titik}`);
      url.searchParams.set('overview', 'full');
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('steps', 'true');

      let res;
      try {
        res = await fetch(url, {
          headers: { 'User-Agent': cfg.mapUserAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeout),
        });
      } catch {
        throw gagal();
      }
      let body;
      try {
        body = await res.json();
      } catch {
        throw gagal();
      }
      // OSRM membalas 400 untuk NoRoute/NoSegment; itu bukan kegagalan layanan.
      if (!res.ok && !['NoRoute', 'NoSegment'].includes(body?.code)) throw gagal();
      return body;
    },
  };
}

const ARAH = {
  left: 'kiri',
  right: 'kanan',
  'slight left': 'sedikit ke kiri',
  'slight right': 'sedikit ke kanan',
  'sharp left': 'tajam ke kiri',
  'sharp right': 'tajam ke kanan',
};

const URUTAN = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam'];
const keluarKe = (n) => (n ? `keluar di jalan ${URUTAN[n - 1] || `ke-${n}`}` : 'keluar');

// Satu langkah OSRM → kalimat bahasa Indonesia.
export function teksLangkah(step) {
  const m = step.maneuver || {};
  const jalan = step.name || step.ref || '';
  const ke = jalan ? ` ke ${jalan}` : '';
  const di = jalan ? ` di ${jalan}` : '';
  const arah = ARAH[m.modifier];

  switch (m.type) {
    case 'depart':
      return `Mulai${di}`;
    case 'arrive':
      return m.modifier === 'left'
        ? 'Tiba di tujuan, di sebelah kiri'
        : m.modifier === 'right'
          ? 'Tiba di tujuan, di sebelah kanan'
          : 'Tiba di tujuan';
    case 'roundabout':
    case 'rotary':
      return `Masuk bundaran, ${keluarKe(m.exit)}${ke}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Keluar bundaran${ke}`;
    case 'merge':
      return `Bergabung${ke || ' ke jalur utama'}`;
    case 'on ramp':
      return `Ambil jalur masuk${ke}`;
    case 'off ramp':
      return `Ambil jalur keluar${ke}`;
    case 'fork':
      return m.modifier?.includes('left')
        ? `Ambil cabang kiri${ke}`
        : m.modifier?.includes('right')
          ? `Ambil cabang kanan${ke}`
          : `Ikuti percabangan${ke}`;
    case 'new name':
    case 'continue':
    case 'notification':
      if (m.modifier === 'uturn') return `Putar balik${di}`;
      if (arah) return `Belok ${arah}${ke}`;
      return `Lurus terus${di}`;
    default: // turn, end of road, roundabout turn, dll.
      if (m.modifier === 'uturn') return `Putar balik${di}`;
      if (m.modifier === 'straight' || !arah) return `Lurus${ke}`;
      return `Belok ${arah}${ke}`;
  }
}

// Respons OSRM → bentuk API_SPECS §6.1. `null` bila rute tidak ditemukan.
export function keRute(body, mode) {
  const r = body?.code === 'Ok' ? body.routes?.[0] : null;
  if (!r) return null;
  const jarakM = Math.round(r.distance);
  const langkah = (r.legs || [])
    .flatMap((l) => l.steps || [])
    .map((s) => ({
      teks: teksLangkah(s),
      jarakM: Math.round(s.distance || 0),
      lokasi: Array.isArray(s.maneuver?.location) ? s.maneuver.location : undefined,
    }));
  return {
    mode,
    jarakM,
    durasiS: Math.round(mode === 'walking' ? jarakM / KECEPATAN_JALAN_MS : r.duration),
    garis: r.geometry?.coordinates || [],
    langkah,
  };
}
