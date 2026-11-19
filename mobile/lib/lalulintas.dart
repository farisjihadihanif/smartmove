import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'api.dart';
import 'navigasi.dart';

// Live Traffic Information (T-205): label, warna, teks, dan pemuat data.
// Samakan dengan web/src/lib/lalulintas.js + useLaluLintas.js.

class InfoTingkat {
  const InfoTingkat(this.label, this.warna);
  final String label;
  final Color warna;
}

const tingkatLaluLintas = {
  'lancar': InfoTingkat('Lancar', Color(0xFF2E9E5B)),
  'padat': InfoTingkat('Padat', Color(0xFFFFA000)),
  'macet': InfoTingkat('Macet', Color(0xFFF44336)),
};

/// Koridor tanpa laporan: warna garis rute mockup, waktu = waktu tempuh normal.
const tanpaLaporan = InfoTingkat('Belum ada laporan', Color(0xFF0F53FF));

/// Teks "Padat" di atas putih memakai oranye gelap agar kontras cukup.
const warnaTeksPadat = Color(0xFFB26A00);

const kejadianLaluLintas = {
  'none': 'Tidak ada',
  'kecelakaan': 'Kecelakaan',
  'banjir': 'Banjir',
  'penutupan': 'Penutupan jalan',
  'perbaikan_jalan': 'Perbaikan jalan',
};

InfoTingkat infoTingkat(String? t) => tingkatLaluLintas[t] ?? tanpaLaporan;

Color warnaTeksTingkat(String? t) => t == 'padat'
    ? warnaTeksPadat
    : t == null
    ? const Color(0xA6000000)
    : infoTingkat(t).warna;

/// Detik → "12 mnt"; null → "–".
String formatMenit(num? detik) => detik == null ? '–' : formatDurasi(detik);

/// Meter → "4,9 km"; null → "".
String formatKm(num? m) => m == null ? '' : formatJarak(m);

/// Tambahan waktu dibanding normal, mis. "+4 mnt"; kosong bila < 1 menit.
String teksTunda(Map k) {
  final d = k['durasiS'], n = k['durasiNormalS'];
  if (d is! num || n is! num) return '';
  final m = ((d - n) / 60).round();
  return m >= 1 ? '+$m mnt' : '';
}

LatLng _keLatLng(Object? c) {
  final l = c as List;
  return LatLng((l[1] as num).toDouble(), (l[0] as num).toDouble());
}

List<LatLng> garisKoridor(Map k) => [
  for (final c in (k['garis'] as List? ?? const [])) _keLatLng(c),
];

List<({String tingkat, List<LatLng> garis})> segmenKoridor(Map k) => [
  for (final s in (k['segmen'] as List? ?? const []).whereType<Map>())
    (
      tingkat: s['tingkat'] as String,
      garis: [for (final c in (s['garis'] as List)) _keLatLng(c)],
    ),
];

/// Titik tengah garis (menurut jumlah titik; cukup untuk label).
LatLng? titikTengah(List<LatLng> garis) =>
    garis.isEmpty ? null : garis[garis.length ~/ 2];

LatLng lokasiLaporan(Map r) {
  final l = r['lokasi'] as Map;
  return LatLng((l['lat'] as num).toDouble(), (l['lng'] as num).toDouble());
}

/// bbox "minLng,minLat,maxLng,maxLat" dipotong ke maks. 1° (API_SPECS §6.3).
String bboxDari(LatLngBounds b) {
  // Titik tengah aritmetika (bukan geodesik) agar sama dengan web.
  final c = LatLng((b.north + b.south) / 2, (b.east + b.west) / 2);
  final setLng = ((b.east - b.west) / 2).clamp(0, 0.5);
  final setLat = ((b.north - b.south) / 2).clamp(0, 0.5);
  String f(double n) => n.toStringAsFixed(4);
  return [
    f(c.longitude - setLng),
    f(c.latitude - setLat),
    f(c.longitude + setLng),
    f(c.latitude + setLat),
  ].join(',');
}

/// Ringkasan untuk Share.
String teksBagikanLaluLintas(List<Map> koridor) {
  final baris = [
    for (final k in koridor)
      if (k['tersedia'] == true)
        '• ${k['nama']}: ${formatMenit(k['durasiS'] as num?)}'
            '${teksTunda(k).isNotEmpty ? ' (${teksTunda(k)})' : ''}, '
            '${k['tingkat'] == null ? 'belum ada laporan' : infoTingkat(k['tingkat'] as String).label.toLowerCase()}'
            '${k['ditutup'] == true ? ', ada penutupan' : ''}',
  ];
  return ['Lalu lintas Medan sekarang (SmartMove Medan):', ...baris].join('\n');
}

const pesanLaporanTerkirim =
    'Laporan terkirim. Terima kasih sudah membantu warga Medan!';
const pesanLaporanDigabung =
    'Laporanmu menguatkan laporan warga lain di dekat situ. Terima kasih!';

/// Data lalu lintas untuk peta: koridor jalan utama (GET /traffic/corridors)
/// dan laporan warga di area peta (GET /traffic?bbox), disegarkan tiap 2 menit.
class LaluLintasData extends ChangeNotifier {
  LaluLintasData(this.api, {this.segarkan = const Duration(minutes: 2)});

  final ApiClient api;
  final Duration segarkan;

  String status = 'memuat'; // memuat | ok | galat
  List<Map> koridor = const [];
  Object? galat;
  DateTime? diperbaruiPada;
  List<Map> laporan = const [];

  String? _area;
  int _reqLaporan = 0;
  Timer? _timer;
  bool _mati = false;

  void mulai() {
    muatKoridor();
    _timer?.cancel();
    _timer = Timer.periodic(segarkan, (_) {
      muatKoridor();
      muatLaporan();
    });
  }

  void berhenti() {
    _timer?.cancel();
    _timer = null;
  }

  void _kabari() {
    if (!_mati) notifyListeners();
  }

  Future<void> muatKoridor() async {
    try {
      final r = await api.get('/traffic/corridors') as Map;
      koridor = (r['items'] as List? ?? const []).whereType<Map>().toList();
      diperbaruiPada = DateTime.tryParse('${r['diperbaruiPada']}');
      status = 'ok';
      galat = null;
    } catch (e) {
      status = 'galat';
      galat = e;
    }
    _kabari();
  }

  void aturArea(LatLngBounds b) {
    _area = bboxDari(b);
    muatLaporan();
  }

  Future<void> muatLaporan() async {
    final area = _area;
    if (area == null) return;
    final req = ++_reqLaporan;
    try {
      final r = await api.get('/traffic', query: {'bbox': area});
      if (req != _reqLaporan) return;
      laporan = ((r as Map)['items'] as List? ?? const [])
          .whereType<Map>()
          .toList();
      _kabari();
    } catch (_) {
      // Laporan bersifat tambahan; galat koridor sudah ditampilkan.
    }
  }

  void muatUlang() {
    status = 'memuat';
    _kabari();
    muatKoridor();
    muatLaporan();
  }

  /// Kirim laporan (wajib masuk). Mengembalikan `(laporan, digabung)`.
  Future<({Map laporan, bool digabung})> kirim({
    required LatLng lokasi,
    required String tingkat,
    String kejadian = 'none',
    String catatan = '',
  }) async {
    final r = await api.post('/traffic/reports', {
      'lokasi': {'lat': lokasi.latitude, 'lng': lokasi.longitude},
      'tingkat': tingkat,
      'kejadian': kejadian,
      if (catatan.trim().isNotEmpty) 'catatan': catatan.trim(),
    }) as Map;
    final l = r['laporan'] as Map;
    laporan = [l, ...laporan.where((x) => x['id'] != l['id'])];
    _kabari();
    unawaited(muatKoridor());
    return (laporan: l, digabung: r['digabung'] == true);
  }

  @override
  void dispose() {
    _mati = true;
    berhenti();
    super.dispose();
  }
}
