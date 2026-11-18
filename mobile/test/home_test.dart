import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/main.dart';
import 'package:smartmove/notifications.dart';
import 'package:smartmove/screens/home/home_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/wib.dart';

import 'font_preload.dart';

http.Response _json(Object body) => http.Response(
  jsonEncode(body),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const _user = {
  'id': 'u1',
  'username': 'sarah',
  'email': 'sarah@contoh.id',
  'role': 'user',
  'namaLengkap': 'Sarah Lubis',
};

final _server = DateTime.utc(2026, 11, 19, 0, 30); // 07.30 WIB
String _iso(Duration d) => _server.add(d).toIso8601String();

Map<String, dynamic> _home() => {
  'sapaan': {
    'salam': 'Selamat pagi',
    'teks': 'Hallo! Selamat pagi, Sarah Lubis',
    'jam': '07.30',
    'zona': 'WIB',
    'waktuServer': _server.toIso8601String(),
  },
  'poin': {'saldo': 70, 'bulanIni': 85},
  'events': [
    {
      'id': 'e1',
      'judul': 'Car Free Day Jl. Pemuda',
      'isi': 'x',
      'jenis': 'cfd',
      'mulai': _iso(const Duration(hours: -1)),
      'selesai': _iso(const Duration(hours: 2)),
      'lokasi': null,
    },
  ],
  'notifikasi': [
    {
      'id': 'trip:1',
      'jenis': 'trip',
      'judul': 'Ke Kualanamu',
      'isi': 'Berangkat 09.30 WIB',
      'waktu': _iso(const Duration(hours: 2)),
      'muncul': _iso(const Duration(hours: -22)),
      'ref': '1',
    },
    {
      'id': 'poin:2',
      'jenis': 'poin',
      'judul': '+30 poin',
      'isi': 'Poin dari perjalanan',
      'waktu': _iso(const Duration(hours: -3)),
      'muncul': _iso(const Duration(hours: -3)),
      'ref': '2',
    },
  ],
};

/// Respons tamu (API_SPECS §5): tanpa nama, poin null, tanpa notifikasi pribadi.
Map<String, dynamic> _homeTamu() => {
  ..._home(),
  'sapaan': {..._home()['sapaan'] as Map, 'teks': 'Hallo! Selamat pagi'},
  'poin': null,
  'notifikasi': <Object>[],
};

Future<void> pumpHome(WidgetTester tester, {bool tamu = false}) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = ApiClient(
    client: MockClient(
      (req) async => req.url.path == '/api/home'
          ? _json(tamu ? _homeTamu() : _home())
          : _json({'user': _user}),
    ),
    tokens: MemoryTokenStore(tamu ? null : 'jwt'),
    baseUrl: 'http://api.test/api',
  );
  final state = AppState(api);
  await tester.pumpWidget(
    SmartMoveApp(state: state, splashDuration: const Duration(milliseconds: 1)),
  );
  await tester.runAsync(state.bootstrap);
  await tester.pump(const Duration(milliseconds: 10));
  await tester.pumpAndSettle();
  // Beri waktu request /home & baca shared_preferences.
  for (var i = 0; i < 3; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  group('countUnread', () {
    final list = [
      {'muncul': '2026-11-18T10:00:00.000Z'},
      {'muncul': '2026-11-19T00:00:00.000Z'},
      {'waktu': '2026-11-19T01:00:00.000Z'}, // tanpa muncul → pakai waktu
    ];
    test('belum pernah dibuka = semua', () {
      expect(countUnread(list, null), 3);
    });
    test('hanya yang muncul setelah terakhir dibuka', () {
      expect(countUnread(list, DateTime.utc(2026, 11, 18, 12)), 2);
      expect(countUnread(list, DateTime.utc(2026, 11, 19, 1)), 0);
    });
  });

  group('wib', () {
    test('jam & salam dihitung dalam WIB', () {
      expect(jamWib(_server), '07.30');
      expect(salamWib(DateTime.utc(2026, 11, 19, 12, 5)), 'Selamat malam');
      expect(hariWib(DateTime.utc(2026, 11, 19, 18), _server), 'Besok');
    });
  });

  testWidgets('Beranda 360 px: sapaan, menu, Trip Planner, poin, event', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await pumpHome(tester);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Hallo! Selamat pagi,'), findsOneWidget);
    expect(find.text('Sarah Lubis'), findsOneWidget);
    for (final m in [
      'Smart Navigation',
      'Live Traffic Information',
      'Digital Payment',
      'Traffic Mitigation Campaign',
    ]) {
      expect(find.text(m), findsOneWidget);
    }
    expect(find.text('Trip Planner'), findsOneWidget);
    expect(find.text('Beranda'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Car Free Day Jl. Pemuda'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(HomeScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('70 poin'), findsOneWidget);
    expect(find.text('+85 bulan ini'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('lonceng: hitung dari waktu terakhir dibuka, lalu simpan '
      'waktuServer saat panel dibuka', (tester) async {
    // Terakhir dibuka 5 jam lalu: trip (muncul 22 jam lalu) sudah terbaca,
    // poin (3 jam lalu) belum.
    SharedPreferences.setMockInitialValues({
      notifSeenKey('u1'): _server
          .subtract(const Duration(hours: 5))
          .millisecondsSinceEpoch,
    });
    await pumpHome(tester);
    expect(find.bySemanticsLabel('Notifikasi, 1 belum dibaca'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Notifikasi, 1 belum dibaca'));
    await tester.pumpAndSettle();
    expect(find.text('Ke Kualanamu'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Baru\. \+30 poin')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Ke Kualanamu')), findsOneWidget);

    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getInt(notifSeenKey('u1')), _server.millisecondsSinceEpoch);

    await tester.tap(find.byTooltip('Tutup'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Notifikasi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tamu: Beranda terbuka tanpa nama, poin, & lonceng; '
      'Rewards/Akun/Trip Planner minta login', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpHome(tester, tamu: true);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Hallo! Selamat pagi'), findsOneWidget);
    expect(find.text('Sarah Lubis'), findsNothing);
    expect(find.bySemanticsLabel(RegExp('^Notifikasi')), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Masuk'), findsWidgets);
    expect(find.text('70 poin'), findsNothing);
    expect(find.text('Smart Navigation'), findsOneWidget);

    // Menu umum tetap terbuka untuk tamu.
    await tester.tap(find.text('Smart Navigation'));
    await tester.pumpAndSettle();
    expect(find.text('Segera hadir'), findsOneWidget);
    await tester.tap(find.byTooltip('Kembali'));
    await tester.pumpAndSettle();

    for (final target in [find.text('Rewards'), find.text('Akun')]) {
      await tester.tap(target);
      await tester.pumpAndSettle();
      expect(find.text('Member Login'), findsOneWidget);
      await tester.tap(find.byTooltip('Kembali'));
      await tester.pumpAndSettle();
    }

    await tester.tap(find.bySemanticsLabel(RegExp('^Trip Planner')));
    await tester.pumpAndSettle();
    expect(find.text('Member Login'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
