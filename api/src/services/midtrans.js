import crypto from 'node:crypto';
import { httpError } from '../lib/httpError.js';

// Midtrans Core API — SELALU sandbox (TASK Keputusan #3 & #7), juga di produksi.
// Server key hanya dipakai di sini; tidak pernah dikirim ke klien.
// Tes menyuntikkan klien palsu lewat createApp({ midtrans }).

export const CORE_URL = 'https://api.sandbox.midtrans.com/v2';

/**
 * Metode di layar pembayaran SmartMove (Core API, TASK Keputusan #19). Tanpa kartu kredit.
 * `grup` menentukan tampilan instruksi: qris = kode QR, va = nomor virtual account, ewallet = buka aplikasi.
 * `menit` = batas bayar.
 */
export const METODE_BAYAR = {
  qris: { grup: 'qris', menit: 15 },
  gopay: { grup: 'ewallet', menit: 15 },
  shopeepay: { grup: 'ewallet', menit: 15 },
  bca: { grup: 'va', menit: 24 * 60 },
  bni: { grup: 'va', menit: 24 * 60 },
  bri: { grup: 'va', menit: 24 * 60 },
  permata: { grup: 'va', menit: 24 * 60 },
  mandiri: { grup: 'va', menit: 24 * 60 },
};
export const METODE = Object.keys(METODE_BAYAR);

/** Parameter `charge` sesuai metode. */
export function parameterMetode(metode, { kembaliUrl } = {}) {
  if (metode === 'qris') return { payment_type: 'qris', qris: { acquirer: 'gopay' } };
  if (metode === 'gopay') {
    return { payment_type: 'gopay', gopay: { enable_callback: Boolean(kembaliUrl), callback_url: kembaliUrl } };
  }
  if (metode === 'shopeepay') return { payment_type: 'shopeepay', shopeepay: { callback_url: kembaliUrl } };
  if (metode === 'mandiri') {
    return { payment_type: 'echannel', echannel: { bill_info1: 'Pembayaran:', bill_info2: 'SmartMove (simulasi)' } };
  }
  return { payment_type: 'bank_transfer', bank_transfer: { bank: metode } };
}

/** "2026-11-19 17:00:00" (WIB, format Midtrans) → Date. */
export function waktuMidtrans(s) {
  if (typeof s !== 'string' || !s) return null;
  const d = new Date(`${s.replace(' ', 'T')}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Jawaban `charge` → instruksi bayar untuk klien (tanpa data sensitif). */
export function instruksiDari(tx, metode) {
  const aksi = Array.isArray(tx.actions) ? tx.actions : [];
  const url = (nama) => aksi.find((a) => a.name === nama)?.url ?? null;
  const grup = METODE_BAYAR[metode]?.grup ?? 'va';
  return {
    grup,
    metode,
    qrString: tx.qr_string || null,
    qrUrl: url('generate-qr-code') ?? url('generate-qr-code-v2'),
    deeplink: url('deeplink-redirect'),
    bank: tx.va_numbers?.[0]?.bank ?? (tx.permata_va_number ? 'permata' : metode === 'mandiri' ? 'mandiri' : null),
    nomorVa: tx.va_numbers?.[0]?.va_number ?? tx.permata_va_number ?? null,
    kodePerusahaan: tx.biller_code ?? null,
    kodeBayar: tx.bill_key ?? null,
  };
}

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
  const gagal = (pesan) => httpError(502, pesan, 'PEMBAYARAN_GAGAL');

  async function panggil(url, init, pesan) {
    try {
      return await fetchFn(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      if (err.status) throw err;
      throw gagal(pesan);
    }
  }

  return {
    serverKey,

    /** Core API `POST /v2/charge` → { tx, instruksi, batasBayar }. */
    async charge({ orderId, jumlah, item, pelanggan, metode, kembaliUrl }) {
      const info = METODE_BAYAR[metode];
      if (!info) throw httpError(400, 'Metode pembayaran tidak didukung');
      const body = {
        transaction_details: { order_id: orderId, gross_amount: jumlah },
        item_details: [item],
        customer_details: pelanggan,
        custom_expiry: { expiry_duration: info.menit, unit: 'minute' },
        ...parameterMetode(metode, { kembaliUrl }),
      };
      const res = await panggil(
        `${CORE_URL}/charge`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: auth() },
          body: JSON.stringify(body),
        },
        'Midtrans tidak bisa dihubungi. Coba lagi sebentar.',
      );
      const tx = await res.json().catch(() => ({}));
      const kode = String(tx.status_code ?? res.status);
      if (!res.ok || !['200', '201'].includes(kode) || !tx.transaction_status) {
        throw gagal('Transaksi belum bisa dibuat. Coba metode lain atau ulangi sebentar lagi.');
      }
      const batas = waktuMidtrans(tx.expiry_time) ?? new Date(Date.now() + info.menit * 60_000);
      return { tx, instruksi: instruksiDari(tx, metode), batasBayar: batas };
    },

    /** GET /v2/:orderId/status → isi notifikasi (bertanda tangan) atau `null` bila belum ada. */
    async cekStatus(orderId) {
      const res = await panggil(
        `${CORE_URL}/${encodeURIComponent(orderId)}/status`,
        { headers: { Accept: 'application/json', Authorization: auth() } },
        'Midtrans tidak bisa dihubungi. Coba lagi sebentar.',
      );
      const data = await res.json().catch(() => ({}));
      // Midtrans membalas HTTP 200 dengan status_code "404" bila transaksi belum ada.
      if (res.status === 404 || String(data.status_code) === '404') return null;
      if (!res.ok || !data.transaction_status) {
        throw gagal('Status pembayaran belum bisa dicek. Coba lagi sebentar.');
      }
      return data;
    },
  };
}
