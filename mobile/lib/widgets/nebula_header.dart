import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../theme.dart';

/// Header bertekstur cat air lilac (mockup hal. 3–7), sudut bawah membulat
/// agar isi di bawahnya (peta, menu) terasa naik. Sama dengan web NebulaHeader.
///
/// - [leading]: ikon fitur / avatar dalam lingkaran putih.
/// - [title]: judul layar (Open Sans tebal); [serif] = sapaan Bree Serif (Beranda).
/// - [unread] + [onNotifications]: tombol lonceng dengan lencana jumlah.
/// - [children]: isi di bawah judul (SearchField, PillToggle, …).
class NebulaHeader extends StatelessWidget {
  const NebulaHeader({
    super.key,
    required this.title,
    this.leading,
    this.serif = false,
    this.unread = 0,
    this.onNotifications,
    this.children = const [],
    this.bottomPadding = AppSizes.s6,
  });

  final String title;
  final Widget? leading;
  final bool serif;
  final int unread;
  final VoidCallback? onNotifications;
  final List<Widget> children;

  /// Ruang bawah; perbesar bila MapView bertutup menumpang di tepi header.
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    final titleStyle = serif
        ? titleSerif(size: 22)
        : sans(
            size: 20,
            weight: FontWeight.w700,
            color: AppColors.ink,
            height: 1.2,
          );

    return DecoratedBox(
      decoration: AppTextures.lilacWash.copyWith(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: AppColors.inkViolet.withValues(alpha: 0.5),
            blurRadius: 20,
            spreadRadius: -8,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSizes.s4,
            AppSizes.s3,
            AppSizes.s4,
            bottomPadding,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: AppSizes.touch),
                child: Row(
                  children: [
                    if (leading != null) ...[
                      Container(
                        width: 48,
                        height: 48,
                        clipBehavior: Clip.antiAlias,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.inkViolet.withValues(
                                alpha: 0.25,
                              ),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: leading,
                      ),
                      const SizedBox(width: AppSizes.s3),
                    ],
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(title, style: titleStyle),
                      ),
                    ),
                    if (onNotifications != null)
                      NotificationButton(
                        unread: unread,
                        onPressed: onNotifications!,
                      ),
                  ],
                ),
              ),
              for (final child in children) ...[
                const SizedBox(height: AppSizes.s4),
                child,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Tombol lonceng notifikasi dengan lencana jumlah belum dibaca.
class NotificationButton extends StatelessWidget {
  const NotificationButton({
    super.key,
    required this.unread,
    required this.onPressed,
  });

  final int unread;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = unread > 0
        ? tr('Notifikasi, {0} belum dibaca', [unread])
        : tr('Notifikasi');
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onPressed,
        radius: 24,
        child: SizedBox(
          width: AppSizes.touch,
          height: AppSizes.touch,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.card.withValues(alpha: 0.75),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.inkViolet.withValues(alpha: 0.18),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.notifications_none_rounded,
                  size: 20,
                  color: AppColors.ink,
                ),
              ),
              if (unread > 0)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    constraints: const BoxConstraints(
                      minWidth: 18,
                      minHeight: 18,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.trafficMacet,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(color: AppColors.white, width: 2),
                    ),
                    child: Text(
                      unread > 9 ? '9+' : '$unread',
                      style: sans(
                        color: AppColors.white,
                        size: 10,
                        weight: FontWeight.w700,
                        height: 1,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
