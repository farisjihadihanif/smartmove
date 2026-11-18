import 'package:material_ui/material_ui.dart';

import '../theme.dart';
import 'pill_toggle.dart';

/// Keadaan kosong: ikon di medali lilac, judul Bree Serif, satu kalimat arahan,
/// aksi opsional. Kalimat menjelaskan apa yang bisa dilakukan.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.icon,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData? icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.s6,
        vertical: AppSizes.s8 + AppSizes.s2,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null)
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.lilacWash,
                image: AppTextures.lilacWash.image,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.white, width: 4),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.inkViolet.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(icon, size: 34, color: AppColors.inkViolet),
            ),
          const SizedBox(height: AppSizes.s4 + AppSizes.s1),
          Text(title, textAlign: TextAlign.center, style: titleSerif(size: 20)),
          if (message != null) ...[
            const SizedBox(height: AppSizes.s2),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: Text(
                message!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  height: 1.6,
                  color: AppColors.ink.withValues(alpha: 0.7),
                ),
              ),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSizes.s6),
            GradientPill(
              label: actionLabel!,
              onTap: onAction,
              bold: true,
              fontSize: 16,
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.s6),
            ),
          ],
        ],
      ),
    );
  }
}
