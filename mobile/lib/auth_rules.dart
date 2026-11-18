// Cek ringan di klien, aturan sama dengan api/src/lib/validate.js
// dan web/src/lib/authRules.js (server tetap penentu).

final usernameRe = RegExp(r'^[a-z0-9_.]{3,30}$');
final emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

String? checkPassword(String pw, [String label = 'Password']) {
  if (pw.length < 8) return '$label minimal 8 karakter.';
  if (pw.length > 72) return '$label maksimal 72 karakter.';
  return null;
}

/// Pesan galat pertama, atau null bila data daftar sudah benar.
String? checkRegister({
  required String username,
  required String email,
  required String password,
}) {
  if (!usernameRe.hasMatch(username)) {
    return 'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.';
  }
  if (!emailRe.hasMatch(email)) return 'Format email belum benar.';
  return checkPassword(password);
}
