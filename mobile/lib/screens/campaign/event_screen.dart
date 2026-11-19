import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../../kampanye.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/map_screen.dart';
import '../../widgets/widgets.dart';
import '../navigation/navigation_screen.dart';

/// EventAlert (T-207): event lalu lintas berlangsung & mendatang, penanda di
/// peta untuk event berlokasi. [pilihId] memilih event (dari hub/notifikasi).
/// Sama dengan web `pages/kampanye/EventAlert.jsx`.
class EventAlertScreen extends StatefulWidget {
  const EventAlertScreen({
    super.key,
    this.pilihId,
    this.share = bagikanSistem,
    this.tileProvider,
  });

  final String? pilihId;
  final Future<void> Function(String teks, String judul) share;
  final TileProvider? tileProvider;

  @override
  State<EventAlertScreen> createState() => EventAlertScreenState();
}

class EventAlertScreenState extends State<EventAlertScreen> {
  final _map = MapController();
  bool _mapReady = false;
  bool _mulai = false;
  String status = 'memuat';
  Object? galat;
  List<Map> items = const [];
  late String? pilihId = widget.pilihId;
  final _now = DateTime.now();
  String? pesan;
  Timer? _pesanTimer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_mulai) return;
    _mulai = true;
    _muat();
  }

  @override
  void dispose() {
    _pesanTimer?.cancel();
    _map.dispose();
    super.dispose();
  }

  Future<void> _muat() async {
    setState(() => status = 'memuat');
    try {
      final r = await AppScope.of(context).api.get('/campaign/events');
      if (!mounted) return;
      setState(() {
        items = ((r as Map)['items'] as List).whereType<Map>().toList();
        status = 'ok';
      });
      _fokus();
    } catch (e) {
      if (mounted) {
        setState(() {
          galat = e;
          status = 'galat';
        });
      }
    }
  }

  Map? get pilih => items.where((e) => e['id'] == pilihId).firstOrNull;

  LatLng? _titik(Map? e) {
    final l = e?['lokasi'];
    if (l is! Map) return null;
    return LatLng((l['lat'] as num).toDouble(), (l['lng'] as num).toDouble());
  }

  void _fokus() {
    final t = _titik(pilih);
    if (t == null || !_mapReady) return;
    final z = math.max(_map.camera.zoom, 15.0);
    // Geser ke atas agar penanda tidak tertutup lembar bawah.
    final geser = _map.camera.size.height * 0.2;
    final p = _map.camera.projectAtZoom(t, z) + Offset(0, geser);
    _map.move(_map.camera.unprojectAtZoom(p, z), z);
  }

  void _pilih(String? id) {
    setState(() => pilihId = id);
    _fokus();
  }

  void _kabari(String teks) {
    _pesanTimer?.cancel();
    setState(() => pesan = teks);
    _pesanTimer = Timer(const Duration(milliseconds: 3200), () {
      if (mounted) setState(() => pesan = null);
    });
  }

  Future<void> _bagikan() async {
    final e = pilih;
    if (e == null) return;
    final teks =
        '${e['judul']} (${infoJenisEvent(e['jenis'] as String?).label})\n'
        '${rentangEvent(e, _now)}\n${e['isi']}\n\nEventAlert SmartMove Medan';
    try {
      await widget.share(teks, '${e['judul']}');
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: teks));
      _kabari('Info event disalin. Tempel di chat untuk membagikannya.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final e = pilih;
    final titik = _titik(e);
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: CustomMultiChildLayout(
        delegate: MapScreenLayout(sheetMax: 0.55),
        children: [
          LayoutId(
            id: MapSlot.map,
            child: MapView(
              tucked: true,
              controller: _map,
              zoom: 13,
              tileProvider: widget.tileProvider,
              onMapReady: () {
                _mapReady = true;
                _fokus();
              },
              children: [
                MarkerLayer(
                  markers: [
                    for (final ev in items)
                      if (_titik(ev) != null)
                        Marker(
                          point: _titik(ev)!,
                          width: ev['id'] == pilihId ? 46 : 38,
                          height: ev['id'] == pilihId ? 54 : 46,
                          alignment: Alignment.topCenter,
                          child: Semantics(
                            button: true,
                            label: '${ev['judul']}',
                            excludeSemantics: true,
                            child: GestureDetector(
                              onTap: () => _pilih(ev['id'] as String?),
                              child: Icon(
                                Icons.event_available_rounded,
                                size: ev['id'] == pilihId ? 40 : 32,
                                color: infoJenisEvent(ev['jenis'] as String?)
                                    .warna,
                                shadows: const [
                                  Shadow(color: Colors.white, blurRadius: 6),
                                ],
                              ),
                            ),
                          ),
                        ),
                  ],
                ),
              ],
            ),
          ),
          LayoutId(id: MapSlot.sheet, child: _lembar()),
          if (pesan != null)
            LayoutId(
              id: MapSlot.toast,
              child: MapToast(teks: pesan!),
            ),
          LayoutId(
            id: MapSlot.bar,
            child: BottomActionBar(
              actions: [
                BarAction(
                  label: 'Rute',
                  icon: Icons.near_me_outlined,
                  onPressed: titik == null
                      ? null
                      : () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => NavigationScreen(
                              ke: titik,
                              keNama: '${e!['judul']}',
                            ),
                          ),
                        ),
                ),
                BarAction(
                  label: 'Share',
                  icon: Icons.share_outlined,
                  onPressed: e == null ? null : _bagikan,
                ),
              ],
            ),
          ),
          LayoutId(
            id: MapSlot.header,
            child: NebulaHeader(
              title: 'EventAlert',
              leading: canPop
                  ? IconButton(
                      tooltip: 'Kembali',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    )
                  : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _lembar() {
    final List<Widget> isi;
    if (status == 'memuat') {
      isi = [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSizes.s6),
          child: Text(
            'Memuat event…',
            style: sans(size: 14, color: AppColors.ink.withValues(alpha: 0.7)),
          ),
        ),
      ];
    } else if (status == 'galat') {
      isi = [ErrorBanner(error: galat, onRetry: _muat)];
    } else if (items.isEmpty) {
      isi = const [
        EmptyState(
          icon: Icons.event_note_outlined,
          title: 'Belum ada event',
          message: 'Car Free Day, rekayasa arus, dan acara yang memengaruhi jalan di Medan akan muncul di sini.',
        ),
      ];
    } else {
      final kelompok = [
        (
          'Sedang berlangsung',
          items.where((e) => e['status'] == 'berlangsung').toList(),
        ),
        ('Mendatang', items.where((e) => e['status'] == 'mendatang').toList()),
      ];
      isi = [
        for (final (judul, xs) in kelompok)
          if (xs.isNotEmpty) ...[
            Text(judul, style: titleSerif(size: 22)),
            const SizedBox(height: AppSizes.s1),
            for (final e in xs) _item(e),
            const SizedBox(height: AppSizes.s4),
          ],
        Wrap(
          spacing: 16,
          runSpacing: 6,
          children: [
            for (final j in jenisEvent.values)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: j.warna,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    j.label,
                    style: sans(
                      size: 13,
                      color: AppColors.ink.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ];
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: AppColors.inkViolet.withValues(alpha: 0.4),
            blurRadius: 32,
            spreadRadius: -14,
            offset: const Offset(0, -12),
          ),
        ],
      ),
      child: Material(
        type: MaterialType.transparency,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28 + 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: AppColors.ink.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              ...isi,
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(Map e) {
    final j = infoJenisEvent(e['jenis'] as String?);
    final aktif = e['id'] == pilihId;
    final muted = AppColors.ink.withValues(alpha: 0.6);
    return Semantics(
      selected: aktif,
      button: true,
      child: Material(
        color: aktif
            ? AppColors.lilacWash.withValues(alpha: 0.35)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _pilih(aktif ? null : e['id'] as String?),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: j.warna,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: AppSizes.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${e['judul']}',
                        style: sans(size: 15, weight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${j.label}, ${rentangEvent(e, _now)}',
                        style: sans(size: 13, color: muted),
                      ),
                      if (aktif) ...[
                        const SizedBox(height: 8),
                        Text(
                          '${e['isi']}',
                          style: sans(
                            size: 15,
                            height: 1.45,
                            color: AppColors.ink.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                      if (e['lokasi'] == null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              Icon(
                                Icons.location_off_outlined,
                                size: 14,
                                color: AppColors.ink.withValues(alpha: 0.5),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Tanpa titik di peta',
                                style: sans(
                                  size: 12,
                                  color: AppColors.ink.withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
