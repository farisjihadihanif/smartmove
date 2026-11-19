import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../pembayaran.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../trip.dart';
import '../../widgets/widgets.dart';
import '../../wib.dart';
import '../navigation/navigation_screen.dart';
import '../payment/payment_screen.dart';
import 'trip_form.dart';

/// Trip Planner (DESIGN §3, gaya kartu Trip Planner mockup hal. 3): rencana
/// berikutnya di kartu gradasi pink → ungu, daftar per hari seperti garis
/// waktu, form di lembar bawah. Sama dengan web `TripPlanner.jsx`.
class TripPlannerScreen extends StatefulWidget {
  const TripPlannerScreen({
    super.key,
    this.locate = lokasiPerangkat,
    this.clock = DateTime.now,
    this.mulai,
  });

  /// Lokasi perangkat untuk "Pakai lokasi saat ini" di form.
  final Future<LokasiHasil> Function() locate;
  final DateTime Function() clock;

  /// Tombol "Mulai navigasi"; bawaan membuka Smart Navigation.
  final void Function(BuildContext context, Trip trip)? mulai;

  @override
  State<TripPlannerScreen> createState() => TripPlannerScreenState();
}

class TripPlannerScreenState extends State<TripPlannerScreen> {
  static const _halaman = 50;

  List<Trip> items = [];
  int _total = 0;
  int _page = 0;
  String status = 'memuat'; // memuat | ok | galat | menambah
  Object? _error;
  bool _lewatTerbuka = false;
  late DateTime _now = widget.clock();
  Timer? _tick;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = widget.clock());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _muat(1));
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _muat(int page) async {
    setState(() {
      status = page == 1 && items.isEmpty ? 'memuat' : 'menambah';
      _error = null;
    });
    try {
      final r = await _api.get(
        '/trips',
        query: {'page': page, 'limit': _halaman},
      ) as Map;
      final baru = (r['items'] as List)
          .whereType<Map>()
          .map(Trip.fromJson)
          .toList();
      if (!mounted) return;
      setState(() {
        items = page == 1
            ? baru
            : [...items, ...baru.where((t) => !items.any((x) => x.id == t.id))];
        _total = (r['total'] as num?)?.toInt() ?? items.length;
        _page = page;
        status = 'ok';
        _now = widget.clock();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        status = items.isEmpty ? 'galat' : 'ok';
      });
    }
  }

  void _kabari(String teks) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(teks)));
  }

  Future<void> _bukaForm([Trip? awal]) async {
    final hasil = await showTripForm(
      context,
      awal: awal,
      locate: widget.locate,
      onSimpan: (body) async {
        final r = awal == null
            ? await _api.post('/trips', body)
            : await _api.patch('/trips/${awal.id}', body);
        return Trip.fromJson((r as Map)['trip'] as Map);
      },
    );
    if (hasil == null || !mounted) return;
    setState(() {
      if (awal == null) {
        items = [hasil, ...items];
        _total++;
      } else {
        items = [for (final t in items) t.id == hasil.id ? hasil : t];
      }
    });
    _kabari(awal == null ? 'Rencana disimpan.' : 'Perubahan disimpan.');
  }

  Future<void> _hapus(Trip trip) async {
    final ya = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Hapus rencana ini?', style: titleSerif(size: 20)),
        content: Text(
          'Rencana ke ${trip.tujuan.nama} akan dihapus.',
          style: sans(size: 15),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.trafficMacet,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (ya != true || !mounted) return;
    try {
      await _api.delete('/trips/${trip.id}');
      if (!mounted) return;
      setState(() {
        items = items.where((t) => t.id != trip.id).toList();
        _total = (_total - 1).clamp(0, 1 << 30);
      });
      _kabari('Rencana dihapus.');
    } on ApiException catch (e) {
      _kabari(e.message);
    }
  }

  void _mulai(Trip trip) {
    final m = widget.mulai;
    if (m != null) return m(context, trip);
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NavigationScreen(
          dari: trip.asal.lokasi,
          ke: trip.tujuan.lokasi,
          dariNama: trip.asal.nama,
          keNama: trip.tujuan.nama,
          mode: trip.moda.navigasi,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final k = kelompokkan(items, _now);
    final kosong = status == 'ok' && items.isEmpty;

    return Scaffold(
      floatingActionButton: status == 'memuat' || items.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: _bukaForm,
              backgroundColor: AppColors.loginButton,
              foregroundColor: AppColors.white,
              shape: const StadiumBorder(),
              icon: const Icon(Icons.add_rounded),
              label: Text(
                'Buat rencana',
                style: sans(
                  size: 15,
                  weight: FontWeight.w600,
                  color: AppColors.white,
                ),
              ),
            ),
      body: RefreshIndicator(
        onRefresh: () => _muat(1),
        color: AppColors.loginButton,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            NebulaHeader(
              title: 'Trip Planner',
              leading: canPop
                  ? IconButton(
                      tooltip: 'Kembali',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    )
                  : null,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.s4,
                AppSizes.s4 + AppSizes.s1,
                AppSizes.s4,
                96,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (status == 'memuat')
                    const _KartuMemuat()
                  else
                    _Sorotan(
                      trip: k.berikutnya,
                      now: _now,
                      onBuat: _bukaForm,
                      onMulai: _mulai,
                    ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSizes.s4),
                    ErrorBanner(
                      error: _error,
                      onRetry: () => _muat(items.isEmpty ? 1 : _page + 1),
                    ),
                  ],
                  if (kosong)
                    const EmptyState(
                      icon: Icons.event_note_rounded,
                      title: 'Belum ada rencana',
                      message: 'Simpan rute yang sering kamu tempuh, misalnya rumah ke kampus, lalu mulai navigasi dengan sekali ketuk.',
                    ),
                  if (k.grup.isNotEmpty) ...[
                    const SizedBox(height: AppSizes.s8),
                    Text('Rencanamu', style: titleSerif(size: 24)),
                    for (final g in k.grup) ...[
                      const SizedBox(height: AppSizes.s4),
                      Text(
                        g.judul,
                        style: sans(
                          size: 14,
                          weight: FontWeight.w700,
                          color: AppColors.inkViolet,
                        ),
                      ),
                      for (final (i, t) in g.items.indexed)
                        _ItemRencana(
                          trip: t,
                          garis: i < g.items.length - 1,
                          onMulai: () => _mulai(t),
                          onUbah: () => _bukaForm(t),
                          onHapus: () => _hapus(t),
                        ),
                    ],
                  ],
                  if (k.lewat.isNotEmpty) ...[
                    const SizedBox(height: AppSizes.s6),
                    _Lewat(
                      jumlah: k.lewat.length,
                      terbuka: _lewatTerbuka,
                      onToggle: () =>
                          setState(() => _lewatTerbuka = !_lewatTerbuka),
                      children: [
                        for (final (i, t) in k.lewat.indexed)
                          _ItemRencana(
                            trip: t,
                            lewat: true,
                            now: _now,
                            garis: i < k.lewat.length - 1,
                            onMulai: () => _mulai(t),
                            onUbah: () => _bukaForm(t),
                            onHapus: () => _hapus(t),
                          ),
                      ],
                    ),
                  ],
                  if (items.length < _total && status != 'memuat') ...[
                    const SizedBox(height: AppSizes.s4),
                    Center(
                      child: OutlinedButton(
                        onPressed: status == 'menambah'
                            ? null
                            : () => _muat(_page + 1),
                        child: Text(
                          status == 'menambah'
                              ? 'Memuat…'
                              : 'Muat rencana lainnya',
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _bayangTeks = [
  Shadow(color: Color(0x5941396F), blurRadius: 2, offset: Offset(0, 1)),
];

BoxDecoration _kartuGradasi() => BoxDecoration(
  gradient: AppGradients.tripCard,
  borderRadius: BorderRadius.circular(28),
  boxShadow: [
    BoxShadow(
      color: AppColors.trip4.withValues(alpha: 0.9),
      blurRadius: 30,
      spreadRadius: -16,
      offset: const Offset(0, 14),
    ),
  ],
);

class _KartuMemuat extends StatelessWidget {
  const _KartuMemuat();

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Memuat rencana',
    child: Container(
      height: 220,
      decoration: _kartuGradasi().copyWith(
        gradient: LinearGradient(
          colors: [
            AppColors.trip1.withValues(alpha: 0.5),
            AppColors.trip4.withValues(alpha: 0.5),
          ],
        ),
      ),
    ),
  );
}

/// Digital Payment untuk rencana ini (T-302): tiket (umum) atau parkir (mobil/motor).
void _pesan(BuildContext context, Trip t) {
  final q = pesananDariTrip(t);
  if (q == null) return;
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => PaymentScreen(
        asal: q.asal,
        tujuan: q.tujuan,
        tanggal: q.tanggal,
        jenis: q.jenis,
      ),
    ),
  );
}

String _labelPesan(Trip t) =>
    t.moda == ModaTrip.transit ? 'Pesan tiket' : 'Pesan parkir';

/// Kartu gradasi: rencana terdekat, atau ajakan membuat rencana.
class _Sorotan extends StatelessWidget {
  const _Sorotan({
    required this.trip,
    required this.now,
    required this.onBuat,
    required this.onMulai,
  });

  final Trip? trip;
  final DateTime now;
  final VoidCallback onBuat;
  final void Function(Trip) onMulai;

  @override
  Widget build(BuildContext context) {
    final t = trip;
    if (t == null) {
      return Container(
        decoration: _kartuGradasi(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Mau ke mana berikutnya?',
              style: titleSerif(
                size: 28,
                color: AppColors.white,
              ).copyWith(shadows: _bayangTeks),
            ),
            const SizedBox(height: AppSizes.s2),
            Text(
              'Buat perencanaan terbaik untuk setiap perjalananmu.',
              style: titleSerif(
                size: 15,
                color: AppColors.white,
              ).copyWith(height: 1.3, shadows: _bayangTeks),
            ),
            const SizedBox(height: AppSizes.s4 + AppSizes.s1),
            _TombolPutih(
              icon: Icons.add_rounded,
              label: 'Buat rencana',
              onPressed: onBuat,
            ),
          ],
        ),
      );
    }

    final ringkas = teksRingkasan(t.ringkasan, t.moda);
    final hari = hariWib(t.berangkatPada!, now);
    return Semantics(
      container: true,
      label: 'Perjalanan berikutnya',
      child: Container(
        decoration: _kartuGradasi(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.judul == null ? hari : '$hari, ${t.judul}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: titleSerif(
                          size: 15,
                          color: AppColors.white,
                        ).copyWith(shadows: _bayangTeks),
                      ),
                      Text(
                        jamWib(t.berangkatPada!),
                        style: titleSerif(
                          size: 56,
                          color: AppColors.white,
                        ).copyWith(height: 1.05, shadows: _bayangTeks),
                      ),
                      const SizedBox(height: AppSizes.s1),
                      Text(
                        hitungMundur(t.berangkatPada!, now),
                        style: sans(
                          size: 14,
                          weight: FontWeight.w600,
                          color: AppColors.white,
                        ).copyWith(shadows: _bayangTeks),
                      ),
                    ],
                  ),
                ),
                _ChipModa(moda: t.moda, terang: true),
              ],
            ),
            const SizedBox(height: AppSizes.s4 + AppSizes.s1),
            Lintasan(asal: t.asal.nama, tujuan: t.tujuan.nama, terang: true),
            const SizedBox(height: AppSizes.s4 + AppSizes.s1),
            Wrap(
              spacing: AppSizes.s4,
              runSpacing: AppSizes.s3,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _TombolPutih(
                  icon: Icons.navigation_rounded,
                  label: 'Mulai navigasi',
                  onPressed: () => onMulai(t),
                ),
                if (pesananDariTrip(t) != null)
                  OutlinedButton.icon(
                    onPressed: () => _pesan(context, t),
                    icon: const Icon(
                      Icons.confirmation_number_outlined,
                      size: 18,
                    ),
                    label: Text(_labelPesan(t)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.white,
                      side: BorderSide(
                        color: AppColors.white.withValues(alpha: 0.6),
                      ),
                      minimumSize: const Size(0, AppSizes.touch),
                      textStyle: sans(size: 15, weight: FontWeight.w600),
                    ),
                  ),
                if (ringkas != null)
                  Text(
                    'Estimasi $ringkas',
                    style: sans(
                      size: 14,
                      weight: FontWeight.w600,
                      color: AppColors.white,
                    ).copyWith(shadows: _bayangTeks),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TombolPutih extends StatelessWidget {
  const _TombolPutih({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: onPressed,
    style: FilledButton.styleFrom(
      backgroundColor: AppColors.white,
      foregroundColor: AppColors.trip4,
      minimumSize: const Size(0, AppSizes.touch),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      shape: const StadiumBorder(),
      elevation: 0,
    ),
    icon: Icon(icon, size: 20),
    label: Text(
      label,
      style: sans(size: 15, weight: FontWeight.w600, color: AppColors.trip4),
    ),
  );
}

class _ChipModa extends StatelessWidget {
  const _ChipModa({required this.moda, this.terang = false});
  final ModaTrip moda;
  final bool terang;

  @override
  Widget build(BuildContext context) {
    final warna = terang ? AppColors.white : AppColors.inkViolet;
    final isi = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(moda.icon, size: 16, color: warna),
        const SizedBox(width: 6),
        Text(
          moda.label,
          style: sans(size: 13, weight: FontWeight.w600, color: warna),
        ),
      ],
    );
    if (!terang) return isi;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: isi,
    );
  }
}

/// Asal (lingkaran) ke tujuan (titik penuh), dihubungkan garis seperti rute.
class Lintasan extends StatelessWidget {
  const Lintasan({
    super.key,
    required this.asal,
    required this.tujuan,
    this.terang = false,
  });

  final String asal;
  final String tujuan;
  final bool terang;

  @override
  Widget build(BuildContext context) {
    final garis = terang
        ? AppColors.white.withValues(alpha: 0.6)
        : AppColors.inkViolet.withValues(alpha: 0.35);
    return Semantics(
      label: 'Dari $asal ke $tujuan',
      excludeSemantics: true,
      child: Stack(
        children: [
          Positioned(
            left: 5,
            top: 14,
            bottom: 14,
            child: Container(width: 2, color: garis),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: terang ? AppColors.trip2 : AppColors.white,
                      border: Border.all(
                        width: 2.5,
                        color: terang ? AppColors.white : AppColors.inkViolet,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSizes.s3),
                  Expanded(
                    child: Text(
                      asal,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sans(
                        size: 15,
                        color: terang
                            ? AppColors.white.withValues(alpha: 0.9)
                            : AppColors.ink.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSizes.s2),
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: terang ? AppColors.white : AppColors.pillVia,
                      boxShadow: [
                        BoxShadow(
                          color: (terang ? AppColors.white : AppColors.pillVia)
                              .withValues(alpha: 0.2),
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSizes.s3),
                  Expanded(
                    child: Text(
                      tujuan,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sans(
                        size: 17,
                        weight: FontWeight.w600,
                        color: terang ? AppColors.white : AppColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ItemRencana extends StatelessWidget {
  const _ItemRencana({
    required this.trip,
    required this.onMulai,
    required this.onUbah,
    required this.onHapus,
    this.garis = true,
    this.lewat = false,
    this.now,
  });

  final Trip trip;
  final VoidCallback onMulai;
  final VoidCallback onUbah;
  final VoidCallback onHapus;
  final bool garis;
  final bool lewat;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final b = trip.berangkatPada;
    final ringkas = teksRingkasan(trip.ringkasan, trip.moda);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.s4),
      decoration: BoxDecoration(
        border: garis
            ? Border(
                bottom: BorderSide(
                  color: AppColors.ink.withValues(alpha: 0.07),
                ),
              )
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 60,
            child: b == null
                ? Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Tanpa jam',
                      style: sans(
                        size: 12,
                        weight: FontWeight.w600,
                        color: AppColors.ink.withValues(alpha: 0.5),
                      ),
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(jamWib(b), style: titleSerif(size: 22)),
                      if (lewat && now != null)
                        Text(
                          hariWib(b, now!),
                          style: sans(
                            size: 12,
                            color: AppColors.ink.withValues(alpha: 0.55),
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(width: AppSizes.s2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (trip.judul != null) ...[
                  Text(
                    trip.judul!,
                    style: sans(
                      size: 13,
                      weight: FontWeight.w700,
                      color: AppColors.trip4,
                    ),
                  ),
                  const SizedBox(height: 6),
                ],
                Lintasan(asal: trip.asal.nama, tujuan: trip.tujuan.nama),
                const SizedBox(height: 10),
                Wrap(
                  spacing: AppSizes.s3,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _ChipModa(moda: trip.moda),
                    if (ringkas != null)
                      Text(
                        ringkas,
                        style: sans(
                          size: 13,
                          color: AppColors.ink.withValues(alpha: 0.65),
                        ),
                      ),
                    if (pesananDariTrip(trip) != null)
                      TextButton.icon(
                        onPressed: () => _pesan(context, trip),
                        icon: const Icon(
                          Icons.confirmation_number_outlined,
                          size: 18,
                        ),
                        label: Text(_labelPesan(trip)),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.inkViolet,
                          minimumSize: const Size(0, AppSizes.touch),
                          textStyle: sans(size: 13, weight: FontWeight.w600),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSizes.s3),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(child: _TombolMulai(onPressed: onMulai)),
                    const SizedBox(width: AppSizes.s2),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Ubah rencana',
                          onPressed: onUbah,
                          icon: Icon(
                            Icons.edit_outlined,
                            color: AppColors.inkViolet,
                            size: 20,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Hapus rencana',
                          onPressed: onHapus,
                          icon: Icon(
                            Icons.delete_outline_rounded,
                            color: AppColors.ink.withValues(alpha: 0.55),
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TombolMulai extends StatelessWidget {
  const _TombolMulai({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: AppGradients.pill,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onPressed,
        customBorder: const StadiumBorder(),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSizes.touch),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.s4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.navigation_rounded,
                  size: 16,
                  color: AppColors.white,
                ),
                const SizedBox(width: AppSizes.s2),
                Text(
                  'Mulai navigasi',
                  style: sans(
                    size: 14,
                    weight: FontWeight.w600,
                    color: AppColors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _Lewat extends StatelessWidget {
  const _Lewat({
    required this.jumlah,
    required this.terbuka,
    required this.onToggle,
    required this.children,
  });

  final int jumlah;
  final bool terbuka;
  final VoidCallback onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.surfaceNav,
      borderRadius: BorderRadius.circular(24),
    ),
    padding: const EdgeInsets.symmetric(horizontal: AppSizes.s4),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: onToggle,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: AppSizes.touch),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Sudah lewat ($jumlah)',
                    style: sans(
                      size: 15,
                      weight: FontWeight.w600,
                      color: AppColors.ink.withValues(alpha: 0.75),
                    ),
                  ),
                ),
                Text(
                  terbuka ? 'Sembunyikan' : 'Tampilkan',
                  style: sans(size: 14, color: AppColors.inkViolet),
                ),
              ],
            ),
          ),
        ),
        if (terbuka) Opacity(opacity: 0.8, child: Column(children: children)),
      ],
    ),
  );
}
