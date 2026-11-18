import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/navigasi.dart';
import 'package:smartmove/screens/navigation/navigation_screen.dart'
    show LokasiHasil;
import 'package:smartmove/screens/trip/trip_planner_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/trip.dart';

import 'font_preload.dart';

http.Response _json(Object? body, [int status = 200]) => http.Response(
  body == null ? '' : jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

// 19 Nov 2026 05.00 WIB.
final _now = DateTime.utc(2026, 11, 18, 22);

Map<String, Object?> _tempat(String nama, double lat, double lng) => {
  'nama': nama,
  'lokasi': {'lat': lat, 'lng': lng},
};

Map<String, Object?> _trip(
  String id, {
  String? judul,
  required String tujuan,
  String moda = 'driving',
  DateTime? berangkat,
  Map<String, Object?>? ringkasan,
}) => {
  'id': id,
  'judul': judul,
  'asal': _tempat('Jalan Setia Budi', 3.5732, 98.6355),
  'tujuan': _tempat(tujuan, 3.5617, 98.6566),
  'moda': moda,
  'berangkatPada': berangkat?.toIso8601String(),
  'ringkasan': ringkasan,
  'createdAt': '2026-11-18T20:00:00.000Z',
  'updatedAt': '2026-11-18T20:00:00.000Z',
};

class _Server {
  _Server(this.trips);
  final List<Map<String, Object?>> trips;
  final List<http.Request> calls = [];

  http.Client get client => MockClient((req) async {
    calls.add(req);
    final path = req.url.path;
    if (path == '/api/trips' && req.method == 'GET') {
      return _json({'items': trips, 'page': 1, 'total': trips.length});
    }
    if (path == '/api/trips' && req.method == 'POST') {
      final b = jsonDecode(req.body) as Map<String, dynamic>;
      return _json({
        'trip': {...b, 'id': 'baru'},
      }, 201);
    }
    if (path.startsWith('/api/trips/') && req.method == 'DELETE') {
      return _json(null, 204);
    }
    if (path == '/api/places/search') {
      return _json({
        'items': [
          {
            'id': 'osm:n1',
            'nama': 'Lapangan Merdeka',
            'alamat': 'Kesawan',
            'lokasi': {'lat': 3.5913, 'lng': 98.6776},
          },
        ],
      });
    }
    if (path == '/api/places/reverse') {
      return _json({
        'tempat': {
          'id': 'x',
          'nama': 'Jalan Setia Budi',
          'lokasi': {'lat': 3.5732, 'lng': 98.6355},
        },
      });
    }
    if (path == '/api/routes') {
      return _json({
        'jarakM': 4100,
        'durasiS': 420,
        'garis': [],
        'langkah': [],
      });
    }
    return _json({'message': 'x'}, 404);
  });
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

Future<_Server> _pump(
  WidgetTester tester,
  List<Map<String, Object?>> trips, {
  void Function(Trip)? mulai,
}) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _Server(trips);
  final api = ApiClient(
    client: server.client,
    tokens: MemoryTokenStore('t'),
    baseUrl: 'http://api.test/api',
  );
  await tester.pumpWidget(
    AppScope(
      state: AppState(api),
      child: MaterialApp(
        theme: buildTheme(),
        home: TripPlannerScreen(
          clock: () => _now,
          locate: () async => const LokasiHasil('ok', LatLng(3.5732, 98.6355)),
          mulai: (_, t) => mulai?.call(t),
        ),
      ),
    ),
  );
  await _settle(tester);
  return server;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  group('helper trip', () {
    test('kelompokkan: berikutnya, per hari, kapan saja, sudah lewat', () {
      final trips = [
        _trip('a', tujuan: 'A', berangkat: _now.add(const Duration(hours: 26))),
        _trip('b', tujuan: 'B', berangkat: _now.add(const Duration(hours: 2))),
        _trip('c', tujuan: 'C'),
        _trip(
          'd',
          tujuan: 'D',
          berangkat: _now.subtract(const Duration(hours: 3)),
        ),
        _trip(
          'e',
          tujuan: 'E',
          berangkat: _now.subtract(const Duration(minutes: 10)),
        ),
      ].map(Trip.fromJson).toList();
      final k = kelompokkan(trips, _now);
      expect(k.berikutnya?.id, 'e');
      expect(k.grup.map((g) => g.judul), ['Hari ini', 'Besok', 'Kapan saja']);
      expect(k.grup.first.items.map((t) => t.id), ['e', 'b']);
      expect(k.lewat.map((t) => t.id), ['d']);
    });

    test('jam WIB pemilih ↔ UTC', () {
      final utc = waktuWib(
        DateTime(2026, 11, 20),
        const TimeOfDay(hour: 7, minute: 30),
      );
      expect(utc, DateTime.utc(2026, 11, 20, 0, 30));
      final w = keWib(utc);
      expect(w.tanggal, DateTime(2026, 11, 20));
      expect(labelJam(w.jam), '07.30');
    });

    test('ringkasan & hitung mundur', () {
      expect(teksRingkasan({'durasiS': 420, 'jarakM': 4100}), '7 mnt · 4,1 km');
      expect(teksRingkasan(null), isNull);
      expect(
        hitungMundur(_now.add(const Duration(minutes: 95)), _now),
        'Berangkat dalam 1 j 35 mnt',
      );
      expect(hitungMundur(_now, _now), 'Waktunya berangkat');
      expect(ModaTrip.transit.navigasi, isNull);
      expect(ModaTrip.motorcycle.navigasi, Moda.motorcycle);
    });
  });

  testWidgets('daftar: kartu berikutnya, grup hari, transit bertanda segera', (
    tester,
  ) async {
    await _pump(tester, [
      _trip(
        'a',
        judul: 'Berangkat kuliah',
        tujuan: 'Universitas Sumatera Utara',
        moda: 'motorcycle',
        berangkat: _now.add(const Duration(minutes: 95)),
        ringkasan: {'durasiS': 420, 'jarakM': 4100},
      ),
      _trip(
        'b',
        tujuan: 'Stasiun Medan',
        moda: 'transit',
        berangkat: _now.add(const Duration(hours: 27)),
      ),
      _trip('c', tujuan: 'Lapangan Merdeka'),
    ]);
    expect(
      find.bySemanticsLabel(RegExp('^Perjalanan berikutnya')),
      findsOneWidget,
    );
    expect(find.text('06.35'), findsWidgets);
    expect(find.text('Berangkat dalam 1 j 35 mnt'), findsOneWidget);
    expect(find.text('Estimasi 7 mnt · 4,1 km'), findsOneWidget);
    expect(find.text('Hari ini'), findsOneWidget);
    expect(find.text('Kapan saja'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Navigasi segera hadir'), 200);
    expect(find.text('Navigasi segera hadir'), findsOneWidget);
  });

  testWidgets('kosong: ajakan membuat rencana', (tester) async {
    await _pump(tester, []);
    expect(find.text('Mau ke mana berikutnya?'), findsOneWidget);
    expect(find.text('Belum ada rencana'), findsOneWidget);
  });

  testWidgets('Mulai navigasi membawa asal, tujuan, dan moda rencana', (
    tester,
  ) async {
    Trip? dibuka;
    await _pump(tester, [
      _trip(
        'a',
        tujuan: 'Universitas Sumatera Utara',
        moda: 'walking',
        berangkat: _now.add(const Duration(hours: 1)),
      ),
    ], mulai: (t) => dibuka = t);
    await _tap(tester, find.text('Mulai navigasi').first);
    expect(dibuka?.id, 'a');
    expect(dibuka?.moda.navigasi, Moda.walking);
    expect(dibuka?.asal.nama, 'Jalan Setia Budi');
    expect(dibuka?.tujuan.lokasi, const LatLng(3.5617, 98.6566));
  });

  testWidgets('hapus rencana setelah konfirmasi', (tester) async {
    final server = await _pump(tester, [
      _trip('a', tujuan: 'Lapangan Merdeka'),
    ]);
    await _tap(tester, find.byTooltip('Hapus rencana'));
    expect(find.text('Hapus rencana ini?'), findsOneWidget);
    await _tap(tester, find.widgetWithText(FilledButton, 'Hapus'));
    expect(
      server.calls.any(
        (r) => r.method == 'DELETE' && r.url.path == '/api/trips/a',
      ),
      isTrue,
    );
    expect(find.text('Rencana dihapus.'), findsOneWidget);
    expect(find.text('Belum ada rencana'), findsOneWidget);
  });

  testWidgets('buat rencana: pilih tempat, transit belum bisa, simpan', (
    tester,
  ) async {
    final server = await _pump(tester, []);
    await _tap(tester, find.text('Buat rencana'));
    expect(find.text('Rencana baru'), findsOneWidget);

    // Asal dari lokasi perangkat.
    await _tap(tester, find.text('Pilih titik asal'));
    await _tap(tester, find.text('Pakai lokasi saat ini'));
    expect(find.text('Jalan Setia Budi'), findsOneWidget);

    // Tujuan dari pencarian.
    await _tap(tester, find.text('Pilih tujuan'));
    await tester.enterText(find.byType(TextField), 'merdeka');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await _settle(tester);
    await _tap(tester, find.text('Lapangan Merdeka'));

    // Transit masih "Segera": moda tidak berubah.
    await _tap(
      tester,
      find.bySemanticsLabel('Transportasi umum, segera hadir'),
    );
    expect(find.textContaining('sedang disiapkan'), findsOneWidget);
    await _tap(tester, find.bySemanticsLabel('Motor'));
    expect(find.text('Estimasi 7 mnt · 4,1 km'), findsOneWidget);

    await _tap(tester, find.text('Simpan rencana'));
    final post = server.calls.lastWhere((r) => r.method == 'POST');
    final body = jsonDecode(post.body) as Map;
    expect(body['moda'], 'motorcycle');
    expect((body['asal'] as Map)['nama'], 'Jalan Setia Budi');
    expect((body['tujuan'] as Map)['lokasi'], {'lat': 3.5913, 'lng': 98.6776});
    expect(body['berangkatPada'], isNull);
    expect(body['ringkasan'], {'jarakM': 4100, 'durasiS': 420});
    expect(find.text('Rencana disimpan.'), findsOneWidget);
    expect(find.text('Rencana baru'), findsNothing);
  });
}
