import 'i18n.dart';
import 'kota.dart';

// Waktu kota aktif (kota.dart; Medan: WIB, UTC+7, tanpa musim panas). Samakan dengan web/src/lib/wib.js.

final _wib = kota.offsetZona;
DateTime _shift(DateTime t) => t.toUtc().add(_wib);
int _hari(DateTime t) {
  final w = _shift(t);
  return DateTime.utc(w.year, w.month, w.day).millisecondsSinceEpoch ~/
      Duration.millisecondsPerDay;
}

/// "07.30"
String jamWib(DateTime t) {
  final w = _shift(t);
  return jamMenit(w.hour, w.minute);
}

/// Sama dengan API: pagi 04–10, siang 11–14, sore 15–17, malam 18–03.
String salamWib(DateTime t) {
  final h = _shift(t).hour;
  if (h >= 4 && h < 11) return tr('Selamat pagi');
  if (h >= 11 && h < 15) return tr('Selamat siang');
  if (h >= 15 && h < 18) return tr('Selamat sore');
  return tr('Selamat malam');
}

/// "Hari ini" / "Besok" / "Kemarin" / "21 Nov".
String hariWib(DateTime t, DateTime now) {
  final d = _hari(t) - _hari(now);
  if (d == 0) return tr('Hari ini');
  if (d == 1) return tr('Besok');
  if (d == -1) return tr('Kemarin');
  final w = _shift(t);
  return tanggalBulan(w.day, w.month);
}

/// "11.00" bila hari yang sama, selain itu "21 Nov, 11.00".
String jamAtauTanggal(DateTime t, DateTime now) =>
    _hari(t) == _hari(now) ? jamWib(t) : '${hariWib(t, now)}, ${jamWib(t)}';

/// Kejadian lampau: "Baru saja", "15 menit lalu", "3 jam lalu", lalu tanggal.
String sejak(DateTime t, DateTime now) {
  final m = now.difference(t).inMinutes;
  if (m < 1) return tr('Baru saja');
  if (m < 60) return tr('{0} menit lalu', [m]);
  if (m < 24 * 60) return tr('{0} jam lalu', [m ~/ 60]);
  return hariWib(t, now);
}
