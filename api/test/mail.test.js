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
