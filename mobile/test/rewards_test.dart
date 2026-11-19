import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/screens/rewards/rewards_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';

import 'font_preload.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

class Server {
  int saldo = 250;
  int stok = 3;
  bool habisSaatTukar = false;
  final redemptions = <Map<String, Object?>>[];
  final posts = <String>[];

  Map<String, Object?> get _parkir => {
    'id': 'v1',
    'nama': 'Gratis 1 jam parkir',
    'deskripsi': 'Di parkir mitra.',
    'syarat': 'Satu kode untuk satu kendaraan.',
    'poin': 150,
    'stok': stok,
    'berlakuSampai': '2026-12-19T00:00:00.000Z',
    'tersedia': stok > 0,
  };

  late final client = MockClient((req) async {
    switch (req.url.path) {
      case '/api/rewards':
        return _json({
          'saldo': saldo,
          'items': [
            {
              'id': 'l1',
              'jumlah': 70,
              'alasan': 'pembayaran',
              'label': 'Pemesanan lunas',
              'ref': 'SM-1',
              'createdAt': '2026-11-19T03:00:00.000Z',
            },
            {
              'id': 'l2',
              'jumlah': -100,
              'alasan': 'tukar_voucher',
              'label': 'Tukar voucher',
              'ref': 'r0',
              'createdAt': '2026-11-18T03:00:00.000Z',
            },
          ],
          'page': 1,
          'total': 2,
        });
      case '/api/rewards/vouchers':
        return _json({
          'items': [
            _parkir,
            {
              'id': 'v2',
              'nama': 'Merchandise',
              'deskripsi': null,
              'syarat': null,
              'poin': 800,
              'stok': 2,
              'berlakuSampai': null,
              'tersedia': true,
            },
          ],
        });
      case '/api/rewards/redemptions':
        return _json({
          'items': redemptions,
          'page': 1,
          'total': redemptions.length,
        });
      case '/api/rewards/vouchers/v1/redeem':
        posts.add(req.url.path);
        if (habisSaatTukar) {
          stok = 0;
          return _json({
            'message': 'Stok voucher ini sudah habis.',
            'code': 'STOK_HABIS',
          }, 409);
        }
        saldo -= 150;
        stok -= 1;
        final r = {
          'id': 'r1',
          'kode': 'SMV-ABCD-EFGH',
          'status': 'aktif',
          'voucher': {
            'id': 'v1',
            'nama': 'Gratis 1 jam parkir',
            'poin': 150,
            'berlakuSampai': null,
            'syarat': null,
            'deskripsi': null,
          },
          'createdAt': '2026-11-19T03:00:00.000Z',
        };
        redemptions.add(r);
        return _json({'redemption': r, 'saldo': saldo}, 201);
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<Server> _pump(WidgetTester tester, [Server? server]) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final s = server ?? Server();
  final api = ApiClient(
    client: s.client,
    tokens: MemoryTokenStore(),
    baseUrl: 'http://api.test/api',
    hasInternet: () async => true,
  );
  final state = AppState(api);
  await state.setSession({
    'token': 't',
    'user': {'id': 'u1', 'username': 'uji', 'role': 'user'},
  });
  await tester.pumpWidget(
    AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: const RewardsScreen()),
    ),
  );
  await _settle(tester);
  return s;
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
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

  testWidgets(
    'saldo + katalog: tukar butuh konfirmasi, lalu kode tampil & saldo berkurang',
    (tester) async {
      final s = await _pump(tester);
      expect(find.bySemanticsLabel('Poin kamu 250'), findsOneWidget);
      expect(find.text('Gratis 1 jam parkir'), findsOneWidget);
      expect(find.text('Kurang 550 poin'), findsOneWidget);

      await _tap(tester, find.widgetWithText(OutlinedButton, 'Tukar'));
      expect(s.posts, isEmpty);
      await _tap(tester, find.text('Tukar 150 poin?'));
      expect(s.posts, ['/api/rewards/vouchers/v1/redeem']);
      expect(find.text('SMV-ABCD-EFGH'), findsOneWidget);
      expect(
        tester.state<RewardsScreenState>(find.byType(RewardsScreen)).saldo,
        100,
      );
      expect(find.text('Sisa 2, berlaku sampai 19 Des 2026'), findsOneWidget);
    },
  );

  testWidgets('stok habis saat ditukar → pesan galat, katalog dimuat ulang', (
    tester,
  ) async {
    final server = Server()..habisSaatTukar = true;
    await _pump(tester, server);
    await _tap(tester, find.widgetWithText(OutlinedButton, 'Tukar'));
    await _tap(tester, find.text('Tukar 150 poin?'));
    expect(find.text('Stok voucher ini sudah habis.'), findsOneWidget);
    expect(find.text('Habis'), findsOneWidget);
  });

  testWidgets('Voucher saya & Riwayat', (tester) async {
    final server = Server()
      ..redemptions.add({
        'id': 'r0',
        'kode': 'SMV-AAAA-BBBB',
        'status': 'aktif',
        'voucher': {
          'id': 'v1',
          'nama': 'Gratis 1 jam parkir',
          'poin': 150,
          'berlakuSampai': null,
          'syarat': null,
          'deskripsi': null,
        },
        'createdAt': '2026-11-18T03:00:00.000Z',
      });
    await _pump(tester, server);
    await _tap(tester, find.text('Voucher saya'));
    expect(find.text('SMV-AAAA-BBBB'), findsOneWidget);
    expect(find.text('Bisa dipakai'), findsOneWidget);
    expect(find.byTooltip('Salin kode SMV-AAAA-BBBB'), findsOneWidget);

    await _tap(tester, find.text('Riwayat'));
    expect(find.text('Pemesanan lunas'), findsOneWidget);
    expect(find.text('+70'), findsOneWidget);
    expect(find.text('−100'), findsOneWidget);
  });
}
