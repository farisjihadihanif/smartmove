import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import 'navigasi.dart';

// Helper rute transportasi umum (T-203, API_SPECS §6.2). Sama dengan web/src/lib/transit.js – ubah bersamaan.

/// Warna garis per kendaraan yang dinaiki (urutan naik), sama di peta & lembar rute.
const warnaNaikList = [Color(0xFFA2028A), Color(0xFF1E63C3)];
const warnaJalan = Color(0xFF41396F);
Color warnaNaik(int i) => warnaNaikList[i % warnaNaikList.length];

const labelJenis = {'angkot': 'Angkot', 'bus': 'Bus', 'kereta': 'Kereta'};

IconData ikonJenis(Object? jenis) =>
    jenis == 'kereta' ? Icons.train_rounded : Icons.directions_bus_rounded;

/// "KPUM 69 : Gabion → Term. P. Induk" → (nama: "KPUM 69", trayek: "Gabion → Term. P. Induk").
({String nama, String trayek}) namaKoridor(Map? k) {
  final s = '${k?['nama'] ?? k?['kode'] ?? ''}'.split(' : ');
  final nama = s.first.trim();
  return (
    nama: nama.isEmpty ? '${k?['kode'] ?? ''}' : nama,
    trayek: s.skip(1).join(' : ').trim(),
  );
}

/// "Jalan Almamater" → "Jl. Almamater".
String singkatJalan(Object? nama) => '${nama ?? ''}'.replaceFirst(
  RegExp(r'^Jalan\s+', caseSensitive: false),
  'Jl. ',
);

bool _adaNamaJalan(Object? nama) =>
    nama != null &&
    '$nama'.isNotEmpty &&
    !RegExp(
      r'^Titik (naik|turun|pindah)',
      caseSensitive: false,
    ).hasMatch('$nama');

String _nama(Map b, String k) => '${(b[k] as Map?)?['nama'] ?? ''}';

/// Rupiah atau "tarif belum tersedia" (null = belum diisi admin, jangan dianggap 0).
String teksTarif(Object? n) {
  if (n is! num) return 'tarif belum tersedia';
  final s = n.round().toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return 'Rp$s';
}

/// true bila tarif ada tapi bukan isian admin (tarif bawaan/OSM) → tampilkan "Tarif perkiraan".
bool tarifPerkiraan(Map? x) =>
    x?['tarif'] is num && x?['tarifPerkiraan'] == true;

/// Tarif satu baris teks: "Rp5.000 (perkiraan)" / "Rp5.000" / "tarif belum tersedia".
String teksTarifRingkas(Map? x) =>
    '${teksTarif(x?['tarif'])}${tarifPerkiraan(x) ? ' (perkiraan)' : ''}';

/// Kalimat naik. Angkot tidak punya halte: naik di sepanjang jalan.
String teksNaik(Map b) {
  final dari = _nama(b, 'dari');
  if (dari == 'Lokasi asal') return 'Naik di titik asalmu';
  if (dari == 'Titik pindah') {
    return 'Naik di titik pindah, tempat kamu turun tadi';
  }
  if (b['naikDiMana'] == true) {
    return _adaNamaJalan(dari)
        ? 'Naik di sepanjang ${singkatJalan(dari)}'
        : 'Naik di titik terdekat di jalur trayek';
  }
  return 'Naik di $dari';
}

String teksTurun(Map b) {
  final ke = _nama(b, 'ke');
  if (ke == 'Tujuan') return 'Turun di tujuan';
  if (ke == 'Titik pindah') return 'Turun di titik pindah';
  if (b['naikDiMana'] == true) {
    return _adaNamaJalan(ke)
        ? 'Turun di sekitar ${singkatJalan(ke)}'
        : 'Turun di titik terdekat tujuan';
  }
  return 'Turun di $ke';
}

/// "Jalan kaki 105 m ke Jl. Almamater". [terakhir] = menuju tujuan.
String teksJalan(Map b, bool terakhir) {
  final ke = _nama(b, 'ke');
  final tujuan = terakhir
      ? 'tujuan'
      : _adaNamaJalan(ke)
      ? singkatJalan(ke)
      : 'titik naik';
  return 'Jalan kaki ${formatJarak(b['jarakM'] as num? ?? 0)} ke $tujuan';
}

/// "Naik angkot KPUM 69".
String judulNaik(Map b) {
  final k = b['koridor'] as Map?;
  final jenis = (labelJenis[k?['jenis']] ?? '').toLowerCase();
  return 'Naik $jenis ${namaKoridor(k).nama}'.replaceAll(RegExp(r'\s+'), ' ');
}

/// Kalimat utama satu bagian (teks Share).
String teksBagian(Map b, int i, List<Map> bagian) {
  if (b['jenis'] == 'jalan') return teksJalan(b, i == bagian.length - 1);
  return '${judulNaik(b)} ${teksNaik(b).replaceFirst('Naik ', '')}, '
      '${teksTurun(b).replaceFirst('Turun', 'turun')}';
}

List<Map> bagianOpsi(Map? opsi) =>
    (opsi?['bagian'] as List? ?? const []).whereType<Map>().toList();

/// Urutan naik per bagian (null untuk jalan kaki) → indeks warna.
List<int?> indeksNaik(List<Map> bagian) {
  var n = -1;
  return [for (final b in bagian) b['jenis'] == 'naik' ? ++n : null];
}

LatLng? titikBagian(Map b, String k) {
  final l = (b[k] as Map?)?['lokasi'] as Map?;
  final lat = l?['lat'], lng = l?['lng'];
  if (lat is! num || lng is! num) return null;
  return LatLng(lat.toDouble(), lng.toDouble());
}

/// Garis satu bagian; tanpa garis = garis lurus dari → ke.
List<LatLng> garisBagian(Map b) {
  final g = (b['garis'] as List? ?? const [])
      .map(keLatLng)
      .whereType<LatLng>()
      .toList();
  if (g.length > 1) return g;
  return [?titikBagian(b, 'dari'), ?titikBagian(b, 'ke')];
}

num jarakOpsi(Map o) =>
    bagianOpsi(o).fold<num>(0, (s, b) => s + (b['jarakM'] as num? ?? 0));

/// "1× pindah · jalan 271 m · tarif belum tersedia".
String ringkasOpsi(Map o) {
  final t = o['transfer'] as num? ?? 0;
  return [
    t > 0 ? '$t× pindah' : 'Tanpa pindah',
    'jalan ${formatJarak(o['jalanM'] as num? ?? 0)}',
    teksTarifRingkas(o),
  ].join(' · ');
}

/// Ringkasan untuk Trip Planner (`ringkasan` rencana).
Map<String, Object> ringkasanTrip(Map o) => {
  'durasiS': o['totalS'] as num? ?? 0,
  'jarakM': jarakOpsi(o),
  if (o['tarif'] is num) 'tarif': o['tarif'] as num,
  if (tarifPerkiraan(o)) 'tarifPerkiraan': true,
};

/// Teks tombol Share untuk rute transportasi umum.
String teksBagikanTransit({
  required Tempat dari,
  required Tempat ke,
  required Map opsi,
}) {
  final bagian = bagianOpsi(opsi);
  return [
    'Rute transportasi umum ke ${ke.nama}: ${formatDurasi(opsi['totalS'] as num? ?? 0)}, ${teksTarifRingkas(opsi)}',
    'Dari ${dari.nama}',
    for (final (i, b) in bagian.indexed)
      '${i + 1}. ${teksBagian(b, i, bagian)}',
  ].join('\n');
}
