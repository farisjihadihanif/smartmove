import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/theme.dart';
import 'package:smartmove/widgets/widgets.dart';

import 'font_preload.dart';

/// Tile palsu dari aset lokal agar tes tidak memanggil jaringan.
class FakeTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      const AssetImage(AppTextures.barDarkAsset);
}

Future<void> pumpScreen(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(360, 760);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(),
      home: Scaffold(body: child),
    ),
  );
  await tester.pump();
}

/// Layar Smart Navigation (mockup hal. 4) disusun dari komponen bersama.
class NavPreview extends StatefulWidget {
  const NavPreview({super.key});

  @override
  State<NavPreview> createState() => _NavPreviewState();
}

class _NavPreviewState extends State<NavPreview> {
  Set<String> layers = {'traffic'};
  String? tapped;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NebulaHeader(
          title: 'Smart Navigation',
          leading: const Icon(Icons.map_outlined, color: AppColors.inkViolet),
          unread: 2,
          onNotifications: () => tapped = 'notif',
          children: [
            SearchField(onSubmitted: (_) => tapped = 'cari'),
            PillToggle<String>(
              multiple: true,
              selected: layers,
              onChanged: (v) => setState(() => layers = v),
              options: const [
                PillOption('traffic', 'Traffic'),
                PillOption('transit', 'Transportasi umum'),
                PillOption('street', 'Street view'),
              ],
            ),
          ],
        ),
        Expanded(child: MapView(tucked: true, tileProvider: FakeTiles())),
        BottomActionBar(
          actions: [
            BarAction(
              label: 'Rute',
              icon: Icons.route,
              onPressed: () => tapped = 'rute',
            ),
            BarAction(
              label: 'Play',
              icon: Icons.play_arrow,
              onPressed: () => tapped = 'play',
            ),
            BarAction(
              label: 'Share',
              icon: Icons.share_outlined,
              onPressed: () => tapped = 'share',
            ),
          ],
        ),
      ],
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(preloadFonts);

  testWidgets('layar navigasi 360 px tanpa overflow + atribusi OSM tampil', (
    tester,
  ) async {
    await pumpScreen(tester, const NavPreview());
    expect(tester.takeException(), isNull);
    expect(find.text('Smart Navigation'), findsOneWidget);
    expect(find.text('Telusuri di sini'), findsOneWidget);
    expect(find.text('© OpenStreetMap contributors'), findsOneWidget);
    expect(find.bySemanticsLabel('Notifikasi, 2 belum dibaca'), findsOneWidget);
    for (final l in ['Rute', 'Play', 'Share']) {
      expect(find.text(l), findsOneWidget);
    }
  });

  testWidgets('PillToggle multiple menambah & melepas pilihan', (tester) async {
    await pumpScreen(tester, const NavPreview());
    final state = tester.state<_NavPreviewState>(find.byType(NavPreview));

    await tester.tap(find.text('Street view'));
    await tester.pump();
    expect(state.layers, {'traffic', 'street'});

    await tester.tap(find.text('Traffic'));
    await tester.pump();
    expect(state.layers, {'street'});
  });

  testWidgets('PillToggle tunggal hanya satu terpilih', (tester) async {
    Set<String> sel = {'eta'};
    await pumpScreen(
      tester,
      StatefulBuilder(
        builder: (context, setState) => PillToggle<String>(
          selected: sel,
          onChanged: (v) => setState(() => sel = v),
          options: const [
            PillOption('eta', 'Estimasi Waktu'),
            PillOption('map', 'Peta Interaktif'),
          ],
        ),
      ),
    );
    await tester.tap(find.text('Peta Interaktif'));
    await tester.pump();
    expect(sel, {'map'});
  });

  testWidgets('target sentuh kapsul & tombol aksi ≥ 48 dp', (tester) async {
    await pumpScreen(tester, const NavPreview());
    for (final t in ['Traffic', 'Rute']) {
      final ink = find.ancestor(
        of: find.text(t),
        matching: find.byType(InkWell),
      );
      expect(tester.getSize(ink.first).height, greaterThanOrEqualTo(48));
    }
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  });

  testWidgets('MenuTile memanggil onTap pada kedua varian', (tester) async {
    final taps = <String>[];
    await pumpScreen(
      tester,
      Row(
        children: [
          Expanded(
            child: MenuTile(
              icon: const Icon(Icons.payments_outlined),
              label: 'Digital Payment',
              onTap: () => taps.add('plain'),
            ),
          ),
          Expanded(
            child: MenuTile(
              variant: MenuTileVariant.pill,
              icon: const Icon(Icons.campaign, size: 72),
              label: 'Poster',
              onTap: () => taps.add('pill'),
            ),
          ),
        ],
      ),
    );
    await tester.tap(find.text('Digital Payment'));
    await tester.tap(find.text('Poster'));
    expect(taps, ['plain', 'pill']);
  });

  testWidgets('EmptyState menampilkan judul, pesan, dan aksi', (tester) async {
    var pressed = false;
    await pumpScreen(
      tester,
      EmptyState(
        icon: Icons.route,
        title: 'Belum ada rencana perjalanan',
        message: 'Simpan rute ke kantor atau kampus.',
        actionLabel: 'Buat rencana',
        onAction: () => pressed = true,
      ),
    );
    expect(find.text('Belum ada rencana perjalanan'), findsOneWidget);
    await tester.tap(find.text('Buat rencana'));
    expect(pressed, isTrue);
  });

  group('ErrorBanner', () {
    test('memetakan kode galat ke teks DESIGN §5', () {
      expect(
        errorMessageFor(ApiException(0, 'x', kOffline)),
        'Kamu sedang offline',
      );
      expect(
        errorMessageFor(ApiException(0, 'x', kServerUnreachable)),
        'Tidak bisa terhubung ke server SmartMove. Coba lagi sebentar.',
      );
      expect(
        errorMessageFor(ApiException(422, 'x', 'DI_LUAR_WILAYAH')),
        'SmartMove baru melayani Medan dan sekitarnya.',
      );
      expect(
        errorMessageFor(ApiException(400, 'Pesan server')),
        'Pesan server',
      );
      expect(errorMessageFor(null), '');
    });

    testWidgets('server tak terjangkau: ikon cloud_off', (tester) async {
      await pumpScreen(
        tester,
        ErrorBanner(error: ApiException(0, 'x', kServerUnreachable)),
      );
      expect(find.byIcon(Icons.cloud_off), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off), findsNothing);
    });

    testWidgets('galat jaringan: ikon offline + Coba lagi', (tester) async {
      var retried = false;
      await pumpScreen(
        tester,
        ErrorBanner(
          error: ApiException(0, 'x', kOffline),
          onRetry: () => retried = true,
        ),
      );
      expect(find.byIcon(Icons.wifi_off), findsOneWidget);
      await tester.tap(find.text('Coba lagi'));
      expect(retried, isTrue);
    });

    testWidgets('tanpa pesan tidak menampilkan apa pun', (tester) async {
      await pumpScreen(tester, const ErrorBanner());
      expect(find.byIcon(Icons.error_outline), findsNothing);
    });
  });
}
