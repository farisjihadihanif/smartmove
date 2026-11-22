import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../i18n.dart';
import '../../pembayaran.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import 'instruksi_bayar.dart';
import 'payment_widgets.dart';

/// Status, instruksi bayar, dan e-tiket satu pesanan (T-113). Selama menunggu: QR / nomor VA /
/// tombol e-wallet + hitung mundur; status diperbarui otomatis (tiap 5 dtk dari server SmartMove,
/// tiap 15 dtk server menanyakan Midtrans, dan saat aplikasi kembali ke depan). Sama dengan web.
class PaymentStatusScreen extends StatefulWidget {
  const PaymentStatusScreen({
    super.key,
    required this.orderId,
    this.selang = const Duration(seconds: 5),
    this.clock = DateTime.now,
    this.bukaTautan = _bukaTautan,
  });
  final String orderId;
  final Duration selang;
  final DateTime Function() clock;
  final Future<bool> Function(Uri) bukaTautan;

  static Future<bool> _bukaTautan(Uri u) =>
      launchUrl(u, mode: LaunchMode.externalApplication);

  @override
  State<PaymentStatusScreen> createState() => PaymentStatusScreenState();
}

class PaymentStatusScreenState extends State<PaymentStatusScreen>
    with WidgetsBindingObserver {
  static const _cekTiap = 3;
  Map? payment;
  Object? galat;
  bool memeriksa = false;
  bool baruLunas = false;
  Timer? _poll;
  Timer? _detik;
  int _ke = 0;
  bool _depan = true;
  bool _habisDicek = false;

  ApiClient get _api => AppScope.read(context).api;
  String get _path => '/payments/${Uri.encodeComponent(widget.orderId)}';
  bool get _menunggu => payment?['status'] == 'menunggu';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _muat());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _detik?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _depan = state == AppLifecycleState.resumed;
    if (_depan && _menunggu) cek(diam: true);
  }

  void _terima(Map p) {
    if (!mounted) return;
    setState(() {
      if (payment?['status'] == 'menunggu' && p['status'] == 'lunas') {
        baruLunas = true;
      }
      payment = p;
      galat = null;
    });
    _aturTimer();
  }

  void _aturTimer() {
    if (_menunggu) {
      _poll ??= Timer.periodic(widget.selang, (_) => _putaran());
      _detik ??= Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() {});
        final batas = DateTime.tryParse('${payment?['batasBayar']}');
        if (batas != null && !widget.clock().isBefore(batas) && !_habisDicek) {
          _habisDicek = true;
          cek(diam: true);
        }
      });
    } else {
      _poll?.cancel();
      _detik?.cancel();
      _poll = null;
      _detik = null;
    }
  }

  Future<void> _putaran() async {
    if (!_depan || !_menunggu) return;
    _ke++;
    try {
      if (_ke % _cekTiap == 0) {
        await cek(diam: true);
      } else {
        _terima((await _api.get(_path) as Map)['payment'] as Map);
      }
    } on ApiException {
      // Diam: dicoba lagi di putaran berikutnya.
    }
  }

  Future<void> _muat() async {
    try {
      final res = await _api.get(_path) as Map;
      _terima(res['payment'] as Map);
      if (_menunggu) await cek(diam: true);
    } on ApiException catch (e) {
      if (mounted) setState(() => galat = e);
    }
  }

  Future<void> cek({bool diam = false}) async {
    if (memeriksa) return;
    if (!diam) {
      setState(() {
        memeriksa = true;
        galat = null;
      });
    }
    try {
      final res = await _api.post('$_path/cek') as Map;
      _terima(res['payment'] as Map);
    } on ApiException catch (e) {
      if (mounted && !diam) setState(() => galat = e);
    } finally {
      if (mounted && !diam) setState(() => memeriksa = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final lunas = p?['status'] == 'lunas';
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: lunas ? tr('E-tiket') : tr('Pembayaran'),
            leading: IconButton(
              tooltip: tr('Kembali'),
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
              children: [
                const PitaSimulasi(),
                const SizedBox(height: AppSizes.s4),
                if (p == null && galat == null)
                  const Padding(
                    padding: EdgeInsets.all(AppSizes.s8),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (p == null && galat != null)
                  ErrorBanner(error: galat, onRetry: _muat),
                if (lunas) ..._lunas(p!),
                if (_menunggu) ..._instruksi(p!),
                if (p != null && !lunas && !_menunggu) _belumLunas(p),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _lunas(Map p) => [
    if (baruLunas)
      Padding(
        padding: const EdgeInsets.only(bottom: AppSizes.s4),
        child: Semantics(
          liveRegion: true,
          child: Text(
            tr('Pembayaran diterima. Ini e-tiketmu.'),
            textAlign: TextAlign.center,
            style: titleSerif(size: 20, color: AppColors.teksHijau),
          ),
        ),
      ),
    ETiket(payment: p),
    if ((p['poin'] as num? ?? 0) > 0) ...[
      const SizedBox(height: AppSizes.s4),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.auto_awesome_rounded,
            size: 18,
            color: AppColors.pillVia,
          ),
          const SizedBox(width: AppSizes.s2),
          Text(
            tr('+{0} poin masuk ke Rewards', [p['poin']]),
            style: sans(
              size: 15,
              weight: FontWeight.w600,
              color: AppColors.inkViolet,
            ),
          ),
        ],
      ),
    ],
    const SizedBox(height: AppSizes.s4),
    Center(
      child: FilledButton.icon(
        onPressed: () =>
            SharePlus.instance.share(ShareParams(text: teksBagikan(p))),
        icon: const Icon(Icons.share_rounded, size: 18),
        label: Text(tr('Bagikan')),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.pillVia,
          minimumSize: const Size(160, AppSizes.touch),
        ),
      ),
    ),
  ];

  List<Widget> _instruksi(Map p) => [
    if (galat != null) ...[
      ErrorBanner(error: galat, onDismiss: () => setState(() => galat = null)),
      const SizedBox(height: AppSizes.s3),
    ],
    InstruksiBayar(
      payment: p,
      sekarang: widget.clock(),
      memeriksa: memeriksa,
      onCek: () => cek(),
      bukaTautan: (u) => widget.bukaTautan(u),
    ),
    const SizedBox(height: AppSizes.s4),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${(p['layanan'] as Map?)?['nama'] ?? ''}',
            style: titleSerif(size: 20),
          ),
          Text(
            ruteLayanan((p['layanan'] as Map?) ?? const {}),
            style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: AppSizes.s2),
          Text(
            tr('No. pesanan {0}', [p['orderId']]),
            style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.6)),
          ),
        ],
      ),
    ),
  ];

  Widget _belumLunas(Map p) {
    final menunggu = p['status'] == 'menunggu';
    final l = (p['layanan'] as Map?) ?? const {};
    final jadwal = DateTime.tryParse('${p['jadwal']}');
    final (label, warna) = statusPembayaran('${p['status']}');
    final redup = sans(size: 13, color: AppColors.ink.withValues(alpha: 0.55));
    final isi = sans(size: 14, weight: FontWeight.w600);
    final pesan = menunggu
        ? tr(
            'Selesaikan pembayaran di halaman Midtrans (sandbox), lalu cek status di sini. E-tiket muncul setelah pembayaran lunas.',
          )
        : p['status'] == 'kedaluwarsa'
        ? tr(
            'Batas waktu pembayaran sudah lewat. Buat pesanan baru kalau masih mau berangkat.',
          )
        : tr(
            'Pembayaran tidak berhasil. Buat pesanan baru untuk mencoba lagi.',
          );
    return Container(
      padding: const EdgeInsets.all(AppSizes.s6),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.inkViolet.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            liveRegion: true,
            child: Row(
              children: [
                Icon(
                  menunggu
                      ? Icons.schedule_rounded
                      : Icons.error_outline_rounded,
                  size: 20,
                  color: warna,
                ),
                const SizedBox(width: AppSizes.s2),
                Text(
                  label,
                  style: sans(size: 15, weight: FontWeight.w600, color: warna),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSizes.s2),
          Text('${l['nama']}', style: titleSerif(size: 22)),
          Text(
            ruteLayanan(l),
            style: sans(size: 14, color: AppColors.ink.withValues(alpha: 0.65)),
          ),
          const SizedBox(height: AppSizes.s3),
          Text(tr('Jadwal'), style: redup),
          Text(jadwal == null ? '—' : waktuLengkap(jadwal), style: isi),
          const SizedBox(height: AppSizes.s2),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('Jumlah'), style: redup),
                    Text('${p['penumpang']} ${satuan(l)}', style: isi),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('Total'), style: redup),
                    Text(rupiah(p['jumlah'] as num? ?? 0), style: isi),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.s2),
          Text(tr('No. pesanan'), style: redup),
          Text('${p['orderId']}', style: isi),
          const SizedBox(height: AppSizes.s4),
          Text(
            pesan,
            style: sans(
              size: 15,
              height: 1.45,
              color: AppColors.ink.withValues(alpha: 0.75),
            ),
          ),
          if (galat != null) ...[
            const SizedBox(height: AppSizes.s3),
            ErrorBanner(error: galat),
          ],
          const SizedBox(height: AppSizes.s4),
          Wrap(
            spacing: AppSizes.s3,
            runSpacing: AppSizes.s2,
            children: [
              if (menunggu) ...[
                FilledButton.icon(
                  onPressed: memeriksa ? null : cek,
                  icon: memeriksa
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.white,
                          ),
                        )
                      : const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(tr('Cek status')),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.pillVia,
                    minimumSize: const Size(0, AppSizes.touch),
                  ),
                ),
                if (p['redirectUrl'] != null)
                  OutlinedButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse('${p['redirectUrl']}'),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: Text(tr('Lanjutkan bayar')),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, AppSizes.touch),
                    ),
                  ),
              ] else
                FilledButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.pillVia,
                    minimumSize: const Size(0, AppSizes.touch),
                  ),
                  child: Text(tr('Pesan lagi')),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
