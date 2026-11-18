import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../navigasi.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../trip.dart';
import '../../widgets/widgets.dart';
import '../navigation/navigation_screen.dart' show LokasiHasil;

/// Lembar bawah form rencana. `onSimpan` mengirim ke API dan mengembalikan
/// rencana tersimpan; lembar tertutup dengan hasilnya. Galat tampil di form.
Future<Trip?> showTripForm(
  BuildContext context, {
  Trip? awal,
  required Future<LokasiHasil> Function() locate,
  required Future<Trip> Function(Map<String, Object?> body) onSimpan,
}) => showModalBottomSheet<Trip>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: AppColors.white,
  showDragHandle: true,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
  ),
  builder: (_) => TripForm(awal: awal, locate: locate, onSimpan: onSimpan),
);

class TripForm extends StatefulWidget {
  const TripForm({
    super.key,
    this.awal,
    required this.locate,
    required this.onSimpan,
  });

  final Trip? awal;
  final Future<LokasiHasil> Function() locate;
  final Future<Trip> Function(Map<String, Object?> body) onSimpan;

  @override
  State<TripForm> createState() => TripFormState();
}

class TripFormState extends State<TripForm> {
  late Tempat? asal = widget.awal?.asal;
  late Tempat? tujuan = widget.awal?.tujuan;
  late ModaTrip moda = widget.awal?.moda ?? ModaTrip.driving;
  DateTime? _tanggal;
  TimeOfDay? _jam;
  late final _judul = TextEditingController(text: widget.awal?.judul ?? '');

  Map<String, num>? _estimasi;
  String? _kunciEstimasi;
  bool _memuatEstimasi = false;
  bool _kirim = false;
  Object? _galat;
  bool _pesanSegera = false;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void initState() {
    super.initState();
    final b = widget.awal?.berangkatPada;
    if (b != null) {
      final w = keWib(b);
      _tanggal = w.tanggal;
      _jam = w.jam;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _hitungEstimasi());
  }

  @override
  void dispose() {
    _judul.dispose();
    super.dispose();
  }

  String? get _kunci {
    final a = asal, b = tujuan;
    if (a == null || b == null || moda.segera) return null;
    return '${a.lokasi.latitude},${a.lokasi.longitude};${b.lokasi.latitude},${b.lokasi.longitude};${moda.name}';
  }

  Future<void> _hitungEstimasi() async {
    final kunci = _kunci;
    if (kunci == _kunciEstimasi) return;
    setState(() {
      _kunciEstimasi = kunci;
      _estimasi = null;
      _memuatEstimasi = kunci != null;
    });
    if (kunci == null) return;
    try {
      final r = await _api.get(
        '/routes',
        query: {
          'from': latLngQuery(asal!.lokasi.latitude, asal!.lokasi.longitude),
          'to': latLngQuery(tujuan!.lokasi.latitude, tujuan!.lokasi.longitude),
          'mode': moda.name,
        },
      ) as Map;
      if (!mounted || _kunciEstimasi != kunci) return;
      setState(() {
        _estimasi = {
          'jarakM': r['jarakM'] as num,
          'durasiS': r['durasiS'] as num,
        };
        _memuatEstimasi = false;
      });
    } catch (_) {
      if (mounted && _kunciEstimasi == kunci) {
        setState(() => _memuatEstimasi = false);
      }
    }
  }

  void _ubah(VoidCallback fn) {
    setState(fn);
    _hitungEstimasi();
  }

  Future<void> _pilihTempat(bool isAsal) async {
    final t = await Navigator.of(context).push<Tempat>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PilihTempatScreen(
          judul: isAsal ? 'Titik asal' : 'Tujuan',
          locate: isAsal ? widget.locate : null,
          near: (isAsal ? tujuan : asal)?.lokasi,
        ),
      ),
    );
    if (t == null || !mounted) return;
    _ubah(() => isAsal ? asal = t : tujuan = t);
  }

  Future<void> _pilihTanggal() async {
    final kini = keWib(DateTime.now());
    final d = await showDatePicker(
      context: context,
      initialDate: _tanggal ?? kini.tanggal,
      firstDate: kini.tanggal.subtract(const Duration(days: 365)),
      lastDate: kini.tanggal.add(const Duration(days: 365)),
      helpText: 'Tanggal berangkat',
    );
    if (d != null) setState(() => _tanggal = d);
  }

  Future<void> _pilihJam() async {
    final j = await showTimePicker(
      context: context,
      initialTime: _jam ?? const TimeOfDay(hour: 7, minute: 0),
      helpText: 'Jam berangkat (WIB)',
      builder: (ctx, child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (j != null) setState(() => _jam = j);
  }

  Future<void> _simpan() async {
    final a = asal, b = tujuan;
    if (a == null || b == null) {
      setState(
        () => _galat = a == null ? 'Pilih titik asal.' : 'Pilih tujuan.',
      );
      return;
    }
    setState(() {
      _kirim = true;
      _galat = null;
    });
    final jam = _jam;
    final kunciAwal = widget.awal == null
        ? null
        : '${widget.awal!.asal.lokasi.latitude},${widget.awal!.asal.lokasi.longitude};${widget.awal!.tujuan.lokasi.latitude},${widget.awal!.tujuan.lokasi.longitude};${widget.awal!.moda.name}';
    final ringkasan =
        _estimasi ??
        (_kunci != null && _kunci == kunciAwal ? widget.awal!.ringkasan : null);
    try {
      final trip = await widget.onSimpan({
        'judul': _judul.text.trim().isEmpty ? null : _judul.text.trim(),
        'asal': tempatJson(a),
        'tujuan': tempatJson(b),
        'moda': moda.name,
        'berangkatPada': jam == null
            ? null
            : waktuWib(
                _tanggal ?? keWib(DateTime.now()).tanggal,
                jam,
              ).toIso8601String(),
        'ringkasan': ringkasan,
      });
      if (mounted) Navigator.of(context).pop(trip);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _kirim = false;
          _galat = e;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final edit = widget.awal != null;
    final ringkas = teksRingkasan(_estimasi);
    final label = sans(
      size: 14,
      weight: FontWeight.w600,
      color: AppColors.ink.withValues(alpha: 0.75),
    );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              edit ? 'Ubah rencana' : 'Rencana baru',
              style: titleSerif(size: 24),
            ),
            const SizedBox(height: AppSizes.s1),
            Text(
              edit
                  ? 'Perubahan langsung dipakai saat kamu mulai navigasi.'
                  : 'Pilih asal, tujuan, dan cara berangkat.',
              style: sans(
                size: 14,
                color: AppColors.ink.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: AppSizes.s6 - AppSizes.s1),
            Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      _KolomTempat(
                        label: 'Dari',
                        nilai: asal?.nama,
                        hint: 'Pilih titik asal',
                        onTap: () => _pilihTempat(true),
                      ),
                      const SizedBox(height: AppSizes.s2),
                      _KolomTempat(
                        label: 'Ke',
                        nilai: tujuan?.nama,
                        hint: 'Pilih tujuan',
                        onTap: () => _pilihTempat(false),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSizes.s2),
                IconButton.outlined(
                  tooltip: 'Tukar asal dan tujuan',
                  onPressed: () => _ubah(() {
                    final a = asal;
                    asal = tujuan;
                    tujuan = a;
                  }),
                  icon: const Icon(
                    Icons.swap_vert_rounded,
                    color: AppColors.inkViolet,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSizes.s6 - AppSizes.s1),
            Text('Naik apa?', style: label),
            const SizedBox(height: AppSizes.s2),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AppSizes.s2,
              crossAxisSpacing: AppSizes.s2,
              childAspectRatio: 2.7,
              children: [
                for (final m in ModaTrip.values)
                  _PilihanModa(
                    moda: m,
                    aktif: moda == m,
                    onTap: () => m.segera
                        ? setState(() => _pesanSegera = true)
                        : _ubah(() => moda = m),
                  ),
              ],
            ),
            if (_pesanSegera) ...[
              const SizedBox(height: AppSizes.s2),
              Text(
                'Rute transportasi umum sedang disiapkan. Untuk sekarang pilih Mobil, Motor, atau Jalan kaki.',
                style: sans(
                  size: 14,
                  color: AppColors.ink.withValues(alpha: 0.7),
                ),
              ),
            ],
            const SizedBox(height: AppSizes.s6 - AppSizes.s1),
            Text('Berangkat (WIB)', style: label),
            const SizedBox(height: AppSizes.s2),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: _KotakPilih(
                    icon: Icons.calendar_today_rounded,
                    teks: _tanggal == null
                        ? 'Hari ini'
                        : labelTanggal(_tanggal!),
                    redup: _tanggal == null,
                    onTap: _pilihTanggal,
                  ),
                ),
                const SizedBox(width: AppSizes.s2),
                Expanded(
                  flex: 2,
                  child: _KotakPilih(
                    icon: Icons.schedule_rounded,
                    teks: _jam == null ? 'Jam' : labelJam(_jam!),
                    redup: _jam == null,
                    onTap: _pilihJam,
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _jam == null
                        ? 'Kosongkan jam bila belum tahu kapan berangkat.'
                        : 'Terjadwal',
                    style: sans(
                      size: 12,
                      color: AppColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                if (_jam != null || _tanggal != null)
                  TextButton(
                    onPressed: () => setState(() {
                      _jam = null;
                      _tanggal = null;
                    }),
                    child: const Text('Kosongkan'),
                  ),
              ],
            ),
            const SizedBox(height: AppSizes.s3),
            Text('Nama rencana (opsional)', style: label),
            const SizedBox(height: AppSizes.s2),
            TextField(
              controller: _judul,
              maxLength: 100,
              decoration: InputDecoration(
                hintText: 'mis. Berangkat kuliah',
                counterText: '',
                filled: true,
                fillColor: AppColors.search,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            if (_memuatEstimasi || ringkas != null) ...[
              const SizedBox(height: AppSizes.s4),
              Text(
                _memuatEstimasi ? 'Menghitung estimasi…' : 'Estimasi $ringkas',
                style: sans(
                  size: 14,
                  weight: _memuatEstimasi ? FontWeight.w400 : FontWeight.w600,
                  color: AppColors.ink.withValues(alpha: 0.75),
                ),
              ),
            ],
            if (_galat != null) ...[
              const SizedBox(height: AppSizes.s4),
              _galat is String
                  ? ErrorBanner(message: _galat as String)
                  : ErrorBanner(error: _galat),
            ],
            const SizedBox(height: AppSizes.s6 - AppSizes.s1),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, AppSizes.touch),
                    ),
                    child: const Text('Batal'),
                  ),
                ),
                const SizedBox(width: AppSizes.s2),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: _kirim ? null : _simpan,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.loginButton,
                      minimumSize: const Size(0, AppSizes.touch),
                    ),
                    child: Text(edit ? 'Simpan perubahan' : 'Simpan rencana'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _KolomTempat extends StatelessWidget {
  const _KolomTempat({
    required this.label,
    required this.nilai,
    required this.hint,
    required this.onTap,
  });

  final String label;
  final String? nilai;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.search,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: AppSizes.touch + 4),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.s3),
          child: Row(
            children: [
              SizedBox(
                width: 40,
                child: Text(
                  label,
                  style: sans(
                    size: 13,
                    weight: FontWeight.w600,
                    color: AppColors.ink.withValues(alpha: 0.6),
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  nilai ?? hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sans(
                    size: 15,
                    weight: nilai == null ? FontWeight.w400 : FontWeight.w600,
                    color: nilai == null
                        ? AppColors.ink.withValues(alpha: 0.5)
                        : AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _PilihanModa extends StatelessWidget {
  const _PilihanModa({
    required this.moda,
    required this.aktif,
    required this.onTap,
  });

  final ModaTrip moda;
  final bool aktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final warna = aktif
        ? AppColors.white
        : moda.segera
        ? AppColors.ink.withValues(alpha: 0.5)
        : AppColors.inkViolet;
    return Semantics(
      selected: aktif,
      button: true,
      enabled: !moda.segera,
      label: moda.segera ? '${moda.label}, segera hadir' : moda.label,
      excludeSemantics: true,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: aktif ? AppGradients.pill : null,
                color: aktif
                    ? null
                    : moda.segera
                    ? AppColors.search
                    : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: aktif
                    ? null
                    : Border.all(
                        color: moda.segera
                            ? AppColors.ink.withValues(alpha: 0.2)
                            : AppColors.inkViolet.withValues(alpha: 0.2),
                      ),
              ),
              child: Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: onTap,
                  borderRadius: BorderRadius.circular(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(moda.icon, size: 20, color: warna),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          moda.label,
                          maxLines: 2,
                          textAlign: TextAlign.center,
                          style: sans(
                            size: 13,
                            weight: aktif ? FontWeight.w600 : FontWeight.w400,
                            color: warna,
                            height: 1.15,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (moda.segera)
            Positioned(
              top: -8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.trafficPadat,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Segera',
                  style: sans(size: 11, weight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _KotakPilih extends StatelessWidget {
  const _KotakPilih({
    required this.icon,
    required this.teks,
    required this.onTap,
    this.redup = false,
  });

  final IconData icon;
  final String teks;
  final VoidCallback onTap;
  final bool redup;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.search,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: AppSizes.touch),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.s3),
          child: Row(
            children: [
              Icon(icon, size: 18, color: AppColors.inkViolet),
              const SizedBox(width: AppSizes.s2),
              Expanded(
                child: Text(
                  teks,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sans(
                    size: 15,
                    color: redup
                        ? AppColors.ink.withValues(alpha: 0.55)
                        : AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Layar penuh untuk mencari tempat (lewat /places/search) atau memakai
/// lokasi perangkat. Mengembalikan [Tempat] terpilih.
class PilihTempatScreen extends StatefulWidget {
  const PilihTempatScreen({
    super.key,
    required this.judul,
    this.locate,
    this.near,
  });

  final String judul;
  final Future<LokasiHasil> Function()? locate;
  final LatLng? near;

  @override
  State<PilihTempatScreen> createState() => _PilihTempatScreenState();
}

class _PilihTempatScreenState extends State<PilihTempatScreen> {
  final _q = TextEditingController();
  List<Map>? _items;
  bool _memuat = false;
  Object? _galat;
  int _req = 0;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _cari(String q) async {
    final s = q.trim();
    if (s.length < 2) {
      setState(() => _galat = 'Ketik minimal 2 huruf.');
      return;
    }
    final req = ++_req;
    setState(() {
      _memuat = true;
      _galat = null;
    });
    try {
      final near = widget.near ?? medanCenter;
      final r = await _api.get(
        '/places/search',
        query: {'q': s, 'near': latLngQuery(near.latitude, near.longitude)},
      ) as Map;
      if (!mounted || req != _req) return;
      setState(() {
        _items = (r['items'] as List).whereType<Map>().toList();
        _memuat = false;
      });
    } on ApiException catch (e) {
      if (!mounted || req != _req) return;
      setState(() {
        _galat = e;
        _memuat = false;
      });
    }
  }

  Future<void> _lokasiSaya() async {
    final locate = widget.locate!;
    setState(() {
      _memuat = true;
      _galat = null;
    });
    final h = await locate();
    if (!mounted) return;
    final p = h.lokasi;
    if (p == null) {
      setState(() {
        _memuat = false;
        _galat = h.status == 'luar'
            ? 'SmartMove baru melayani Medan dan sekitarnya.'
            : 'Lokasi belum bisa dibaca. Ketik nama tempatnya.';
      });
      return;
    }
    var nama = 'Lokasi saya';
    try {
      final r = await _api.get(
        '/places/reverse',
        query: {'at': latLngQuery(p.latitude, p.longitude)},
      ) as Map;
      nama = Tempat.fromJson(r['tempat'] as Map).nama;
    } catch (_) {}
    if (mounted) Navigator.of(context).pop(Tempat(nama: nama, lokasi: p));
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: widget.judul,
            leading: IconButton(
              tooltip: 'Tutup',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
            children: [
              SearchField(
                controller: _q,
                autofocus: true,
                hint: 'Cari nama tempat',
                label: 'Cari ${widget.judul.toLowerCase()}',
                onSubmitted: _cari,
              ),
            ],
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSizes.s3),
              children: [
                if (widget.locate != null && items == null)
                  ListTile(
                    minTileHeight: AppSizes.touch,
                    leading: const Icon(
                      Icons.my_location_rounded,
                      color: AppColors.inkViolet,
                    ),
                    title: Text(
                      'Pakai lokasi saat ini',
                      style: sans(
                        size: 15,
                        weight: FontWeight.w600,
                        color: AppColors.inkViolet,
                      ),
                    ),
                    onTap: _memuat ? null : _lokasiSaya,
                  ),
                if (_memuat)
                  const Padding(
                    padding: EdgeInsets.all(AppSizes.s6),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_galat != null)
                  Padding(
                    padding: const EdgeInsets.all(AppSizes.s2),
                    child: _galat is String
                        ? ErrorBanner(message: _galat as String)
                        : ErrorBanner(error: _galat),
                  ),
                if (items != null && items.isEmpty && !_memuat)
                  Padding(
                    padding: const EdgeInsets.all(AppSizes.s4),
                    child: Text(
                      'Tidak ditemukan di Medan dan sekitarnya. Coba nama lain.',
                      style: sans(
                        size: 14,
                        color: AppColors.ink.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                if (items != null && !_memuat)
                  for (final j in items)
                    ListTile(
                      minTileHeight: AppSizes.touch + 8,
                      leading: const Icon(
                        Icons.place_outlined,
                        color: AppColors.inkViolet,
                      ),
                      title: Text(
                        '${j['nama']}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: sans(size: 15, weight: FontWeight.w600),
                      ),
                      subtitle: (j['alamat'] ?? '').toString().isEmpty
                          ? null
                          : Text(
                              '${j['alamat']}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                      trailing: j['jarakM'] is num
                          ? Text(formatJarak(j['jarakM'] as num))
                          : null,
                      onTap: () =>
                          Navigator.of(context).pop(Tempat.fromJson(j)),
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
