import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/kampanye.dart';
import 'package:smartmove/screens/campaign/campaign_screen.dart';
import 'package:smartmove/screens/campaign/event_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';

import 'font_preload.dart';
import 'widgets_test.dart' show FakeTiles;

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

final _jam = const Duration(hours: 1);

List<Map<String, Object?>> _events() {
  final now = DateTime.now().toUtc();
  return [
    {
      'id': 'e1',
      'judul': 'CFD Jl. Pemuda',
      'isi': 'Jl. Pemuda ditutup untuk kendaraan bermotor.',
      'jenis': 'cfd',
      'mulai': now.subtract(_jam).toIso8601String(),
      'selesai': now.add(_jam * 3).toIso8601String(),
      'lokasi': {'lat': 3.5844, 'lng': 98.6789},
      'status': 'berlangsung',
    },
    {
      'id': 'e2',
      'judul': 'Konser Lapangan Merdeka',
      'isi': 'Kepadatan sekitar lapangan.',
      'jenis': 'acara',
      'mulai': now.add(_jam * 50).toIso8601String(),
      'selesai': now.add(_jam * 54).toIso8601String(),
      'lokasi': null,
      'status': 'mendatang',
    },
  ];
}

const _tips = [
  {
    'id': 't1',
    'jenis': 'tips',
    'judul': 'Pakai helm SNI',
    'isi': 'Kencangkan talinya.',
    'gambar': null,
    'urutan': 1,
  },
  {
    'id': 't2',
    'jenis': 'tips',
    'judul': 'Jaga jarak aman',
    'isi': 'Tiga detik.',
    'gambar': null,
    'urutan': 2,
  },
];

class _Server {
  final posts = <Map>[];
  int statusFeedback = 201;
  late final client = MockClient((req) async {
    switch (req.url.path) {
      case '/api/campaign/contents':
        final jenis = req.url.queryParameters['jenis'];
        return _json({'items': jenis == 'poster' ? [] : _tips});
      case '/api/campaign/events':
        return _json({'items': _events()});
      case '/api/campaign/feedback':
        posts.add(jsonDecode(req.body) as Map);
        if (statusFeedback == 429) {
          return _json({
            'message': 'Maksimal 3 umpan balik per hari. Terima kasih, coba lagi besok ya',
            'code': 'BATAS_UMPAN_BALIK',
          }, 429);
        }
        return _json({
          'feedback': {'id': 'f1', 'rating': 4},
        }, 201);
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<_Server> _pump(
  WidgetTester tester,
  Widget layar, {
  bool masuk = true,
  _Server? server,
}) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final s = server ?? _Server();
  final api = ApiClient(
    client: s.client,
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
  await tester.pumpWidget(
    AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: layar),
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
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  group('helper kampanye', () {
    test('rentang waktu event dalam WIB', () {
      final now = DateTime.utc(2026, 11, 19, 1); // 08.00 WIB
      expect(
        rentangEvent({
          'mulai': '2026-11-18T23:00:00Z',
          'selesai': '2026-11-19T03:00:00Z',
        }, now),
        'Hari ini, 06.00–10.00 WIB',
      );
      expect(
        rentangEvent({
          'mulai': '2026-11-20T12:00:00Z',
          'selesai': '2026-11-21T02:00:00Z',
        }, now),
        'Besok, 19.00 – 21 Nov, 09.00 WIB',
      );
    });

    test('cocok & URL berkas', () {
      expect(cocok('HELM', ['Pakai helm SNI']), isTrue);
      expect(cocok('banjir', ['Pakai helm', null]), isFalse);
      expect(cocok('  ', ['apa saja']), isTrue);
      expect(urlBerkas(null), isNull);
      expect(urlBerkas('https://x.id/a.png'), 'https://x.id/a.png');
      expect(
        urlBerkas('/uploads/campaign/a.png'),
        endsWith('/uploads/campaign/a.png'),
      );
    });
  });

  testWidgets('hub: 4 menu, event berlangsung, cari menyaring tips', (
    tester,
  ) async {
    await _pump(tester, const CampaignScreen());
    for (final l in [
      'Tips Keselamatan',
      'Poster',
      'EventAlert',
      'Umpan Balik',
    ]) {
      expect(find.bySemanticsLabel(l), findsOneWidget);
    }
    expect(find.text('Sedang berlangsung'), findsOneWidget);
    expect(find.text('CFD Jl. Pemuda'), findsOneWidget);
    expect(find.text('Konser Lapangan Merdeka'), findsNothing);

    await tester.enterText(find.byType(TextField), 'helm');
    await _settle(tester);
    expect(find.text('Pakai helm SNI'), findsOneWidget);
    expect(find.text('Jaga jarak aman'), findsNothing);

    await tester.enterText(find.byType(TextField), 'zzz');
    await _settle(tester);
    expect(find.textContaining('Tidak ada tips atau event'), findsOneWidget);
  });

  testWidgets('Tips: daftar dengan rambu; Poster kosong → keadaan kosong', (
    tester,
  ) async {
    await _pump(tester, const TipsScreen());
    expect(find.text('Pakai helm SNI'), findsOneWidget);
    expect(find.text('Kencangkan talinya.'), findsOneWidget);
    expect(find.byType(Rambu), findsNWidgets(2));

    await _pump(tester, const PosterScreen());
    expect(find.text('Belum ada poster'), findsOneWidget);
  });

  testWidgets('EventAlert: dikelompokkan, pilih event menampilkan isi', (
    tester,
  ) async {
    await _pump(
      tester,
      EventAlertScreen(tileProvider: FakeTiles(), share: (_, _) async {}),
    );
    expect(find.text('Sedang berlangsung'), findsOneWidget);
    expect(find.text('Mendatang'), findsOneWidget);
    expect(find.text('Tanpa titik di peta'), findsOneWidget);
    expect(
      find.text('Jl. Pemuda ditutup untuk kendaraan bermotor.'),
      findsNothing,
    );

    await _tap(tester, find.text('CFD Jl. Pemuda').first);
    expect(
      find.text('Jl. Pemuda ditutup untuk kendaraan bermotor.'),
      findsOneWidget,
    );
    final state = tester.state<EventAlertScreenState>(
      find.byType(EventAlertScreen),
    );
    expect(state.pilihId, 'e1');
  });

  testWidgets('Umpan Balik: tamu diajak masuk', (tester) async {
    await _pump(tester, const FeedbackScreen(), masuk: false);
    expect(find.text('Masuk dulu untuk memberi masukan'), findsOneWidget);
    expect(find.text('Kirim umpan balik'), findsNothing);
  });

  testWidgets('Umpan Balik: bintang wajib, kirim → POST + terima kasih', (
    tester,
  ) async {
    final server = await _pump(tester, const FeedbackScreen());
    final kirim = find.widgetWithText(FilledButton, 'Kirim umpan balik');
    expect(tester.widget<FilledButton>(kirim).onPressed, isNull);
    expect(find.text('Pilih bintang dulu untuk mengirim.'), findsOneWidget);

    await _tap(tester, find.bySemanticsLabel('4 dari 5, bagus'));
    expect(find.text('Bagus'), findsOneWidget);
    await _tap(tester, find.text('Live Traffic'));
    await tester.enterText(find.byType(TextField), '  Laporannya membantu  ');
    await _tap(tester, kirim);

    expect(server.posts.single, {
      'rating': 4,
      'komentar': 'Laporannya membantu',
      'fitur': 'lalu_lintas',
    });
    expect(find.text('Terima kasih!'), findsOneWidget);

    await _tap(tester, find.text('Kirim masukan lain'));
    expect(find.text('Seberapa membantu SmartMove buatmu?'), findsOneWidget);
  });

  testWidgets('Umpan Balik: batas harian → pesan dari server', (tester) async {
    final server = _Server()..statusFeedback = 429;
    await _pump(tester, const FeedbackScreen(), server: server);
    await _tap(tester, find.bySemanticsLabel('5 dari 5, bagus sekali'));
    await _tap(tester, find.widgetWithText(FilledButton, 'Kirim umpan balik'));
    expect(
      find.textContaining('Maksimal 3 umpan balik per hari'),
      findsOneWidget,
    );
    expect(find.text('Terima kasih!'), findsNothing);
  });
}
