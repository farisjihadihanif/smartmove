import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'fonts.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_shell.dart';
import 'screens/splash_screen.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  setupFonts();
  final state = AppState(ApiClient())..bootstrap();
  runApp(SmartMoveApp(state: state));
}

class SmartMoveApp extends StatelessWidget {
  const SmartMoveApp({
    super.key,
    required this.state,
    this.splashDuration = const Duration(milliseconds: 1800),
  });

  final AppState state;

  /// Lama minimal Splash tampil (tes memakai durasi pendek).
  final Duration splashDuration;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
        title: 'SmartMove Medan',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: RootGate(splashDuration: splashDuration),
      ),
    );
  }
}

/// Splash tampil sampai durasi minimal lewat dan sesi selesai dipulihkan,
/// lalu: belum masuk → Member Login, sudah masuk → Beranda.
/// Saat keluar / sesi berakhir (401) otomatis kembali ke Member Login.
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
    } else if (status == AuthStatus.signedIn) {
      child = const HomeShell(key: ValueKey('home'));
    } else {
      child = const LoginScreen(key: ValueKey('login'));
    }
    return AnimatedSwitcher(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 350),
      child: child,
    );
  }
}
