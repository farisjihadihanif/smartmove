import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/screens/auth/forgot_password_screen.dart';
import 'package:smartmove/screens/auth/login_screen.dart';
import 'package:smartmove/screens/auth/register_screen.dart';
import 'package:smartmove/screens/splash_screen.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/widgets/widgets.dart';

import 'font_preload.dart';

import 'widgets_test.dart' show NavPreview;

/// Nama file per bobot di assets/google_fonts/ (`OpenSans-<nama>.ttf`).
const _fileByWeight = {
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
};

/// google_fonts mendaftarkan tiap bobot sebagai family sendiri:
/// `OpenSans_regular`, `OpenSans_600`, dst. Kembalikan bobot dari nama family.
int? _familyWeight(String family) {
  final m = RegExp(r'^OpenSans_(regular|\d{3})$').firstMatch(family);
  if (m == null) return null;
  return m[1] == 'regular' ? 400 : int.parse(m[1]!);
}

/// Masalah bobot pada satu gaya teks, atau null bila benar.
/// Benar = family Open Sans yang dipakai cocok dengan `fontWeight`-nya,
/// jadi mesin teks memuat file font tebal yang sesungguhnya.
String? weightProblem(TextStyle style, String text) {
  final family = style.fontFamily;
  if (family == null || !family.startsWith('OpenSans')) return null;
  final fileWeight = _familyWeight(family);
  final wanted = (style.fontWeight ?? FontWeight.w400).value;
  if (fileWeight == null) return '"$text": family tak dikenal $family';
  if (fileWeight != wanted) {
    return '"$text": minta bobot $wanted tapi memakai file $family';
  }
  return null;
}

/// Kumpulkan semua gaya teks yang benar-benar dirender di layar.
List<(TextStyle, String)> renderedStyles(WidgetTester tester) {
  final out = <(TextStyle, String)>[];
  for (final p in tester.renderObjectList<RenderParagraph>(
    find.byType(RichText),
  )) {
    p.text.visitChildren((span) {
      if (span is TextSpan && span.style != null) {
        out.add((span.style!, span.toPlainText()));
      }
      return true;
    });
  }
  return out;
}

Future<void> pumpScreen(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: child));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  test('pemeriksa mendeteksi bobot yang tidak ikut mengganti file font', () {
    final base = sans();
    // Pola lama yang salah: mewarisi family regular lalu mengubah bobot saja.
    final wrong = base.merge(const TextStyle(fontWeight: FontWeight.w700));
    expect(weightProblem(wrong, 'x'), isNotNull);
    expect(
      weightProblem(base.copyWith(fontWeight: FontWeight.w600), 'x'),
      isNotNull,
    );
    for (final w in _fileByWeight.keys) {
      final fw = FontWeight.values[w ~/ 100 - 1];
      expect(weightProblem(sans(weight: fw), 'x'), isNull);
    }
  });

  test('setiap bobot yang dipakai sans() ada file font-nya', () async {
    for (final name in _fileByWeight.values) {
      final data = await rootBundle.load(
        'assets/google_fonts/OpenSans-$name.ttf',
      );
      expect(data.lengthInBytes, greaterThan(10000), reason: name);
    }
  });

  final screens = <String, Widget Function()>{
    'Splash': () => const SplashScreen(),
    'Member Login': () => const LoginScreen(),
    'Daftar': () => const RegisterScreen(),
    'Lupa password': () => const ForgotPasswordScreen(),
    'komponen bersama': () => Scaffold(
      appBar: AppBar(title: const Text('Judul AppBar')),
      body: Column(
        children: [
          const Expanded(child: NavPreview()),
          ErrorBanner(message: 'Galat', onRetry: () {}),
          FilledButton(onPressed: () {}, child: const Text('Tombol')),
        ],
      ),
    ),
  };

  for (final MapEntry(key: name, value: build) in screens.entries) {
    testWidgets('$name: teks tebal memakai file font tebal', (tester) async {
      await pumpScreen(tester, build());
      final styles = renderedStyles(tester);
      final problems = [for (final (s, t) in styles) ?weightProblem(s, t)];
      expect(problems, isEmpty);
      // Pastikan memang ada teks tebal yang diperiksa.
      expect(styles.any((e) => (e.$1.fontWeight?.value ?? 400) >= 600), isTrue);
    });
  }

  testWidgets(
    'semua gaya tema (setelah Theme.of) memakai family sesuai bobot',
    (tester) async {
      late TextTheme t;
      await pumpScreen(
        tester,
        Builder(
          builder: (context) {
            t = Theme.of(context).textTheme;
            return const SizedBox();
          },
        ),
      );
      final all = {
        'displayLarge': t.displayLarge,
        'displayMedium': t.displayMedium,
        'displaySmall': t.displaySmall,
        'headlineLarge': t.headlineLarge,
        'headlineMedium': t.headlineMedium,
        'headlineSmall': t.headlineSmall,
        'titleLarge': t.titleLarge,
        'titleMedium': t.titleMedium,
        'titleSmall': t.titleSmall,
        'bodyLarge': t.bodyLarge,
        'bodyMedium': t.bodyMedium,
        'bodySmall': t.bodySmall,
        'labelLarge': t.labelLarge,
        'labelMedium': t.labelMedium,
        'labelSmall': t.labelSmall,
      };
      final problems = [
        for (final MapEntry(:key, :value) in all.entries)
          ?weightProblem(value!, key),
      ];
      expect(problems, isEmpty);
    },
  );

  testWidgets('judul Splash memakai Open Sans ExtraBold (sama dengan web)', (
    tester,
  ) async {
    await pumpScreen(tester, const SplashScreen());
    final title = renderedStyles(tester)
        .firstWhere((e) => e.$2 == 'PERMUDAH\nKEGIATANMU');
    expect(title.$1.fontWeight, FontWeight.w800);
    expect(_familyWeight(title.$1.fontFamily!), 800);
  });
}
