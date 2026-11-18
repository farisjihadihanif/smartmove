import { MEBIDANG } from '../lib/wilayah.js';

export const OVERPASS_BAWAAN = 'https://overpass-api.de/api/interpreter';

// Relasi `route` transportasi umum di kotak Mebidang + node anggotanya (halte),
// dalam SATU permintaan. `out geom` menyertakan geometri jalan tiap anggota.
export function kueriTransit(b = MEBIDANG) {
  const bbox = `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`;
  return [
    '[out:json][timeout:180];',
    `rel["type"="route"]["route"~"^(bus|trolleybus|minibus|share_taxi|train|light_rail)$"](${bbox})->.r;`,
    '.r out body geom;',
    'node(r.r);',
    'out body;',
  ].join('\n');
}

const SEMENTARA = new Set([429, 502, 503, 504]); // server penuh/batas: boleh dicoba lagi

// Klien Overpass yang patuh kebijakan pemakaian:
// - User-Agent yang mengenali SmartMove;
// - satu kueri per impor, tidak pernah paralel;
// - bila server penuh (429/50x/timeout) menunggu dengan jeda yang terus berlipat
//   (atau sesuai header Retry-After), bukan mengirim ulang beruntun.
export function createOverpass(
  cfg,
  { fetch = globalThis.fetch, tidur = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {},
) {
  const url = cfg.overpassUrl || OVERPASS_BAWAAN;
  const timeout = cfg.overpassTimeoutMs ?? 200_000;
  const jedaAwal = cfg.overpassJedaMs ?? 30_000;
  const maksCoba = cfg.overpassMaksCoba ?? 5;

  async function sekali(kueri) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': cfg.mapUserAgent,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: kueri }).toString(),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      return { ulang: true, alasan: `jaringan/timeout (${err.name || err.message})` };
    }
    if (SEMENTARA.has(res.status)) {
      const ra = Number(res.headers?.get?.('retry-after'));
      return { ulang: true, alasan: `HTTP ${res.status}`, tunggu: ra > 0 ? ra * 1000 : undefined };
    }
    if (!res.ok) throw new Error(`Overpass menolak permintaan (HTTP ${res.status})`);
    let body;
    try {
      body = await res.json();
    } catch {
      return { ulang: true, alasan: 'respons bukan JSON' };
    }
    // Overpass kadang membalas 200 dengan "runtime error" (kehabisan waktu/memori).
    if (typeof body?.remark === 'string' && /error/i.test(body.remark)) {
      return { ulang: true, alasan: body.remark.slice(0, 120) };
    }
    if (!Array.isArray(body?.elements)) throw new Error('Respons Overpass tidak berisi elements');
    return { body };
  }

  return {
    url,
    async ambil(kueri = kueriTransit()) {
      let jeda = jedaAwal;
      for (let coba = 1; ; coba++) {
        const hasil = await sekali(kueri);
        if (hasil.body) return hasil.body;
        if (coba >= maksCoba) {
          throw new Error(`Overpass gagal setelah ${coba} percobaan (${hasil.alasan}). Coba lagi nanti.`);
        }
        const tunggu = Math.max(hasil.tunggu ?? 0, jeda);
        log(
          `Overpass: ${hasil.alasan}; mencoba lagi dalam ${Math.round(tunggu / 1000)} detik ` +
            `(percobaan ${coba + 1}/${maksCoba})`,
        );
        await tidur(tunggu);
        jeda *= 2;
      }
    },
  };
}
