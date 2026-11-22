import { createRequire } from 'node:module';

// Dua bahasa untuk teks dari API (T-111, TASK Keputusan #20). Bahasa diambil dari header
// `Accept-Language` (klien mengirim bahasa pilihan pengguna): `en…` → Inggris, selain itu Indonesia.
// Kunci kamus = teks Indonesia apa adanya; `{0}`, `{1}` = bagian yang berubah.
const en = createRequire(import.meta.url)('../i18n/en.json');
const KAMUS = { en };

export function bahasaDari(req) {
  const h = String(req.get?.('accept-language') ?? '').trim().toLowerCase();
  const pertama = h.split(',')[0]?.trim() ?? '';
  return pertama.startsWith('en') ? 'en' : 'id';
}

/**
 * Middleware: `req.bahasa` = 'id' | 'en', dan setiap `message` di respons JSON (galat, batas
 * permintaan, info) diterjemahkan otomatis sesuai bahasa.
 */
export function pasangBahasa(req, res, next) {
  req.bahasa = bahasaDari(req);
  res.vary('Accept-Language');
  if (req.bahasa !== 'id') {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object' && typeof body.message === 'string') {
        body = { ...body, message: terjemahPesan(req.bahasa, body.message) };
      }
      return json(body);
    };
  }
  next();
}

/** tr('en', 'Rute ke {0}', [nama]) */
export function tr(bahasa, teks, vars = []) {
  const s = bahasa === 'id' ? teks : (KAMUS[bahasa]?.[teks] ?? teks);
  return s.replace(/\{(\d+)\}/g, (m, i) => (vars[i] === undefined ? m : String(vars[i])));
}

// Pola untuk pesan dengan bagian yang berubah ("{0} wajib diisi"), dari yang paling spesifik.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const POLA = Object.keys(en)
  .filter((k) => /\{\d+\}/.test(k))
  .sort((a, b) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map((k) => ({ k, re: new RegExp(`^${esc(k).replace(/\\\{\d+\\\}/g, '(.+?)')}$`, 's') }));

/**
 * Terjemahkan pesan yang sudah jadi (mis. galat `httpError`): cocok persis, atau cocok pola
 * dengan bagian yang berubah ikut diterjemahkan bila ada di kamus (mis. nama field).
 */
export function terjemahPesan(bahasa, pesan) {
  if (bahasa === 'id' || typeof pesan !== 'string') return pesan;
  const kamus = KAMUS[bahasa] ?? {};
  if (kamus[pesan]) return kamus[pesan];
  for (const { k, re } of POLA) {
    const m = pesan.match(re);
    if (m) return tr(bahasa, k, m.slice(1).map((v) => kamus[v] ?? v));
  }
  return pesan;
}
