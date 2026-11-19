import 'package:material_ui/material_ui.dart';

import '../../state.dart';
import '../../theme.dart';
import '../auth/login_screen.dart';
import '../coming_soon_screen.dart';
import '../rewards/rewards_screen.dart';
import 'home_screen.dart';

/// Kerangka setelah masuk: navigasi bawah Beranda · Rewards · Akun
/// (mockup hal. 3, gaya Material 3).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  // Rewards dibuat saat tab dibuka dan dimuat ulang tiap kali dibuka lagi.
  int _kunjunganRewards = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const HomeScreen(),
          if (_kunjunganRewards == 0)
            const SizedBox.shrink()
          else
            RewardsScreen(key: ValueKey(_kunjunganRewards)),
          const ComingSoonScreen(title: 'Akun', account: true),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          // Rewards & Akun wajib login: tamu diarahkan ke Member Login.
          if (i > 0 && !AppScope.read(context).isSignedIn) {
            pushLogin(context);
            return;
          }
          setState(() {
            if (i == 1 && _index != 1) _kunjunganRewards++;
            _index = i;
          });
        },
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? sans(size: 12, weight: FontWeight.w700, color: AppColors.ink)
              : sans(
                  size: 12,
                  weight: FontWeight.w500,
                  color: AppColors.ink.withValues(alpha: 0.65),
                ),
        ),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.card_giftcard_outlined),
            selectedIcon: Icon(Icons.card_giftcard_rounded),
            label: 'Rewards',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Akun',
          ),
        ],
      ),
    );
  }
}
