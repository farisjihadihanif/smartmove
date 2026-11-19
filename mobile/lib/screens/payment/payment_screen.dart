import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../pembayaran.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../auth/login_screen.dart';
import 'payment_history_screen.dart';
import 'payment_status_screen.dart';
import 'payment_widgets.dart';

/// Membuka halaman Snap Midtrans (sandbox). Tes menggantinya.
typedef BukaSnap = Future<bool> Function(Uri url);

Future<bool> bukaSnapDiBrowser(Uri url) =>
    launchUrl(url, mode: LaunchMode.externalApplication);

/// Digital Payment (mockup hal. 5, PRD §6.3, T-302) — SELALU simulasi (Midtrans sandbox).
/// Pilih transportasi (jenis, tanggal, layanan, jam) → Estimasi biaya (jumlah, metode)
/// → Bayar sekarang membuka Snap di browser → layar status mengecek saat aplikasi kembali.
/// Dari Trip Planner: [asal]/[tujuan] menyaring layanan; tak ada yang cocok → semua layanan.
/// Sama dengan web pages/Pembayaran.jsx.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({
    super.key,
    this.asal,
    this.tujuan,
    this.tanggal,
    this.jenis,
    this.bukaSnap = bukaSnapDiBrowser,
    this.clock = DateTime.now,
  });

  final String? asal;
  final String? tujuan;
  final String? tanggal;
  final String? jenis;
  final BukaSnap bukaSnap;
  final DateTime Function() clock;

  @override
  State<PaymentScreen> createState() => PaymentScreenState();
}

class PaymentScreenState extends State<PaymentScreen> {
  late final DateTime _now = widget.clock();
  late final String _hariIni = tanggalWib(_now);
  late String tanggal =
      (widget.tanggal != null && widget.tanggal!.compareTo(_hariIni) >= 0)
      ? widget.tanggal!
      : _hariIni;
  late String? jenis = widget.jenis;
  String langkah = 'pilih';
  String _cari = '';

  bool get _dariTrip =>
      (widget.asal ?? '').isNotEmpty || (widget.tujuan ?? '').isNotEmpty;
  bool semuaLayanan = false;

  // Data
  String status = 'memuat';
  Object? _galat;
  List<Map> _semua = const [];
  List<Map>? _rute; // null = bukan dari trip
  int _muatKe = 0;

  // Pilihan
  String? kode;
  ({String jam, DateTime waktu})? slot;
  int jumlah = 1;
  String? metode;
  bool kirim = false;
  Object? galatBayar;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _muat());
  }

  Future<void> _muat() async {
    final ke = ++_muatKe;
    setState(() {
      status = 'memuat';
      _galat = null;
    });
    try {
      final semua = await _api.get(
        '/payments/services',
        query: {'tanggal': tanggal},
      ) as Map;
      List<Map>? rute;
      if (_dariTrip) {
        final r = await _api.get(
          '/payments/services',
          query: {
            'tanggal': tanggal,
            'asal': widget.asal,
            'tujuan': widget.tujuan,
          },
        ) as Map;
        rute = (r['items'] as List).cast<Map>();
      }
      if (!mounted || ke != _muatKe) return;
      setState(() {
        _semua = (semua['items'] as List).cast<Map>();
        _rute = rute;
        status = 'ok';
      });
    } on ApiException catch (e) {
      if (!mounted || ke != _muatKe) return;
      setState(() {
        status = 'galat';
        _galat = e;
      });
    }
  }

  bool get _ruteCocok => _rute != null && _rute!.isNotEmpty;
  bool get _ruteTakCocok => _rute != null && _rute!.isEmpty;

  List<Map> get _sumber => _ruteCocok && !semuaLayanan ? _rute! : _semua;

  List<Map> get items {
    final q = _cari.trim().toLowerCase();
    return _sumber.where((s) {
      if (jenis != null && s['jenis'] != jenis) return false;
      if (q.isEmpty) return true;
      return [
        s['nama'],
        s['operator'],
        s['asal'],
        s['tujuan'],
      ].any((v) => v != null && '$v'.toLowerCase().contains(q));
    }).toList();
  }

  Map? get layanan => kode == null
      ? null
      : (_semua.followedBy(_rute ?? const []))
            .where((s) => s['kode'] == kode)
            .firstOrNull;

  int get total => ((layanan?['harga'] as num?) ?? 0).round() * jumlah;
  bool get siapBayar => layanan != null && slot != null;

  void _pilihLayanan(Map s) {
    if (kode == s['kode']) return;
    setState(() {
      kode = '${s['kode']}';
      slot = null;
      jumlah = 1;
    });
  }

  void _pilihTanggal(String t) {
    setState(() {
      tanggal = t;
      slot = null;
    });
    _muat();
  }

  Future<void> _bayar() async {
    if (!siapBayar) {
      setState(() => langkah = 'pilih');
      return;
    }
    final app = AppScope.read(context);
    if (app.user == null) {
      await pushLogin(context);
      return;
    }
    setState(() {
      kirim = true;
      galatBayar = null;
    });
    try {
      final res = await _api.post('/payments', {
        'layanan': kode,
        'jadwal': slot!.waktu.toUtc().toIso8601String(),
        'penumpang': jumlah,
        'metode': ?metode,
      }) as Map;
      final orderId = '${res['orderId']}';
      await widget.bukaSnap(Uri.parse('${res['redirectUrl']}'));
      if (!mounted) return;
      setState(() => kirim = false);
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              PaymentStatusScreen(orderId: orderId, cekSaatKembali: true),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          kirim = false;
          galatBayar = e;
        });
      }
    }
  }

  void _bagikan() {
    final l = layanan;
    final teks = l == null
        ? 'Pesan tiket transportasi & parkir (simulasi) di SmartMove Medan'
        : [
            '${l['nama']} (simulasi)',
            ruteLayanan(l),
            if (slot != null) waktuLengkap(slot!.waktu),
            'Estimasi ${rupiah(total)} untuk $jumlah ${satuan(l)}',
            'SmartMove Medan',
          ].join('\n');
    SharePlus.instance.share(ShareParams(text: teks));
  }

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).user;
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: 'Digital Payment',
            leading: canPop
                ? IconButton(
                    tooltip: 'Kembali',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
            children: [
              SearchField(
                hint: 'Cari layanan atau tujuan',
                label: 'Cari layanan',
                leading: const Icon(
                  Icons.search_rounded,
                  color: AppColors.inkViolet,
                ),
                showSubmit: false,
                onChanged: (v) => setState(() => _cari = v),
              ),
              const SizedBox(height: AppSizes.s3),
              PillToggle<String>(
                options: const [
                  PillOption('pilih', 'Pilih transportasi', short: 'Pilih'),
                  PillOption('biaya', 'Estimasi biaya'),
                ],
                selected: {langkah},
                onChanged: (v) => setState(() => langkah = v.first),
              ),
            ],
          ),
          Expanded(
            // Kunci per langkah: ganti langkah selalu mulai dari atas.
            child: ListView(
              key: PageStorageKey('langkah-$langkah'),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: langkah == 'pilih' ? _pilih(user != null) : _biaya(),
            ),
          ),
          BottomActionBar(
            top: const Padding(
              padding: EdgeInsets.only(bottom: AppSizes.s3),
              child: PitaSimulasi(gelap: true),
            ),
            actions: [
              BarAction(
                label: kirim
                    ? 'Membuka…'
                    : user == null
                    ? 'Masuk untuk bayar'
                    : siapBayar
                    ? 'Bayar ${rupiah(total)}'
                    : 'Bayar sekarang',
                short: 'Bayar',
                icon: Icons.play_arrow_rounded,
                filled: true,
                onPressed: kirim ? null : _bayar,
              ),
              BarAction(
                label: 'Bagikan',
                icon: Icons.share_rounded,
                filled: true,
                onPressed: _bagikan,
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _pilih(bool masuk) {
    final label = sans(size: 14, weight: FontWeight.w600);
    final daftar = items;
    return [
      if (masuk)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const PaymentHistoryScreen(),
              ),
            ),
            icon: const Icon(Icons.history_rounded, size: 18),
            label: const Text('Riwayat pemesanan'),
          ),
        ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _chipJenis(null, 'Semua', null),
            for (final (v, l, i) in jenisLayanan) _chipJenis(v, l, i),
          ],
        ),
      ),
      const SizedBox(height: AppSizes.s4),
      Row(
        children: [
          const Icon(
            Icons.calendar_today_rounded,
            size: 16,
            color: AppColors.inkViolet,
          ),
          const SizedBox(width: AppSizes.s2),
          Text('Tanggal', style: label),
        ],
      ),
      const SizedBox(height: AppSizes.s2),
      PitaTanggal(hariIni: _hariIni, value: tanggal, onChanged: _pilihTanggal),
      if (_ruteTakCocok)
        _catatan(
          'Belum ada layanan untuk rute ${widget.asal ?? '…'} → ${widget.tujuan ?? '…'}. '
          'Pilih dari semua layanan di bawah.',
        ),
      if (_ruteCocok)
        _catatan(
          semuaLayanan
              ? 'Menampilkan semua layanan.'
              : 'Layanan untuk rute ${widget.asal ?? '…'} → ${widget.tujuan ?? '…'}.',
          aksi: TextButton(
            onPressed: () => setState(() => semuaLayanan = !semuaLayanan),
            child: Text(semuaLayanan ? 'Hanya rute ini' : 'Lihat semua'),
          ),
        ),
      const SizedBox(height: AppSizes.s2),
      if (status == 'memuat')
        const Padding(
          padding: EdgeInsets.all(AppSizes.s6),
          child: Center(child: CircularProgressIndicator()),
        )
      else if (status == 'galat')
        ErrorBanner(error: _galat, onRetry: _muat)
      else if (daftar.isEmpty)
        const EmptyState(
          icon: Icons.confirmation_number_outlined,
          title: 'Layanan tidak ditemukan',
          message: 'Coba jenis lain atau hapus kata pencarian.',
        )
      else
        for (final s in daftar)
          BarisLayanan(
            layanan: s,
            slot: slotLayanan(s, tanggal, widget.clock()),
            terpilih: kode == s['kode'],
            jam: kode == s['kode'] ? slot?.jam : null,
            onPilih: () => _pilihLayanan(s),
            onJam: (sl) => setState(() {
              slot = (jam: sl.jam, waktu: sl.waktu);
              langkah = 'biaya';
            }),
          ),
    ];
  }

  Widget _catatan(String teks, {Widget? aksi}) => Container(
    margin: const EdgeInsets.only(top: AppSizes.s4),
    padding: const EdgeInsets.symmetric(
      horizontal: AppSizes.s4,
      vertical: AppSizes.s2,
    ),
    decoration: BoxDecoration(
      color: AppColors.lilacWash.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSizes.s1),
            child: Text(teks, style: sans(size: 14, height: 1.4)),
          ),
        ),
        ?aksi,
      ],
    ),
  );

  Widget _chipJenis(String? v, String l, IconData? ikon) {
    final on = jenis == v;
    return Padding(
      padding: const EdgeInsets.only(right: AppSizes.s2),
      child: ChoiceChip(
        avatar: ikon == null
            ? null
            : Icon(
                ikon,
                size: 16,
                color: on ? AppColors.white : AppColors.inkViolet,
              ),
        label: Text(l),
        selected: on,
        onSelected: (_) => setState(() => jenis = v),
        showCheckmark: false,
        materialTapTargetSize: MaterialTapTargetSize.padded,
        labelStyle: sans(
          size: 14,
          weight: FontWeight.w600,
          color: on ? AppColors.white : AppColors.ink.withValues(alpha: 0.8),
        ),
        selectedColor: AppColors.inkViolet,
        backgroundColor: AppColors.white,
        side: BorderSide(
          color: on
              ? AppColors.inkViolet
              : AppColors.ink.withValues(alpha: 0.15),
        ),
        shape: const StadiumBorder(),
      ),
    );
  }

  List<Widget> _biaya() {
    final l = layanan;
    final redup = AppColors.ink.withValues(alpha: 0.65);
    return [
      Text('Estimasi biaya', style: titleSerif(size: 24)),
      const SizedBox(height: AppSizes.s2),
      if (l == null || slot == null)
        Text(
          l == null
              ? 'Pilih layanan dan jamnya dulu, totalnya muncul di sini.'
              : 'Pilih jam keberangkatan dulu.',
          style: sans(size: 15, height: 1.45, color: redup),
        )
      else ...[
        Text('${l['nama']}', style: sans(size: 16, weight: FontWeight.w600)),
        Text(waktuLengkap(slot!.waktu), style: sans(size: 14, color: redup)),
        const SizedBox(height: AppSizes.s4),
        Row(
          children: [
            Expanded(
              child: Text(
                adalahParkir(l) ? 'Lama parkir' : 'Penumpang',
                style: sans(size: 14, weight: FontWeight.w600),
              ),
            ),
            IconButton.outlined(
              tooltip: 'Kurangi ${satuan(l)}',
              onPressed: jumlah <= 1 ? null : () => setState(() => jumlah--),
              icon: const Icon(Icons.remove_rounded),
            ),
            SizedBox(
              width: 84,
              child: Semantics(
                liveRegion: true,
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: '$jumlah ', style: titleSerif(size: 22)),
                      TextSpan(
                        text: satuan(l),
                        style: sans(size: 14, color: redup),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            IconButton.outlined(
              tooltip: 'Tambah ${satuan(l)}',
              onPressed: jumlah >= maksJumlah(l)
                  ? null
                  : () => setState(() => jumlah++),
              icon: const Icon(Icons.add_rounded),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s3),
        const GarisPutus(),
        const SizedBox(height: AppSizes.s3),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text(
                '${rupiah(l['harga'] as num)} × $jumlah ${satuan(l)}',
                style: sans(size: 14, color: redup),
              ),
            ),
            Text(
              rupiah(total),
              style: titleSerif(size: 30, color: AppColors.inkViolet),
            ),
          ],
        ),
      ],
      const SizedBox(height: AppSizes.s6),
      Text('Metode pembayaran', style: sans(size: 14, weight: FontWeight.w600)),
      for (final (v, label, ket, ikon) in metodeBayar)
        BarisMetode(
          label: label,
          keterangan: ket,
          ikon: ikon,
          aktif: metode == v,
          onTap: () => setState(() => metode = metode == v ? null : v),
        ),
      BarisMetode(
        label: 'Bayar parkir',
        keterangan: 'Pesan tempat parkir per jam',
        ikon: Icons.local_parking_rounded,
        warna: AppColors.iconBlueDeep,
        panah: true,
        onTap: () => setState(() {
          jenis = 'parkir';
          langkah = 'pilih';
        }),
      ),
      const SizedBox(height: AppSizes.s2),
      Text(
        'Tidak memilih = semua metode tersedia di halaman Midtrans.',
        style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.55)),
      ),
      if (galatBayar != null) ...[
        const SizedBox(height: AppSizes.s3),
        ErrorBanner(error: galatBayar),
      ],
    ];
  }
}
