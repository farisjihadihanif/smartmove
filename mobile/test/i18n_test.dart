import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/i18n.dart';
import 'package:smartmove/navigasi.dart';
import 'package:smartmove/screens/account/account_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/wib.dart';

Map<String, String> _kamus() => Map<String, String>.from(
  jsonDecode(File('assets/i18n/en.json').readAsStringSync()) as Map,
);

void main() {
  setUpAll(() => aturKamus(_kamus()));
  tearDown(() => aturBahasa('id'));

  test(
    'tr: kunci = teks Indonesia, {0} diisi, belum diterjemahkan → apa adanya',
    () {
      expect(tr('Sisa {0} kursi', [3]), 'Sisa 3 kursi');
      aturBahasa('en');
      expect(tr('Sisa {0} kursi', [3]), '3 seats left');
      expect(tr('Teks yang belum ada'), 'Teks yang belum ada');
      expect(tr('Mobil'), 'Car');
    },
  );

  test('angka, rupiah, tanggal & jam mengikuti bahasa', () {
    final t = DateTime.utc(2026, 11, 20, 0, 40); // 07.40 WIB, Jumat
    expect(angka(1234567), '1.234.567');
    expect(rupiah(35000), 'Rp35.000');
    expect(formatJarak(4900), '4,9 km');
    expect(jamWib(t), '07.40');
    expect(tanggalBulanTahun(20, 11, 2026), '20 Nov 2026');
    expect(hariPendek(t.weekday), 'Jum');

    aturBahasa('en');
    expect(angka(1234567), '1,234,567');
    expect(rupiah(35000), 'Rp35,000');
    expect(formatJarak(4900), '4.9 km');
    expect(formatDurasi(3900), '1 h 5 min');
    expect(jamWib(t), '07:40');
    expect(tanggalBulanTahun(20, 5, 2026), 'May 20, 2026');
    expect(hariPendek(t.weekday), 'Fri');
    expect(salamWib(t), 'Good morning');
  });

  test('bahasa perangkat: id/in → Indonesia, selain itu Inggris', () {
    expect(bahasaPerangkat(const [Locale('id', 'ID')]), 'id');
    expect(bahasaPerangkat(const [Locale('in')]), 'id');
    expect(bahasaPerangkat(const [Locale('fr'), Locale('id')]), 'id');
    expect(bahasaPerangkat(const [Locale('en', 'US'), Locale('id')]), 'en');
    expect(bahasaPerangkat(const [Locale('ja')]), 'en');
    expect(bahasaDari('id', const [Locale('en')]), 'id');
    expect(bahasaDari('sistem', const [Locale('en')]), 'en');
  });

  test('semua tr() di lib/ punya terjemahan Inggris', () {
    final kamus = _kamus();
    final re = RegExp(r"\btr\(\s*'((?:[^'\\]|\\.)*)'");
    final hilang = <String>{};
    for (final f in Directory('lib').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      for (final m in re.allMatches(f.readAsStringSync())) {
        final k = m
            .group(1)!
            .replaceAll(r'\n', '\n')
            .replaceAllMapped(RegExp(r'\\(.)'), (x) => x.group(1)!);
        if (!kamus.containsKey(k)) hilang.add(k);
      }
    }
    expect(hilang, isEmpty);
  });

  test('ApiClient mengirim Accept-Language sesuai bahasa', () async {
    final seen = <String?>[];
    final api = ApiClient(
      client: MockClient((req) async {
        seen.add(req.headers['Accept-Language']);
        return http.Response('{}', 200);
      }),
      tokens: MemoryTokenStore(),
      baseUrl: 'http://api.test/api',
      hasInternet: () async => true,
    );
    await api.get('/home');
    aturBahasa('en');
    await api.get('/home');
    expect(seen, ['id', 'en']);
  });

  testWidgets('pilihan Bahasa di Akun mengganti teks dan disimpan', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({AppState.kunciBahasa: 'id'});
    final state = AppState(
      ApiClient(
        tokens: MemoryTokenStore(),
        baseUrl: 'http://api.test/api',
        hasInternet: () async => true,
      ),
    );
    await tester.runAsync(state.muatBahasa);
    await state.setSession({
      'token': 't',
      'user': {'id': 'u1', 'username': 'uji', 'role': 'user'},
    });
    await tester.pumpWidget(
      AppScope(
        state: state,
        child: MaterialApp(theme: buildTheme(), home: const AccountScreen()),
      ),
    );
    await tester.pump();
    expect(find.text('Bahasa'), findsOneWidget);
    expect(find.text('Bahasa Indonesia'), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('English').last);
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
    expect(bahasa, 'en');
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Appearance'), findsOneWidget);
    expect(
      (await SharedPreferences.getInstance()).getString(AppState.kunciBahasa),
      'en',
    );

    // Ikuti perangkat: pilihan dihapus, bahasa dari perangkat (tes: en-US).
    await tester.tap(find.byType(DropdownButton<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Follow device').last);
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
    expect(state.pilihanBahasa, 'sistem');
    expect(
      (await SharedPreferences.getInstance()).getString(AppState.kunciBahasa),
      isNull,
    );
  });
}
