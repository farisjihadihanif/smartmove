import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/screens/account/account_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'font_preload.dart';

double _kontras(Color a, Color b) {
  final x = a.computeLuminance();
  final y = b.computeLuminance();
  final (t, r) = x > y ? (x, y) : (y, x);
  return (t + 0.05) / (r + 0.05);
}

Color _campur(Color fg, Color bg, double alpha) =>
    Color.alphaBlend(fg.withValues(alpha: alpha), bg);

void main() {
  setUpAll(preloadFonts);
  tearDown(() => buildTheme()); // kembalikan palet terang untuk tes lain

  group('palet', () {
    for (final gelap in [false, true]) {
      test('kontras teks ≥ 4.5:1 (${gelap ? 'gelap' : 'terang'})', () {
        final t = buildTheme(gelap: gelap);
        expect(AppPalette.gelap, gelap);
        expect(t.brightness, gelap ? Brightness.dark : Brightness.light);
        expect(t.scaffoldBackgroundColor, AppColors.surface);
        final pasangan = {
          'ink/surface': (AppColors.ink, AppColors.surface),
          'ink 55%/card': (
            _campur(AppColors.ink, AppColors.card, 0.55),
            AppColors.card,
          ),
          'inkViolet/card': (AppColors.inkViolet, AppColors.card),
          'inkViolet/surface': (AppColors.inkViolet, AppColors.surface),
          'putih/isian ungu': (AppColors.white, AppColors.inkVioletIsi),
          'ungu tetap/kapsul putih': (
            AppColors.inkVioletTetap,
            AppColors.actionPill,
          ),
          'indigo/kolom login': (AppColors.indigo, AppColors.loginField),
          'ink 60%/search': (
            _campur(AppColors.ink, AppColors.search, 0.6),
            AppColors.search,
          ),
        };
        for (final MapEntry(key: n, value: (a, b)) in pasangan.entries) {
          expect(_kontras(a, b), greaterThanOrEqualTo(4.5), reason: n);
        }
      });
    }
  });

  testWidgets('pilihan tampilan di Akun menyimpan tema', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(
      ApiClient(
        tokens: MemoryTokenStore(),
        baseUrl: 'http://api.test/api',
        hasInternet: () async => true,
      ),
    );
    await state.muatTema();
    await state.setSession({
      'token': 't',
      'user': {
        'id': 'u1',
        'username': 'uji',
        'role': 'user',
        'email': 'uji@contoh.id',
      },
    });
    expect(state.tema, 'sistem');
    await tester.pumpWidget(
      AppScope(
        state: state,
        child: MaterialApp(theme: buildTheme(), home: const AccountScreen()),
      ),
    );
    await tester.pump();
    expect(find.text('Tampilan'), findsOneWidget);
    expect(find.text('Ikuti sistem'), findsOneWidget);
    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gelap').last);
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump();
    expect(state.tema, 'gelap');
    expect(
      (await SharedPreferences.getInstance()).getString(AppState.kunciTema),
      'gelap',
    );

    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ikuti sistem').last);
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    expect(state.tema, 'sistem');
    expect(
      (await SharedPreferences.getInstance()).getString(AppState.kunciTema),
      isNull,
    );
  });
}
