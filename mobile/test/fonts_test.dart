import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/fonts.dart';
import 'package:smartmove/theme.dart';

import 'font_preload.dart';

final bundledOpenSans = bundledOpenSansWeights.toSet();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(setupFonts);

  test('unduhan font saat runtime dimatikan', () {
    expect(GoogleFonts.config.allowRuntimeFetching, isFalse);
  });

  testWidgets('tiap varian font termuat dari aset (tanpa jaringan)', (
    tester,
  ) async {
    // Muat lalu langsung tunggu: melempar bila file font tidak ada di aset.
    await tester.runAsync(() async {
      for (final w in bundledOpenSans) {
        GoogleFonts.openSans(fontWeight: w);
        await GoogleFonts.pendingFonts();
      }
      GoogleFonts.breeSerif();
      await GoogleFonts.pendingFonts();
    });
  });

  testWidgets('tema hanya memakai ketebalan yang dibundel', (tester) async {
    final theme = buildTheme();
    final t = theme.textTheme;
    final styles = [
      t.displayLarge,
      t.displayMedium,
      t.displaySmall,
      t.headlineLarge,
      t.headlineMedium,
      t.headlineSmall,
      t.titleLarge,
      t.titleMedium,
      t.titleSmall,
      t.bodyLarge,
      t.bodyMedium,
      t.bodySmall,
      t.labelLarge,
      t.labelMedium,
      t.labelSmall,
      theme.appBarTheme.titleTextStyle,
      theme.filledButtonTheme.style?.textStyle?.resolve({}),
    ];
    for (final s in styles) {
      expect(
        bundledOpenSans,
        contains(s?.fontWeight ?? FontWeight.w400),
        reason: 'ketebalan ${s?.fontWeight} belum dibundel',
      );
    }
    expect(titleSerif().fontWeight ?? FontWeight.w400, FontWeight.w400);
    await tester.runAsync(GoogleFonts.pendingFonts);
  });

  testWidgets('lisensi OFL terdaftar', (tester) async {
    final entries = await tester.runAsync(
      () => LicenseRegistry.licenses.toList(),
    );
    final packages = entries!.expand((e) => e.packages).toSet();
    expect(packages, containsAll(['Open Sans', 'Bree Serif']));
  });
}
