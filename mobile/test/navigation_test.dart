import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/navigasi.dart';
import 'package:smartmove/screens/navigation/navigation_screen.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/transit.dart';
import 'package:smartmove/widgets/widgets.dart';

import 'font_preload.dart';
import 'widgets_test.dart' show FakeTiles;

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const _usu = LatLng(3.5617, 98.6566);

final _rute = {
  'mode': 'driving',
  'jarakM': 6099,
  'durasiS': 563,
  'garis': [
    [98.6566, 3.5617],
    [98.66, 3.57],
    [98.6747, 3.5855],
  ],
  'langkah': [
    {
      'teks': 'Mulai di Jalan Universitas',
      'jarakM': 120,
      'lokasi': [98.6566, 3.5617],
    },
    {
      'teks': 'Belok kiri ke Jalan Dr. Mansyur',
      'jarakM': 350,
      'lokasi': [98.66, 3.57],
    },
    {
      'teks': 'Tiba di tujuan',
      'jarakM': 0,
      'lokasi': [98.6747, 3.5855],
    },
  ],
};

Map<String, Object?> _titik(String nama, double lat, double lng) => {
  'nama': nama,
  'lokasi': {'lat': lat, 'lng': lng},
};

/// Opsi dengan 1 transfer: jalan → angkot (tanpa halte) → angkot → jalan.
final _transit = {
  'opsi': [
    {
      'totalS': 1980,
      'jalanM': 271,
      'transfer': 1,
      'perkiraan': false,
      'tarif': null,
      'tarifTeks': 'Tarif belum tersedia',
      'bagian': [
        {
          'jenis': 'jalan',
          'jarakM': 105,
          'durasiS': 76,
          'perkiraan': false,
          'dari': _titik('Lokasi asal', 3.5617, 98.6566),
          'ke': _titik('Jalan Almamater', 3.5625, 98.6571),
          'garis': [
            [98.6566, 3.5617],
            [98.6571, 3.5625],
          ],
        },
        {
          'jenis': 'naik',
          'naikDiMana': true,
          'jumlahHalte': null,
          'jarakM': 4010,
          'durasiS': 722,
          'tarif': null,
          'koridor': {
            'kode': 'ANGKOT-KPUM-69',
            'nama': 'KPUM 69 : Gabion → Term. P. Induk',
            'jenis': 'angkot',
            'warna': null,
            'tarif': null,
          },
          'koridorLain': [
            {
              'kode': 'ANGKOT-RMC-103',
              'nama': 'RMC 103 : A → B',
              'jenis': 'angkot',
              'tarif': null,
            },
          ],
          'dari': _titik('Jalan Almamater', 3.5625, 98.6571),
          'ke': _titik('Titik pindah', 3.58, 98.67),
          'garis': [
            [98.6571, 3.5625],
            [98.67, 3.58],
          ],
        },
        {
          'jenis': 'naik',
          'naikDiMana': false,
          'jumlahHalte': 3,
          'jarakM': 1500,
          'durasiS': 400,
          'tarif': 4000,
          'koridor': {
            'kode': 'TMD-K2',
            'nama': 'TMD K2 : Amplas → Lapangan Merdeka',
            'jenis': 'bus',
            'warna': null,
            'tarif': 4000,
          },
          'koridorLain': [],
          'dari': {..._titik('Halte Juanda', 3.58, 98.67), 'halteId': 'h1'},
          'ke': {..._titik('Halte Balai Kota', 3.59, 98.677), 'halteId': 'h2'},
          'garis': [
            [98.67, 3.58],
            [98.677, 3.59],
          ],
        },
        {
          'jenis': 'jalan',
          'jarakM': 166,
          'durasiS': 120,
          'perkiraan': false,
          'dari': _titik('Halte Balai Kota', 3.59, 98.677),
          'ke': _titik('Tujuan', 3.5913, 98.6776),
          'garis': [],
        },
      ],
    },
    {
      'totalS': 2400,
      'jalanM': 500,
      'transfer': 0,
      'perkiraan': false,
      'tarif': null,
      'tarifTeks': 'Tarif belum tersedia',
      'bagian': [
        {
          'jenis': 'naik',
          'naikDiMana': true,
          'jarakM': 5000,
          'durasiS': 2400,
          'tarif': null,
          'koridor': {
            'kode': 'ANGKOT-KPUM-26',
            'nama': 'KPUM 26 : Tuntungan → Mabar',
            'jenis': 'angkot',
            'tarif': null,
          },
          'koridorLain': [],
          'dari': _titik('Lokasi asal', 3.5617, 98.6566),
          'ke': _titik('Tujuan', 3.5913, 98.6776),
          'garis': [],
        },
      ],
    },
  ],
};

class _Server {
  final List<Uri> calls = [];
  Map<String, dynamic>? foto;

  http.Client get client => MockClient((req) async {
    calls.add(req.url);
    switch (req.url.path) {
      case '/api/places/search':
        return _json({
          'items': [
            {
              'id': 'osm:n1',
              'nama': 'Lapangan Merdeka',
              'alamat': 'Kesawan, Medan Barat',
              'lokasi': {'lat': 3.5913, 'lng': 98.6776},
              'jarakM': 98,
            },
          ],
        });
      case '/api/places/reverse':
        return _json({
          'tempat': {
            'id': 'osm:w2',
            'nama': 'Travellers Suites',
            'alamat': 'Jalan Imam Bonjol',
            'lokasi': {'lat': 3.5855, 'lng': 98.6747},
          },
        });
      case '/api/routes/transit':
        return _json(_transit);
      case '/api/routes':
        return _json({..._rute, 'mode': req.url.queryParameters['mode']});
      case '/api/streetview':
        return _json({'foto': foto});
    }
    return _json({'message': 'x'}, 404);
  });
}

Future<(NavigationScreenState, _Server)> _pump(
  WidgetTester tester, {
  String? query,
  LatLng? ke,
  LokasiHasil lokasi = const LokasiHasil('ok', _usu),
  Future<void> Function(String, String)? share,
}) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _Server();
  final api = ApiClient(
    client: server.client,
    tokens: MemoryTokenStore(),
    baseUrl: 'http://api.test/api',
  );
  await tester.pumpWidget(
    AppScope(
      state: AppState(api),
      child: MaterialApp(
        theme: buildTheme(),
        home: NavigationScreen(
          initialQuery: query,
          ke: ke,
          locate: () async => lokasi,
          share: share ?? (_, _) async {},
          tileProvider: FakeTiles(),
        ),
      ),
    ),
  );
  await _settle(tester);
  return (
    tester.state<NavigationScreenState>(find.byType(NavigationScreen)),
    server,
  );
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

  group('helper navigasi', () {
    test('durasi & jarak berbahasa Indonesia', () {
      expect(formatDurasi(20), '< 1 mnt');
      expect(formatDurasi(720), '12 mnt');
      expect(formatDurasi(3900), '1 j 5 mnt');
      expect(formatDurasi(7200), '2 j');
      expect(formatJarak(350.4), '350 m');
      expect(formatJarak(4900), '4,9 km');
      expect(formatJarak(12400), '12 km');
    });

    test('tautan OSM & teks bagikan memakai engine sesuai moda', () {
      const a = Tempat(nama: 'USU', lokasi: _usu);
      const b = Tempat(
        nama: 'Lapangan Merdeka',
        lokasi: LatLng(3.5913, 98.6776),
      );
      expect(
        tautanOsm(a.lokasi, b.lokasi, Moda.walking),
        'https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=3.56170,98.65660%3B3.59130,98.67760',
      );
      final teks = teksBagikan(
        dari: a,
        ke: b,
        mode: Moda.motorcycle,
        rute: _rute,
      );
      expect(
        teks,
        startsWith('Rute motor ke Lapangan Merdeka: 9 mnt · 6,1 km'),
      );
      expect(teks, contains('fossgis_osrm_car'));
    });

    test('ikon langkah, tanggal foto WIB, wilayah', () {
      expect(ikonLangkah('Belok kiri ke Jalan A'), Icons.turn_left_rounded);
      expect(ikonLangkah('Belok sedikit ke kanan'), Icons.turn_right_rounded);
      expect(
        ikonLangkah('Masuk bundaran, keluar'),
        Icons.roundabout_right_rounded,
      );
      expect(ikonLangkah('Tiba di tujuan'), Icons.flag_rounded);
      expect(ikonLangkah('Lurus terus'), Icons.straight_rounded);
      expect(tanggalFoto('2024-10-28T20:00:00.000Z'), '29 Okt 2024');
      expect(dalamWilayah(_usu), isTrue);
      expect(dalamWilayah(const LatLng(-6.2, 106.8)), isFalse);
    });
  });

  group('helper transit', () {
    final bagian = bagianOpsi((_transit['opsi'] as List).first as Map);

    test('angkot: naik di sepanjang jalan, halte: nama halte', () {
      expect(teksNaik(bagian[1]), 'Naik di sepanjang Jl. Almamater');
      expect(teksTurun(bagian[1]), 'Turun di titik pindah');
      expect(teksNaik(bagian[2]), 'Naik di Halte Juanda');
      expect(teksTurun(bagian[2]), 'Turun di Halte Balai Kota');
      expect(teksJalan(bagian[0], false), 'Jalan kaki 105 m ke Jl. Almamater');
      expect(teksJalan(bagian[3], true), 'Jalan kaki 166 m ke tujuan');
      expect(judulNaik(bagian[1]), 'Naik angkot KPUM 69');
      expect(
        namaKoridor(bagian[1]['koridor'] as Map).trayek,
        'Gabion → Term. P. Induk',
      );
    });

    test('tarif null tidak dianggap 0; warna per kendaraan', () {
      expect(teksTarif(null), 'tarif belum tersedia');
      expect(teksTarif(4000), 'Rp4.000');
      expect(indeksNaik(bagian), [null, 0, 1, null]);
      expect(warnaNaik(0), isNot(warnaNaik(1)));
      // Bagian tanpa garis → garis lurus dari → ke.
      expect(garisBagian(bagian[3]).length, 2);
      final o = (_transit['opsi'] as List).first as Map;
      expect(ringkasanTrip(o), {'durasiS': 1980, 'jarakM': 5781});
    });

    test('tarif bawaan/OSM ditandai perkiraan, isian admin tidak', () {
      final bawaan = {'tarif': 5000, 'tarifPerkiraan': true};
      expect(tarifPerkiraan(bawaan), isTrue);
      expect(teksTarifRingkas(bawaan), 'Rp5.000 (perkiraan)');
      expect(
        teksTarifRingkas({'tarif': 5000, 'tarifPerkiraan': false}),
        'Rp5.000',
      );
      expect(teksTarifRingkas({'tarif': null}), 'tarif belum tersedia');
      expect(
        ringkasanTrip({'totalS': 600, 'tarif': 5000, 'tarifPerkiraan': true}),
        {'durasiS': 600, 'jarakM': 0, 'tarif': 5000, 'tarifPerkiraan': true},
      );
    });
  });

  testWidgets('Transportasi umum: opsi, bagian, tarif belum tersedia, Play', (
    tester,
  ) async {
    final (state, server) = await _pump(
      tester,
      ke: const LatLng(3.5913, 98.6776),
    );
    await _tap(tester, find.bySemanticsLabel('Transportasi umum'));
    expect(state.mode, Moda.transit);
    expect(state.lapisan, isEmpty);

    // 360 px: kapsul satu baris (label pendek "Umum"), tidak turun baris
    // walau Street view ikut aktif.
    await _tap(tester, find.bySemanticsLabel('Street view'));
    for (final t in ['Traffic', 'Street view']) {
      final teks = find.descendant(
        of: find.byType(PillToggle<String>),
        matching: find.text(t),
      );
      expect(tester.getSize(teks).height, lessThan(24));
    }
    expect(tester.takeException(), isNull);
    expect(
      find.descendant(
        of: find.byType(PillToggle<String>),
        matching: find.text('Umum'),
      ),
      findsOneWidget,
    );
    await _tap(
      tester,
      find.descendant(
        of: find.byType(PillToggle<String>),
        matching: find.text('Street view'),
      ),
    );
    expect(state.lapisan, isEmpty);
    expect(
      server.calls
          .lastWhere((u) => u.path == '/api/routes/transit')
          .queryParameters,
      {'from': '3.5617,98.6566', 'to': '3.5913,98.6776'},
    );
    expect(tester.takeException(), isNull);
    expect(find.text('33 mnt'), findsWidgets);
    expect(find.text('Tarif belum tersedia'), findsOneWidget);
    expect(find.text('Naik di sepanjang Jl. Almamater'), findsOneWidget);
    expect(find.text('KPUM 69'), findsWidgets);
    expect(find.textContaining('tarif belum tersedia'), findsWidgets);
    expect(find.textContaining('Rp4.000'), findsOneWidget);
    expect(find.text('Turun di Halte Balai Kota'), findsOneWidget);

    // Opsi kedua: tanpa jalan kaki, naik di titik asal.
    await _tap(tester, find.bySemanticsLabel(RegExp('^40 mnt')));
    expect(find.text('Naik di titik asalmu'), findsOneWidget);
    expect(find.text('Turun di tujuan'), findsOneWidget);
    await _tap(tester, find.bySemanticsLabel(RegExp('^33 mnt')));

    await _tap(tester, find.text('Play'));
    expect(find.text('Bagian 1 dari 4'), findsOneWidget);
    await _tap(tester, find.text('Berikutnya'));
    expect(find.text('Naik angkot KPUM 69'), findsOneWidget);
    await _tap(tester, find.widgetWithText(TextButton, 'Selesai'));
    expect(state.play, isNull);

    // Kapsul dimatikan → kembali ke moda sebelumnya.
    await _tap(tester, find.bySemanticsLabel('Transportasi umum'));
    expect(state.mode, Moda.driving);
    expect(tester.takeException(), isNull);
  });

  testWidgets('360 px: cari → pilih tujuan → ringkasan rute & moda', (
    tester,
  ) async {
    final (_, server) = await _pump(tester, query: 'Merdeka');
    expect(tester.takeException(), isNull);
    expect(find.text('Lokasi kamu'), findsOneWidget);
    expect(find.text('© OpenStreetMap contributors'), findsOneWidget);
    expect(find.text('Lapangan Merdeka'), findsOneWidget);
    expect(
      server.calls.any(
        (u) =>
            u.path == '/api/places/search' &&
            u.queryParameters['q'] == 'Merdeka',
      ),
      isTrue,
    );

    await _tap(tester, find.text('Lapangan Merdeka'));
    expect(tester.takeException(), isNull);
    expect(find.text('9 mnt'), findsOneWidget);
    expect(find.text('6,1 km'), findsOneWidget);
    final rute = server.calls.lastWhere((u) => u.path == '/api/routes');
    expect(rute.queryParameters, {
      'from': '3.5617,98.6566',
      'to': '3.5913,98.6776',
      'mode': 'driving',
    });

    await _tap(tester, find.text('Jalan kaki'));
    expect(
      server.calls
          .lastWhere((u) => u.path == '/api/routes')
          .queryParameters['mode'],
      'walking',
    );

    await _tap(tester, find.text('Lihat semua'));
    expect(find.text('Belok kiri ke Jalan Dr. Mansyur'), findsOneWidget);
  });

  testWidgets('Play: panduan langkah maju-mundur lalu selesai', (tester) async {
    final (state, _) = await _pump(tester, ke: const LatLng(3.5855, 98.6747));
    // Nama tujuan di lembar rute + di kolom cari.
    expect(find.text('Travellers Suites'), findsNWidgets(2));
    expect(find.widgetWithText(TextField, 'Travellers Suites'), findsOneWidget);

    await _tap(tester, find.text('Play'));
    expect(find.text('Langkah 1 dari 3'), findsOneWidget);
    expect(find.text('Mulai di Jalan Universitas'), findsOneWidget);

    await _tap(tester, find.text('Berikutnya'));
    expect(find.text('Langkah 2 dari 3'), findsOneWidget);
    expect(find.text('Lalu ikuti jalan 350 m'), findsOneWidget);

    await _tap(tester, find.text('Berikutnya'));
    await _tap(tester, find.widgetWithText(FilledButton, 'Selesai'));
    expect(state.play, isNull);
    expect(find.text('9 mnt'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Street view: tanpa foto → pesan kosong; Traffic belum aktif', (
    tester,
  ) async {
    final (state, server) = await _pump(
      tester,
      ke: const LatLng(3.5855, 98.6747),
    );

    await _tap(tester, find.text('Street view'));
    expect(state.lapisan, {'street'});
    expect(
      server.calls
          .lastWhere((u) => u.path == '/api/streetview')
          .queryParameters['at'],
      '3.5855,98.6747',
    );
    expect(find.text('Belum ada foto jalan di sini'), findsOneWidget);

    await _tap(tester, find.text('Traffic'));
    expect(state.lapisan, {'street'});
    expect(
      find.text('Lapisan Traffic hadir bersama Live Traffic Information.'),
      findsOneWidget,
    );
    await tester.pump(const Duration(seconds: 4));
    expect(state.pesan, isNull);
  });

  testWidgets('Street view: ada foto → atribusi Mapillary', (tester) async {
    final (_, server) = await _pump(tester, ke: const LatLng(3.5855, 98.6747));
    server.foto = {
      'id': '1',
      'url': 'https://cdn.test/1.jpg',
      'diambil': '2024-10-28T10:27:02.894Z',
      'pengunggah': 'warga',
      'lokasi': {'lat': 3.5856, 'lng': 98.6748},
      'jarakM': 70,
      'halaman': 'https://www.mapillary.com/app/?pKey=1',
    };
    await _tap(tester, find.text('Street view'));
    expect(
      find.textContaining('±70 m dari titik, 28 Okt 2024'),
      findsOneWidget,
    );
    expect(find.textContaining('© Mapillary, warga'), findsOneWidget);
  });

  testWidgets('Share membuka lembar bagikan dengan ringkasan + tautan OSM', (
    tester,
  ) async {
    final dibagikan = <(String, String)>[];
    await _pump(
      tester,
      ke: const LatLng(3.5855, 98.6747),
      share: (teks, judul) async => dibagikan.add((teks, judul)),
    );
    await _tap(tester, find.text('Share'));
    expect(dibagikan, hasLength(1));
    final (teks, judul) = dibagikan.single;
    expect(judul, 'Rute ke Travellers Suites');
    expect(teks, startsWith('Rute mobil ke Travellers Suites: 9 mnt · 6,1 km'));
    expect(teks, contains('openstreetmap.org/directions'));
  });

  testWidgets('Share gagal → teks disalin ke papan klip', (tester) async {
    String? disalin;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          disalin = (call.arguments as Map)['text'] as String;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await _pump(
      tester,
      ke: const LatLng(3.5855, 98.6747),
      share: (_, _) async => throw Exception('tidak tersedia'),
    );
    await _tap(tester, find.text('Share'));
    expect(disalin, startsWith('Rute mobil ke Travellers Suites'));
    expect(
      find.text('Rute disalin. Tempel di chat untuk membagikannya.'),
      findsOneWidget,
    );
    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets('izin lokasi ditolak → arahan memilih titik asal', (
    tester,
  ) async {
    final (state, _) = await _pump(
      tester,
      lokasi: const LokasiHasil('ditolak'),
    );
    expect(find.textContaining('Izin lokasi ditolak'), findsOneWidget);
    expect(find.text('Rute'), findsOneWidget);

    await _tap(tester, find.bySemanticsLabel('Ganti titik dari'));
    expect(state.target, 'dari');
    expect(find.text('Cari titik asal'), findsOneWidget);
  });
}
