import nodemailer from 'nodemailer';

// Pengirim email via Gmail SMTP. Tes menyuntikkan mailer palsu lewat createApp({ mailer }).
//
// Di luar produksi email TIDAK dikirim ke sembarang alamat (alamat uji sering palsu):
// - MAIL_MODE=console (bawaan dev): isi email hanya ditulis ke konsol.
// - MAIL_MODE=smtp: dikirim lewat SMTP, tapi hanya ke ADMIN_EMAIL; alamat lain ke konsol.
// Produksi selalu SMTP ke alamat tujuan.
export function createMailer(cfg, { logger = console, transport } = {}) {
  const { user, pass, from } = cfg.smtp || {};
  const production = cfg.nodeEnv === 'production';
  const mode = production ? 'smtp' : cfg.mailMode === 'smtp' ? 'smtp' : 'console';
  const adminEmail = (cfg.admin?.email || '').trim().toLowerCase();

  const toConsole = ({ to, subject, text }, reason) =>
    logger.log(`[email ${reason}] ke ${to}: ${subject}\n${text}`);

  if (mode === 'console' || !user || !pass) {
    return {
      async send(msg) {
        if (production) logger.warn('SMTP belum diatur; email tidak dikirim.');
        else toConsole(msg, 'konsol');
      },
    };
  }

  const smtp = transport || nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return {
    async send(msg) {
      const to = String(msg.to || '').trim().toLowerCase();
      if (!production && (!adminEmail || to !== adminEmail)) {
        toConsole(msg, 'konsol, bukan ADMIN_EMAIL');
        return;
      }
      await smtp.sendMail({ from: `SmartMove Medan <${from}>`, ...msg });
    },
  };
}
