import 'package:material_ui/material_ui.dart';

import '../../i18n.dart';
import '../../notifications.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../../wib.dart';

class _Jenis {
  const _Jenis(this.icon, this.bg, this.fg);
  final IconData icon;
  final Color bg;
  final Color fg;
}

final _jenis = {
  'event': _Jenis(
    Icons.event_note_rounded,
    AppColors.iconBlue.withValues(alpha: 0.15),
    AppColors.iconBlueDeep,
  ),
  'trip': _Jenis(
    Icons.route_rounded,
    AppColors.pillSoft.withValues(alpha: 0.15),
    AppColors.loginButton,
  ),
  'poin': _Jenis(
    Icons.toll_rounded,
    AppColors.trafficPadat.withValues(alpha: 0.15),
    AppColors.teksKuning,
  ),
};

/// Lembar bawah notifikasi Beranda. [lastSeen] = waktu dibuka sebelumnya,
/// hanya untuk menandai yang baru (penyimpanan diurus pemanggil).
Future<void> showNotificationSheet(
  BuildContext context, {
  required List<dynamic> items,
  required DateTime? lastSeen,
  required DateTime now,
  required ValueChanged<String?> onOpen,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.card,
    barrierColor: AppColors.inkViolet.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * 0.82,
    ),
    builder: (sheetContext) {
      final list = items.whereType<Map<dynamic, dynamic>>().toList();
      return SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, AppSizes.s2, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        tr('Notifikasi'),
                        style: titleSerif(size: 20),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: tr('Tutup'),
                    onPressed: () => Navigator.of(sheetContext).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            if (list.isEmpty)
              EmptyState(
                icon: Icons.notifications_none_rounded,
                title: tr('Belum ada notifikasi'),
                message: tr(
                  'Pengingat perjalanan dan event lalu lintas dalam 24 jam ke depan akan muncul di sini.',
                ),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.s2,
                    AppSizes.s1,
                    AppSizes.s2,
                    AppSizes.s4,
                  ),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 4),
                  itemBuilder: (_, i) => _NotifTile(
                    item: list[i],
                    baru: isUnread(list[i], lastSeen),
                    now: now,
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      onOpen(list[i]['jenis']?.toString());
                    },
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

class _NotifTile extends StatelessWidget {
  const _NotifTile({
    required this.item,
    required this.baru,
    required this.now,
    required this.onTap,
  });

  final Map<dynamic, dynamic> item;
  final bool baru;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final jenis = item['jenis']?.toString();
    final j = _jenis[jenis] ?? _jenis['event']!;
    final waktu = DateTime.tryParse('${item['waktu']}');
    final kapan = waktu == null
        ? ''
        : jenis == 'poin'
        ? sejak(waktu, now)
        : hariWib(waktu, now);
    final judul = '${item['judul'] ?? ''}';
    final isi = '${item['isi'] ?? ''}';
    final muted = AppColors.ink.withValues(alpha: 0.7);

    return Semantics(
      button: true,
      label: '${baru ? tr('Baru. ') : ''}$judul. $isi. $kapan',
      excludeSemantics: true,
      child: Material(
        color: baru
            ? AppColors.lilacWash.withValues(alpha: 0.22)
            : AppColors.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(AppSizes.s3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: j.bg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(j.icon, size: 20, color: j.fg),
                ),
                const SizedBox(width: AppSizes.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              judul,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: sans(size: 15, weight: FontWeight.w600),
                            ),
                          ),
                          const SizedBox(width: AppSizes.s2),
                          Text(
                            kapan,
                            style: sans(
                              size: 12,
                              color: AppColors.ink.withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              isi,
                              style: sans(size: 14, color: muted),
                            ),
                          ),
                          if (baru)
                            Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                color: AppColors.pillVia,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
