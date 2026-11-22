import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer } from '../src/services/mail.js';

const msg = { to: 'Palsu@Contoh.id', subject: 'Reset', text: 'tautan' };
const smtp = { user: 'u', pass: 'p', from: 'u@x.id' };

function setup(cfg) {
  const logs = [];
  const sent = [];
  const logger = { log: (s) => logs.push(s), warn: (s) => logs.push(s) };
  const transport = { sendMail: async (m) => sent.push(m) };
  return { mailer: createMailer(cfg, { logger, transport }), logs, sent };
}

test('dev bawaan: email hanya ke konsol walau SMTP diisi', async () => {
  const { mailer, logs, sent } = setup({ nodeEnv: 'development', smtp });
  await mailer.send(msg);
  assert.equal(sent.length, 0);
  assert.match(logs[0], /Palsu@Contoh.id/);
});

test('dev MAIL_MODE=smtp: hanya ADMIN_EMAIL yang dikirim sungguhan', async () => {
  const { mailer, logs, sent } = setup({
    nodeEnv: 'development',
    mailMode: 'smtp',
    smtp,
    admin: { email: 'admin@smartmove.id' },
  });
  await mailer.send(msg);
  await mailer.send({ ...msg, to: 'ADMIN@smartmove.id' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ADMIN@smartmove.id');
  assert.match(logs[0], /bukan ADMIN_EMAIL/);
});

test('produksi: dikirim ke alamat tujuan', async () => {
  const { mailer, sent } = setup({ nodeEnv: 'production', mailMode: 'console', smtp });
  await mailer.send(msg);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'Palsu@Contoh.id');
});

function setupHttp(cfg) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 201, text: async () => '' };
  };
  const logger = { log() {}, warn() {} };
  return { mailer: createMailer(cfg, { logger, fetch }), calls };
}

test('produksi MAIL_PROVIDER=brevo: dikirim lewat API HTTP Brevo', async () => {
  const { mailer, calls } = setupHttp({
    nodeEnv: 'production',
    mailProvider: 'brevo',
    brevoApiKey: 'kunci',
    mailFrom: 'noreply@smartmove.id',
  });
  await mailer.send(msg);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.headers['api-key'], 'kunci');
  assert.deepEqual(calls[0].body.to, [{ email: 'Palsu@Contoh.id' }]);
  assert.equal(calls[0].body.sender.email, 'noreply@smartmove.id');
  assert.equal(calls[0].body.textContent, 'tautan');
});

test('produksi MAIL_PROVIDER=resend: Bearer key, galat HTTP dilempar', async () => {
  const { mailer, calls } = setupHttp({
    nodeEnv: 'production',
    mailProvider: 'resend',
    resendApiKey: 're_x',
    mailFrom: 'noreply@smartmove.id',
  });
  await mailer.send(msg);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_x');
  assert.deepEqual(calls[0].body.to, ['Palsu@Contoh.id']);

  const gagal = createMailer(
    { nodeEnv: 'production', mailProvider: 'resend', resendApiKey: 're_x', mailFrom: 'a@b.id' },
    { fetch: async () => ({ ok: false, status: 403, text: async () => 'domain belum diverifikasi' }) },
  );
  await assert.rejects(gagal.send(msg), /HTTP 403/);
});

test('dev dengan penyedia HTTP: tetap konsol kecuali ADMIN_EMAIL saat MAIL_MODE=smtp', async () => {
  const base = { nodeEnv: 'development', mailProvider: 'brevo', brevoApiKey: 'k', mailFrom: 'a@b.id' };
  const dev = setupHttp(base);
  await dev.mailer.send(msg);
  assert.equal(dev.calls.length, 0);

  const kirim = setupHttp({ ...base, mailMode: 'smtp', admin: { email: 'admin@smartmove.id' } });
  await kirim.mailer.send(msg);
  await kirim.mailer.send({ ...msg, to: 'admin@smartmove.id' });
  assert.equal(kirim.calls.length, 1);
});
