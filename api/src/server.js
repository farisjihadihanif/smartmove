import dns from 'node:dns';
import mongoose from 'mongoose';
import config, { assertConfig } from './config.js';
import { createApp } from './app.js';
import { ensureAdmin } from './services/adminSeed.js';

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

  const stop = async () => {
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
