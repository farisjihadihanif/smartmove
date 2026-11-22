import 'i18n.dart';

// Cek ringan di klien, aturan sama dengan api/src/lib/validate.js
// dan web/src/lib/authRules.js (server tetap penentu).

final usernameRe = RegExp(r'^[a-z0-9_.]{3,30}$');
final emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

String? checkPassword(String pw, [String? label]) {
  label ??= tr('Password');
  if (pw.length < 8) return tr('{0} minimal 8 karakter.', [label]);
  if (pw.length > 72) return tr('{0} maksimal 72 karakter.', [label]);
  return null;
}

/// Pesan galat pertama, atau null bila data daftar sudah benar.
String? checkRegister({
  required String username,
  required String email,
  required String password,
}) {
  if (!usernameRe.hasMatch(username)) {
    return tr(
      'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.',
    );
  }
  if (!emailRe.hasMatch(email)) return tr('Format email belum benar.');
  return checkPassword(password);
}
