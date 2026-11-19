import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/screens/account/account_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';

import 'font_preload.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> _user([Map<String, Object?> lain = const {}]) => {
  'id': 'u1',
  'username': 'rina',
  'email': 'rina@contoh.id',
  'role': 'user',
  'namaLengkap': 'Rina',
  'foto': null,
  'createdAt': '2026-11-01T00:00:00.000Z',
  ...lain,
};

class _Server {
  final permintaan = <http.Request>[];
  late final client = MockClient((req) async {
    permintaan.add(req);
    if (req.url.path == '/api/users/me' && req.method == 'PATCH') {
      final ct = req.headers['content-type'] ?? '';
      if (ct.startsWith('multipart/form-data')) {
        return _json({
          'user': _user({'foto': '/uploads/avatars/u1-a.webp'}),
        });
      }
      final b = jsonDecode(req.body) as Map;
      if (b['username'] == 'dipakai') {
        return _json({'message': 'Username sudah dipakai'}, 409);
      }
      return _json({
        'user': _user({
          'username': b['username'],
          'namaLengkap': b['namaLengkap'],
        }),
      });
    }
    if (req.url.path == '/api/users/me/password') {
      final b = jsonDecode(req.body) as Map;
      if (b['passwordLama'] != 'rahasia123') {
        return _json({'message': 'Password lama salah'}, 400);
      }
      return _json({'user': _user(), 'token': 'token-baru'});
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<(_Server, AppState, MemoryTokenStore)> _pump(
  WidgetTester tester, {
  PilihFoto? pilihFoto,
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(360, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final s = _Server();
  final tokens = MemoryTokenStore();
  final api = ApiClient(
    client: s.client,
    tokens: tokens,
    baseUrl: 'http://api.test/api',
    hasInternet: () async => true,
  );
  final state = AppState(api);
  await state.setSession({'token': 'token-lama', 'user': _user()});
  await tester.pumpWidget(
    AppScope(
      state: state,
      child: MaterialApp(
        theme: buildTheme(),
        home: AccountScreen(pilihFoto: pilihFoto ?? () async => null),
      ),
    ),
  );
  await _settle(tester);
  return (s, state, tokens);
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

void main() {
  setUpAll(preloadFonts);

  testWidgets('identitas, pengaturan, dan simpan profil', (tester) async {
    final (s, state, _) = await _pump(tester);
    expect(find.text('Rina'), findsWidgets);
    expect(find.text('@rina'), findsOneWidget);
    expect(find.text('Tampilan'), findsOneWidget);
    expect(find.text('Riwayat pemesanan'), findsOneWidget);
    expect(find.text('Keluar'), findsOneWidget);

    final simpan = find.widgetWithText(FilledButton, 'Simpan profil');
    await tester.ensureVisible(simpan);
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(0), 'Rina Sitepu');
    await tester.enterText(find.byType(TextField).at(1), 'Rina.Medan');
    await _tap(tester, simpan);
    expect(jsonDecode(s.permintaan.last.body), {
      'namaLengkap': 'Rina Sitepu',
      'username': 'rina.medan',
    });
    expect(state.user?['username'], 'rina.medan');
    expect(find.text('Profil disimpan.'), findsOneWidget);
  });

  testWidgets('username bentrok → pesan galat', (tester) async {
    await _pump(tester);
    await tester.enterText(find.byType(TextField).at(1), 'dipakai');
    await _tap(tester, find.widgetWithText(FilledButton, 'Simpan profil'));
    expect(find.text('Username sudah dipakai'), findsOneWidget);
  });

  testWidgets('ganti foto: unggah multipart field foto', (tester) async {
    final (s, state, _) = await _pump(
      tester,
      pilihFoto: () async => (List<int>.filled(10, 1), 'a.jpg'),
    );
    await _tap(tester, find.byTooltip('Tambah foto profil'));
    final req = s.permintaan.last;
    expect(req.method, 'PATCH');
    expect(req.headers['content-type'], startsWith('multipart/form-data'));
    expect(
      utf8.decode(req.bodyBytes, allowMalformed: true),
      contains('name="foto"'),
    );
    expect(state.user?['foto'], '/uploads/avatars/u1-a.webp');
  });

  testWidgets('foto > 2 MB ditolak di perangkat', (tester) async {
    final (s, _, _) = await _pump(
      tester,
      pilihFoto: () async =>
          (List<int>.filled(2 * 1024 * 1024 + 1, 0), 'besar.jpg'),
    );
    await _tap(tester, find.byTooltip('Tambah foto profil'));
    expect(find.text('Ukuran foto maksimal 2 MB.'), findsOneWidget);
    expect(s.permintaan, isEmpty);
  });

  testWidgets('ganti password: validasi, simpan, token baru disimpan', (
    tester,
  ) async {
    final (s, _, tokens) = await _pump(tester);
    final simpan = find.widgetWithText(FilledButton, 'Simpan password');
    final isian = find.byType(TextField);
    await tester.enterText(isian.at(2), 'rahasia123');
    await tester.enterText(isian.at(3), 'pendek');
    await tester.pump();
    expect(find.text('Password baru minimal 8 karakter.'), findsOneWidget);
    await tester.enterText(isian.at(3), 'rahasiaBaru99');
    await tester.enterText(isian.at(4), 'rahasiaBeda99');
    await tester.pump();
    expect(
      find.text('Ulangi password belum sama dengan password baru.'),
      findsOneWidget,
    );
    await tester.ensureVisible(simpan);
    expect(tester.widget<FilledButton>(simpan).onPressed, isNull);

    await tester.enterText(isian.at(4), 'rahasiaBaru99');
    await _tap(tester, simpan);
    expect(jsonDecode(s.permintaan.last.body), {
      'passwordLama': 'rahasia123',
      'passwordBaru': 'rahasiaBaru99',
    });
    expect(await tokens.read(), 'token-baru');
    expect(find.text('Password diganti.'), findsOneWidget);
  });
}
