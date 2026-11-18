import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../navigasi.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';

/// Hasil membaca lokasi perangkat. [status]: ok | ditolak | luar | tidak.
class LokasiHasil {
  const LokasiHasil(this.status, [this.lokasi]);
  final String status;
  final LatLng? lokasi;
}

/// Lokasi perangkat sekali baca, hanya selama layar terbuka (aturan bisnis #5).
Future<LokasiHasil> lokasiPerangkat() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return const LokasiHasil('tidak');
    }
    var izin = await Geolocator.checkPermission();
    if (izin == LocationPermission.denied) {
      izin = await Geolocator.requestPermission();
    }
    if (izin == LocationPermission.denied ||
        izin == LocationPermission.deniedForever) {
      return const LokasiHasil('ditolak');
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
    final l = LatLng(pos.latitude, pos.longitude);
    return dalamWilayah(l) ? LokasiHasil('ok', l) : const LokasiHasil('luar');
  } catch (_) {
    return const LokasiHasil('tidak');
  }
}

const _segera = {
  'traffic': 'Lapisan Traffic hadir bersama Live Traffic Information.',
  'transit': 'Rute transportasi umum sedang disiapkan.',
};

const _teksLokasi = {
  'mencari': 'Mencari lokasimu…',
  'ditolak':
      'Izin lokasi ditolak. Ketuk Ganti, lalu cari alamat atau ketuk peta.',
  'luar': 'Lokasimu di luar Medan. Ketuk Ganti untuk memilih titik asal.',
  'tidak': 'Ketuk Ganti, lalu cari alamat atau ketuk peta.',
};

/// Smart Navigation (mockup hal. 4, PRD §6.1): cari tujuan, pilih moda, rute di
/// peta, ringkasan & langkah di lembar bawah, Play (panduan langkah), Share,
/// Street view (foto Mapillary). Sama dengan web `pages/Navigasi.jsx`.
class NavigationScreen extends StatefulWidget {
  const NavigationScreen({
    super.key,
    this.initialQuery,
    this.dari,
    this.ke,
    this.mode = Moda.driving,
    this.locate = lokasiPerangkat,
    this.tileProvider,
  });

  /// Kata kunci dari kolom cari Beranda.
  final String? initialQuery;

  /// Titik awal dari Trip Planner (nanti, T-109). Tanpa [dari] = lokasi perangkat.
  final LatLng? dari;
  final LatLng? ke;
  final Moda mode;
  final Future<LokasiHasil> Function() locate;

  /// Untuk tes: tile palsu tanpa jaringan.
  final TileProvider? tileProvider;

  @override
  State<NavigationScreen> createState() => NavigationScreenState();
}

class NavigationScreenState extends State<NavigationScreen> {
  final _map = MapController();
  final _lembarKey = GlobalKey();
  final _query = TextEditingController();
  bool _mapReady = false;

  // Pencarian: null = tertutup.
  ({String status, List<Tempat> items, Object? error})? _hasil;

  Tempat? dari;
  Tempat? ke;
  String lokasiStatus = 'mencari';
  String target = 'ke';
  late Moda mode = widget.mode;

  Map? rute;
  Object? _galatRute;
  bool _memuatRute = false;
  int _ruteReq = 0;

  bool buka = false;
  int? play;
  Set<String> lapisan = {};

  // Street view.
  String _fotoStatus = 'mati'; // mati | memuat | ada | kosong | galat
  Map? _foto;
  Object? _fotoGalat;
  int _fotoReq = 0;

  String? pesan;
  Timer? _pesanTimer;

  ApiClient get _api => AppScope.of(context).api;

  @override
  void initState() {
    super.initState();
    _query.text = widget.initialQuery ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) => _mulai());
  }

  @override
  void dispose() {
    _pesanTimer?.cancel();
    _query.dispose();
    _map.dispose();
    super.dispose();
  }

  Future<void> _mulai() async {
    final pKe = widget.ke;
    if (pKe != null && dalamWilayah(pKe)) {
      unawaited(
        _namaTitik(pKe).then((t) {
          _set(() => ke = t);
          _hitungRute();
        }),
      );
    }
    final q = widget.initialQuery?.trim() ?? '';
    if (q.isNotEmpty) unawaited(cari(q));

    final pDari = widget.dari;
    if (pDari != null && dalamWilayah(pDari)) {
      final t = await _namaTitik(pDari);
      _set(() {
        dari = t;
        lokasiStatus = 'tidak';
      });
      _hitungRute();
      return;
    }
    final hasil = await widget.locate();
    if (!mounted) return;
    _set(() {
      lokasiStatus = hasil.status;
      if (hasil.lokasi != null && dari == null) {
        dari = Tempat(nama: 'Lokasi kamu', lokasi: hasil.lokasi!, saya: true);
      }
    });
    _hitungRute();
  }

  /// Jalankan setelah frame berikutnya (ukuran lembar bawah sudah baru).
  void _setelahFrame(VoidCallback fn) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) fn();
    });
  }

  void _set(VoidCallback fn) {
    if (mounted) setState(fn);
  }

  void _kabari(String teks) {
    _pesanTimer?.cancel();
    _set(() => pesan = teks);
    _pesanTimer = Timer(const Duration(milliseconds: 3200), () {
      _set(() => pesan = null);
    });
  }

  /// Nama titik dari API (reverse); bila gagal cukup "Titik di peta".
  Future<Tempat> _namaTitik(LatLng p) async {
    try {
      final r = await _api.get(
        '/places/reverse',
        query: {'at': latLngQuery(p.latitude, p.longitude)},
      );
      final t = Tempat.fromJson((r as Map)['tempat'] as Map);
      return Tempat(nama: t.nama, alamat: t.alamat, lokasi: p);
    } catch (_) {
      return Tempat(nama: 'Titik di peta', lokasi: p);
    }
  }

  LatLng get _tengah => _mapReady ? _map.camera.center : medanCenter;

  Future<void> cari(String q) async {
    final s = q.trim();
    if (s.length < 2) {
      _set(
        () => _hasil = (
          status: 'galat',
          items: const [],
          error: 'Ketik minimal 2 huruf.',
        ),
      );
      return;
    }
    _set(() => _hasil = (status: 'memuat', items: const [], error: null));
    try {
      final near = dari?.lokasi ?? _tengah;
      final r = await _api.get(
        '/places/search',
        query: {'q': s, 'near': latLngQuery(near.latitude, near.longitude)},
      );
      final items = ((r as Map)['items'] as List? ?? const [])
          .whereType<Map>()
          .map(Tempat.fromJson)
          .toList();
      _set(() => _hasil = (status: 'ok', items: items, error: null));
    } catch (e) {
      _set(() => _hasil = (status: 'galat', items: const [], error: e));
    }
  }

  void pilih(Tempat t) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _hasil = null;
      play = null;
      if (target == 'dari') {
        dari = t;
        target = 'ke';
        _query.text = ke?.nama ?? '';
      } else {
        ke = t;
        _query.text = t.nama;
      }
    });
    if (!_mapReady || rute != null) {
      // Rute baru akan menyesuaikan tampilan.
    } else {
      _geserKe(t.lokasi, math.max(_map.camera.zoom, 15));
    }
    _hitungRute();
    if (lapisan.contains('street')) _muatFoto();
  }

  Future<void> _ketukPeta(TapPosition _, LatLng p) async {
    if (!dalamWilayah(p)) {
      _kabari('SmartMove baru melayani Medan dan sekitarnya.');
      return;
    }
    _set(() => _hasil = null);
    pilih(await _namaTitik(p));
  }

  Future<void> _hitungRute() async {
    final a = dari, b = ke;
    if (a == null || b == null) return;
    final req = ++_ruteReq;
    _set(() {
      _memuatRute = true;
      _galatRute = null;
      rute = null;
    });
    try {
      final r = await _api.get(
        '/routes',
        query: {
          'from': latLngQuery(a.lokasi.latitude, a.lokasi.longitude),
          'to': latLngQuery(b.lokasi.latitude, b.lokasi.longitude),
          'mode': mode.name,
        },
      );
      if (req != _ruteReq) return;
      _set(() {
        rute = r as Map;
        _memuatRute = false;
      });
      _setelahFrame(_fitRute);
    } catch (e) {
      if (req != _ruteReq) return;
      _set(() {
        _galatRute = e;
        _memuatRute = false;
      });
    }
  }

  List<LatLng> get _garis => (rute?['garis'] as List? ?? const [])
      .map(keLatLng)
      .whereType<LatLng>()
      .toList();

  List<Map> get _langkah =>
      (rute?['langkah'] as List? ?? const []).whereType<Map>().toList();

  void _fitRute() {
    final g = _garis;
    if (!_mapReady || g.length < 2) return;
    // Ruang bawah = tinggi lembar bawah yang sebenarnya (peta terselip di bawahnya).
    final lembar =
        _lembarKey.currentContext?.size?.height ??
        MediaQuery.sizeOf(context).height * 0.42;
    _map.fitCamera(
      CameraFit.coordinates(
        coordinates: g,
        maxZoom: 17,
        padding: EdgeInsets.fromLTRB(28, 72, 28, lembar + 24),
      ),
    );
  }

  /// Pindahkan peta agar [p] tampil di area yang tidak tertutup lembar bawah.
  void _geserKe(LatLng p, double zoom) {
    if (!_mapReady) return;
    final cam = _map.camera;
    final lembar = _lembarKey.currentContext?.size?.height ?? 0;
    // Titik di tengah area peta yang terlihat (antara header dan lembar bawah).
    final geser = Offset(0, math.max(0, lembar - 28) / 2);
    _map.move(
      cam.unprojectAtZoom(cam.projectAtZoom(p, zoom) + geser, zoom),
      zoom,
    );
  }

  void setPlay(int? i) {
    setState(() => play = i);
    final l = i == null ? null : keLatLng(_langkah[i]['lokasi']);
    if (l != null) {
      _setelahFrame(() => _geserKe(l, math.max(_map.camera.zoom, 17)));
    }
    if (lapisan.contains('street')) _muatFoto();
  }

  void _ubahLapisan(Set<String> next) {
    final baru = next.difference(lapisan);
    for (final v in baru) {
      if (_segera.containsKey(v)) return _kabari(_segera[v]!);
    }
    setState(
      () => lapisan = next.where((v) => !_segera.containsKey(v)).toSet(),
    );
    if (lapisan.contains('street')) {
      _muatFoto();
    } else {
      _fotoReq++;
      setState(() => _fotoStatus = 'mati');
    }
  }

  Future<void> _muatFoto() async {
    final langkah = play == null || rute == null ? null : _langkah[play!];
    final titik = keLatLng(langkah?['lokasi']) ?? ke?.lokasi ?? _tengah;
    final req = ++_fotoReq;
    _set(() => _fotoStatus = 'memuat');
    try {
      final r = await _api.get(
        '/streetview',
        query: {
          'at':
              '${titik.latitude.toStringAsFixed(4)},${titik.longitude.toStringAsFixed(4)}',
        },
      );
      if (req != _fotoReq) return;
      final f = (r as Map)['foto'];
      _set(() {
        _foto = f is Map ? f : null;
        _fotoStatus = _foto == null ? 'kosong' : 'ada';
      });
    } catch (e) {
      if (req != _fotoReq) return;
      _set(() {
        _fotoGalat = e;
        _fotoStatus = 'galat';
      });
    }
  }

  Future<void> _bagikan() async {
    final r = rute, a = dari, b = ke;
    if (r == null || a == null || b == null) return;
    await Clipboard.setData(
      ClipboardData(
        text: teksBagikan(dari: a, ke: b, mode: mode, rute: r),
      ),
    );
    _kabari('Rute disalin. Tempel di chat untuk membagikannya.');
  }

  void _gantiTarget(String t) {
    setState(() {
      target = t;
      _hasil = null;
      _query.text = t == 'ke' ? (ke?.nama ?? '') : '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final adaRute = rute != null;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: CustomMultiChildLayout(
        delegate: _NavLayout(),
        children: [
          LayoutId(
            id: _Slot.map,
            child: MapView(
              tucked: true,
              controller: _map,
              tileProvider: widget.tileProvider,
              onTap: _ketukPeta,
              onMapReady: () {
                _mapReady = true;
                _fitRute();
              },
              children: _lapisanPeta(),
            ),
          ),
          LayoutId(id: _Slot.sheet, child: _lembar()),
          if (pesan != null)
            LayoutId(
              id: _Slot.toast,
              child: _Toast(teks: pesan!),
            ),
          LayoutId(
            id: _Slot.bar,
            child: BottomActionBar(
              actions: [
                BarAction(
                  label: 'Rute',
                  icon: Icons.route_rounded,
                  onPressed: adaRute
                      ? () {
                          setState(() {
                            play = null;
                            buka = true;
                          });
                          _setelahFrame(_fitRute);
                        }
                      : null,
                ),
                BarAction(
                  label: 'Play',
                  icon: Icons.play_arrow_rounded,
                  onPressed: adaRute ? () => setPlay(0) : null,
                ),
                BarAction(
                  label: 'Share',
                  icon: Icons.share_outlined,
                  onPressed: adaRute ? _bagikan : null,
                ),
              ],
            ),
          ),
          LayoutId(
            id: _Slot.header,
            child: NebulaHeader(
              title: 'Smart Navigation',
              leading: canPop
                  ? IconButton(
                      tooltip: 'Kembali',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    )
                  : const Icon(Icons.map_outlined, color: AppColors.inkViolet),
              children: [
                SearchField(
                  controller: _query,
                  onSubmitted: cari,
                  onChanged: (v) {
                    if (v.isEmpty) setState(() => _hasil = null);
                  },
                  hint: target == 'dari'
                      ? 'Cari titik asal'
                      : 'Telusuri di sini',
                  label: target == 'dari' ? 'Cari titik asal' : 'Cari tujuan',
                ),
                PillToggle<String>(
                  multiple: true,
                  selected: lapisan,
                  onChanged: _ubahLapisan,
                  options: const [
                    PillOption('traffic', 'Traffic'),
                    PillOption('transit', 'Transportasi umum'),
                    PillOption('street', 'Street view'),
                  ],
                ),
              ],
            ),
          ),
          if (_hasil != null)
            LayoutId(
              id: _Slot.results,
              child: _HasilCari(
                hasil: _hasil!,
                onPilih: pilih,
                onTutup: () => setState(() => _hasil = null),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _lapisanPeta() {
    final g = _garis;
    final fokus = play == null || rute == null
        ? null
        : keLatLng(_langkah[play!]['lokasi']);
    return [
      if (g.length > 1)
        PolylineLayer(
          polylines: [
            Polyline(
              points: g,
              strokeWidth: 6,
              color: AppColors.route,
              borderStrokeWidth: 1.5,
              borderColor: AppColors.routeOutline,
              strokeCap: StrokeCap.round,
              strokeJoin: StrokeJoin.round,
            ),
          ],
        ),
      MarkerLayer(
        markers: [
          if (dari != null)
            Marker(
              point: dari!.lokasi,
              width: 20,
              height: 20,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.inkViolet, width: 4),
                ),
              ),
            ),
          if (ke != null)
            Marker(
              point: ke!.lokasi,
              width: 40,
              height: 44,
              alignment: Alignment.topCenter,
              child: const Icon(
                Icons.location_on,
                size: 44,
                color: AppColors.trafficMacet,
                shadows: [Shadow(color: Color(0x668E1B12), blurRadius: 4)],
              ),
            ),
          if (fokus != null)
            Marker(
              point: fokus,
              width: 24,
              height: 24,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.pillVia,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.white, width: 3),
                ),
              ),
            ),
        ],
      ),
    ];
  }

  // ───────────── Lembar bawah ─────────────

  Widget _lembar() {
    final r = rute;
    final isi = play != null && r != null ? _panduan(r) : _ringkasan();
    return DecoratedBox(
      key: _lembarKey,
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

  static const _gap = SizedBox(height: AppSizes.s4);
  Color get _muted => AppColors.ink.withValues(alpha: 0.65);

  List<Widget> _ringkasan() {
    final r = rute;
    return [
      if (target == 'dari') ...[
        Container(
          padding: const EdgeInsets.only(left: AppSizes.s4, right: AppSizes.s1),
          decoration: BoxDecoration(
            color: AppColors.lilacWash.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Pilih titik asal: cari alamat di atas atau ketuk peta.',
                  style: sans(size: 14, height: 1.35),
                ),
              ),
              TextButton(
                onPressed: () => _gantiTarget('ke'),
                child: const Text('Batal'),
              ),
            ],
          ),
        ),
        _gap,
      ],
      if (ke == null) ...[
        Semantics(
          header: true,
          child: Text('Mau ke mana?', style: titleSerif(size: 26)),
        ),
        const SizedBox(height: AppSizes.s1),
        Text(
          'Cari tempat di kolom atas atau ketuk peta untuk memilih tujuan.',
          style: sans(size: 15, color: _muted, height: 1.45),
        ),
      ] else if (_galatRute != null)
        ErrorBanner(error: _galatRute, onRetry: _hitungRute)
      else if (r == null || _memuatRute)
        Semantics(
          label: 'Menghitung rute',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Tulang(width: 128, height: 36),
              const SizedBox(height: AppSizes.s2),
              _Tulang(width: 176, height: 16),
            ],
          ),
        )
      else ...[
        Semantics(
          liveRegion: true,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatDurasi(r['durasiS'] as num? ?? 0),
                style: titleSerif(size: 36).copyWith(height: 1),
              ),
              const SizedBox(width: AppSizes.s3),
              Text(
                formatJarak(r['jarakM'] as num? ?? 0),
                style: sans(size: 18, weight: FontWeight.w600, color: _muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Perkiraan waktu tanpa macet.',
          style: sans(size: 14, color: _muted),
        ),
      ],
      if (ke != null) ...[
        _gap,
        _PilihModa(
          mode: mode,
          onMode: (m) {
            setState(() => mode = m);
            _hitungRute();
          },
        ),
      ],
      if (_fotoStatus != 'mati') ...[_gap, _fotoJalan()],
      _gap,
      _rencana(),
      if (r != null) ...[
        _gap,
        InkWell(
          onTap: () => setState(() => buka = !buka),
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: AppSizes.touch,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${_langkah.length} langkah',
                    style: sans(size: 15, weight: FontWeight.w700),
                  ),
                ),
                Text(
                  buka ? 'Sembunyikan' : 'Lihat semua',
                  style: sans(
                    size: 14,
                    weight: FontWeight.w600,
                    color: AppColors.inkViolet,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (buka)
          for (final (i, l) in _langkah.indexed) _barisLangkah(i, l),
      ],
    ];
  }

  Widget _rencana() {
    Widget baris({
      required String key,
      required String label,
      required Widget titik,
      Tempat? t,
      required String kosong,
    }) {
      final sorot = target == key && key == 'dari';
      return Row(
        children: [
          SizedBox(width: 16, child: Center(child: titik)),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Container(
              padding: EdgeInsets.symmetric(
                vertical: AppSizes.s2,
                horizontal: sorot ? AppSizes.s2 : 0,
              ),
              decoration: sorot
                  ? BoxDecoration(
                      color: AppColors.lilacWash.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(12),
                    )
                  : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: sans(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.ink.withValues(alpha: 0.55),
                    ),
                  ),
                  if (t != null) ...[
                    Text(
                      t.nama,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sans(size: 15, weight: FontWeight.w600),
                    ),
                    if (t.alamat.isNotEmpty)
                      Text(
                        t.alamat,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: sans(size: 12, color: _muted),
                      ),
                  ] else
                    Text(
                      kosong,
                      style: sans(size: 14, color: _muted, height: 1.35),
                    ),
                ],
              ),
            ),
          ),
          TextButton(
            onPressed: () =>
                _gantiTarget(target == key && key == 'dari' ? 'ke' : key),
            child: Semantics(
              label: 'Ganti titik ${label.toLowerCase()}',
              excludeSemantics: true,
              child: const Text('Ganti'),
            ),
          ),
        ],
      );
    }

    return Stack(
      children: [
        Positioned(
          left: 7,
          top: 28,
          bottom: 28,
          child: Container(
            width: 2,
            color: AppColors.inkViolet.withValues(alpha: 0.25),
          ),
        ),
        Column(
          children: [
            baris(
              key: 'dari',
              label: 'Dari',
              t: dari,
              kosong: _teksLokasi[lokasiStatus] ?? _teksLokasi['tidak']!,
              titik: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.inkViolet, width: 3),
                ),
              ),
            ),
            baris(
              key: 'ke',
              label: 'Ke',
              t: ke,
              kosong: 'Belum dipilih',
              titik: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: AppColors.trafficMacet,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.trafficMacet.withValues(alpha: 0.25),
                    width: 3,
                    strokeAlign: BorderSide.strokeAlignOutside,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _barisLangkah(int i, Map l) {
    final teks = (l['teks'] ?? '').toString();
    final jarak = l['jarakM'] as num? ?? 0;
    return InkWell(
      onTap: () => setPlay(i),
      borderRadius: BorderRadius.circular(12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: AppSizes.touch),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.lilacWash.withValues(alpha: 0.45),
                child: Icon(
                  ikonLangkah(teks),
                  size: 18,
                  color: AppColors.inkViolet,
                ),
              ),
              const SizedBox(width: AppSizes.s3),
              Expanded(child: Text(teks, style: sans(size: 15, height: 1.35))),
              if (jarak > 0)
                Text(formatJarak(jarak), style: sans(size: 14, color: _muted)),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _panduan(Map r) {
    final langkah = _langkah;
    final i = play!.clamp(0, langkah.length - 1);
    final l = langkah[i];
    final teks = (l['teks'] ?? '').toString();
    final jarak = l['jarakM'] as num? ?? 0;
    final terakhir = i == langkah.length - 1;
    return [
      Row(
        children: [
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                'Langkah ${i + 1} dari ${langkah.length}',
                style: sans(size: 14, weight: FontWeight.w600, color: _muted),
              ),
            ),
          ),
          TextButton.icon(
            onPressed: () => setPlay(null),
            icon: const Icon(Icons.close_rounded, size: 18),
            label: const Text('Selesai'),
          ),
        ],
      ),
      const SizedBox(height: AppSizes.s2),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: AppGradients.pill,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppColors.pillDeepVia.withValues(alpha: 0.6),
                  blurRadius: 18,
                  spreadRadius: -8,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Icon(ikonLangkah(teks), size: 30, color: AppColors.white),
          ),
          const SizedBox(width: AppSizes.s4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(teks, style: titleSerif(size: 24)),
                if (!terakhir && jarak > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSizes.s1),
                    child: Text(
                      'Lalu ikuti jalan ${formatJarak(jarak)}',
                      style: sans(size: 15, color: _muted),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      _gap,
      ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          height: 6,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: AppColors.ink.withValues(alpha: 0.08)),
              FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: (i + 1) / langkah.length,
                child: const DecoratedBox(
                  decoration: BoxDecoration(gradient: AppGradients.pill),
                ),
              ),
            ],
          ),
        ),
      ),
      _gap,
      Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: i == 0 ? null : () => setPlay(i - 1),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(AppSizes.touch),
                foregroundColor: AppColors.inkViolet,
                backgroundColor: AppColors.search,
                side: BorderSide(color: AppColors.ink.withValues(alpha: 0.06)),
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              icon: const Icon(Icons.chevron_left_rounded),
              label: const Text('Sebelumnya'),
            ),
          ),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: FilledButton(
              onPressed: () => setPlay(terakhir ? null : i + 1),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(AppSizes.touch),
                backgroundColor: AppColors.loginButton,
                shape: const StadiumBorder(),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(terakhir ? 'Selesai' : 'Berikutnya'),
                  if (!terakhir) const Icon(Icons.chevron_right_rounded),
                ],
              ),
            ),
          ),
        ],
      ),
      if (_fotoStatus != 'mati') ...[_gap, _fotoJalan()],
    ];
  }

  /// Foto jalan Mapillary (Keputusan #5).
  Widget _fotoJalan() {
    final f = _foto;
    Widget isi;
    switch (_fotoStatus) {
      case 'memuat':
        isi = const AspectRatio(aspectRatio: 16 / 10, child: _Tulang());
      case 'galat':
        isi = ErrorBanner(error: _fotoGalat, onRetry: _muatFoto);
      case 'ada' when f != null:
        isi = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: Image.network(
                  f['url'].toString(),
                  fit: BoxFit.cover,
                  semanticLabel: 'Foto jalan sekitar titik ini',
                  loadingBuilder: (c, child, p) =>
                      p == null ? child : const _Tulang(),
                  errorBuilder: (c, e, s) => ColoredBox(
                    color: AppColors.search,
                    child: Center(
                      child: Text(
                        'Foto belum bisa dimuat',
                        style: sans(size: 14, color: _muted),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSizes.s2),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '±${formatJarak(f['jarakM'] as num? ?? 0)} dari titik, ${tanggalFoto(f['diambil']?.toString())}\n'
                    '© Mapillary${f['pengunggah'] != null ? ', ${f['pengunggah']}' : ''} (CC BY-SA)',
                    style: sans(size: 12, color: _muted, height: 1.35),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(f['halaman'].toString()),
                    mode: LaunchMode.externalApplication,
                  ),
                  iconAlignment: IconAlignment.end,
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: const Text('Buka'),
                ),
              ],
            ),
          ],
        );
      default:
        isi = Container(
          padding: const EdgeInsets.all(AppSizes.s4),
          decoration: BoxDecoration(
            color: AppColors.search,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Icon(Icons.image_not_supported_outlined, color: _muted),
              const SizedBox(width: AppSizes.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Belum ada foto jalan di sini',
                      style: sans(size: 15, weight: FontWeight.w600),
                    ),
                    Text(
                      'Coba titik lain, mis. langkah berikutnya saat Play.',
                      style: sans(size: 14, color: _muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Street view',
                style: sans(size: 15, weight: FontWeight.w700),
              ),
            ),
            IconButton(
              tooltip: 'Tutup Street view',
              onPressed: () => _ubahLapisan({...lapisan}..remove('street')),
              icon: const Icon(Icons.close_rounded, size: 20),
            ),
          ],
        ),
        isi,
      ],
    );
  }
}

class _PilihModa extends StatelessWidget {
  const _PilihModa({required this.mode, required this.onMode});

  final Moda mode;
  final ValueChanged<Moda> onMode;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSizes.s1),
      decoration: ShapeDecoration(
        color: AppColors.search,
        shape: StadiumBorder(
          side: BorderSide(color: AppColors.ink.withValues(alpha: 0.06)),
        ),
      ),
      child: Row(
        children: [
          for (final m in Moda.values)
            Expanded(
              child: Semantics(
                inMutuallyExclusiveGroup: true,
                checked: m == mode,
                child: _SegmenModa(
                  moda: m,
                  aktif: m == mode,
                  onTap: () => onMode(m),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SegmenModa extends StatelessWidget {
  const _SegmenModa({
    required this.moda,
    required this.aktif,
    required this.onTap,
  });

  final Moda moda;
  final bool aktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = aktif ? AppColors.white : AppColors.inkViolet;
    return Material(
      type: MaterialType.transparency,
      child: Ink(
        height: 44,
        decoration: ShapeDecoration(
          gradient: aktif ? AppGradients.pill : null,
          shape: const StadiumBorder(),
        ),
        child: InkWell(
          onTap: onTap,
          customBorder: const StadiumBorder(),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(moda.icon, size: 18, color: fg),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  moda.label,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: sans(
                    size: 13,
                    color: fg,
                    weight: aktif ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HasilCari extends StatelessWidget {
  const _HasilCari({
    required this.hasil,
    required this.onPilih,
    required this.onTutup,
  });

  final ({String status, List<Tempat> items, Object? error}) hasil;
  final ValueChanged<Tempat> onPilih;
  final VoidCallback onTutup;

  @override
  Widget build(BuildContext context) {
    final muted = AppColors.ink.withValues(alpha: 0.65);
    Widget isi;
    if (hasil.status == 'memuat') {
      isi = Padding(
        padding: const EdgeInsets.all(AppSizes.s3),
        child: Row(
          children: [
            const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: AppSizes.s2),
            Text('Mencari tempat…', style: sans(size: 14, color: muted)),
          ],
        ),
      );
    } else if (hasil.status == 'galat') {
      isi = ErrorBanner(error: hasil.error, onDismiss: onTutup);
    } else if (hasil.items.isEmpty) {
      isi = Padding(
        padding: const EdgeInsets.all(AppSizes.s3),
        child: Text(
          'Tempat tidak ditemukan di Medan dan sekitarnya. Coba nama lain atau ketuk peta.',
          style: sans(size: 14, color: muted, height: 1.4),
        ),
      );
    } else {
      isi = ListView(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        children: [
          for (final t in hasil.items)
            ListTile(
              onTap: () => onPilih(t),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              leading: CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.lilacWash.withValues(alpha: 0.45),
                child: const Icon(
                  Icons.place_outlined,
                  size: 18,
                  color: AppColors.inkViolet,
                ),
              ),
              title: Text(
                t.nama,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: sans(size: 15, weight: FontWeight.w600),
              ),
              subtitle: t.alamat.isEmpty
                  ? null
                  : Text(
                      t.alamat,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sans(size: 12, color: muted),
                    ),
            ),
        ],
      );
    }
    return Material(
      color: AppColors.white,
      elevation: 10,
      shadowColor: AppColors.inkViolet.withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(24),
      child: Padding(padding: const EdgeInsets.all(AppSizes.s2), child: isi),
    );
  }
}

class _Toast extends StatelessWidget {
  const _Toast({required this.teks});
  final String teks;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: ShapeDecoration(
          color: AppColors.inkViolet,
          shape: const StadiumBorder(),
          shadows: [
            BoxShadow(
              color: AppColors.inkViolet.withValues(alpha: 0.6),
              blurRadius: 20,
              spreadRadius: -8,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Text(
          teks,
          textAlign: TextAlign.center,
          style: sans(
            size: 14,
            weight: FontWeight.w600,
            color: AppColors.white,
          ),
        ),
      ),
    );
  }
}

/// Kerangka abu saat memuat.
class _Tulang extends StatelessWidget {
  const _Tulang({this.width, this.height});
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: AppColors.ink.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(12),
    ),
  );
}

enum _Slot { map, sheet, toast, bar, header, results }

/// Header di atas, bar aksi di bawah, peta diselipkan 28 dp di bawah keduanya,
/// lembar bawah menempel di atas bar (ikut terselip di bawah sudutnya).
class _NavLayout extends MultiChildLayoutDelegate {
  static const _tuck = 28.0;

  @override
  void performLayout(Size size) {
    final w = size.width;
    final hh = layoutChild(
      _Slot.header,
      BoxConstraints(minWidth: w, maxWidth: w, maxHeight: size.height),
    ).height;
    final bh = layoutChild(
      _Slot.bar,
      BoxConstraints(minWidth: w, maxWidth: w, maxHeight: size.height),
    ).height;
    positionChild(_Slot.header, Offset.zero);
    positionChild(_Slot.bar, Offset(0, size.height - bh));

    final mapTop = hh - _tuck;
    final mapH = math.max(0.0, size.height - bh + _tuck - mapTop);
    layoutChild(_Slot.map, BoxConstraints.tight(Size(w, mapH)));
    positionChild(_Slot.map, Offset(0, mapTop));

    final tersedia = math.max(0.0, size.height - bh - hh);
    if (hasChild(_Slot.sheet)) {
      final s = layoutChild(
        _Slot.sheet,
        BoxConstraints(
          minWidth: w,
          maxWidth: w,
          maxHeight: tersedia * 0.62 + _tuck,
        ),
      );
      positionChild(
        _Slot.sheet,
        Offset(0, size.height - bh + _tuck - s.height),
      );
    }
    if (hasChild(_Slot.toast)) {
      final s = layoutChild(_Slot.toast, BoxConstraints(maxWidth: w - 32));
      positionChild(_Slot.toast, Offset((w - s.width) / 2, hh + 12));
    }
    if (hasChild(_Slot.results)) {
      layoutChild(
        _Slot.results,
        BoxConstraints(
          minWidth: w - 32,
          maxWidth: w - 32,
          maxHeight: tersedia * 0.75,
        ),
      );
      positionChild(_Slot.results, Offset(16, hh + 4));
    }
  }

  @override
  bool shouldRelayout(_NavLayout oldDelegate) => false;
}
