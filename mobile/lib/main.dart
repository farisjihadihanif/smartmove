import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'fonts.dart';
import 'screens/home/home_shell.dart';
import 'screens/splash_screen.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  setupFonts();
  final state = AppState(ApiClient())
    ..muatTema()
    ..bootstrap();
  runApp(SmartMoveApp(state: state));
}

class SmartMoveApp extends StatefulWidget {
  const SmartMoveApp({
    super.key,
    required this.state,
    this.splashDuration = const Duration(milliseconds: 1800),
  });

  final AppState state;

  /// Lama minimal Splash tampil (tes memakai durasi pendek).
  final Duration splashDuration;

  @override
  State<SmartMoveApp> createState() => _SmartMoveAppState();
}

/// Tema mengikuti pilihan pengguna (Sistem / Terang / Gelap) dan setelan sistem.
class _SmartMoveAppState extends State<SmartMoveApp>
    with WidgetsBindingObserver {
  bool? _gelapSebelum;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.state.addListener(_cekTema);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.state.removeListener(_cekTema);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() => _cekTema();

  bool get _gelap {
    final t = widget.state.tema;
    if (t == 'gelap') return true;
    if (t == 'terang') return false;
    return WidgetsBinding.instance.platformDispatcher.platformBrightness ==
        Brightness.dark;
  }

  void _cekTema() {
    if (_gelap == _gelapSebelum) return;
    setState(() {});
    // Banyak widget membaca AppColors langsung (bukan lewat Theme): tandai seluruh pohon
    // untuk dibangun ulang tanpa membuang state (tumpukan layar & isian tetap).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      void bangun(Element e) {
        e.markNeedsBuild();
        e.visitChildren(bangun);
      }

      if (mounted) (context as Element).visitChildren(bangun);
    });
  }

  @override
  Widget build(BuildContext context) {
    final gelap = _gelap;
    _gelapSebelum = gelap;
    return AppScope(
      state: widget.state,
      child: MaterialApp(
        title: 'SmartMove Medan',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(gelap: gelap),
        home: RootGate(splashDuration: widget.splashDuration),
      ),
    );
  }
}

/// Splash tampil sampai durasi minimal lewat dan sesi selesai dipulihkan,
/// lalu Beranda (tamu atau pengguna). Member Login dibuka dari tombol Masuk
/// ([pushLogin]); saat keluar / sesi berakhir (401) kembali ke Beranda tamu.
class RootGate extends StatefulWidget {
  const RootGate({super.key, required this.splashDuration});

  final Duration splashDuration;

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _splashDone = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.splashDuration, () {
      if (mounted) setState(() => _splashDone = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final status = AppScope.of(context).status;
    final Widget child;
    if (!_splashDone || status == AuthStatus.unknown) {
      child = const SplashScreen(key: ValueKey('splash'));
    } else {
      // Beranda terbuka untuk tamu (ARCHITECTURE §4); key berganti saat
      // masuk/keluar agar data & lonceng dimuat ulang.
      child = HomeShell(key: ValueKey('home-${status.name}'));
    }
    return AnimatedSwitcher(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 350),
      child: child,
    );
  }
}
