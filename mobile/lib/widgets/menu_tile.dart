import 'package:material_ui/material_ui.dart';

import '../theme.dart';
import 'pill_toggle.dart';

enum MenuTileVariant { plain, pill }

/// Ubin menu.
/// - [MenuTileVariant.plain] (Beranda, hal. 3): ikon dalam lingkaran + label hitam.
/// - [MenuTileVariant.pill] (Traffic Mitigation Campaign, hal. 7): ilustrasi
///   besar + label kapsul gradasi.
class MenuTile extends StatelessWidget {
  const MenuTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.variant = MenuTileVariant.plain,
    this.iconBackground = AppColors.iconBlue,
    this.iconBorder,
  });

  final Widget icon;
  final String label;
  final VoidCallback onTap;
  final MenuTileVariant variant;
  final Color iconBackground;
  final Color? iconBorder;

  @override
  Widget build(BuildContext context) {
    if (variant == MenuTileVariant.pill) {
      return Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(AppSizes.s2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.lilacWash.withValues(alpha: 0.25),
                  ),
                  child: icon,
                ),
                const SizedBox(height: AppSizes.s3),
                GradientPill(
                  label: label,
                  bold: true,
                  padding: const EdgeInsets.symmetric(horizontal: AppSizes.s4),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSizes.s2,
            vertical: AppSizes.s3,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: iconBackground,
                  shape: BoxShape.circle,
                  border: iconBorder == null
                      ? null
                      : Border.all(color: iconBorder!, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.iconBlueDeep.withValues(alpha: 0.35),
                      blurRadius: 14,
                      spreadRadius: -8,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: IconTheme.merge(
                  data: const IconThemeData(color: AppColors.white, size: 30),
                  child: icon,
                ),
              ),
              const SizedBox(height: AppSizes.s2),
              Text(
                label,
                textAlign: TextAlign.center,
                style: sans(
                  size: 14,
                  height: 1.3,
                  weight: FontWeight.w500,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
