import 'package:latlong2/latlong.dart';

/// Config kota aktif di aplikasi (T-112). Cerminan `api/src/cities/<kota>.js` untuk
/// bagian yang dipakai peta & waktu. Rencana multi-kota: docs/ARCHITECTURE.md §11.
class Kota {
  const Kota({
    required this.id,
    required this.nama,
    required this.minLat,
    required this.maxLat,
    required this.minLng,
    required this.maxLng,
    required this.pusat,
    required this.zonaWaktu,
    required this.offsetZona,
    required this.offset,
  });

  final String id;
  final String nama;
  final double minLat, maxLat, minLng, maxLng;
  final LatLng pusat;

  /// Nama zona (mis. "WIB"), selisih dari UTC, dan bentuk ISO-nya ("+07:00").
  final String zonaWaktu;
  final Duration offsetZona;
  final String offset;

  bool dalamBatas(LatLng p) =>
      p.latitude >= minLat &&
      p.latitude <= maxLat &&
      p.longitude >= minLng &&
      p.longitude <= maxLng;
}

/// Medan: kotak Mebidang (sama dengan API), pusat Lapangan Merdeka, WIB (UTC+7).
const kotaMedan = Kota(
  id: 'medan',
  nama: 'Medan',
  minLat: 3.25,
  maxLat: 3.9,
  minLng: 98.35,
  maxLng: 99.0,
  pusat: LatLng(3.5913, 98.6776),
  zonaWaktu: 'WIB',
  offsetZona: Duration(hours: 7),
  offset: '+07:00',
);

/// Kota aktif. Kota berikutnya: tambah konstanta di atas lalu pilih lewat
/// `--dart-define=CITY=…`, mis. `String.fromEnvironment('CITY') == 'x' ? kotaX : kotaMedan`.
const kota = kotaMedan;
