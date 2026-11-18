import { httpError } from '../lib/httpError.js';
import { jarakMeter } from '../lib/wilayah.js';

export const MAPILLARY_BAWAAN = 'https://graph.mapillary.com';

// Kotak pencarian ±0,0015° (≈ 165 m) di sekitar titik. Mapillary membatasi luas bbox,
// jadi kotak dibuat kecil; foto terdekat dari titik yang dipilih.
const RADIUS_DERAJAT = 0.0015;
const FIELDS = 'id,thumb_1024_url,captured_at,computed_geometry,geometry,creator';

const gagal = () => httpError(502, 'Foto jalan belum bisa dimuat, coba lagi nanti', 'FOTO_JALAN_GAGAL');

// Klien Mapillary Graph API v4. Token dikirim lewat header (tidak masuk URL/log).
export function createMapillary(cfg, { fetch = globalThis.fetch } = {}) {
  const base = (cfg.mapillaryUrl || MAPILLARY_BAWAAN).replace(/\/+$/, '');
  const timeout = cfg.mapillaryTimeoutMs ?? 8000;

  return {
    aktif: Boolean(cfg.mapillaryToken),
    async sekitar({ lat, lng }) {
      const url = new URL(`${base}/images`);
      const r = RADIUS_DERAJAT;
      url.searchParams.set('bbox', [lng - r, lat - r, lng + r, lat + r].map((n) => n.toFixed(6)).join(','));
      url.searchParams.set('fields', FIELDS);
      url.searchParams.set('limit', '20');

      let res;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `OAuth ${cfg.mapillaryToken}`,
            'User-Agent': cfg.mapUserAgent,
            Accept: 'application/json',
          },
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
    },
  };
}

// Respons Mapillary → foto terdekat dari `titik`, atau null bila tidak ada.
export function fotoTerdekat(body, titik) {
  const kandidat = (Array.isArray(body?.data) ? body.data : [])
    .map((img) => {
      const koordinat = img.computed_geometry?.coordinates || img.geometry?.coordinates;
      if (!img.thumb_1024_url || !Array.isArray(koordinat)) return null;
      const lokasi = { lat: Number(koordinat[1]), lng: Number(koordinat[0]) };
      if (!Number.isFinite(lokasi.lat) || !Number.isFinite(lokasi.lng)) return null;
      return {
        id: String(img.id),
        url: img.thumb_1024_url,
        diambil: img.captured_at ? new Date(img.captured_at).toISOString() : null,
        pengunggah: img.creator?.username || null,
        lokasi,
        jarakM: Math.round(jarakMeter(titik, lokasi)),
        halaman: `https://www.mapillary.com/app/?pKey=${encodeURIComponent(img.id)}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.jarakM - b.jarakM);
  return kandidat[0] || null;
}
