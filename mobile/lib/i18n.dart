// Dua bahasa (T-111, TASK Keputusan #20): Indonesia (bawaan) + Inggris. Sama dengan
// web/src/lib/i18n.js: kunci terjemahan = teks Indonesia apa adanya, `{0}`, `{1}` = bagian
// yang berubah; teks yang belum diterjemahkan tampil dalam bahasa Indonesia.
// Terjemahan Inggris di assets/i18n/en.json. Kode galat API tidak pernah diterjemahkan.
import 'dart:convert';
import 'dart:ui' show Locale, PlatformDispatcher;

import 'package:flutter/services.dart' show rootBundle;

const asetKamusEn = 'assets/i18n/en.json';

Map<String, String> _en = const {};
String _bahasa = 'id';

/// Bahasa aktif: 'id' | 'en'.
String get bahasa => _bahasa;

/// Locale untuk widget Material (pemilih tanggal/jam, dsb.).
Locale get localeAktif => Locale(_bahasa, _bahasa == 'en' ? 'US' : 'ID');

/// Muat kamus Inggris dari aset (sekali, sebelum runApp). Gagal → tetap Indonesia.
Future<void> muatKamus() async {
  if (_en.isNotEmpty) return;
  try {
    final data = jsonDecode(await rootBundle.loadString(asetKamusEn));
    _en = {for (final e in (data as Map).entries) '${e.key}': '${e.value}'};
  } catch (_) {}
}

/// Untuk tes: isi kamus langsung.
void aturKamus(Map<String, String> en) => _en = en;

/// Pilihan pengguna: 'sistem' | 'id' | 'en'.
String bahasaDari(String pilihan, [List<Locale>? perangkat]) =>
    pilihan == 'id' || pilihan == 'en' ? pilihan : bahasaPerangkat(perangkat);

/// Bahasa perangkat: Indonesia bila bahasa pertama (dari id/en) `id`/`in`, selain itu Inggris.
String bahasaPerangkat([List<Locale>? daftar]) {
  daftar ??= PlatformDispatcher.instance.locales;
  if (daftar.isEmpty) return 'id';
  final kode = daftar
      .map((l) => l.languageCode.toLowerCase())
      .firstWhere(
        (k) => k == 'id' || k == 'in' || k == 'en',
        orElse: () => daftar!.first.languageCode.toLowerCase(),
      );
  return kode == 'id' || kode == 'in' ? 'id' : 'en';
}

/// Ganti bahasa aktif (dipanggil AppState).
void aturBahasa(String b) => _bahasa = b == 'en' ? 'en' : 'id';

/// Terjemahkan teks UI: tr('Sisa {0} kursi', [3]).
String tr(String teks, [List<Object?> vars = const []]) {
  var s = _bahasa == 'en' ? (_en[teks] ?? teks) : teks;
  if (vars.isNotEmpty) {
    s = s.replaceAllMapped(RegExp(r'\{(\d+)\}'), (m) {
      final i = int.parse(m.group(1)!);
      return i < vars.length ? '${vars[i] ?? ''}' : m.group(0)!;
    });
  }
  return s;
}

/// Angka sesuai bahasa: 1.234,5 (id) / 1,234.5 (en).
String angka(num n, {int desimal = 0}) {
  final en = _bahasa == 'en';
  final neg = n < 0;
  final teks = n.abs().toStringAsFixed(desimal);
  final titik = teks.indexOf('.');
  final bulat = titik < 0 ? teks : teks.substring(0, titik);
  final b = StringBuffer();
  for (var i = 0; i < bulat.length; i++) {
    if (i > 0 && (bulat.length - i) % 3 == 0) b.write(en ? ',' : '.');
    b.write(bulat[i]);
  }
  if (titik >= 0) b.write('${en ? '.' : ','}${teks.substring(titik + 1)}');
  return '${neg ? '-' : ''}$b';
}

/// "Rp35.000" (id) / "Rp35,000" (en).
String rupiah(num n) => 'Rp${angka(n.round())}';

const _bulanId = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const _bulanEn = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const _bulanPanjangId = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', //
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const _bulanPanjangEn = [
  'January', 'February', 'March', 'April', 'May', 'June', //
  'July', 'August', 'September', 'October', 'November', 'December',
];
const _hariId = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const _hariEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Nama bulan singkat, [bulan] 1–12.
String bulanPendek(int bulan) =>
    (_bahasa == 'en' ? _bulanEn : _bulanId)[bulan - 1];

/// Nama bulan lengkap, [bulan] 1–12.
String bulanPanjang(int bulan) =>
    (_bahasa == 'en' ? _bulanPanjangEn : _bulanPanjangId)[bulan - 1];

/// Nama hari singkat, [weekday] 1 (Senin) – 7 (Minggu).
String hariPendek(int weekday) =>
    (_bahasa == 'en' ? _hariEn : _hariId)[weekday - 1];

/// "20 Nov" (id) / "Nov 20" (en).
String tanggalBulan(int hari, int bulan) => _bahasa == 'en'
    ? '${bulanPendek(bulan)} $hari'
    : '$hari ${bulanPendek(bulan)}';

/// "20 Nov 2026" (id) / "Nov 20, 2026" (en).
String tanggalBulanTahun(int hari, int bulan, int tahun) => _bahasa == 'en'
    ? '${tanggalBulan(hari, bulan)}, $tahun'
    : '${tanggalBulan(hari, bulan)} $tahun';

/// "07.30" (id) / "07:30" (en).
String jamMenit(int jam, int menit) =>
    '${jam.toString().padLeft(2, '0')}${_bahasa == 'en' ? ':' : '.'}${menit.toString().padLeft(2, '0')}';
