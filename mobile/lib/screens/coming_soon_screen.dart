import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../widgets/widgets.dart';

/// Tujuan menu yang layarnya belum dibuat (TASK.md).
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: title,
            leading: canPop
                ? IconButton(
                    tooltip: tr('Kembali'),
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
          ),
          Expanded(
            child: Center(
              child: EmptyState(
                icon: Icons.construction_rounded,
                title: tr('Segera hadir'),
                message: tr(
                  'Layar ini sedang disiapkan. Sementara, kembali ke Beranda.',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
