import nodemailer from 'nodemailer';

// Pengirim email. Tes menyuntikkan mailer palsu lewat createApp({ mailer }).
//
// Penyedia (MAIL_PROVIDER):
// - smtp (bawaan, dev lokal): Gmail SMTP (SMTP_USER/SMTP_PASS).
// - brevo / resend: API HTTP (BREVO_API_KEY / RESEND_API_KEY). Dipakai di hosting yang
//   memblokir port SMTP (Render free).
//
// Di luar produksi email TIDAK dikirim ke sembarang alamat (alamat uji sering palsu):
// - MAIL_MODE=console (bawaan dev): isi email hanya ditulis ke konsol.
// - MAIL_MODE=smtp (atau kirim): dikirim lewat penyedia, tapi hanya ke ADMIN_EMAIL.
// Produksi selalu mengirim ke alamat tujuan.
export const NAMA_PENGIRIM = 'SmartMove Medan';

function httpSender(provider, apiKey, from, fetchFn) {
  const panggil = async (url, headers, body) => {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Email ${provider} gagal (HTTP ${res.status}) ${detail.slice(0, 200)}`.trim());
    }
  };
  if (provider === 'brevo') {
    return ({ to, subject, text, html }) =>
      panggil(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': apiKey },
        {
          sender: { name: NAMA_PENGIRIM, email: from },
          to: [{ email: to }],
          subject,
          textContent: text,
          ...(html ? { htmlContent: html } : {}),
        },
      );
  }
  return ({ to, subject, text, html }) =>
    panggil(
      'https://api.resend.com/emails',
      { Authorization: `Bearer ${apiKey}` },
      { from: `${NAMA_PENGIRIM} <${from}>`, to: [to], subject, text, ...(html ? { html } : {}) },
    );
}

export function createMailer(cfg, { logger = console, transport, fetch: fetchFn = globalThis.fetch } = {}) {
  const provider = ['brevo', 'resend'].includes(cfg.mailProvider) ? cfg.mailProvider : 'smtp';
  const { user, pass } = cfg.smtp || {};
  const from = cfg.mailFrom || cfg.smtp?.from || user;
  const production = cfg.nodeEnv === 'production';
  const kirimDev = ['smtp', 'kirim', 'send'].includes(cfg.mailMode);
  const mode = production || kirimDev ? 'kirim' : 'console';
  const adminEmail = (cfg.admin?.email || '').trim().toLowerCase();

  const toConsole = ({ to, subject, text }, reason) =>
    logger.log(`[email ${reason}] ke ${to}: ${subject}\n${text}`);

  let kirim = null;
  if (provider === 'smtp' && user && pass) {
    const smtp = transport || nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    kirim = (msg) => smtp.sendMail({ from: `${NAMA_PENGIRIM} <${from}>`, ...msg });
  } else if (provider !== 'smtp') {
    const apiKey = provider === 'brevo' ? cfg.brevoApiKey : cfg.resendApiKey;
    if (apiKey && from) kirim = httpSender(provider, apiKey, from, fetchFn);
  }

  if (mode === 'console' || !kirim) {
    return {
      provider,
      async send(msg) {
        if (production) logger.warn(`Email (${provider}) belum diatur; email tidak dikirim.`);
        else toConsole(msg, 'konsol');
      },
    };
  }

  return {
    provider,
    async send(msg) {
      const to = String(msg.to || '').trim().toLowerCase();
      if (!production && (!adminEmail || to !== adminEmail)) {
        toConsole(msg, 'konsol, bukan ADMIN_EMAIL');
        return;
      }
      await kirim(msg);
    },
  };
}
