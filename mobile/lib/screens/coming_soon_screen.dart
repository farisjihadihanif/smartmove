import 'package:material_ui/material_ui.dart';

import '../state.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'payment/payment_history_screen.dart';

/// Tujuan menu Beranda yang layarnya dibuat di tugas berikutnya (TASK.md).
/// Tab Akun memakai [account] agar tombol Keluar tetap ada.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    this.account = false,
  });

  final String title;
  final bool account;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final user = state.user;
    final canPop = ModalRoute.of(context)?.canPop ?? false;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: title,
            leading: canPop
                ? IconButton(
                    tooltip: 'Kembali',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
          ),
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    if (account && user != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSizes.s6,
                        ),
                        child: Text(
                          'Masuk sebagai ${user['namaLengkap'] ?? user['username']}\n${user['email'] ?? ''}',
                          textAlign: TextAlign.center,
                          style: sans(
                            size: 15,
                            color: AppColors.ink.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                    if (account)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSizes.s6,
                          AppSizes.s6,
                          AppSizes.s6,
                          0,
                        ),
                        child: PilihTema(
                          value: state.tema,
                          onChanged: state.setTema,
                        ),
                      ),
                    if (account && user != null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSizes.s3),
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const PaymentHistoryScreen(),
                            ),
                          ),
                          icon: const Icon(
                            Icons.receipt_long_rounded,
                            size: 18,
                          ),
                          label: const Text('Riwayat pemesanan'),
                        ),
                      ),
                    EmptyState(
                      icon: Icons.construction_rounded,
                      title: 'Segera hadir',
                      message: account
                          ? 'Ubah profil, foto, dan password akan ada di sini.'
                          : 'Layar ini sedang disiapkan. Sementara, kembali ke Beranda.',
                      actionLabel: account ? 'Keluar' : null,
                      onAction: account ? state.signOut : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pilihan tampilan (T-110): Ikuti sistem · Terang · Gelap. Sama dengan web PilihTema.jsx.
class PilihTema extends StatelessWidget {
  const PilihTema({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  static const _opsi = [
    ('sistem', 'Ikuti sistem', Icons.brightness_auto_rounded),
    ('terang', 'Terang', Icons.light_mode_rounded),
    ('gelap', 'Gelap', Icons.dark_mode_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tampilan', style: sans(size: 14, weight: FontWeight.w600)),
        const SizedBox(height: AppSizes.s2),
        Row(
          children: [
            for (final (v, label, ikon) in _opsi) ...[
              if (v != 'sistem') const SizedBox(width: AppSizes.s2),
              Expanded(
                child: Semantics(
                  selected: value == v,
                  inMutuallyExclusiveGroup: true,
                  button: true,
                  label: label,
                  excludeSemantics: true,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => onChanged(v),
                      borderRadius: BorderRadius.circular(16),
                      child: Ink(
                        height: 72,
                        decoration: BoxDecoration(
                          gradient: value == v ? AppGradients.pill : null,
                          color: value == v ? null : AppColors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: value == v
                              ? null
                              : Border.all(
                                  color: AppColors.ink.withValues(alpha: 0.15),
                                ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              value == v ? Icons.check_rounded : ikon,
                              size: 20,
                              color: value == v
                                  ? AppColors.white
                                  : AppColors.ink.withValues(alpha: 0.8),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              label,
                              textAlign: TextAlign.center,
                              style: sans(
                                size: 12,
                                weight: FontWeight.w600,
                                color: value == v
                                    ? AppColors.white
                                    : AppColors.ink.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
