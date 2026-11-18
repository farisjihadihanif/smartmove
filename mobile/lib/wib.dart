// Waktu Medan (WIB, UTC+7, tanpa musim panas). Samakan dengan web/src/lib/wib.js.

const _wib = Duration(hours: 7);
const _bulan = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', //
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

DateTime _shift(DateTime t) => t.toUtc().add(_wib);
String _dua(int n) => n.toString().padLeft(2, '0');
int _hari(DateTime t) {
  final w = _shift(t);
  return DateTime.utc(w.year, w.month, w.day).millisecondsSinceEpoch ~/
      Duration.millisecondsPerDay;
}

/// "07.30"
String jamWib(DateTime t) {
  final w = _shift(t);
  return '${_dua(w.hour)}.${_dua(w.minute)}';
}

/// Sama dengan API: pagi 04–10, siang 11–14, sore 15–17, malam 18–03.
String salamWib(DateTime t) {
  final h = _shift(t).hour;
  if (h >= 4 && h < 11) return 'Selamat pagi';
  if (h >= 11 && h < 15) return 'Selamat siang';
  if (h >= 15 && h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/// "Hari ini" / "Besok" / "Kemarin" / "21 Nov".
String hariWib(DateTime t, DateTime now) {
  final d = _hari(t) - _hari(now);
  if (d == 0) return 'Hari ini';
  if (d == 1) return 'Besok';
  if (d == -1) return 'Kemarin';
  final w = _shift(t);
  return '${w.day} ${_bulan[w.month - 1]}';
}

/// "11.00" bila hari yang sama, selain itu "21 Nov, 11.00".
String jamAtauTanggal(DateTime t, DateTime now) =>
    _hari(t) == _hari(now) ? jamWib(t) : '${hariWib(t, now)}, ${jamWib(t)}';

/// Kejadian lampau: "Baru saja", "15 menit lalu", "3 jam lalu", lalu tanggal.
String sejak(DateTime t, DateTime now) {
  final m = now.difference(t).inMinutes;
  if (m < 1) return 'Baru saja';
  if (m < 60) return '$m menit lalu';
  if (m < 24 * 60) return '${m ~/ 60} jam lalu';
  return hariWib(t, now);
}
