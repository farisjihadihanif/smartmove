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

/// Baris pengaturan Tampilan (T-110, dropdown T-115): ikon + label, dropdown di kanan
/// (pola `D:\project\chemistry`). Sama dengan web PilihTema.jsx.
class PilihTema extends StatelessWidget {
  const PilihTema({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  static const opsi = [
    ('sistem', 'Ikuti sistem', Icons.brightness_auto_rounded),
    ('terang', 'Terang', Icons.light_mode_rounded),
    ('gelap', 'Gelap', Icons.dark_mode_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return BarisDropdown<String>(
      ikon: Icons.palette_outlined,
      label: 'Tampilan',
      value: value,
      onChanged: onChanged,
      items: [for (final (v, l, i) in opsi) (v, l, i)],
    );
  }
}

/// Baris pengaturan dengan dropdown (Tampilan, Bahasa).
class BarisDropdown<T> extends StatelessWidget {
  const BarisDropdown({
    super.key,
    required this.ikon,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final IconData ikon;
  final String label;
  final T value;
  final List<(T, String, IconData?)> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: AppSizes.touch + 8),
      child: Row(
        children: [
          Icon(ikon, color: AppColors.inkViolet, size: 22),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Text(label, style: sans(size: 15, weight: FontWeight.w600)),
          ),
          Container(
            padding: const EdgeInsets.only(
              left: AppSizes.s3,
              right: AppSizes.s1,
            ),
            decoration: BoxDecoration(
              color: AppColors.search,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink.withValues(alpha: 0.1)),
            ),
            child: DropdownButton<T>(
              value: value,
              underline: const SizedBox.shrink(),
              borderRadius: BorderRadius.circular(12),
              dropdownColor: AppColors.card,
              iconEnabledColor: AppColors.ink.withValues(alpha: 0.55),
              style: sans(
                size: 15,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
              itemHeight: AppSizes.touch,
              items: [
                for (final (v, l, i) in items)
                  DropdownMenuItem<T>(
                    value: v,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (i != null) ...[
                          Icon(i, size: 18, color: AppColors.inkViolet),
                          const SizedBox(width: AppSizes.s2),
                        ],
                        Text(l),
                      ],
                    ),
                  ),
              ],
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ),
        ],
      ),
    );
  }
}
