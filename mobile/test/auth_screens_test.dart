import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/auth_rules.dart';
import 'package:smartmove/main.dart';
import 'package:smartmove/screens/splash_screen.dart';
import 'package:smartmove/state.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'font_preload.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const _user = {
  'id': 'u1',
  'username': 'budi',
  'email': 'budi@contoh.id',
  'role': 'user',
  'namaLengkap': 'Budi Medan',
};

/// Aplikasi lengkap dengan API palsu. [calls] mencatat request yang dikirim.
Future<(AppState, MemoryTokenStore)> pumpApp(
  WidgetTester tester,
  Future<http.Response> Function(http.Request) handler, {
  String? token,
}) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final store = MemoryTokenStore(token);
  final api = ApiClient(
    client: MockClient(handler),
    tokens: store,
    baseUrl: 'http://api.test/api',
  );
  final state = AppState(api);
  await tester.pumpWidget(
    SmartMoveApp(
      state: state,
      splashDuration: const Duration(milliseconds: 100),
    ),
  );
  await tester.runAsync(state.bootstrap);
  return (state, store);
}

/// Lewati Splash sampai layar berikutnya tampil.
Future<void> passSplash(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 150));
  await tester.pumpAndSettle();
}

/// Lewati Splash ke Beranda tamu, lalu buka Member Login lewat tombol Masuk.
Future<void> openLogin(WidgetTester tester) async {
  await passSplash(tester);
  await settleApi(tester);
  await tester.tap(find.widgetWithText(FilledButton, 'Masuk').first);
  await tester.pumpAndSettle();
}

/// Tunggu request API palsu selesai lalu gambar ulang.
Future<void> settleApi(WidgetTester tester) async {
  await tester.runAsync(() => Future<void>.delayed(Duration.zero));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('Splash menampilkan logo & 4 fitur, lalu Beranda tamu', (
    tester,
  ) async {
    await pumpApp(tester, (_) async => _json({'user': null}));
    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.text('PERMUDAH\nKEGIATANMU'), findsOneWidget);
    for (final f in splashFeatures) {
      expect(find.text(f), findsOneWidget);
    }
    expect(tester.takeException(), isNull);

    await passSplash(tester);
    await settleApi(tester);
    // Tamu: tanpa lonceng, ada ajakan masuk.
    expect(find.bySemanticsLabel(RegExp('^Notifikasi')), findsNothing);
    expect(find.text('Simpan perjalanan & kumpulkan poin'), findsOneWidget);
    expect(find.text('Member Login'), findsNothing);

    await tester.tap(find.widgetWithText(FilledButton, 'Masuk').first);
    await tester.pumpAndSettle();
    expect(find.text('Member Login'), findsOneWidget);
    expect(find.text('Ingat saya'), findsOneWidget);
    expect(find.text('Lupa password?'), findsOneWidget);
    expect(find.text('Buat akun'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('token tersimpan & valid → langsung ke Beranda', (tester) async {
    await pumpApp(tester, (_) async => _json({'user': _user}), token: 'lama');
    await passSplash(tester);
    expect(find.text('Budi Medan'), findsOneWidget);
  });

  testWidgets('Masuk: kolom kosong ditolak di klien tanpa memanggil API', (
    tester,
  ) async {
    var calls = 0;
    await pumpApp(tester, (req) async {
      if (req.url.path.startsWith('/api/auth/login')) calls++;
      return _json({});
    });
    await openLogin(tester);
    await tester.tap(find.text('Masuk'));
    await tester.pump();
    expect(find.text('Isi username/email dan password dulu.'), findsOneWidget);
    expect(calls, 0);
  });

  testWidgets('Masuk: galat 401 dari API tampil di banner', (tester) async {
    await pumpApp(tester, (req) async {
      if (req.url.path == '/api/auth/login') {
        return _json({'message': 'Username/email atau password salah'}, 401);
      }
      return _json({'user': null});
    });
    await openLogin(tester);
    await tester.enterText(find.byType(TextField).at(0), 'budi');
    await tester.enterText(find.byType(TextField).at(1), 'salahsalah');
    await tester.tap(find.text('Masuk'));
    await settleApi(tester);
    expect(find.text('Username/email atau password salah'), findsOneWidget);
    expect(find.text('Member Login'), findsOneWidget);
  });

  testWidgets('Masuk berhasil → token disimpan, pindah ke Beranda', (
    tester,
  ) async {
    late Map<String, dynamic> sent;
    final (_, store) = await pumpApp(tester, (req) async {
      if (req.url.path == '/api/auth/login') {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({'user': _user, 'token': 'jwt-1'});
      }
      return _json({'user': null});
    });
    await openLogin(tester);
    await tester.enterText(find.byType(TextField).at(0), ' budi ');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.text('Masuk'));
    await settleApi(tester);

    expect(sent, {'username': 'budi', 'password': 'rahasia123', 'ingat': true});
    expect(await store.read(), 'jwt-1');
    expect(find.text('Budi Medan'), findsOneWidget);
  });

  testWidgets('Masuk tanpa "Ingat saya" → token hanya di memori', (
    tester,
  ) async {
    late Map<String, dynamic> sent;
    final (state, store) = await pumpApp(tester, (req) async {
      if (req.url.path == '/api/auth/login') {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({'user': _user, 'token': 'jwt-2'});
      }
      return _json({'user': null});
    });
    await openLogin(tester);
    await tester.tap(find.text('Ingat saya'));
    await tester.enterText(find.byType(TextField).at(0), 'budi');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.text('Masuk'));
    await settleApi(tester);

    expect(sent['ingat'], false);
    expect(await store.read(), isNull);
    expect(state.api.sessionToken, 'jwt-2');
    expect(state.isSignedIn, isTrue);
  });

  testWidgets('Daftar: validasi klien lalu berhasil → Beranda', (tester) async {
    late Map<String, dynamic> sent;
    await pumpApp(tester, (req) async {
      if (req.url.path == '/api/auth/register') {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({'user': _user, 'token': 'jwt-3'}, 201);
      }
      return _json({'user': null});
    });
    await openLogin(tester);
    await tester.tap(find.text('Buat akun'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Buat akun'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Budi Medan');
    await tester.enterText(fields.at(1), 'Budi Keren');
    await tester.enterText(fields.at(2), 'budi@contoh.id');
    await tester.enterText(fields.at(3), 'rahasia123');
    final submit = find.widgetWithText(FilledButton, 'Buat akun');
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pump();
    expect(
      find.text(
        'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.',
      ),
      findsOneWidget,
    );

    await tester.enterText(fields.at(1), 'Budi_Medan');
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await settleApi(tester);
    expect(sent['username'], 'budi_medan');
    expect(sent.containsKey('role'), isFalse);
    expect(find.text('Budi Medan'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Buat akun'), findsNothing);
  });

  testWidgets('Lupa password: pesan dari API tampil', (tester) async {
    late Map<String, dynamic> sent;
    await pumpApp(tester, (req) async {
      if (req.url.path == '/api/auth/forgot') {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({
          'message': 'Jika email terdaftar, tautan sudah dikirim.',
        });
      }
      return _json({'user': null});
    });
    await openLogin(tester);
    await tester.tap(find.text('Lupa password?'));
    await tester.pumpAndSettle();
    expect(find.text('Lupa password'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'bukan-email');
    await tester.tap(find.text('Kirim tautan'));
    await tester.pump();
    expect(find.text('Format email belum benar.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Budi@Contoh.id');
    await tester.tap(find.text('Kirim tautan'));
    await settleApi(tester);
    expect(sent, {'email': 'budi@contoh.id'});
    expect(
      find.text('Jika email terdaftar, tautan sudah dikirim.'),
      findsOneWidget,
    );
    expect(find.text('Kirim ulang tautan'), findsOneWidget);
  });

  test('aturan daftar sama dengan API', () {
    expect(
      checkRegister(username: 'ab', email: 'a@b.id', password: '12345678'),
      isNotNull,
    );
    expect(
      checkRegister(username: 'budi', email: 'a@b', password: '12345678'),
      'Format email belum benar.',
    );
    expect(
      checkRegister(username: 'budi', email: 'a@b.id', password: '1234567'),
      'Password minimal 8 karakter.',
    );
    expect(
      checkRegister(
        username: 'budi.m_1',
        email: 'a@b.id',
        password: '12345678',
      ),
      isNull,
    );
  });
}
