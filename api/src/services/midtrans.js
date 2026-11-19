import crypto from 'node:crypto';
import { httpError } from '../lib/httpError.js';

// Midtrans Snap — SELALU sandbox (TASK Keputusan #3 & #7), juga di produksi.
// Server key hanya dipakai di sini; tidak pernah dikirim ke klien.
// Tes menyuntikkan klien palsu lewat createApp({ midtrans }).

export const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
export const CORE_URL = 'https://api.sandbox.midtrans.com/v2';

/** Metode di layar Digital Payment (mockup hal. 5) → `enabled_payments` Snap. */
export const METODE_SNAP = {
  kartu: ['credit_card'],
  ewallet: ['gopay', 'shopeepay'],
  transfer: ['bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel', 'other_va'],
  qris: ['other_qris'],
};
export const METODE = Object.keys(METODE_SNAP);

/** SHA512(order_id + status_code + gross_amount + serverKey) — ARCHITECTURE §5.3. */
export function hitungSignature({ order_id, status_code, gross_amount }, serverKey) {
  return crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex');
}

export function signatureValid(body, serverKey) {
  if (!serverKey || !body || typeof body.signature_key !== 'string') return false;
  const { order_id, status_code, gross_amount } = body;
  if ([order_id, status_code, gross_amount].some((v) => typeof v !== 'string' && typeof v !== 'number')) {
    return false;
  }
  const harap = Buffer.from(hitungSignature(body, serverKey), 'hex');
  const dapat = Buffer.from(body.signature_key, 'hex');
  return harap.length === dapat.length && crypto.timingSafeEqual(harap, dapat);
}

/**
 * Status Midtrans → status `Payment`. `null` = belum final (pending / challenge).
 * https://docs.midtrans.com/docs/https-notification-webhooks
 */
export function statusDariMidtrans({ transaction_status: s, fraud_status: f } = {}) {
  if (s === 'settlement') return 'lunas';
  if (s === 'capture') return f === 'accept' || f === undefined ? 'lunas' : f === 'deny' ? 'gagal' : null;
  if (s === 'deny' || s === 'failure') return 'gagal';
  if (s === 'expire') return 'kedaluwarsa';
  if (s === 'cancel') return 'dibatalkan';
  return null;
}

export function createMidtrans(cfg, { fetchFn = globalThis.fetch } = {}) {
  const serverKey = cfg.midtrans?.serverKey;
  const auth = () => {
    if (!serverKey) throw httpError(503, 'Pembayaran simulasi belum diaktifkan', 'PEMBAYARAN_NONAKTIF');
    return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
  };

  return {
    serverKey,

    /** Buat transaksi Snap → { token, redirectUrl }. */
    async buatTransaksi({ orderId, jumlah, item, pelanggan, metode, finishUrl }) {
      const body = {
        transaction_details: { order_id: orderId, gross_amount: jumlah },
        item_details: [item],
        customer_details: pelanggan,
        credit_card: { secure: true },
        expiry: { unit: 'hours', duration: 24 },
        ...(metode ? { enabled_payments: METODE_SNAP[metode] } : {}),
        ...(finishUrl ? { callbacks: { finish: finishUrl } } : {}),
      };
      let res;
      try {
        res = await fetchFn(SNAP_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: auth() },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        if (err.status) throw err;
        throw httpError(502, 'Midtrans tidak bisa dihubungi. Coba lagi sebentar.', 'PEMBAYARAN_GAGAL');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw httpError(502, 'Transaksi belum bisa dibuat. Coba lagi sebentar.', 'PEMBAYARAN_GAGAL');
      }
      return { token: data.token, redirectUrl: data.redirect_url };
    },

    /** GET /v2/:orderId/status → isi notifikasi (bertanda tangan) atau `null` bila belum ada. */
    async cekStatus(orderId) {
      let res;
      try {
        res = await fetchFn(`${CORE_URL}/${encodeURIComponent(orderId)}/status`, {
          headers: { Accept: 'application/json', Authorization: auth() },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        if (err.status) throw err;
        throw httpError(502, 'Midtrans tidak bisa dihubungi. Coba lagi sebentar.', 'PEMBAYARAN_GAGAL');
      }
      const data = await res.json().catch(() => ({}));
      // Midtrans membalas HTTP 200 dengan status_code "404" bila transaksi belum dibuat/dibayar.
      if (res.status === 404 || String(data.status_code) === '404') return null;
      if (!res.ok || !data.transaction_status) {
        throw httpError(502, 'Status pembayaran belum bisa dicek. Coba lagi sebentar.', 'PEMBAYARAN_GAGAL');
      }
      return data;
    },
  };
}
