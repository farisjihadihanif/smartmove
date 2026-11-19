import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

// Helper Smart Navigation (T-107). Sama dengan web/src/lib/navigasi.js – ubah bersamaan.

/// Pilihan moda di UI (API_SPECS §2: driving | motorcycle | walking;
/// transit = GET /routes/transit).
enum Moda {
  driving('Mobil', Icons.directions_car_rounded),
  motorcycle('Motor', Icons.two_wheeler_rounded),
  walking('Jalan kaki', Icons.directions_walk_rounded),
  transit('Umum', Icons.directions_bus_rounded);

  const Moda(this.label, this.icon);
  final String label;
  final IconData icon;
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
  if (menit < 1) return '< 1 mnt';
  if (menit < 60) return '$menit mnt';
  final jam = menit ~/ 60;
  final sisa = menit % 60;
  return sisa == 0 ? '$jam j' : '$jam j $sisa mnt';
}

/// Jarak meter → "350 m", "4,9 km", "12 km".
String formatJarak(num meter) {
  final m = meter.round().clamp(0, 1 << 31);
  if (m < 1000) return '$m m';
  final km = m / 1000;
  return km < 10
      ? '${km.toStringAsFixed(1).replaceAll('.', ',')} km'
      : '${km.round()} km';
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
      nama: (j['nama'] ?? 'Titik di peta').toString(),
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
  'Rute ${mode.label.toLowerCase()} ke ${ke.nama}: ${ringkasRute(rute)}',
  'Dari ${dari.nama}',
  tautanOsm(dari.lokasi, ke.lokasi, mode),
].join('\n');

/// Ikon langkah dari kalimat bahasa Indonesia API (api/src/services/osrm.js).
IconData ikonLangkah(String teks) {
  final t = teks.toLowerCase();
  if (t.startsWith('tiba')) return Icons.flag_rounded;
  if (t.startsWith('mulai')) return Icons.navigation_rounded;
  if (t.startsWith('putar balik')) return Icons.u_turn_left_rounded;
  if (t.contains('bundaran')) return Icons.roundabout_right_rounded;
  if (t.contains('kiri')) return Icons.turn_left_rounded;
  if (t.contains('kanan')) return Icons.turn_right_rounded;
  return Icons.straight_rounded;
}

/// `[lng, lat]` dari API → LatLng.
LatLng? keLatLng(Object? v) {
  if (v is! List || v.length < 2) return null;
  final lng = v[0], lat = v[1];
  if (lng is! num || lat is! num) return null;
  return LatLng(lat.toDouble(), lng.toDouble());
}

const _bulan = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', //
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/// Tanggal foto "28 Okt 2024" (WIB).
String tanggalFoto(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  final w = d.toUtc().add(const Duration(hours: 7));
  return '${w.day} ${_bulan[w.month - 1]} ${w.year}';
}
