import 'dart:convert';

import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/lalulintas.dart';
import 'package:smartmove/screens/navigation/navigation_screen.dart';
import 'package:smartmove/screens/traffic/traffic_layers.dart';
import 'package:smartmove/screens/traffic/traffic_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';

import 'font_preload.dart';
import 'widgets_test.dart' show FakeTiles;

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

final _koridor = [
  {
    'kode': 'GATSU',
    'nama': 'Jl. Gatot Subroto',
    'tersedia': true,
    'jarakM': 7700,
    'durasiNormalS': 420,
    'durasiS': 660,
    'tingkat': 'padat',
    'laporan': 1,
    'kejadian': ['banjir'],
    'ditutup': false,
    'garis': [
      [98.6055, 3.5991],
      [98.64, 3.5905],
      [98.6716, 3.5906],
    ],
    'segmen': [
      {
        'tingkat': 'macet',
        'garis': [
          [98.63, 3.591],
          [98.64, 3.5905],
        ],
      },
    ],
  },
  {
    'kode': 'SMRAJA',
    'nama': 'Jl. Sisingamangaraja',
    'tersedia': true,
    'jarakM': 6784,
    'durasiNormalS': 365,
    'durasiS': 365,
    'tingkat': null,
    'laporan': 0,
    'kejadian': <String>[],
    'ditutup': false,
    'garis': [
      [98.7149, 3.5365],
      [98.6846, 3.5823],
    ],
    'segmen': <Map>[],
  },
];

Map<String, Object?> _laporan(String id, {String kejadian = 'none'}) => {
  'id': id,
  'lokasi': {'lat': 3.6, 'lng': 98.678},
  'tingkat': 'macet',
  'kejadian': kejadian,
  'catatan': 'Air setinggi mata kaki',
  'konfirmasi': 2,
  'createdAt': DateTime.now()
      .subtract(const Duration(minutes: 12))
      .toIso8601String(),
  'diperbaruiPada': DateTime.now().toIso8601String(),
  'expiresAt': DateTime.now()
      .add(const Duration(minutes: 108))
      .toIso8601String(),
};

class _Server {
  final posts = <Map>[];
  late final client = MockClient((req) async {
    switch (req.url.path) {
      case '/api/traffic/corridors':
        return _json({
          'items': _koridor,
          'sumber': 'komunitas',
          'diperbaruiPada': '2026-11-19T03:30:00Z',
        });
      case '/api/traffic':
        return _json({
          'items': [_laporan('r1', kejadian: 'banjir')],
          'sumber': 'komunitas',
        });
      case '/api/traffic/reports':
        final body = jsonDecode(req.body) as Map;
        posts.add(body);
        return _json({
          'laporan': {..._laporan('r2'), 'tingkat': body['tingkat']},
          'digabung': false,
        }, 201);
      case '/api/places/reverse':
        return _json({
          'tempat': {
            'nama': 'Jalan Gatot Subroto',
            'lokasi': {'lat': 3.59, 'lng': 98.64},
          },
        });
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<(TrafficScreenState, _Server)> _pump(
  WidgetTester tester, {
  bool masuk = true,
}) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _Server();
  final api = ApiClient(
    client: server.client,
    tokens: MemoryTokenStore(),
    baseUrl: 'http://api.test/api',
    hasInternet: () async => true,
  );
  final state = AppState(api);
  if (masuk) {
    await state.setSession({
      'token': 't',
      'user': {'id': 'u1', 'username': 'uji', 'role': 'user'},
    });
  }
  final data = LaluLintasData(api, segarkan: const Duration(hours: 1));
  addTearDown(data.dispose);
  await tester.pumpWidget(
    AppScope(
      state: state,
      child: MaterialApp(
        theme: buildTheme(),
        home: TrafficScreen(
          locate: () async => const LokasiHasil('ok', LatLng(3.5905, 98.6400)),
          share: (_, _) async {},
          tileProvider: FakeTiles(),
          data: data,
        ),
      ),
    ),
  );
  await _settle(tester);
  return (tester.state<TrafficScreenState>(find.byType(TrafficScreen)), server);
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
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  group('helper lalu lintas', () {
    test('waktu, jarak, tambahan waktu', () {
      expect(formatMenit(660), '11 mnt');
      expect(formatMenit(null), '–');
      expect(formatKm(7700), '7,7 km');
      expect(teksTunda(_koridor[0]), '+4 mnt');
      expect(teksTunda(_koridor[1]), '');
    });

    test('bbox dipotong maks. 1°', () {
      final b = LatLngBounds(const LatLng(2.0, 97.0), const LatLng(5.0, 100.0));
      expect(bboxDari(b), '98.0000,3.0000,99.0000,4.0000');
    });

    test('teks bagikan menyebut tingkat & tambahan waktu', () {
      final teks = teksBagikanLaluLintas(_koridor);
      expect(teks, contains('Jl. Gatot Subroto: 11 mnt (+4 mnt), padat'));
      expect(teks, contains('Jl. Sisingamangaraja: 6 mnt, belum ada laporan'));
    });
  });

  testWidgets('Estimasi Waktu: daftar koridor, kotak waktu, label Lapor', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.text('Live Traffic Information'), findsOneWidget);
    expect(find.text('Jl. Gatot Subroto'), findsOneWidget);
    expect(find.text('biasanya 7 mnt'), findsOneWidget);
    expect(find.text('Banjir'), findsOneWidget);
    // Kotak waktu di peta + angka besar di daftar.
    expect(find.text('11 mnt'), findsNWidgets(2));
    expect(find.text('Belum ada laporan'), findsWidgets);
    // Bar sempit 360 dp: "Laporkan" ditulis pendek, label penuh untuk pembaca layar.
    expect(find.text('Lapor'), findsOneWidget);
    expect(find.bySemanticsLabel('Laporkan'), findsOneWidget);
  });

  testWidgets('Peta Interaktif: penanda laporan → detail', (tester) async {
    await _pump(tester);
    await _tap(tester, find.text('Peta Interaktif'));
    expect(find.text('1 laporan warga di area ini'), findsOneWidget);
    final penanda = find.byType(PenandaLaporan);
    expect(penanda, findsOneWidget);
    expect(find.bySemanticsLabel('Laporan Macet, Banjir'), findsOneWidget);
    await _tap(tester, penanda);
    expect(find.text('“Air setinggi mata kaki”'), findsOneWidget);
    expect(find.textContaining('dikonfirmasi 2 warga'), findsOneWidget);
    expect(find.text('Masih begini di sini'), findsOneWidget);
  });

  testWidgets(
    'Laporkan: pilih tingkat & kejadian → POST + pesan terima kasih',
    (tester) async {
      final (_, server) = await _pump(tester);
      await _tap(tester, find.text('Lapor'));
      expect(find.text('Laporkan kondisi jalan'), findsOneWidget);
      expect(find.text('Jalan Gatot Subroto'), findsOneWidget);
      // Kirim belum aktif sebelum tingkat dipilih.
      final kirim = find.widgetWithText(FilledButton, 'Kirim laporan');
      expect(tester.widget<FilledButton>(kirim).onPressed, isNull);

      await _tap(tester, find.text('Macet').last);
      await _tap(tester, find.text('Penutupan jalan'));
      await tester.enterText(find.byType(TextField).first, 'Ditutup polisi');
      await _tap(tester, kirim);

      expect(server.posts, hasLength(1));
      expect(server.posts.single['tingkat'], 'macet');
      expect(server.posts.single['kejadian'], 'penutupan');
      expect(server.posts.single['catatan'], 'Ditutup polisi');
      expect(server.posts.single['lokasi'], isA<Map>());
      expect(find.text(pesanLaporanTerkirim), findsOneWidget);
      // Pindah ke Peta Interaktif.
      expect(find.text('Laporkan kondisi jalan'), findsNothing);
    },
  );

  testWidgets('tamu menekan Laporkan → layar Masuk', (tester) async {
    final (_, server) = await _pump(tester, masuk: false);
    await _tap(tester, find.text('Lapor'));
    expect(find.text('Laporkan kondisi jalan'), findsNothing);
    expect(find.text('Member Login'), findsWidgets);
    expect(server.posts, isEmpty);
  });
}
