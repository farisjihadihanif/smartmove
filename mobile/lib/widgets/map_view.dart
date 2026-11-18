import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';

/// Pusat kota Medan (Lapangan Merdeka).
const medanCenter = LatLng(3.5913, 98.6776);

// ARCHITECTURE: tile diambil langsung dari OSM dengan atribusi;
// rute & pencarian tetap lewat API kita.
const _tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const _userAgentPackage = 'id.smartmove.smartmove';

/// Peta OSM + atribusi "© OpenStreetMap contributors" yang selalu terlihat.
/// [children] = lapisan flutter_map (PolylineLayer, MarkerLayer, …).
/// [capped] menambah tutup atas ungu melengkung seperti mockup hal. 4 & 6.
class MapView extends StatelessWidget {
  const MapView({
    super.key,
    this.center = medanCenter,
    this.zoom = 14,
    this.controller,
    this.capped = false,
    this.children = const [],
    this.onTap,
    this.tileProvider,
  });

  final LatLng center;
  final double zoom;
  final MapController? controller;
  final bool capped;
  final List<Widget> children;
  final void Function(TapPosition, LatLng)? onTap;

  /// Untuk tes: ganti penyedia tile agar tidak memanggil jaringan.
  final TileProvider? tileProvider;

  @override
  Widget build(BuildContext context) {
    final map = FlutterMap(
      mapController: controller,
      options: MapOptions(
        initialCenter: center,
        initialZoom: zoom,
        maxZoom: 19,
        onTap: onTap,
      ),
      children: [
        TileLayer(
          urlTemplate: _tileUrl,
          userAgentPackageName: _userAgentPackage,
          tileProvider: tileProvider,
        ),
        ...children,
        const OsmAttribution(),
      ],
    );

    if (!capped) return map;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 16,
          margin: const EdgeInsets.symmetric(horizontal: AppSizes.s1),
          decoration: const BoxDecoration(
            color: AppColors.inkViolet,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
        ),
        Expanded(child: map),
      ],
    );
  }
}

/// Label atribusi OSM (wajib, AGENTS §UI). Ketuk → halaman hak cipta OSM.
class OsmAttribution extends StatelessWidget {
  const OsmAttribution({super.key});

  static final _copyright = Uri.parse(
    'https://www.openstreetmap.org/copyright',
  );

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomRight,
      child: Semantics(
        link: true,
        child: GestureDetector(
          onTap: () =>
              launchUrl(_copyright, mode: LaunchMode.externalApplication),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: 0.85),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(6),
              ),
            ),
            child: const Text(
              '© OpenStreetMap contributors',
              style: TextStyle(fontSize: 11, color: AppColors.ink),
            ),
          ),
        ),
      ),
    );
  }
}
