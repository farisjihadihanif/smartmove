# SmartMove Medan – Mobile (Flutter, Android)

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4200   # emulator → API lokal
flutter test
flutter analyze
flutter build apk --release --dart-define=API_URL=https://<domain>
```

- `lib/theme.dart` – token warna mockup (DESIGN §2), font Open Sans/Bree Serif, tema Material.
- `lib/fonts.dart` + `assets/google_fonts/` – font dibundel (Open Sans 400/500/600/700, Bree Serif 400) + lisensi OFL; unduhan font runtime dimatikan. Butuh ketebalan lain? Tambahkan file `OpenSans-<Varian>.ttf` dengan nama asli Google Fonts.
- `lib/config.dart` – `API_URL` dari `--dart-define` (tanpa `/api`).
- `lib/api.dart` – klien API (Bearer token di `flutter_secure_storage`, galat `ApiException`).
- `lib/state.dart` – `AppState` (sesi) + `AppScope`.
- Cleartext HTTP hanya diizinkan di build debug (`android/app/src/debug/AndroidManifest.xml`).
