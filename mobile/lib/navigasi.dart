import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import 'i18n.dart';

// Helper Smart Navigation (T-107). Sama dengan web/src/lib/navigasi.js – ubah bersamaan.

/// Pilihan moda di UI (API_SPECS §2: driving | motorcycle | walking;
/// transit = GET /routes/transit).
enum Moda {
  driving(Icons.directions_car_rounded),
  motorcycle(Icons.two_wheeler_rounded),
  walking(Icons.directions_walk_rounded),
  transit(Icons.directions_bus_rounded);

  const Moda(this.icon);
  final IconData icon;

  String get label => switch (this) {
    Moda.driving => tr('Mobil'),
    Moda.motorcycle => tr('Motor'),
    Moda.walking => tr('Jalan kaki'),
    Moda.transit => tr('Umum'),
  };
}

/// Batas wilayah layanan (sama dengan api/src/lib/wilayah.js MEBIDANG).
bool dalamWilayah(LatLng p) =>
    p.latitude >= 3.25 &&
    p.latitude <= 3.9 &&
    p.longitude >= 98.35 &&
    p.longitude <= 99.0;

/// Durasi detik → "12 mnt", "1 j 5 mnt", "< 1 mnt".
String formatDurasi(num detik) {
  final menit = (detik / 60).round();
  if (menit < 1) return tr('< 1 mnt');
  if (menit < 60) return tr('{0} mnt', [menit]);
  final jam = menit ~/ 60;
  final sisa = menit % 60;
  return sisa == 0 ? tr('{0} j', [jam]) : tr('{0} j {1} mnt', [jam, sisa]);
}

/// Jarak meter → "350 m", "4,9 km", "12 km".
String formatJarak(num meter) {
  final m = meter.round().clamp(0, 1 << 31);
  if (m < 1000) return tr('{0} m', [m]);
  final km = m / 1000;
  return km < 10
      ? tr('{0} km', [angka(km, desimal: 1)])
      : tr('{0} km', [km.round()]);
}

/// "12 mnt · 4,9 km" (DESIGN §6).
String ringkasRute(Map rute) =>
    '${formatDurasi(rute['durasiS'] as num? ?? 0)} · ${formatJarak(rute['jarakM'] as num? ?? 0)}';

/// Tautan rute di openstreetmap.org (dibuka siapa saja tanpa akun/aplikasi).
String tautanOsm(LatLng dari, LatLng ke, Moda mode) {
  final engine = mode == Moda.walking
      ? 'fossgis_osrm_foot'
      : 'fossgis_osrm_car';
  String t(LatLng p) =>
      '${p.latitude.toStringAsFixed(5)},${p.longitude.toStringAsFixed(5)}';
  return 'https://www.openstreetmap.org/directions?engine=$engine&route=${t(dari)}%3B${t(ke)}';
}

/// Satu titik pilihan (asal / tujuan).
class Tempat {
  const Tempat({
    required this.nama,
    required this.lokasi,
    this.alamat = '',
    this.saya = false,
  });

  /// Dari respons `/places/search` atau `/places/reverse`.
  factory Tempat.fromJson(Map j) {
    final l = j['lokasi'] as Map? ?? const {};
    return Tempat(
      nama: (j['nama'] ?? tr('Titik di peta')).toString(),
      alamat: (j['alamat'] ?? '').toString(),
      lokasi: LatLng(
        (l['lat'] as num? ?? 0).toDouble(),
        (l['lng'] as num? ?? 0).toDouble(),
      ),
    );
  }

  final String nama;
  final String alamat;
  final LatLng lokasi;

  /// true = lokasi perangkat ("Lokasi kamu").
  final bool saya;
}

/// Teks yang disalin tombol Share.
String teksBagikan({
  required Tempat dari,
  required Tempat ke,
  required Moda mode,
  required Map rute,
}) => [
  tr('Rute {0} ke {1}: {2}', [
    mode.label.toLowerCase(),
    ke.nama,
    ringkasRute(rute),
  ]),
  tr('Dari {0}', [dari.nama]),
  tautanOsm(dari.lokasi, ke.lokasi, mode),
].join('\n');

/// Ikon langkah dari kalimat API (api/src/services/osrm.js), bahasa Indonesia atau Inggris.
IconData ikonLangkah(String teks) {
  final t = teks.toLowerCase();
  bool ada(String id, String en) => t.contains(id) || t.contains(en);
  if (t.startsWith('tiba') || t.startsWith('arrive')) {
    return Icons.flag_rounded;
  }
  if (t.startsWith('mulai') || t.startsWith('start')) {
    return Icons.navigation_rounded;
  }
  if (t.startsWith('putar balik') || t.contains('u-turn')) {
    return Icons.u_turn_left_rounded;
  }
  if (ada('bundaran', 'roundabout')) return Icons.roundabout_right_rounded;
  if (ada('kiri', 'left')) return Icons.turn_left_rounded;
  if (ada('kanan', 'right')) return Icons.turn_right_rounded;
  return Icons.straight_rounded;
}

/// `[lng, lat]` dari API → LatLng.
LatLng? keLatLng(Object? v) {
  if (v is! List || v.length < 2) return null;
  final lng = v[0], lat = v[1];
  if (lng is! num || lat is! num) return null;
  return LatLng(lat.toDouble(), lng.toDouble());
}

/// Tanggal foto "28 Okt 2024" (WIB).
String tanggalFoto(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  final w = d.toUtc().add(const Duration(hours: 7));
  return tanggalBulanTahun(w.day, w.month, w.year);
}
