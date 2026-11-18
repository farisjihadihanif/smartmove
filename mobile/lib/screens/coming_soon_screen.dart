import 'package:material_ui/material_ui.dart';

import '../state.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

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
