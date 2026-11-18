import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/fonts.dart';

/// Bobot Open Sans yang dibundel di assets/google_fonts/.
const bundledOpenSansWeights = [
  FontWeight.w400,
  FontWeight.w500,
  FontWeight.w600,
  FontWeight.w700,
  FontWeight.w800,
];

/// Muat semua font lebih dulu (di `setUpAll`) agar tidak memicu relayout
/// setelah tes selesai.
Future<void> preloadFonts() async {
  setupFonts();
  for (final w in bundledOpenSansWeights) {
    GoogleFonts.openSans(fontWeight: w);
  }
  GoogleFonts.breeSerif();
  await GoogleFonts.pendingFonts();
}
