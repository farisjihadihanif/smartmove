import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/pembayaran.dart';
import 'package:smartmove/screens/payment/payment_screen.dart';
import 'package:smartmove/screens/payment/payment_status_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/trip.dart';

import 'font_preload.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

// 19 Nov 2026 10.00 WIB.
final now = DateTime.utc(2026, 11, 19, 3);

Map<String, Object?> _kereta() => {
  'kode': 'RAILINK-KNO',
  'jenis': 'kereta',
  'operator': 'Railink',
  'nama': 'Kereta Bandara Medan → Kualanamu',
  'asal': 'Stasiun Medan',
  'tujuan': 'Bandara Kualanamu',
  'harga': 35000,
  'satuan': 'orang',
  'jadwal': ['06:40', '18:30'],
  'tanggal': '2026-11-19',
  'slot': [
    {'jam': '06:40', 'waktu': '2026-11-18T23:40:00.000Z', 'tersedia': false},
    {'jam': '18:30', 'waktu': '2026-11-19T11:30:00.000Z', 'tersedia': true},
  ],
};

Map<String, Object?> _parkir() => {
  'kode': 'PARKIR-MERDEKA',
  'jenis': 'parkir',
  'operator': null,
  'nama': 'Parkir Lapangan Merdeka',
  'asal': 'Lapangan Merdeka',
  'tujuan': null,
  'harga': 5000,
  'satuan': 'jam',
  'jadwal': <String>[],
  'tanggal': '2026-11-19',
  'slot': <Object>[],
};

/// Batas bayar contoh (null = 25 menit dari jam asli).
String? batasUji;

var _instruksi = <String, Object?>{
  'grup': 'qris',
  'metode': 'qris',
  'qrString': '00020101021226QRIS-PALSU',
  'qrUrl': null,
  'deeplink': null,
  'bank': null,
  'nomorVa': null,
  'kodePerusahaan': null,
  'kodeBayar': null,
};

Map<String, Object?> _bayar(String status) => {
  'orderId': 'SM-20261119-ABCDEF',
  'layanan': {
    'kode': 'RAILINK-KNO',
    'nama': 'Kereta Bandara Medan → Kualanamu',
    'jenis': 'kereta',
    'operator': 'Railink',
    'asal': 'Stasiun Medan',
    'tujuan': 'Bandara Kualanamu',
    'harga': 35000,
  },
  'jadwal': '2026-11-19T11:30:00.000Z',
  'penumpang': 2,
  'jumlah': 70000,
  'status': status,
  'metode': status == 'lunas' ? 'qris' : null,
  'eTiket': status == 'lunas' ? {'kode': 'SIM-ABCD-EFGH'} : null,
  'poin': status == 'lunas' ? 70 : 0,
  'instruksi': status == 'menunggu' ? _instruksi : null,
  'batasBayar':
      batasUji ??
      DateTime.now().toUtc().add(const Duration(minutes: 25)).toIso8601String(),
  'simulasi': true,
  'label': labelSimulasi,
};

class Server {
  final posts = <String, Map>{};
  final queries = <Map<String, String>>[];
  String statusBayar = 'menunggu';
  String statusSetelahCek = 'menunggu';
  late final client = MockClient((req) async {
    final path = req.url.path;
    if (path == '/api/payments/services') {
      queries.add(req.url.queryParameters);
      final rute = req.url.queryParameters.containsKey('asal');
      return _json({
        'items': rute ? <Object>[] : [_kereta(), _parkir()],
        'tanggal': '2026-11-19',
      });
    }
    if (path == '/api/payments' && req.method == 'POST') {
      posts[path] = jsonDecode(req.body) as Map;
      return _json({
        'orderId': 'SM-20261119-ABCDEF',
        'payment': _bayar('menunggu'),
      }, 201);
    }
    if (path == '/api/payments/SM-20261119-ABCDEF') {
      return _json({'payment': _bayar(statusBayar)});
    }
    if (path == '/api/payments/SM-20261119-ABCDEF/cek') {
      posts[path] = {};
      return _json({'payment': _bayar(statusSetelahCek)});
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<Server> _pump(
  WidgetTester tester,
  Widget layar, {
  bool masuk = true,
  Server? server,
}) async {
  await preloadFonts();
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
  group('helper', () {
    test('rupiah & tanggal WIB', () {
      expect(rupiah(70000), 'Rp70.000');
      expect(rupiah(5000), 'Rp5.000');
      expect(rupiah(1234567), 'Rp1.234.567');
      expect(tanggalWib(DateTime.utc(2026, 11, 19, 18)), '2026-11-20');
      expect(
        waktuLengkap(DateTime.utc(2026, 11, 19, 11, 30)),
        'Kam, 19 Nov 2026, 18.30 WIB',
      );
    });

    test('pesanan dari rencana: umum → tiket, mobil → parkir di tujuan, jalan kaki → tidak ada', () {
      Trip trip(String moda) => Trip.fromJson({
        'id': 't1',
        'asal': {
          'nama': 'Stasiun Medan',
          'lokasi': {'lat': 3.59, 'lng': 98.68},
        },
        'tujuan': {
          'nama': 'Kualanamu',
          'lokasi': {'lat': 3.64, 'lng': 98.88},
        },
        'moda': moda,
        'berangkatPada': '2026-11-19T18:00:00.000Z',
      });
      final umum = pesananDariTrip(trip('transit'))!;
      expect(
        (umum.asal, umum.tujuan, umum.jenis, umum.tanggal),
        ('Stasiun Medan', 'Kualanamu', null, '2026-11-20'),
      );
      final mobil = pesananDariTrip(trip('driving'))!;
      expect(
        (mobil.asal, mobil.tujuan, mobil.jenis),
        ('Kualanamu', null, 'parkir'),
      );
      expect(pesananDariTrip(trip('walking')), isNull);
    });
  });

  testWidgets(
    'pilih layanan + jam → estimasi biaya → metode → layar instruksi bayar',
    (tester) async {
      final s = await _pump(tester, PaymentScreen(clock: () => now));
      expect(find.textContaining(labelSimulasi), findsWidgets);
      expect(find.text('Kereta Bandara Medan → Kualanamu'), findsOneWidget);
      expect(find.text('Rp35.000'), findsOneWidget);

      await _tap(tester, find.text('Kereta Bandara Medan → Kualanamu'));
      expect(find.text('Jam keberangkatan (WIB)'), findsOneWidget);
      expect(find.bySemanticsLabel('06.40, sudah lewat'), findsOneWidget);

      await _tap(tester, find.text('18.30'));
      // Pindah ke Estimasi biaya.
      expect(find.text('Kam, 19 Nov 2026, 18.30 WIB'), findsOneWidget);
      await _tap(tester, find.byTooltip('Tambah orang'));
      expect(find.text('Rp70.000'), findsOneWidget);
      await _tap(tester, find.text('Virtual account'));
      expect(find.text('BCA'), findsOneWidget);
      await _tap(tester, find.text('QRIS'));
      expect(find.text('BCA'), findsNothing);

      await _tap(tester, find.bySemanticsLabel('Bayar Rp70.000'));
      expect(s.posts['/api/payments'], {
        'layanan': 'RAILINK-KNO',
        'jadwal': '2026-11-19T11:30:00.000Z',
        'penumpang': 2,
        'metode': 'qris',
      });
      expect(find.byType(PaymentStatusScreen), findsOneWidget);
      expect(find.text('Menunggu pembayaran'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('QRIS, bisa dipindai semua aplikasi pembayaran'),
        200,
        scrollable: find
            .descendant(
              of: find.byType(PaymentStatusScreen),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.byType(QrImageView), findsOneWidget);
      expect(find.text('Cek sekarang'), findsOneWidget);
      // Bersihkan timer pembaruan otomatis.
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('tamu: tombol bayar meminta masuk', (tester) async {
    await _pump(tester, PaymentScreen(clock: () => now), masuk: false);
    expect(find.bySemanticsLabel('Masuk untuk bayar'), findsOneWidget);
    expect(find.text('Riwayat pemesanan'), findsNothing);
  });

  testWidgets(
    'dari Trip Planner: rute tidak cocok → keterangan + semua layanan',
    (tester) async {
      final s = await _pump(
        tester,
        PaymentScreen(
          clock: () => now,
          asal: 'Jl. Gatot Subroto',
          tujuan: 'Pancur Batu',
        ),
      );
      expect(s.queries.any((q) => q['asal'] == 'Jl. Gatot Subroto'), isTrue);
      expect(
        find.textContaining(
          'Belum ada layanan untuk rute Jl. Gatot Subroto → Pancur Batu',
        ),
        findsOneWidget,
      );
      expect(find.text('Kereta Bandara Medan → Kualanamu'), findsOneWidget);
    },
  );

  testWidgets('saring jenis Parkir', (tester) async {
    await _pump(tester, PaymentScreen(clock: () => now, jenis: 'parkir'));
    expect(find.text('Parkir Lapangan Merdeka'), findsOneWidget);
    expect(find.text('Kereta Bandara Medan → Kualanamu'), findsNothing);
    expect(find.text('per jam'), findsOneWidget);
  });

  testWidgets(
    'status menunggu dicek otomatis; lunas → e-tiket bercap SIMULASI',
    (tester) async {
      final server = Server()..statusSetelahCek = 'lunas';
      final s = await _pump(
        tester,
        const PaymentStatusScreen(orderId: 'SM-20261119-ABCDEF'),
        server: server,
      );
      expect(
        s.posts.containsKey('/api/payments/SM-20261119-ABCDEF/cek'),
        isTrue,
      );
      expect(find.text('E-tiket'), findsOneWidget);
      expect(find.text('SIMULASI'), findsOneWidget);
      expect(find.text('bukan tiket resmi'), findsOneWidget);
      expect(find.text('SIM-ABCD-EFGH'), findsOneWidget);
      expect(find.textContaining(labelSimulasi), findsWidgets);
      await tester.scrollUntilVisible(
        find.text('+70 poin masuk ke Rewards'),
        200,
      );
      expect(find.text('+70 poin masuk ke Rewards'), findsOneWidget);
    },
  );

  testWidgets(
    'virtual account: nomor VA, hitung mundur, Salin; waktu habis memicu cek',
    (tester) async {
      final server = Server();
      _instruksi = {
        ..._instruksi,
        'grup': 'va',
        'metode': 'bni',
        'qrString': null,
        'bank': 'bni',
        'nomorVa': '9881234567890',
      };
      addTearDown(
        () => _instruksi = {
          ..._instruksi,
          'grup': 'qris',
          'metode': 'qris',
          'qrString': '00020101021226QRIS-PALSU',
        },
      );
      batasUji = '2026-11-19T11:15:00.000Z';
      addTearDown(() => batasUji = null);
      var jam = DateTime.utc(
        2026,
        11,
        19,
        10,
        50,
      ); // 25 menit sebelum batas 11.15Z
      await _pump(
        tester,
        PaymentStatusScreen(orderId: 'SM-20261119-ABCDEF', clock: () => jam),
        server: server,
      );
      expect(find.text('Virtual account BNI'), findsOneWidget);
      expect(find.text('9881234567890'), findsOneWidget);
      expect(find.text('25:00'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Salin nomor virtual account'),
        findsOneWidget,
      );
      final cekAwal = server.posts.length;

      jam = DateTime.utc(2026, 11, 19, 11, 16);
      await tester.pump(const Duration(seconds: 1));
      await _settle(tester);
      expect(find.text('00:00'), findsOneWidget);
      expect(find.text('Batas bayar sudah lewat'), findsOneWidget);
      expect(find.text('9881234567890'), findsNothing);
      expect(server.posts.length, greaterThanOrEqualTo(cekAwal));
      await tester.pumpWidget(const SizedBox());
    },
  );
}
