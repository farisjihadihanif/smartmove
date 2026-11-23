# SmartMove Medan

Aplikasi mobilitas kota Medan: peta dan rute (OpenStreetMap), transportasi umum, lalu lintas, perjalanan, kampanye, dan pemesanan layanan dengan pembayaran simulasi Midtrans (sandbox).

| Folder | Isi |
|---|---|
| `api/` | API Express + MongoDB (Mongoose). Gambar unggahan disimpan di GridFS |
| `web/` | Web React + Vite |
| `mobile/` | Aplikasi Flutter (Android) |

## Menjalankan di komputer sendiri

1. `api/`: salin `.env.example` ke `.env` lalu isi minimal `MONGO_URL` dan `JWT_SECRET`. Jalankan `npm install` lalu `npm run dev` (port 4200).
2. `web/`: `npm install` lalu `npm run dev` (http://localhost:5173).
3. `mobile/`: hubungkan HP lewat USB, lalu
   ```
   adb reverse tcp:4200 tcp:4200
   flutter run --dart-define=API_URL=http://localhost:4200
   ```

Tes dan lint: `npm test` dan `npm run lint` di `api/` dan `web/`.

## Deploy gratis (Vercel + MongoDB Atlas)

Web dan API masing-masing jadi satu project Vercel dari repositori yang sama.

**1. API** (project Vercel `smartmove-api`, Root Directory `api`, Framework Preset **Other**)
- `api/api/index.js` menjalankan aplikasi Express sebagai serverless function; koneksi MongoDB dipakai ulang antar-request.
- Environment variable: `NODE_ENV=production`, `MONGO_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` dan `APP_URL` (URL web), `CITY=medan`, `COOKIE_SAMESITE=lax`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `MAIL_PROVIDER` + `MAIL_FROM` + `BREVO_API_KEY` (atau `RESEND_API_KEY`), `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` (sandbox), `OSRM_URL_CAR`, `OSRM_URL_FOOT`, dan `CRON_SECRET` (teks acak).
- Vercel Cron memanggil `/api/cron/pembayaran` sekali sehari (paket Hobby) untuk mengakhiri pembayaran yang kedaluwarsa. Daftar pembayaran admin juga mengeceknya saat dibuka.
- MongoDB Atlas: Network Access `0.0.0.0/0`, karena alamat IP Vercel berubah-ubah.

**2. Web** (project Vercel `smartmove`, Root Directory `web`, Framework Preset **Vite**)
- `web/vercel.json` meneruskan `/api/*` ke `https://smartmove-api.vercel.app`. Kalau nama domain API berbeda, ubah alamat itu.

**3. Midtrans** (sandbox): Payment Notification URL = `https://<domain-web>/api/payments/notification`.

**4. Mobile**: build APK dengan `--dart-define=API_URL=https://smartmove-api.vercel.app`.

Alternatif dengan server biasa (Render): `render.yaml` dan `DEPLOY.md`.

## Copyright

© 2026 Faris Jihadi Hanif Lubis. All rights reserved.

This repository is public for portfolio and review purposes only. No license is granted: you may view the code, but you may not copy, modify, redistribute, or use it in other projects without my written permission.

Repositori ini dipublikasikan hanya untuk keperluan portofolio. Kode boleh dilihat, tetapi tidak boleh disalin, diubah, disebarkan, atau digunakan tanpa izin tertulis dari saya.

Contact: [LinkedIn](https://www.linkedin.com/in/faris-jihadi-hanif-lubis-62337a286/)
