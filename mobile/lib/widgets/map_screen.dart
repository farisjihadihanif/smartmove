import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../navigasi.dart';
import '../theme.dart';
import 'error_banner.dart';

// Bagian bersama layar peta (Smart Navigation, Live Traffic Information):
// tata letak header–peta–lembar–bar, toast, dan daftar hasil cari tempat.

/// Daftar hasil GET /places/search di bawah kolom cari.
class PlaceResults extends StatelessWidget {
  const PlaceResults({
    super.key,
    required this.hasil,
    required this.onPilih,
    required this.onTutup,
  });

  final ({String status, List<Tempat> items, Object? error}) hasil;
  final ValueChanged<Tempat> onPilih;
  final VoidCallback onTutup;

  @override
  Widget build(BuildContext context) {
    final muted = AppColors.ink.withValues(alpha: 0.65);
    Widget isi;
    if (hasil.status == 'memuat') {
      isi = Padding(
        padding: const EdgeInsets.all(AppSizes.s3),
        child: Row(
          children: [
            const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: AppSizes.s2),
            Text(tr('Mencari tempat…'), style: sans(size: 14, color: muted)),
          ],
        ),
      );
    } else if (hasil.status == 'galat') {
      isi = ErrorBanner(error: hasil.error, onDismiss: onTutup);
    } else if (hasil.items.isEmpty) {
      isi = Padding(
        padding: const EdgeInsets.all(AppSizes.s3),
        child: Text(
          tr(
            'Tempat tidak ditemukan di Medan dan sekitarnya. Coba nama lain atau ketuk peta.',
          ),
          style: sans(size: 14, color: muted, height: 1.4),
        ),
      );
    } else {
      isi = ListView(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        children: [
          for (final t in hasil.items)
            ListTile(
              onTap: () => onPilih(t),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              leading: CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.lilacWash.withValues(alpha: 0.45),
                child: Icon(
                  Icons.place_outlined,
                  size: 18,
                  color: AppColors.inkViolet,
                ),
              ),
              title: Text(
                t.nama,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: sans(size: 15, weight: FontWeight.w600),
              ),
              subtitle: t.alamat.isEmpty
                  ? null
                  : Text(
                      t.alamat,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sans(size: 12, color: muted),
                    ),
            ),
        ],
      );
    }
    return Material(
      color: AppColors.card,
      elevation: 10,
      shadowColor: AppColors.inkViolet.withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(24),
      child: Padding(padding: const EdgeInsets.all(AppSizes.s2), child: isi),
    );
  }
}

/// Pesan singkat di atas peta (mis. "Laporan terkirim…").
class MapToast extends StatelessWidget {
  const MapToast({super.key, required this.teks});
  final String teks;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: ShapeDecoration(
          color: AppColors.inkVioletIsi,
          shape: const StadiumBorder(),
          shadows: [
            BoxShadow(
              color: AppColors.inkViolet.withValues(alpha: 0.6),
              blurRadius: 20,
              spreadRadius: -8,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Text(
          teks,
          textAlign: TextAlign.center,
          style: sans(
            size: 14,
            weight: FontWeight.w600,
            color: AppColors.white,
          ),
        ),
      ),
    );
  }
}

/// Slot [MapScreenLayout].
enum MapSlot { map, sheet, toast, bar, header, results }

/// Tata letak layar peta: header di atas, bar aksi di bawah, peta diselipkan 28 dp di bawah keduanya,
/// lembar bawah menempel di atas bar (ikut terselip di bawah sudutnya).
class MapScreenLayout extends MultiChildLayoutDelegate {
  MapScreenLayout({this.sheetMax = 0.62});

  /// Tinggi maksimum lembar bawah, bagian dari ruang antara header dan bar.
  final double sheetMax;

  static const _tuck = 28.0;

  @override
  void performLayout(Size size) {
    final w = size.width;
    final hh = layoutChild(
      MapSlot.header,
      BoxConstraints(minWidth: w, maxWidth: w, maxHeight: size.height),
    ).height;
    final bh = layoutChild(
      MapSlot.bar,
      BoxConstraints(minWidth: w, maxWidth: w, maxHeight: size.height),
    ).height;
    positionChild(MapSlot.header, Offset.zero);
    positionChild(MapSlot.bar, Offset(0, size.height - bh));

    final mapTop = hh - _tuck;
    final mapH = math.max(0.0, size.height - bh + _tuck - mapTop);
    layoutChild(MapSlot.map, BoxConstraints.tight(Size(w, mapH)));
    positionChild(MapSlot.map, Offset(0, mapTop));

    final tersedia = math.max(0.0, size.height - bh - hh);
    if (hasChild(MapSlot.sheet)) {
      final s = layoutChild(
        MapSlot.sheet,
        BoxConstraints(
          minWidth: w,
          maxWidth: w,
          maxHeight: tersedia * sheetMax + _tuck,
        ),
      );
      positionChild(
        MapSlot.sheet,
        Offset(0, size.height - bh + _tuck - s.height),
      );
    }
    if (hasChild(MapSlot.toast)) {
      final s = layoutChild(MapSlot.toast, BoxConstraints(maxWidth: w - 32));
      positionChild(MapSlot.toast, Offset((w - s.width) / 2, hh + 12));
    }
    if (hasChild(MapSlot.results)) {
      layoutChild(
        MapSlot.results,
        BoxConstraints(
          minWidth: w - 32,
          maxWidth: w - 32,
          maxHeight: tersedia * 0.75,
        ),
      );
      positionChild(MapSlot.results, Offset(16, hh + 4));
    }
  }

  @override
  bool shouldRelayout(MapScreenLayout oldDelegate) =>
      oldDelegate.sheetMax != sheetMax;
}
