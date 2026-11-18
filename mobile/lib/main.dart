import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'fonts.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  setupFonts();
  final state = AppState(ApiClient())..bootstrap();
  runApp(SmartMoveApp(state: state));
}

class SmartMoveApp extends StatelessWidget {
  const SmartMoveApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
        title: 'SmartMove Medan',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _PlaceholderHome(),
      ),
    );
  }
}

/// Sementara sampai layar Splash/Masuk/Beranda dibuat (T-102, T-104).
class _PlaceholderHome extends StatelessWidget {
  const _PlaceholderHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: AppTextures.lilacWash,
        alignment: Alignment.center,
        child: Text('SmartMove Medan', style: titleSerif(size: 28)),
      ),
    );
  }
}
