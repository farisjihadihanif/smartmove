import nodemailer from 'nodemailer';

// Pengirim email via Gmail SMTP. Tes menyuntikkan mailer palsu lewat createApp({ mailer }).
export function createMailer(cfg, { logger = console } = {}) {
  const { user, pass, from } = cfg.smtp || {};
  if (!user || !pass) {
    return {
      async send({ to, subject, text }) {
        if (cfg.nodeEnv === 'production') {
          logger.warn('SMTP belum diatur; email tidak dikirim.');
        } else {
          // Hanya di development: tampilkan isi email agar alur reset bisa dicoba.
          logger.log(`[email dev] ke ${to}: ${subject}\n${text}`);
        }
      },
    };
  }

  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return {
    send: ({ to, subject, text, html }) =>
      transport.sendMail({ from: `SmartMove Medan <${from}>`, to, subject, text, html }),
  };
}
