import { httpError } from '../lib/httpError.js';

const gagal = () => httpError(502, 'Layanan peta sedang bermasalah, coba lagi nanti', 'LAYANAN_PETA_GAGAL');

// Moda SmartMove → profil OSRM. Motor memakai jaringan jalan mobil.
export const PROFIL = { driving: 'driving', motorcycle: 'driving', walking: 'foot' };

// Bawaan: server FOSSGIS (routing.openstreetmap.de), satu server per profil.
// Untuk produksi ramai sebaiknya pasang OSRM sendiri (ARCHITECTURE §9).
export const OSRM_CAR_BAWAAN = 'https://routing.openstreetmap.de/routed-car';
export const OSRM_FOOT_BAWAAN = 'https://routing.openstreetmap.de/routed-foot';

// Klien OSRM: User-Agent khusus aplikasi + batas waktu. Mengembalikan JSON mentah.
export function createOsrm(cfg, { fetch = globalThis.fetch } = {}) {
  const bersih = (u) => u.replace(/\/+$/, '');
  const base = {
    driving: bersih(cfg.osrmUrlCar || OSRM_CAR_BAWAAN),
    foot: bersih(cfg.osrmUrlFoot || OSRM_FOOT_BAWAAN),
  };
  const timeout = cfg.osrmTimeoutMs ?? 10000;

  async function minta(url) {
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
  }

  return {
    async route(from, to, profil) {
      if (!base[profil]) throw new Error(`Profil OSRM tidak dikenal: ${profil}`);
      const titik = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = new URL(`${base[profil]}/route/v1/${profil}/${titik}`);
      url.searchParams.set('overview', 'full');
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('steps', 'true');
      return minta(url);
    },

    // Rute melewati beberapa titik [{lat, lng, arah?}] tanpa geometri/langkah. `arah` (derajat
    // dari utara) membatasi OSRM ke ruas yang searah, supaya titik di jalan dua jalur tidak
    // menempel ke jalur seberang lalu memaksa putar balik.
    async routeLewat(titik, profil) {
      if (!base[profil]) throw new Error(`Profil OSRM tidak dikenal: ${profil}`);
      const koordinat = titik.map((t) => `${t.lng},${t.lat}`).join(';');
      const url = new URL(`${base[profil]}/route/v1/${profil}/${koordinat}`);
      url.searchParams.set('overview', 'false');
      url.searchParams.set('steps', 'false');
      if (titik.every((t) => Number.isFinite(t.arah))) {
        url.searchParams.set('bearings', titik.map((t) => `${Math.round(t.arah) % 360},45`).join(';'));
      }
      return minta(url);
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

// Satu langkah OSRM → kalimat sesuai bahasa (T-111): 'id' (bawaan) atau 'en'.
export function teksLangkah(step, bahasa = 'id') {
  return bahasa === 'en' ? teksLangkahEn(step) : teksLangkahId(step);
}

function teksLangkahId(step) {
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

const ARAH_EN = {
  left: 'left',
  right: 'right',
  'slight left': 'slightly left',
  'slight right': 'slightly right',
  'sharp left': 'sharply left',
  'sharp right': 'sharply right',
};
const URUTAN_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const keluarKeEn = (n) => (n ? `take the ${URUTAN_EN[n - 1] || `${n}th`} exit` : 'exit');

function teksLangkahEn(step) {
  const m = step.maneuver || {};
  const jalan = step.name || step.ref || '';
  const ke = jalan ? ` onto ${jalan}` : '';
  const di = jalan ? ` on ${jalan}` : '';
  const arah = ARAH_EN[m.modifier];

  switch (m.type) {
    case 'depart':
      return `Start${di}`;
    case 'arrive':
      return m.modifier === 'left'
        ? 'Arrive at your destination, on the left'
        : m.modifier === 'right'
          ? 'Arrive at your destination, on the right'
          : 'Arrive at your destination';
    case 'roundabout':
    case 'rotary':
      return `Enter the roundabout and ${keluarKeEn(m.exit)}${ke}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${ke}`;
    case 'merge':
      return `Merge${ke || ' onto the main road'}`;
    case 'on ramp':
      return `Take the ramp${ke}`;
    case 'off ramp':
      return `Take the exit${ke}`;
    case 'fork':
      return m.modifier?.includes('left')
        ? `Keep left at the fork${ke}`
        : m.modifier?.includes('right')
          ? `Keep right at the fork${ke}`
          : `Continue at the fork${ke}`;
    case 'new name':
    case 'continue':
    case 'notification':
      if (m.modifier === 'uturn') return `Make a U-turn${di}`;
      if (arah) return `Turn ${arah}${ke}`;
      return `Continue straight${di}`;
    default:
      if (m.modifier === 'uturn') return `Make a U-turn${di}`;
      if (m.modifier === 'straight' || !arah) return `Go straight${ke}`;
      return `Turn ${arah}${ke}`;
  }
}

// Respons OSRM → bentuk API_SPECS §6.1. `null` bila rute tidak ditemukan.
export function keRute(body, mode, bahasa = 'id') {
  const r = body?.code === 'Ok' ? body.routes?.[0] : null;
  if (!r) return null;
  const jarakM = Math.round(r.distance);
  const langkah = (r.legs || [])
    .flatMap((l) => l.steps || [])
    .map((s) => ({
      teks: teksLangkah(s, bahasa),
      jarakM: Math.round(s.distance || 0),
      lokasi: Array.isArray(s.maneuver?.location) ? s.maneuver.location : undefined,
    }));
  return {
    mode,
    jarakM,
    durasiS: Math.round(r.duration),
    garis: r.geometry?.coordinates || [],
    langkah,
  };
}
