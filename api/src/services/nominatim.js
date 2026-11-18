import { httpError } from '../lib/httpError.js';
import { MEBIDANG } from '../lib/wilayah.js';

const gagal = () => httpError(502, 'Layanan peta sedang bermasalah, coba lagi nanti', 'LAYANAN_PETA_GAGAL');

// Klien Nominatim yang patuh kebijakan OSM: User-Agent khusus, email kontak,
// dan maksimal 1 permintaan/detik (antrian per proses).
export function createNominatim(cfg, { fetch = globalThis.fetch } = {}) {
  const base = (cfg.nominatimUrl || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
  const jeda = cfg.nominatimIntervalMs ?? 1000;
  const timeout = cfg.nominatimTimeoutMs ?? 8000;
  let antrian = Promise.resolve();
  let terakhir = 0;

  function giliran() {
    const tunggu = antrian.then(async () => {
      const sisa = terakhir + jeda - Date.now();
      if (sisa > 0) await new Promise((r) => setTimeout(r, sisa));
      terakhir = Date.now();
    });
    antrian = tunggu.catch(() => {});
    return tunggu;
  }

  async function panggil(path, params) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries({ format: 'jsonv2', 'accept-language': 'id', ...params })) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    if (cfg.nominatimEmail) url.searchParams.set('email', cfg.nominatimEmail);

    await giliran();
    let res;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': cfg.mapUserAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw gagal();
    }
    if (!res.ok) throw gagal();
    try {
      return await res.json();
    } catch {
      throw gagal();
    }
  }

  return {
    // Hasil mentah Nominatim, dibatasi kotak Mebidang.
    search(q, { limit = 10 } = {}) {
      const b = MEBIDANG;
      return panggil('/search', {
        q,
        limit,
        countrycodes: 'id',
        viewbox: `${b.minLng},${b.maxLat},${b.maxLng},${b.minLat}`,
        bounded: 1,
        addressdetails: 1,
      });
    },
    reverse({ lat, lng }) {
      return panggil('/reverse', { lat, lon: lng, zoom: 18, addressdetails: 1 });
    },
  };
}

// Bentuk tempat untuk klien: { id, nama, alamat, jenis, lokasi: {lat,lng} }.
export function keTempat(p) {
  const label = String(p.display_name || '');
  const nama = p.name || label.split(',')[0].trim() || 'Lokasi tanpa nama';
  const alamat = label.startsWith(nama) ? label.slice(nama.length).replace(/^\s*,\s*/, '') : label;
  return {
    id: `osm:${p.osm_type || ''}${p.osm_id ?? p.place_id ?? ''}`,
    nama,
    alamat,
    jenis: p.type || p.category || null,
    lokasi: { lat: Number(p.lat), lng: Number(p.lon) },
  };
}
