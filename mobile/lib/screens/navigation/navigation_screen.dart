import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../i18n.dart';
import '../../lalulintas.dart';
import '../../navigasi.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../transit.dart';
import '../../widgets/map_screen.dart';
import '../../widgets/widgets.dart';
import '../traffic/traffic_layers.dart';
import 'transit_sheet.dart';

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

/// Buka lembar bagikan sistem Android (share_plus).
Future<void> bagikanSistem(String teks, String judul) =>
    SharePlus.instance.share(ShareParams(text: teks, subject: judul));

Map<String, String> get _teksLokasi => {
  'mencari': tr('Mencari lokasimu…'),
  'ditolak': tr(
    'Izin lokasi ditolak. Ketuk Ganti, lalu cari alamat atau ketuk peta.',
  ),
  'luar': tr('Lokasimu di luar Medan. Ketuk Ganti untuk memilih titik asal.'),
  'tidak': tr('Ketuk Ganti, lalu cari alamat atau ketuk peta.'),
};

/// Smart Navigation (mockup hal. 4, PRD §6.1): cari tujuan, pilih moda, rute di
/// peta, ringkasan & langkah di lembar bawah, Play (panduan langkah), Share,
/// Street view (foto Mapillary). Sama dengan web `pages/Navigasi.jsx`.
/// Moda Transportasi umum (kapsul atau pilihan "Umum"): GET /routes/transit,
/// opsi + bagian berwarna di peta, Play per bagian (T-203).
class NavigationScreen extends StatefulWidget {
  const NavigationScreen({
    super.key,
    this.initialQuery,
    this.dari,
    this.ke,
    this.dariNama,
    this.keNama,
    this.mode = Moda.driving,
    this.locate = lokasiPerangkat,
    this.share = bagikanSistem,
    this.tileProvider,
  });

  /// Kata kunci dari kolom cari Beranda.
  final String? initialQuery;

  /// Titik dari Trip Planner (T-109). Tanpa [dari] = lokasi perangkat.
  final LatLng? dari;
  final LatLng? ke;

  /// Nama titik dari rencana; bila ada, tidak perlu reverse geocoding.
  final String? dariNama;
  final String? keNama;
  final Moda mode;
  final Future<LokasiHasil> Function() locate;

  /// Tombol Share: `(teks, judul)`. Bila gagal, teks disalin ke papan klip.
  final Future<void> Function(String teks, String judul) share;

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
  late Moda _modaSebelum = widget.mode == Moda.transit
      ? Moda.driving
      : widget.mode;
  int opsiIdx = 0;

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

  // Lapisan Traffic (T-205): dimuat hanya selama kapsul Traffic aktif.
  LaluLintasData? _lalin;
  StreamSubscription<MapEvent>? _gerak;
  Timer? _jeda;

  void _aturTraffic(bool on) {
    if (!on) {
      _lalin?.berhenti();
      return;
    }
    final d = _lalin ??= LaluLintasData(_api)..addListener(() => _set(() {}));
    d.mulai();
    if (_mapReady) d.aturArea(_map.camera.visibleBounds);
    _gerak ??= _mapReady
        ? _map.mapEventStream.listen((_) {
            _jeda?.cancel();
            _jeda = Timer(const Duration(milliseconds: 350), () {
              if (mounted && lapisan.contains('traffic')) {
                _lalin?.aturArea(_map.camera.visibleBounds);
              }
            });
          })
        : null;
  }

  @override
  void initState() {
    super.initState();
    _query.text = widget.initialQuery ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) => _mulai());
  }

  @override
  void dispose() {
    _gerak?.cancel();
    _jeda?.cancel();
    _lalin?.dispose();
    _pesanTimer?.cancel();
    _query.dispose();
    _map.dispose();
    super.dispose();
  }

  Future<void> _mulai() async {
    final pKe = widget.ke;
    if (pKe != null && dalamWilayah(pKe)) {
      unawaited(
        _namaTitik(pKe, widget.keNama).then((t) {
          _set(() {
            ke = t;
            if (_query.text.isEmpty) _query.text = t.nama;
          });
          _hitungRute();
        }),
      );
    }
    final q = widget.initialQuery?.trim() ?? '';
    if (q.isNotEmpty) unawaited(cari(q));

    final pDari = widget.dari;
    if (pDari != null && dalamWilayah(pDari)) {
      final t = await _namaTitik(pDari, widget.dariNama);
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
        dari = Tempat(
          nama: tr('Lokasi kamu'),
          lokasi: hasil.lokasi!,
          saya: true,
        );
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
  Future<Tempat> _namaTitik(LatLng p, [String? nama]) async {
    if (nama != null && nama.trim().isNotEmpty) {
      return Tempat(nama: nama.trim(), lokasi: p);
    }
    try {
      final r = await _api.get(
        '/places/reverse',
        query: {'at': latLngQuery(p.latitude, p.longitude)},
      );
      final t = Tempat.fromJson((r as Map)['tempat'] as Map);
      return Tempat(nama: t.nama, alamat: t.alamat, lokasi: p);
    } catch (_) {
      return Tempat(nama: tr('Titik di peta'), lokasi: p);
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
          error: tr('Ketik minimal 2 huruf.'),
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
      _kabari(tr('SmartMove baru melayani Medan dan sekitarnya.'));
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
      opsiIdx = 0;
    });
    try {
      final umum = mode == Moda.transit;
      final r = await _api.get(
        umum ? '/routes/transit' : '/routes',
        query: {
          'from': latLngQuery(a.lokasi.latitude, a.lokasi.longitude),
          'to': latLngQuery(b.lokasi.latitude, b.lokasi.longitude),
          if (!umum) 'mode': mode.name,
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

  bool get _umum => mode == Moda.transit;

  List<Map> get _opsiList => _umum
      ? (rute?['opsi'] as List? ?? const []).whereType<Map>().toList()
      : const [];

  /// Opsi transit yang dipilih (null bila bukan transit / tidak ada rute).
  Map? get _opsi {
    final l = _opsiList;
    return l.isEmpty ? null : l[opsiIdx.clamp(0, l.length - 1)];
  }

  List<Map> get _bagian => bagianOpsi(_opsi);

  List<LatLng> get _garis => _umum
      ? [for (final b in _bagian) ...garisBagian(b)]
      : (rute?['garis'] as List? ?? const [])
            .map(keLatLng)
            .whereType<LatLng>()
            .toList();

  List<Map> get _langkah => _umum
      ? const []
      : (rute?['langkah'] as List? ?? const []).whereType<Map>().toList();

  /// Titik fokus Play: belokan (kendaraan pribadi) atau awal bagian (transit).
  LatLng? _titikPlay(int? i) {
    if (i == null) return null;
    if (_umum) {
      final b = _bagian;
      return i < b.length ? titikBagian(b[i], 'dari') : null;
    }
    final l = _langkah;
    return i < l.length ? keLatLng(l[i]['lokasi']) : null;
  }

  bool get _adaRute => _umum ? _opsi != null : rute != null;

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
    final l = _titikPlay(i);
    if (l != null) {
      _setelahFrame(() => _geserKe(l, math.max(_map.camera.zoom, 17)));
    }
    if (lapisan.contains('street')) _muatFoto();
  }

  void gantiModa(Moda m) {
    if (m == mode) return;
    setState(() {
      if (mode != Moda.transit) _modaSebelum = mode;
      mode = m;
      play = null;
    });
    _hitungRute();
  }

  /// Kapsul aktif; "Transportasi umum" = pintasan moda transit.
  Set<String> get _nilaiLapisan => {...lapisan, if (_umum) 'transit'};

  void _ubahLapisan(Set<String> next) {
    final baru = next.difference(_nilaiLapisan);
    final transitOn = next.contains('transit');
    if (transitOn != _umum) {
      gantiModa(transitOn ? Moda.transit : _modaSebelum);
    }
    setState(() => lapisan = next.where((v) => v != 'transit').toSet());
    _aturTraffic(lapisan.contains('traffic'));
    if (baru.contains('traffic')) {
      _kabari(
        tr(
          'Lapisan Traffic aktif: garis berwarna = kondisi jalan utama, lingkaran = laporan warga.',
        ),
      );
    }
    if (lapisan.contains('street')) {
      _muatFoto();
    } else {
      _fotoReq++;
      setState(() => _fotoStatus = 'mati');
    }
  }

  Future<void> _muatFoto() async {
    final titik = _titikPlay(play) ?? ke?.lokasi ?? _tengah;
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
    final r = rute, a = dari, b = ke, o = _opsi;
    if (r == null || a == null || b == null) return;
    if (_umum && o == null) return;
    final teks = o != null
        ? teksBagikanTransit(dari: a, ke: b, opsi: o)
        : teksBagikan(dari: a, ke: b, mode: mode, rute: r);
    try {
      await widget.share(teks, tr('Rute ke {0}', [b.nama]));
    } catch (_) {
      // Lembar bagikan tidak tersedia: salin saja.
      await Clipboard.setData(ClipboardData(text: teks));
      _kabari(tr('Rute disalin. Tempel di chat untuk membagikannya.'));
    }
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
    final adaRute = _adaRute;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: CustomMultiChildLayout(
        delegate: MapScreenLayout(),
        children: [
          LayoutId(
            id: MapSlot.map,
            child: MapView(
              tucked: true,
              controller: _map,
              tileProvider: widget.tileProvider,
              onTap: _ketukPeta,
              onMapReady: () {
                _mapReady = true;
                _fitRute();
                if (lapisan.contains('traffic')) _aturTraffic(true);
              },
              children: _lapisanPeta(),
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
                  label: tr('Rute'),
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
                  label: tr('Play'),
                  icon: Icons.play_arrow_rounded,
                  onPressed: adaRute ? () => setPlay(0) : null,
                ),
                BarAction(
                  label: tr('Share'),
                  icon: Icons.share_outlined,
                  onPressed: adaRute ? _bagikan : null,
                ),
              ],
            ),
          ),
          LayoutId(
            id: MapSlot.header,
            child: NebulaHeader(
              title: 'Smart Navigation',
              leading: canPop
                  ? IconButton(
                      tooltip: tr('Kembali'),
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    )
                  : Icon(Icons.map_outlined, color: AppColors.inkViolet),
              children: [
                SearchField(
                  controller: _query,
                  onSubmitted: cari,
                  onChanged: (v) {
                    if (v.isEmpty) setState(() => _hasil = null);
                  },
                  hint: target == 'dari'
                      ? tr('Cari titik asal')
                      : tr('Telusuri di sini'),
                  label: target == 'dari'
                      ? tr('Cari titik asal')
                      : tr('Cari tujuan'),
                ),
                PillToggle<String>(
                  multiple: true,
                  selected: _nilaiLapisan,
                  onChanged: _ubahLapisan,
                  options: [
                    PillOption(
                      'traffic',
                      tr('Traffic'),
                      icon: Icons.traffic_rounded,
                    ),
                    PillOption(
                      'transit',
                      tr('Transportasi umum'),
                      short: tr('Umum'),
                      icon: Icons.directions_bus_rounded,
                    ),
                    PillOption(
                      'street',
                      tr('Street view'),
                      icon: Icons.photo_camera_outlined,
                    ),
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
                onPilih: pilih,
                onTutup: () => setState(() => _hasil = null),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _lapisanPeta() => [
    ..._lapisanPetaIsi(),
    if (lapisan.contains('traffic'))
      Align(
        alignment: Alignment.topLeft,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 40, 12, 0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.card.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppColors.inkViolet.withValues(alpha: 0.35),
                  blurRadius: 10,
                  spreadRadius: -4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const TrafficLegend(),
          ),
        ),
      ),
  ];

  List<Widget> _lapisanPetaIsi() {
    final g = _garis;
    final fokus = _titikPlay(play);
    final lalin = lapisan.contains('traffic') ? _lalin : null;
    return [
      if (lalin != null)
        ...lapisanLaluLintas(
          koridor: lalin.koridor,
          laporan: lalin.laporan,
          redup: _adaRute,
        ),
      if (_umum) ..._lapisanTransit(),
      if (!_umum && g.length > 1)
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

  /// Jalan kaki titik-titik ink-violet; tiap kendaraan garis berwarna sendiri
  /// (warnaNaik, sama dengan rel di lembar) + titik naik/turun.
  List<Widget> _lapisanTransit() {
    final bagian = _bagian;
    if (bagian.isEmpty) return const [];
    final urut = indeksNaik(bagian);
    return [
      PolylineLayer(
        polylines: [
          for (final b in bagian)
            if (b['jenis'] == 'jalan')
              Polyline(
                points: garisBagian(b),
                strokeWidth: 5,
                color: warnaJalan,
                pattern: const StrokePattern.dotted(spacingFactor: 2),
                strokeCap: StrokeCap.round,
              ),
          for (final (i, b) in bagian.indexed)
            if (b['jenis'] == 'naik')
              Polyline(
                points: garisBagian(b),
                strokeWidth: 6,
                color: warnaNaik(urut[i]!),
                borderStrokeWidth: 2,
                borderColor: AppColors.white,
                strokeCap: StrokeCap.round,
                strokeJoin: StrokeJoin.round,
              ),
        ],
      ),
      MarkerLayer(
        markers: [
          for (final (i, b) in bagian.indexed)
            if (b['jenis'] == 'naik')
              for (final t in [titikBagian(b, 'dari'), titikBagian(b, 'ke')])
                if (t != null)
                  Marker(
                    point: t,
                    width: 14,
                    height: 14,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: warnaNaik(urut[i]!),
                          width: 3.5,
                        ),
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
    final o = _opsi;
    final isi = play != null && _umum && o != null
        ? [
            TransitPanduan(
              opsi: o,
              idx: play!.clamp(0, _bagian.length - 1),
              onPlay: setPlay,
            ),
            if (_fotoStatus != 'mati') ...[_gap, _fotoJalan()],
          ]
        : play != null && !_umum && r != null
        ? _panduan(r)
        : _ringkasan();
    return DecoratedBox(
      key: _lembarKey,
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
                  tr('Pilih titik asal: cari alamat di atas atau ketuk peta.'),
                  style: sans(size: 14, height: 1.35),
                ),
              ),
              TextButton(
                onPressed: () => _gantiTarget('ke'),
                child: Text(tr('Batal')),
              ),
            ],
          ),
        ),
        _gap,
      ],
      if (ke == null) ...[
        Semantics(
          header: true,
          child: Text(tr('Mau ke mana?'), style: titleSerif(size: 26)),
        ),
        const SizedBox(height: AppSizes.s1),
        Text(
          tr('Cari tempat di kolom atas atau ketuk peta untuk memilih tujuan.'),
          style: sans(size: 15, color: _muted, height: 1.45),
        ),
      ] else if (_umum)
        const SizedBox.shrink()
      else if (_galatRute != null)
        ErrorBanner(error: _galatRute, onRetry: _hitungRute)
      else if (r == null || _memuatRute)
        Semantics(
          label: tr('Menghitung rute'),
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
          tr('Perkiraan waktu tanpa macet.'),
          style: sans(size: 14, color: _muted),
        ),
      ],
      if (ke != null) ...[
        _gap,
        _PilihModa(mode: mode, onMode: gantiModa),
        if (_umum) ...[
          _gap,
          TransitRingkasan(
            data: rute,
            memuat: _memuatRute,
            galat: _galatRute,
            onRetry: _hitungRute,
            idx: opsiIdx,
            onIdx: (i) {
              setState(() {
                opsiIdx = i;
                play = null;
              });
              _setelahFrame(_fitRute);
            },
          ),
        ],
      ],
      if (_fotoStatus != 'mati') ...[_gap, _fotoJalan()],
      _gap,
      _rencana(),
      if (r != null && !_umum) ...[
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
                    tr('{0} langkah', [_langkah.length]),
                    style: sans(size: 15, weight: FontWeight.w700),
                  ),
                ),
                Text(
                  buka ? tr('Sembunyikan') : tr('Lihat semua'),
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
              label: tr('Ganti titik {0}', [label.toLowerCase()]),
              excludeSemantics: true,
              child: Text(tr('Ganti')),
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
              label: tr('Dari'),
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
              label: tr('Ke'),
              t: ke,
              kosong: tr('Belum dipilih'),
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
                tr('Langkah {0} dari {1}', [i + 1, langkah.length]),
                style: sans(size: 14, weight: FontWeight.w600, color: _muted),
              ),
            ),
          ),
          TextButton.icon(
            onPressed: () => setPlay(null),
            icon: const Icon(Icons.close_rounded, size: 18),
            label: Text(tr('Selesai')),
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
                      tr('Lalu ikuti jalan {0}', [formatJarak(jarak)]),
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
              label: Text(tr('Sebelumnya')),
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
                  Text(terakhir ? tr('Selesai') : tr('Berikutnya')),
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
                  semanticLabel: tr('Foto jalan sekitar titik ini'),
                  loadingBuilder: (c, child, p) =>
                      p == null ? child : const _Tulang(),
                  errorBuilder: (c, e, s) => ColoredBox(
                    color: AppColors.search,
                    child: Center(
                      child: Text(
                        tr('Foto belum bisa dimuat'),
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
                    '${tr('±{0} dari titik, {1}', [formatJarak(f['jarakM'] as num? ?? 0), tanggalFoto(f['diambil']?.toString())])}\n'
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
                  label: Text(tr('Buka')),
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
                      tr('Belum ada foto jalan di sini'),
                      style: sans(size: 15, weight: FontWeight.w600),
                    ),
                    Text(
                      tr('Coba titik lain, mis. langkah berikutnya saat Play.'),
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
                tr('Street view'),
                style: sans(size: 15, weight: FontWeight.w700),
              ),
            ),
            IconButton(
              tooltip: tr('Tutup Street view'),
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
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
        height: 52,
        decoration: BoxDecoration(
          gradient: aktif ? AppGradients.pill : null,
          borderRadius: BorderRadius.circular(16),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(moda.icon, size: 18, color: fg),
              const SizedBox(height: 2),
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
