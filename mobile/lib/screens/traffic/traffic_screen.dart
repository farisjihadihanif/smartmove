import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../lalulintas.dart';
import '../../navigasi.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/map_screen.dart';
import '../../widgets/widgets.dart';
import '../auth/login_screen.dart';
import '../navigation/navigation_screen.dart';
import 'traffic_layers.dart';
import 'traffic_panel.dart';

/// Live Traffic Information (mockup hal. 6, PRD §6.2, T-205).
/// Tab Estimasi Waktu: waktu tempuh jalan utama + kotak "12 mnt / 4,9 km".
/// Tab Peta Interaktif: laporan warga di area peta + legenda.
/// Laporkan = POST /traffic/reports (wajib masuk). Lokasi perangkat hanya
/// dibaca saat melapor dan tidak disimpan (aturan bisnis #5).
/// Sama dengan web `pages/LaluLintas.jsx`.
class TrafficScreen extends StatefulWidget {
  const TrafficScreen({
    super.key,
    this.locate = lokasiPerangkat,
    this.share = bagikanSistem,
    this.tileProvider,
    this.data,
  });

  final Future<LokasiHasil> Function() locate;
  final Future<void> Function(String teks, String judul) share;
  final TileProvider? tileProvider;

  /// Untuk tes: sumber data buatan sendiri.
  final LaluLintasData? data;

  @override
  State<TrafficScreen> createState() => TrafficScreenState();
}

class TrafficScreenState extends State<TrafficScreen> {
  final _map = MapController();
  final _query = TextEditingController();
  late LaluLintasData data;
  bool _dataSendiri = false;
  bool _mapReady = false;
  StreamSubscription<MapEvent>? _gerak;
  Timer? _jeda;

  String tab = 'estimasi';
  String? pilih;
  Map? aktif;
  bool konfirmasi = false;
  double zoom = 13;

  // Laporan yang sedang dibuat: null = tidak melapor.
  ({LatLng? titik, String nama})? lapor;

  ({String status, List<Tempat> items, Object? error})? _hasil;

  String? pesan;
  Timer? _pesanTimer;

  ApiClient get _api => AppScope.of(context).api;

  bool _dataDipasang = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_dataDipasang) return;
    _dataDipasang = true;
    _dataSendiri = widget.data == null;
    data = widget.data ?? LaluLintasData(_api);
    data.addListener(_ubah);
    data.mulai();
  }

  void _ubah() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _gerak?.cancel();
    _jeda?.cancel();
    _pesanTimer?.cancel();
    data.removeListener(_ubah);
    if (_dataSendiri) {
      data.dispose();
    } else {
      data.berhenti();
    }
    _query.dispose();
    _map.dispose();
    super.dispose();
  }

  void _kabari(String teks) {
    _pesanTimer?.cancel();
    setState(() => pesan = teks);
    _pesanTimer = Timer(const Duration(milliseconds: 3600), () {
      if (mounted) setState(() => pesan = null);
    });
  }

  void _petaSiap() {
    _mapReady = true;
    _area();
    _gerak = _map.mapEventStream.listen((_) {
      _jeda?.cancel();
      _jeda = Timer(const Duration(milliseconds: 350), _area);
    });
  }

  void _area() {
    if (!mounted || !_mapReady) return;
    final cam = _map.camera;
    data.aturArea(cam.visibleBounds);
    if (cam.zoom != zoom) setState(() => zoom = cam.zoom);
  }

  /// Tengah area peta yang terlihat (bagian bawah tertutup lembar).
  LatLng get _tengahTerlihat {
    if (!_mapReady) return medanCenter;
    final b = _map.camera.visibleBounds;
    final c = b.center;
    return LatLng(c.latitude + (b.north - c.latitude) * 0.35, c.longitude);
  }

  EdgeInsets get _padPeta =>
      EdgeInsets.fromLTRB(24, 56, 24, MediaQuery.sizeOf(context).height * 0.38);

  void _pilihKoridor(String? kode) {
    setState(() => pilih = kode);
    if (kode == null || !_mapReady) return;
    final k = data.koridor.where((x) => x['kode'] == kode).firstOrNull;
    final g = k == null ? const <LatLng>[] : garisKoridor(k);
    if (g.length < 2) return;
    _map.fitCamera(
      CameraFit.coordinates(coordinates: g, padding: _padPeta, maxZoom: 16),
    );
  }

  Future<String> _namaTitik(LatLng p) async {
    try {
      final r = await _api.get(
        '/places/reverse',
        query: {'at': latLngQuery(p.latitude, p.longitude)},
      );
      return Tempat.fromJson((r as Map)['tempat'] as Map).nama;
    } catch (_) {
      return 'Titik di peta';
    }
  }

  Future<void> _aturTitik(LatLng p, [String? nama]) async {
    if (!dalamWilayah(p)) {
      _kabari('SmartMove baru melayani Medan dan sekitarnya.');
      return;
    }
    setState(() => lapor = (titik: p, nama: nama ?? ''));
    if (nama != null) return;
    final n = await _namaTitik(p);
    if (mounted && lapor?.titik == p) {
      setState(() => lapor = (titik: p, nama: n));
    }
  }

  Future<void> _lokasiSaya() async {
    final h = await widget.locate();
    if (!mounted) return;
    switch (h.status) {
      case 'ok':
        await _aturTitik(h.lokasi!);
        if (_mapReady) {
          _map.move(h.lokasi!, math.max(_map.camera.zoom, 15));
        }
      case 'ditolak':
        _kabari('Izin lokasi ditolak. Ketuk peta untuk memilih titik.');
      case 'luar':
        _kabari('Lokasimu di luar Medan. Ketuk peta untuk memilih titik.');
      default:
        _kabari('Lokasi belum terbaca. Ketuk peta untuk memilih titik.');
    }
  }

  Future<void> mulaiLapor() async {
    if (AppScope.of(context).user == null) {
      await pushLogin(context);
      return;
    }
    setState(() {
      _hasil = null;
      aktif = null;
    });
    await _aturTitik(_tengahTerlihat);
  }

  Future<void> _kirim(String tingkat, String kejadian, String catatan) async {
    final titik = lapor?.titik;
    if (titik == null) return;
    final r = await data.kirim(
      lokasi: titik,
      tingkat: tingkat,
      kejadian: kejadian,
      catatan: catatan,
    );
    if (!mounted) return;
    setState(() {
      lapor = null;
      tab = 'peta';
    });
    _kabari(r.digabung ? pesanLaporanDigabung : pesanLaporanTerkirim);
  }

  Future<void> _konfirmasi() async {
    final a = aktif;
    if (a == null) return;
    if (AppScope.of(context).user == null) {
      await pushLogin(context);
      return;
    }
    setState(() => konfirmasi = true);
    try {
      final r = await data.kirim(
        lokasi: lokasiLaporan(a),
        tingkat: a['tingkat'] as String,
        kejadian: a['kejadian'] as String? ?? 'none',
      );
      if (!mounted) return;
      setState(() => aktif = r.laporan);
      _kabari(r.digabung ? pesanLaporanDigabung : pesanLaporanTerkirim);
    } catch (e) {
      if (mounted) _kabari(errorMessageFor(e));
    } finally {
      if (mounted) setState(() => konfirmasi = false);
    }
  }

  Future<void> cari(String q) async {
    final s = q.trim();
    if (s.length < 2) {
      setState(
        () => _hasil = (
          status: 'galat',
          items: const [],
          error: 'Ketik minimal 2 huruf.',
        ),
      );
      return;
    }
    setState(() => _hasil = (status: 'memuat', items: const [], error: null));
    try {
      final near = _tengahTerlihat;
      final r = await _api.get(
        '/places/search',
        query: {'q': s, 'near': latLngQuery(near.latitude, near.longitude)},
      );
      final items = ((r as Map)['items'] as List? ?? const [])
          .whereType<Map>()
          .map(Tempat.fromJson)
          .toList();
      if (mounted) {
        setState(() => _hasil = (status: 'ok', items: items, error: null));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _hasil = (status: 'galat', items: const [], error: e));
      }
    }
  }

  void _pilihTempat(Tempat t) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _hasil = null;
      _query.text = t.nama;
    });
    if (_mapReady) _map.move(t.lokasi, math.max(_map.camera.zoom, 15));
    if (lapor != null) _aturTitik(t.lokasi, t.nama);
  }

  void _ketukPeta(TapPosition _, LatLng p) {
    if (lapor != null) {
      _aturTitik(p);
      return;
    }
    setState(() {
      _hasil = null;
      aktif = null;
    });
  }

  Future<void> _bagikan() async {
    if (data.koridor.isEmpty) return;
    final teks = teksBagikanLaluLintas(data.koridor);
    try {
      await widget.share(teks, 'Lalu lintas Medan');
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: teks));
      _kabari(
        'Ringkasan lalu lintas disalin. Tempel di chat untuk membagikannya.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final estimasi = tab == 'estimasi';
    final melapor = lapor != null;
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: CustomMultiChildLayout(
        delegate: MapScreenLayout(
          sheetMax: melapor
              ? 0.66
              : estimasi
              ? 0.5
              : 0.46,
        ),
        children: [
          LayoutId(
            id: MapSlot.map,
            child: MapView(
              tucked: true,
              controller: _map,
              center: LatLng(
                medanCenter.latitude - 0.022,
                medanCenter.longitude,
              ),
              zoom: 13,
              tileProvider: widget.tileProvider,
              onTap: _ketukPeta,
              onMapReady: _petaSiap,
              children: lapisanLaluLintas(
                koridor: data.koridor,
                laporan: estimasi && !melapor ? const [] : data.laporan,
                kotak: estimasi && !melapor,
                zoom: zoom,
                pilihKoridor: estimasi ? pilih : null,
                onPilihKoridor: estimasi && !melapor
                    ? (k) => _pilihKoridor(pilih == k ? null : k)
                    : null,
                laporanAktif: aktif,
                onPilihLaporan: melapor
                    ? null
                    : (r) => setState(() => aktif = r),
                titikLapor: lapor?.titik,
                redup: melapor,
              ),
            ),
          ),
          LayoutId(id: MapSlot.sheet, child: _lembar(estimasi)),
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
                  icon: Icons.route_rounded,
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const NavigationScreen(),
                    ),
                  ),
                ),
                BarAction(
                  label: 'Laporkan',
                  short: 'Lapor',
                  icon: Icons.campaign_outlined,
                  onPressed: melapor ? null : mulaiLapor,
                ),
                BarAction(
                  label: 'Share',
                  icon: Icons.share_outlined,
                  onPressed: data.koridor.isEmpty ? null : _bagikan,
                ),
              ],
            ),
          ),
          LayoutId(
            id: MapSlot.header,
            child: NebulaHeader(
              title: 'Live Traffic Information',
              leading: canPop
                  ? IconButton(
                      tooltip: 'Kembali',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    )
                  : const Icon(
                      Icons.traffic_outlined,
                      color: AppColors.inkViolet,
                    ),
              children: [
                SearchField(
                  controller: _query,
                  onSubmitted: cari,
                  onChanged: (v) {
                    if (v.isEmpty) setState(() => _hasil = null);
                  },
                  hint: 'Telusuri di sini',
                  label: 'Cari tempat di peta',
                ),
                PillToggle<String>(
                  selected: {tab},
                  onChanged: (s) {
                    if (s.isEmpty) return;
                    setState(() {
                      tab = s.first;
                      aktif = null;
                    });
                  },
                  options: const [
                    PillOption('estimasi', 'Estimasi Waktu'),
                    PillOption('peta', 'Peta Interaktif'),
                  ],
                ),
              ],
            ),
          ),
          if (_hasil != null)
            LayoutId(
              id: MapSlot.results,
              child: PlaceResults(
                hasil: _hasil!,
                onPilih: _pilihTempat,
                onTutup: () => setState(() => _hasil = null),
              ),
            ),
        ],
      ),
    );
  }

  Widget _lembar(bool estimasi) {
    final l = lapor;
    final List<Widget> isi;
    if (l != null) {
      isi = [
        FormLaporan(
          key: const ValueKey('lapor'),
          adaTitik: l.titik != null,
          namaTitik: l.nama,
          onLokasiSaya: _lokasiSaya,
          onBatal: () => setState(() => lapor = null),
          onKirim: _kirim,
        ),
      ];
    } else if (estimasi) {
      isi = [
        Text('Jalan utama sekarang', style: titleSerif(size: 22)),
        const SizedBox(height: AppSizes.s2),
        const TrafficLegend(),
        const SizedBox(height: AppSizes.s2),
        DaftarKoridor(data: data, pilih: pilih, onPilih: _pilihKoridor),
      ];
    } else {
      final a = aktif;
      isi = [
        if (a != null)
          DetailLaporan(
            laporan: a,
            now: DateTime.now(),
            onTutup: () => setState(() => aktif = null),
            onKonfirmasi: _konfirmasi,
            mengirim: konfirmasi,
          )
        else
          RingkasanPeta(jumlah: data.laporan.length),
        const SizedBox(height: AppSizes.s4),
        const TrafficLegend(),
      ];
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.white,
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
}
