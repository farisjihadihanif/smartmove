import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:material_ui/material_ui.dart';

import '../../lalulintas.dart';
import '../../theme.dart';

// Lapisan lalu lintas (T-205): koridor jalan utama (biru = belum ada laporan,
// ruas padat/macet berwarna), kotak waktu "12 mnt / 4,9 km" seperti mockup
// hal. 6, dan penanda laporan warga. Dipakai di Live Traffic Information dan
// mode Traffic Smart Navigation. Sama dengan web components/traffic/TrafficLayers.jsx.

/// - [kotak]: tampilkan kotak waktu tiap koridor (tab Estimasi Waktu, zoom ≥ 12).
/// - [onPilihKoridor] / [onPilihLaporan]: ketukan kotak / penanda.
/// - [titikLapor]: pin titik laporan yang sedang dibuat.
List<Widget> lapisanLaluLintas({
  required List<Map> koridor,
  List<Map> laporan = const [],
  bool kotak = false,
  double zoom = 14,
  String? pilihKoridor,
  ValueChanged<String>? onPilihKoridor,
  Map? laporanAktif,
  ValueChanged<Map>? onPilihLaporan,
  LatLng? titikLapor,
  bool redup = false,
}) {
  final garis = [
    for (final k in koridor)
      (k: k, garis: garisKoridor(k), segmen: segmenKoridor(k)),
  ];
  return [
    PolylineLayer(
      polylines: [
        for (final g in garis)
          if (g.garis.length > 1) ...[
            Polyline(
              points: g.garis,
              strokeWidth: pilihKoridor == g.k['kode'] ? 8 : 6,
              color:
                  (g.k['tingkat'] == 'lancar'
                          ? tingkatLaluLintas['lancar']!.warna
                          : tanpaLaporan.warna)
                      .withValues(
                        alpha: redup
                            ? 0.45
                            : pilihKoridor == null ||
                                  pilihKoridor == g.k['kode']
                            ? 0.95
                            : 0.55,
                      ),
              borderStrokeWidth: 2,
              borderColor: AppColors.white.withValues(alpha: 0.85),
              strokeCap: StrokeCap.round,
              strokeJoin: StrokeJoin.round,
            ),
            for (final s in g.segmen)
              Polyline(
                points: s.garis,
                strokeWidth: pilihKoridor == g.k['kode'] ? 8 : 6,
                color: infoTingkat(s.tingkat).warna
                    .withValues(alpha: redup ? 0.6 : 1),
                strokeCap: StrokeCap.butt,
                strokeJoin: StrokeJoin.round,
              ),
          ],
      ],
    ),
    MarkerLayer(
      markers: [
        if (kotak)
          for (final g in garis)
            if (g.k['tersedia'] == true &&
                (zoom >= 12 || pilihKoridor == g.k['kode']) &&
                titikTengah(g.garis) != null)
              Marker(
                point: titikTengah(g.garis)!,
                width: 96,
                height: 62,
                alignment: Alignment.topCenter,
                child: KotakWaktu(
                  koridor: g.k,
                  aktif: pilihKoridor == g.k['kode'],
                  onTap: onPilihKoridor == null
                      ? null
                      : () => onPilihKoridor(g.k['kode'] as String),
                ),
              ),
        for (final r in laporan)
          Marker(
            point: lokasiLaporan(r),
            width: 48,
            height: 48,
            child: PenandaLaporan(
              laporan: r,
              aktif: laporanAktif?['id'] == r['id'],
              onTap: onPilihLaporan == null ? null : () => onPilihLaporan(r),
            ),
          ),
        if (titikLapor != null)
          Marker(
            point: titikLapor,
            width: 40,
            height: 44,
            alignment: Alignment.topCenter,
            child: const Icon(
              Icons.location_on,
              size: 44,
              color: AppColors.pillVia,
              shadows: [Shadow(color: Color(0x6641396F), blurRadius: 4)],
            ),
          ),
      ],
    ),
  ];
}

/// Kotak waktu koridor: menit (warna tingkat) di atas jarak, ekor menunjuk ke jalan.
class KotakWaktu extends StatelessWidget {
  const KotakWaktu({
    super.key,
    required this.koridor,
    this.aktif = false,
    this.onTap,
  });

  final Map koridor;
  final bool aktif;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = koridor['tingkat'] as String?;
    final warna = t == null ? AppColors.teksMerah : warnaTeksTingkat(t);
    final garis = aktif
        ? AppColors.pillVia
        : AppColors.inkViolet.withValues(alpha: 0.35);
    return Semantics(
      button: onTap != null,
      label:
          '${koridor['nama']}: ${formatMenit(koridor['durasiS'] as num?)}, ${formatKm(koridor['jarakM'] as num?)}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(9, 4, 9, 5),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: garis, width: aktif ? 2 : 1),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.inkViolet.withValues(alpha: 0.4),
                    blurRadius: 12,
                    spreadRadius: -4,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    formatMenit(koridor['durasiS'] as num?),
                    style: sans(
                      size: 15,
                      weight: FontWeight.w700,
                      color: warna,
                      height: 1.15,
                    ),
                  ),
                  Text(
                    formatKm(koridor['jarakM'] as num?),
                    style: sans(
                      size: 12,
                      color: AppColors.ink.withValues(alpha: 0.62),
                      height: 1.15,
                    ),
                  ),
                ],
              ),
            ),
            CustomPaint(
              size: const Size(14, 8),
              painter: _Ekor(garis, aktif ? 2 : 1),
            ),
          ],
        ),
      ),
    );
  }
}

class _Ekor extends CustomPainter {
  _Ekor(this.garis, this.tebal);
  final Color garis;
  final double tebal;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Path()
      ..moveTo(0, -1)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, -1);
    canvas.drawPath(p, Paint()..color = AppColors.white);
    canvas.drawPath(
      p,
      Paint()
        ..color = garis
        ..style = PaintingStyle.stroke
        ..strokeWidth = tebal,
    );
  }

  @override
  bool shouldRepaint(_Ekor old) => old.garis != garis || old.tebal != tebal;
}

const _ikonKejadian = {
  'kecelakaan': Icons.priority_high_rounded,
  'banjir': Icons.waves_rounded,
  'penutupan': Icons.remove_rounded,
  'perbaikan_jalan': Icons.construction_rounded,
};

/// Penanda laporan: lingkaran warna tingkat + ikon kejadian (bentuk, bukan warna saja).
class PenandaLaporan extends StatelessWidget {
  const PenandaLaporan({
    super.key,
    required this.laporan,
    this.aktif = false,
    this.onTap,
  });

  final Map laporan;
  final bool aktif;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = laporan['tingkat'] as String?;
    final k = laporan['kejadian'] as String? ?? 'none';
    final ukuran = aktif ? 38.0 : 30.0;
    return Semantics(
      button: onTap != null,
      label:
          'Laporan ${infoTingkat(t).label}${k != 'none' ? ', ${kejadianLaluLintas[k]}' : ''}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Container(
            width: ukuran,
            height: ukuran,
            decoration: BoxDecoration(
              color: tingkatLaluLintas[t]?.warna ?? AppColors.inkViolet,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.white, width: 2.5),
              boxShadow: const [
                BoxShadow(color: Color(0x4D000000), blurRadius: 6),
              ],
            ),
            child: _ikonKejadian[k] == null
                ? Center(
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.white,
                        shape: BoxShape.circle,
                      ),
                    ),
                  )
                : Icon(
                    _ikonKejadian[k],
                    size: ukuran * 0.58,
                    color: AppColors.white,
                  ),
          ),
        ),
      ),
    );
  }
}

/// Legenda warna lalu lintas (DESIGN §4, §8): garis berwarna + label teks.
class TrafficLegend extends StatelessWidget {
  const TrafficLegend({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [...tingkatLaluLintas.values, tanpaLaporan];
    return Semantics(
      container: true,
      label: 'Legenda lalu lintas',
      child: Wrap(
        spacing: 16,
        runSpacing: 6,
        children: [
          for (final t in items)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 20,
                  height: 6,
                  decoration: BoxDecoration(
                    color: t.warna,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  t.label,
                  style: sans(
                    size: 13,
                    color: AppColors.ink.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
