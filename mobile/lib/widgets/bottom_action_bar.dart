import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Satu tombol di [BottomActionBar].
class BarAction {
  const BarAction({
    required this.label,
    required this.onPressed,
    this.icon,
    this.short,
    this.filled = false,
  });

  final String label;

  /// Label pendek bila kapsul terlalu sempit (mis. "Lapor" untuk "Laporkan");
  /// label penuh tetap dibacakan pembaca layar.
  final String? short;
  final IconData? icon;
  final VoidCallback? onPressed;

  /// true = kapsul gradasi (Pay Now · Share, hal. 5);
  /// false = kapsul putih #F4F0F0 teks ungu (Rute · Play · Share, hal. 4 & 6).
  final bool filled;
}

/// Bar aksi bawah bertekstur ungu tua (mockup hal. 4–7), sudut atas membulat.
/// [top] tampil di atas tombol (mis. pita "Simulasi").
class BottomActionBar extends StatelessWidget {
  const BottomActionBar({super.key, this.actions = const [], this.top});

  final List<BarAction> actions;
  final Widget? top;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: AppTextures.barDark.copyWith(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.only(bottom: AppSizes.s4),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.s4,
            AppSizes.s4,
            AppSizes.s4,
            0,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ?top,
              if (actions.isNotEmpty)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final (i, a) in actions.indexed) ...[
                      if (i > 0) const SizedBox(width: AppSizes.s3),
                      Flexible(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 160),
                          child: _ActionPill(action: a),
                        ),
                      ),
                    ],
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({required this.action});

  final BarAction action;

  @override
  Widget build(BuildContext context) {
    final fg = action.filled ? AppColors.white : AppColors.inkViolet;
    final enabled = action.onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        type: MaterialType.transparency,
        child: Ink(
          height: AppSizes.touch,
          decoration: ShapeDecoration(
            color: action.filled ? null : AppColors.actionPill,
            gradient: action.filled ? AppGradients.pill : null,
            shape: const StadiumBorder(),
            shadows: const [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: InkWell(
            onTap: action.onPressed,
            customBorder: const StadiumBorder(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.s3),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final style = sans(
                          size: 15,
                          color: fg,
                          weight: FontWeight.w600,
                        );
                        var teks = action.label;
                        final pendek = action.short;
                        if (pendek != null) {
                          final tp = TextPainter(
                            text: TextSpan(text: teks, style: style),
                            maxLines: 1,
                            textScaler: MediaQuery.textScalerOf(context),
                            textDirection: TextDirection.ltr,
                          )..layout();
                          if (tp.width > c.maxWidth) teks = pendek;
                          tp.dispose();
                        }
                        return Semantics(
                          label: action.label,
                          excludeSemantics: true,
                          child: Text(
                            teks,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: style,
                          ),
                        );
                      },
                    ),
                  ),
                  if (action.icon != null) ...[
                    const SizedBox(width: AppSizes.s2),
                    Icon(action.icon, size: 20, color: fg),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
