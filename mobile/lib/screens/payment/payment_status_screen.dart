import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api.dart';
import '../../pembayaran.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import 'payment_widgets.dart';

/// Status & e-tiket satu pesanan. [cekSaatKembali]: dibuka setelah Snap diluncurkan di
/// browser — status dicek ke server (POST …/cek) tiap kali aplikasi kembali ke depan.
class PaymentStatusScreen extends StatefulWidget {
  const PaymentStatusScreen({
    super.key,
    required this.orderId,
    this.cekSaatKembali = false,
  });
  final String orderId;
  final bool cekSaatKembali;

  @override
  State<PaymentStatusScreen> createState() => PaymentStatusScreenState();
}

class PaymentStatusScreenState extends State<PaymentStatusScreen>
    with WidgetsBindingObserver {
  Map? payment;
  Object? galat;
  bool memeriksa = false;

  ApiClient get _api => AppScope.read(context).api;
  String get _path => '/payments/${Uri.encodeComponent(widget.orderId)}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _muat());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        payment?['status'] == 'menunggu') {
      cek();
    }
  }

  Future<void> _muat() async {
    try {
      final res = await _api.get(_path) as Map;
      if (!mounted) return;
      setState(() {
        payment = res['payment'] as Map;
        galat = null;
      });
      if (payment!['status'] == 'menunggu' && !widget.cekSaatKembali) {
        await cek();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => galat = e);
    }
  }

  Future<void> cek() async {
    if (memeriksa) return;
    setState(() {
      memeriksa = true;
      galat = null;
    });
    try {
      final res = await _api.post('$_path/cek') as Map;
      if (mounted) setState(() => payment = res['payment'] as Map);
    } on ApiException catch (e) {
      if (mounted) setState(() => galat = e);
    } finally {
      if (mounted) setState(() => memeriksa = false);
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
            title: lunas ? 'E-tiket' : 'Status pembayaran',
            leading: IconButton(
              tooltip: 'Kembali',
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
                if (p != null && !lunas) _belumLunas(p),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _lunas(Map p) => [
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
            '+${p['poin']} poin masuk ke Rewards',
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
        label: const Text('Bagikan'),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.pillVia,
          minimumSize: const Size(160, AppSizes.touch),
        ),
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
        ? 'Selesaikan pembayaran di halaman Midtrans (sandbox), lalu cek status di sini. '
              'E-tiket muncul setelah pembayaran lunas.'
        : p['status'] == 'kedaluwarsa'
        ? 'Batas waktu pembayaran sudah lewat. Buat pesanan baru kalau masih mau berangkat.'
        : 'Pembayaran tidak berhasil. Buat pesanan baru untuk mencoba lagi.';
    return Container(
      padding: const EdgeInsets.all(AppSizes.s6),
      decoration: BoxDecoration(
        color: AppColors.white,
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
          Text('Jadwal', style: redup),
          Text(jadwal == null ? '—' : waktuLengkap(jadwal), style: isi),
          const SizedBox(height: AppSizes.s2),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Jumlah', style: redup),
                    Text('${p['penumpang']} ${satuan(l)}', style: isi),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total', style: redup),
                    Text(rupiah(p['jumlah'] as num? ?? 0), style: isi),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.s2),
          Text('No. pesanan', style: redup),
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
                  label: const Text('Cek status'),
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
                    label: const Text('Lanjutkan bayar'),
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
                  child: const Text('Pesan lagi'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
