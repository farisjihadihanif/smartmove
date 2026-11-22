# DEPLOY.md – SmartMove Medan (free hosting)

This guide puts SmartMove online **for free** for a portfolio. No paid plan is needed.

| Part | Where it runs | Free plan |
|---|---|---|
| API (`api/`) | **Render** web service | Free (sleeps after 15 minutes without traffic) |
| Website (`web/`) | **Vercel** | Hobby |
| Database | **MongoDB Atlas** | M0 (512 MB) |
| Email (password reset) | **Brevo** (recommended) or **Resend** | Free |
| Payments | **Midtrans sandbox** | Always simulation, never real money |
| Android app | Release APK you build yourself | – |

How the parts talk to each other:

```
Browser ──► https://<your-app>.vercel.app ──(/api/* rewrite)──► https://smartmove-api.onrender.com/api/*
Android app ──────────────────────────────────────────────────► https://smartmove-api.onrender.com/api/*
Render API ──► MongoDB Atlas (data + uploaded photos in GridFS)
Midtrans sandbox ──(payment notification)──► https://smartmove-api.onrender.com/api/payments/notification
```

The website calls the API **through Vercel** (`web/vercel.json`), so the browser only sees one
domain and the login cookie stays first-party.

> Before you start: push this repository to your own GitHub account. Render and Vercel both
> deploy from GitHub. **Never commit `.env` files.** Only the `.env.example` files belong in Git.

---

## Free-tier limits and how the code handles them

| Limit | What the code does |
|---|---|
| Render free **blocks SMTP ports** | Email is sent over HTTPS through Brevo or Resend (`MAIL_PROVIDER`). Gmail SMTP stays for local dev only. |
| Render's **disk is wiped** on every deploy or restart | Profile photos and campaign posters are stored in **MongoDB GridFS** and served from `GET /api/files/:id`. |
| Render **sleeps after 15 minutes**, so the hourly cron may never run | Pending payments older than 24 hours are also expired **when they are read** (payment history, payment detail, admin transactions). |
| Waking up takes **up to ~60 seconds** | Web and app wait longer on the first request, show **"Membangunkan server…"** (Waking up the server…) and retry automatically instead of showing an error. |

---

## Step 1 – Create the accounts

Create these free accounts. Signing in with GitHub is easiest for Render and Vercel.

1. **GitHub**: https://github.com (holds the code).
2. **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/register
3. **Render**: https://render.com (sign in with GitHub).
4. **Vercel**: https://vercel.com (sign in with GitHub).
5. **Email provider**, pick one:
   - **Brevo** (recommended): https://www.brevo.com. It can send from a single verified address, so
     your own Gmail address works and **no domain is needed**.
   - **Resend**: https://resend.com. Without your own verified domain it only delivers to your own
     account's email address, so it only suits testing.
6. **Midtrans** (sandbox): https://dashboard.sandbox.midtrans.com/register
7. Optional: **Mapillary** (street-view photos): https://www.mapillary.com/dashboard/developers

---

## Step 2 – MongoDB Atlas (database)

1. In Atlas, **Create** a cluster, choose **M0 (Free)**. The nearest region to Medan is
   **AWS / Singapore (ap-southeast-1)**.
2. **Database Access** → **Add New Database User** → choose *Password*, create a username and a
   strong password, role **Read and write to any database**. Save the password somewhere safe.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) →
   Confirm.
   - Why: Render's free plan has **no fixed outgoing IP address**, so Atlas cannot whitelist a
     single IP. The database is still protected by the user and password from step 2.
4. **Database** → **Connect** → **Drivers** → copy the connection string. It looks like
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/`. Add the database name `smartmove`
   before the `?`, for example `…mongodb.net/smartmove?retryWrites=true&w=majority`.
   This complete string is your **`MONGO_URL`**.

---

## Step 3 – Email provider

### Brevo (recommended)
1. **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender** → enter the email address
   you want to send from (for example your Gmail) → open the confirmation email and verify it.
2. **SMTP & API** → **API Keys** → **Generate a new API key** → copy it.
3. You will use: `MAIL_PROVIDER=brevo`, `MAIL_FROM` = the verified sender address,
   `BREVO_API_KEY` = the key.

### Resend (alternative)
1. **API Keys** → **Create API Key** → copy it.
2. For real users, add and verify your own domain under **Domains**. Without a domain you can only
   send from `onboarding@resend.dev` to your own address.
3. You will use: `MAIL_PROVIDER=resend`, `MAIL_FROM` = a sender on your verified domain (or
   `onboarding@resend.dev` for testing), `RESEND_API_KEY` = the key.

---

## Step 4 – Midtrans sandbox keys

1. Open https://dashboard.sandbox.midtrans.com and make sure the environment switch says
   **Sandbox**.
2. **Settings** → **Access Keys** → copy the **Server Key** and the **Client Key**.
   - Use **sandbox keys only** (they start with `SB-`). SmartMove payments are always simulated.
   - The server key is secret. It goes **only** into Render, never into the web or app.
3. You set the notification URL in Step 6, once the API has its address.

---

## Step 5 – Deploy the API on Render

The repository has a Blueprint (`render.yaml`) that sets everything up.

1. Render Dashboard → **New** → **Blueprint** → connect your GitHub repository → Render finds
   `render.yaml`.
2. Render shows the service **`smartmove-api`** (free plan, region Singapore, root directory `api`,
   health check `/healthz`). It asks you to fill in every variable marked `sync: false`.
3. Fill in the environment variables (names only below, values are yours):

   | Variable | What to put |
   |---|---|
   | `MONGO_URL` | Atlas connection string from Step 2 |
   | `CLIENT_ORIGIN` | Your Vercel URL, e.g. `https://<your-app>.vercel.app` (you can fix it after Step 7; separate several with commas) |
   | `APP_URL` | The same Vercel URL (used in password-reset emails and the payment return link) |
   | `ADMIN_EMAIL` | Email for the first admin account |
   | `ADMIN_USERNAME` | Username for the first admin account |
   | `ADMIN_PASSWORD` | Strong password, at least 8 characters |
   | `MAIL_FROM` | Verified sender address from Step 3 |
   | `BREVO_API_KEY` | If you use Brevo |
   | `RESEND_API_KEY` | If you use Resend (also change `MAIL_PROVIDER` to `resend`) |
   | `MIDTRANS_SERVER_KEY` | Midtrans **sandbox** server key |
   | `MIDTRANS_CLIENT_KEY` | Midtrans **sandbox** client key |
   | `NOMINATIM_EMAIL` | A contact email for the OpenStreetMap place-search policy |
   | `MAPILLARY_TOKEN` | Optional; leave empty to disable street-view photos |

   These are already set by `render.yaml` and normally need no change: `NODE_ENV`, `NODE_VERSION`,
   `CITY`, `TRUST_PROXY`, `COOKIE_SAMESITE`, `JWT_SECRET` (generated automatically), `JWT_DAYS`,
   `MAIL_PROVIDER`, `OSRM_URL_CAR`, `OSRM_URL_FOOT`, `NOMINATIM_URL`.
   Do **not** set `PORT`; Render provides it.

4. Click **Apply**. The first build takes a few minutes. When it is **Live**, open
   `https://smartmove-api.onrender.com/healthz`. You should see `{"ok":true,"db":true}`.
   - If your service got a different address (for example the name was taken), note it down. You
     need it in Step 6, Step 7 and for the APK.
   - `db:false` or a crash means `MONGO_URL` is wrong or Atlas Network Access is missing (Step 2.3).

5. Check the **Logs** tab for the line `Akun admin: …`:
   - `Akun admin: dibuat` → the admin account was created.
   - `Akun admin: sudah_ada` → an admin with that email/username already exists; nothing changed.
   - `Akun admin: bentrok` (with a warning) → that email or username belongs to a **regular user**.
     Nothing was created or changed; pick another `ADMIN_EMAIL` / `ADMIN_USERNAME` and redeploy.
   - `Akun admin: dilewati` → one of the three `ADMIN_*` variables is empty.

> Rate limits use the client IP. Website traffic arrives through Vercel, so those requests may
> share Vercel's addresses. Keep `TRUST_PROXY=1`: a higher value lets clients fake their IP.

---

## Step 6 – Midtrans notification URL

1. Midtrans sandbox dashboard → **Settings** → **Payment** → **Notification URL**
   (on some dashboard versions: **Settings → Configuration**).
2. **Payment Notification URL**:

   ```
   https://smartmove-api.onrender.com/api/payments/notification
   ```

   (Replace the host if your Render address is different.)
3. Save. A payment's status only changes when Midtrans sends a correctly signed notification to
   this URL.
   - If the API was asleep, Midtrans retries the notification. Users can also press **Cek sekarang**
     on the payment page, which asks Midtrans directly.

---

## Step 7 – Deploy the website on Vercel

1. Open `web/vercel.json`. Check that the `/api/:path*` rewrite points to **your** Render address:

   ```json
   { "source": "/api/:path*", "destination": "https://smartmove-api.onrender.com/api/:path*" }
   ```

   If your Render address is different, edit it, commit and push.
2. Vercel → **Add New…** → **Project** → import your GitHub repository.
3. **Root Directory**: click *Edit* and choose **`web`**. Framework preset: **Vite**
   (build command `npm run build`, output `dist`; both are already set in `vercel.json`).
4. **Environment Variables**:
   - `VITE_API_URL` → **leave it empty / don't add it.** The website then calls `/api/...` on its
     own domain and Vercel forwards it to Render, so the login cookie is first-party.
     Only set it if you deliberately call the API on another domain, and then also set
     `COOKIE_SAMESITE=none` on Render.
   - `VITE_CITY` → optional, default `medan`.
5. **Deploy**. Note your URL, e.g. `https://<your-app>.vercel.app`.
6. Back in **Render → smartmove-api → Environment**, make sure `CLIENT_ORIGIN` and `APP_URL` are
   exactly this URL (with `https://`, no trailing slash). Saving restarts the API.
7. Open the website. If the API was asleep you will see **"Membangunkan server…"** for up to about
   a minute; after that the page loads normally.

`vercel.json` also sends every other path to `index.html`, so links like `/navigasi` or
`/admin/transit` work when opened directly or refreshed.

---

## Step 8 – Fill the database (run once from your computer)

The transit corridors, main roads, safety tips and sample booking catalog are imported by scripts.
Run them **from your own computer** against Atlas:

1. In `api/.env` on your computer, temporarily set `MONGO_URL` to the Atlas connection string.
2. Run:

   ```bash
   cd api
   npm install
   npm run impor:osm      # public transit corridors & stops (OpenStreetMap)
   npm run impor:jalan    # main road corridors (traffic time estimates)
   npm run isi:kampanye   # road-safety tips
   npm run isi:layanan    # sample bookable services (simulation)
   ```

   All four are safe to run again; existing or admin-edited data is not overwritten.
3. Put your local `MONGO_URL` back afterwards so local development doesn't write to production.

---

## Step 9 – First admin login

1. Open `https://<your-app>.vercel.app/masuk` and log in with `ADMIN_EMAIL` (or `ADMIN_USERNAME`)
   and `ADMIN_PASSWORD`.
2. Open `https://<your-app>.vercel.app/admin`. You should see the admin dashboard.
3. Go to **Akun** (`/akun`) and **change the password**. The seeder never overwrites an existing
   account, so the password in Render only matters for the very first start.
4. Optional: clear `ADMIN_PASSWORD` in Render once you have changed it.
5. Test the password reset: log out → **Lupa password** → enter your email. The email arrives from
   `MAIL_FROM`. If it doesn't, check Render **Logs** for `Email … gagal` (wrong key or unverified
   sender).

---

## Step 10 – Build and install the release APK

You need Flutter and the Android SDK on your computer (`flutter doctor` should show no errors for
Android).

1. Build with the **production API URL** (the Render address, **without** `/api` at the end):

   ```bash
   cd mobile
   flutter pub get
   flutter build apk --release --dart-define=API_URL=https://smartmove-api.onrender.com
   ```

2. The APK is at `mobile/build/app/outputs/flutter-apk/app-release.apk`.
3. Install it on an Android phone:
   - **With a USB cable:** enable *Developer options → USB debugging* on the phone, connect it,
     then run `flutter install --release` from `mobile/` (or
     `adb install -r build/app/outputs/flutter-apk/app-release.apk`).
   - **Without a cable:** copy `app-release.apk` to the phone (Google Drive, Telegram, USB file
     transfer), open it, and allow *Install unknown apps* for the app you opened it from.
4. Open the app. The first request after the server slept shows **"Membangunkan server…"** and
   retries automatically.

> This APK is signed with the debug key (`android/app/build.gradle.kts`). That is fine for
> installing it yourself and sharing it as a portfolio demo. Publishing to Google Play would need
> your own upload keystore. Never commit keystore files (`*.jks`, `*.keystore`).

---

## Updating

- **API:** push to GitHub; Render redeploys automatically (`autoDeploy: true`).
- **Website:** push to GitHub; Vercel redeploys automatically.
- **App:** rebuild the APK (Step 10) and reinstall it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/healthz` shows `db:false`, or the API crashes at start with a Mongo error | `MONGO_URL` wrong, password has unescaped special characters, or Atlas Network Access missing `0.0.0.0/0` |
| API crashes with "Variabel lingkungan wajib belum diisi" | A required variable is empty (`MONGO_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `APP_URL`) |
| Website loads but login doesn't stick | `VITE_API_URL` was set; remove it so requests go through the Vercel rewrite |
| CORS errors in the browser console | `CLIENT_ORIGIN` doesn't exactly match the Vercel URL |
| Website shows "Membangunkan server…" then an error | Render service failed to start; check Render **Logs** |
| Payments stay "menunggu" | Midtrans notification URL not set (Step 6), or not using **sandbox** keys |
| No reset email | `MAIL_PROVIDER` / API key / `MAIL_FROM` wrong, or sender not verified at Brevo |
| Profile photos uploaded before this version are missing | Old photos were on Render's temporary disk; upload them again (new uploads are kept in GridFS) |
