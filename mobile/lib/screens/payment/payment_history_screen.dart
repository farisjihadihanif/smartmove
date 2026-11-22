import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../i18n.dart';
import '../../pembayaran.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import 'payment_status_screen.dart';
import 'payment_widgets.dart';

/// Riwayat pemesanan (simulasi) milik sendiri, terbaru dulu (GET /payments).
class PaymentHistoryScreen extends StatefulWidget {
  const PaymentHistoryScreen({super.key});

  @override
  State<PaymentHistoryScreen> createState() => _PaymentHistoryScreenState();
}

class _PaymentHistoryScreenState extends State<PaymentHistoryScreen> {
  List<Map> items = [];
  int total = 0;
  int page = 0;
  String status = 'memuat';
  Object? galat;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _muat(1));
  }

  Future<void> _muat(int p) async {
    setState(() {
      status = p == 1 ? 'memuat' : 'menambah';
      galat = null;
    });
    try {
      final res =
          await _api.get('/payments', query: {'page': p, 'limit': 20}) as Map;
      if (!mounted) return;
      setState(() {
        final baru = (res['items'] as List).cast<Map>();
        items = p == 1 ? baru : [...items, ...baru];
        total = res['total'] as int? ?? items.length;
        page = p;
        status = 'ok';
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          status = 'galat';
          galat = e;
        });
      }
    }
  }

  Future<void> _buka(Map p) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PaymentStatusScreen(orderId: '${p['orderId']}'),
      ),
    );
    if (mounted) _muat(1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: tr('Riwayat pemesanan'),
            leading: IconButton(
              tooltip: tr('Kembali'),
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _muat(1),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                children: [
                  const PitaSimulasi(),
                  const SizedBox(height: AppSizes.s3),
                  if (status == 'memuat')
                    const Padding(
                      padding: EdgeInsets.all(AppSizes.s8),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (status == 'galat' && items.isEmpty)
                    ErrorBanner(error: galat, onRetry: () => _muat(1))
                  else if (items.isEmpty)
                    EmptyState(
                      icon: Icons.confirmation_number_outlined,
                      title: tr('Belum ada pemesanan'),
                      message: tr(
                        'Pesan tiket kereta, bus, travel, atau parkir dari Digital Payment.',
                      ),
                      actionLabel: tr('Pesan tiket'),
                      onAction: () => Navigator.of(context).maybePop(),
                    )
                  else ...[
                    for (final p in items) _baris(p),
                    if (items.length < total)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSizes.s3),
                        child: OutlinedButton(
                          onPressed: status == 'menambah'
                              ? null
                              : () => _muat(page + 1),
                          child: Text(tr('Muat lebih banyak')),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _baris(Map p) {
    final l = (p['layanan'] as Map?) ?? const {};
    final jadwal = DateTime.tryParse('${p['jadwal']}');
    return InkWell(
      onTap: () => _buka(p),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.s3),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: AppColors.ink.withValues(alpha: 0.07)),
          ),
        ),
        child: Row(
          children: [
            MedaliIkon(ikonJenis('${l['jenis']}')),
            const SizedBox(width: AppSizes.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${l['nama']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: sans(size: 15, weight: FontWeight.w600),
                  ),
                  Text(
                    jadwal == null ? '${p['orderId']}' : waktuLengkap(jadwal),
                    style: sans(
                      size: 13,
                      color: AppColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      ChipStatus('${p['status']}'),
                      const SizedBox(width: AppSizes.s2),
                      Text(
                        rupiah(p['jumlah'] as num? ?? 0),
                        style: sans(size: 13, weight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: AppColors.ink.withValues(alpha: 0.35),
            ),
          ],
        ),
      ),
    );
  }
}
