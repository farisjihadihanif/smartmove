import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Header bertekstur cat air lilac (mockup hal. 3–7).
///
/// - [leading]: ikon fitur / avatar dalam lingkaran putih bertepi ungu.
/// - [title]: judul layar (Open Sans tebal); [serif] = sapaan Bree Serif (Beranda).
/// - [unread] + [onNotifications]: tombol amplop dengan lencana jumlah.
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
        ? titleSerif(size: 20)
        : GoogleFonts.openSans(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
            height: 1.2,
          );

    return DecoratedBox(
      decoration: AppTextures.lilacWash,
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
                          color: AppColors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.inkViolet.withValues(alpha: 0.8),
                            width: 2,
                          ),
                        ),
                        child: leading,
                      ),
                      const SizedBox(width: AppSizes.s3),
                    ],
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(
                          title,
                          style: titleStyle,
                          textAlign: serif ? TextAlign.center : TextAlign.start,
                        ),
                      ),
                    ),
                    if (onNotifications != null)
                      _NotificationButton(
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

class _NotificationButton extends StatelessWidget {
  const _NotificationButton({required this.unread, required this.onPressed});

  final int unread;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = unread > 0
        ? 'Notifikasi, $unread belum dibaca'
        : 'Notifikasi';
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
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.white.withValues(alpha: 0.3),
                  border: Border.all(color: AppColors.ink, width: 1.5),
                ),
                child: const Icon(
                  Icons.mail_outline,
                  size: 20,
                  color: AppColors.ink,
                ),
              ),
              if (unread > 0)
                Positioned(
                  top: 2,
                  right: 2,
                  child: Container(
                    constraints: const BoxConstraints(
                      minWidth: 18,
                      minHeight: 18,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.ink,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(color: AppColors.white),
                    ),
                    child: Text(
                      unread > 9 ? '9+' : '$unread',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
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
