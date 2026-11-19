import dns from 'node:dns';
import mongoose from 'mongoose';
import config, { assertConfig } from './config.js';
import { createApp } from './app.js';
import { ensureAdmin } from './services/adminSeed.js';
import { createMidtrans } from './services/midtrans.js';
import { kedaluwarsakanPembayaran } from './services/payments.js';

async function main() {
  assertConfig();
  // Opsional: beberapa jaringan Windows membuat Node memakai DNS 127.0.0.1 sehingga
  // lookup SRV `mongodb+srv://` gagal (querySrv ECONNREFUSED).
  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  await mongoose.connect(config.mongoUrl);
  console.log('MongoDB terhubung');

  const seed = await ensureAdmin(config.admin);
  console.log(`Akun admin: ${seed.status}`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API berjalan di port ${config.port}`);
  });

  // Cron (ARCHITECTURE §6): Payment `menunggu` > 24 jam → cocokkan dengan Midtrans /
  // kedaluwarsa. Dicek tiap jam supaya tidak menunggu sampai sehari penuh setelah restart.
  const midtrans = createMidtrans(config);
  const cron = async () => {
    const n = await kedaluwarsakanPembayaran({ midtrans }).catch((err) => {
      console.warn(`Cron pembayaran gagal: ${err.message}`);
      return 0;
    });
    if (n) console.log(`Cron pembayaran: ${n} transaksi diproses`);
  };
  const cronTimer = setInterval(cron, 60 * 60 * 1000);
  cronTimer.unref();
  setTimeout(cron, 30_000).unref();

  const stop = async () => {
    clearInterval(cronTimer);
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
