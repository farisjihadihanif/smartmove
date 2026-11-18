/// Alamat API dari `--dart-define=API_URL=...` (tanpa `/api`).
/// Contoh dev emulator: `http://10.0.2.2:4200`.
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:4200',
);

/// Base URL lengkap: `{API_URL}/api` (API_SPECS §1).
String get apiBase => '${apiUrl.replaceAll(RegExp(r'/+$'), '')}/api';
