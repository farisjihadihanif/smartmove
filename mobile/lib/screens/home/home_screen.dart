import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../config.dart';
import '../../notifications.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../../wib.dart';
import '../auth/login_screen.dart';
import '../auth/register_screen.dart';
import '../coming_soon_screen.dart';
import 'notification_sheet.dart';

/// Beranda (mockup hal. 3): sapaan + jam Medan, lonceng, cari, 4 menu utama,
/// Trip Planner, lalu ringkasan poin & event yang sedang berlangsung.
/// Data dari `GET /home` (API_SPECS §5). Sama dengan web/src/pages/Home.jsx.
/// Terbuka untuk tamu (ARCHITECTURE §4): sapaan tanpa nama, tanpa lonceng &
/// poin, ada tombol Masuk; Trip Planner, Rewards, Akun meminta login.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.seenStore = const NotifSeenStore()});

  final NotifSeenStore seenStore;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _MenuItem {
  const _MenuItem(this.label, this.icon);
  final String label;
  final IconData icon;
}

const _menu = [
  _MenuItem('Smart Navigation', Icons.map_outlined),
  _MenuItem('Live Traffic Information', Icons.traffic_outlined),
  _MenuItem('Digital Payment', Icons.payments_outlined),
  _MenuItem('Traffic Mitigation Campaign', Icons.campaign_outlined),
];

const _eventIcon = {
  'cfd': Icons.directions_bike_rounded,
  'rekayasa_arus': Icons.alt_route_rounded,
  'acara': Icons.event_rounded,
};

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? _data;
  Object? _error;
  Duration _offset = Duration.zero; // jam server − jam perangkat
  DateTime? _lastSeen;
  bool _seenLoaded = false;
  Timer? _clock;
  Timer? _refresh;

  String? get _userId => AppScope.read(context).user?['id']?.toString();
  DateTime get _now => DateTime.now().toUtc().add(_offset);
  List<dynamic> get _notifikasi =>
      _data?['notifikasi'] is List ? _data!['notifikasi'] as List : const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _clock = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
    _refresh = Timer.periodic(const Duration(minutes: 5), (_) => _load());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSeen();
      _load();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _clock?.cancel();
    _refresh?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _loadSeen() async {
    final id = _userId;
    final seen = id == null ? null : await widget.seenStore.read(id);
    if (mounted) {
      setState(() {
        _lastSeen = seen;
        _seenLoaded = true;
      });
    }
  }

  Future<void> _load() async {
    final api = AppScope.read(context).api;
    try {
      final d = await api.get('/home');
      final server = d is Map
          ? DateTime.tryParse('${(d['sapaan'] as Map?)?['waktuServer']}')
          : null;
      if (server == null) {
        throw ApiException(500, 'Respons Beranda tidak valid');
      }
      if (!mounted) return;
      setState(() {
        _data = Map<String, dynamic>.from(d as Map);
        _offset = server.difference(DateTime.now().toUtc());
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _openNotifications() async {
    final before = _lastSeen;
    final id = _userId;
    final server = DateTime.tryParse(
      '${(_data?['sapaan'] as Map?)?['waktuServer']}',
    );
    if (id != null && server != null) {
      setState(() => _lastSeen = server);
      unawaited(widget.seenStore.write(id, server));
    }
    await showNotificationSheet(
      context,
      items: _notifikasi,
      lastSeen: before,
      now: _now,
      onOpen: (jenis) => _open(_destinationFor(jenis)),
    );
  }

  String _destinationFor(String? jenis) => switch (jenis) {
    'trip' => 'Trip Planner',
    'poin' => 'Rewards',
    _ => 'Live Traffic Information',
  };

  void _open(String title) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ComingSoonScreen(title: title)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).user;
    final tamu = user == null;
    final nama = (user?['namaLengkap'] ?? user?['username'] ?? '').toString();
    final now = _now;
    final salam =
        (_data?['sapaan'] as Map?)?['salam']?.toString() ?? salamWib(now);
    final unread = _seenLoaded ? countUnread(_notifikasi, _lastSeen) : 0;
    final poin = _data?['poin'] as Map?;
    final events = _data?['events'] is List
        ? (_data!['events'] as List).whereType<Map>().toList()
        : const <Map>[];

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.loginButton,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          _Header(
            user: user,
            nama: nama,
            salam: salam,
            jam: jamWib(now),
            unread: unread,
            onNotifications: _openNotifications,
            tamu: tamu,
            onSignIn: () => pushLogin(context),
            onAvatar: tamu ? () => pushLogin(context) : () => _open('Akun'),
            onSearch: (_) => _open('Smart Navigation'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.s4,
              AppSizes.s4 + AppSizes.s1,
              AppSizes.s4,
              AppSizes.s6,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  ErrorBanner(error: _error, onRetry: _load),
                  const SizedBox(height: AppSizes.s4),
                ],
                _MenuPanel(onOpen: _open),
                const SizedBox(height: AppSizes.s6),
                _TripPlannerCard(
                  onTap: tamu
                      ? () => pushLogin(context)
                      : () => _open('Trip Planner'),
                ),
                const SizedBox(height: AppSizes.s6),
                if (tamu)
                  const _GuestCard()
                else
                  _PointsTile(
                    poin: poin,
                    loading: _data == null && _error == null,
                    onTap: () => _open('Rewards'),
                  ),
                if (events.isNotEmpty) ...[
                  const SizedBox(height: AppSizes.s6),
                  _OngoingEvents(events: events, now: now),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.user,
    required this.nama,
    required this.salam,
    required this.jam,
    required this.unread,
    required this.onNotifications,
    required this.tamu,
    required this.onSignIn,
    required this.onAvatar,
    required this.onSearch,
  });

  final Map<String, dynamic>? user;
  final String nama;
  final String salam;
  final String jam;
  final bool tamu;
  final VoidCallback onSignIn;
  final int unread;
  final VoidCallback onNotifications;
  final VoidCallback onAvatar;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: AppTextures.lilacWash.copyWith(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: AppColors.inkViolet.withValues(alpha: 0.55),
            blurRadius: 28,
            spreadRadius: -14,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.s4,
            AppSizes.s4,
            AppSizes.s4,
            AppSizes.s6,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Avatar(user: user, onTap: onAvatar),
                  const SizedBox(width: AppSizes.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Medan, $jam WIB',
                          style: sans(
                            size: 13,
                            weight: FontWeight.w600,
                            color: AppColors.inkViolet,
                          ),
                        ),
                        Semantics(
                          header: true,
                          child: Text(
                            nama.isEmpty ? 'Hallo! $salam' : 'Hallo! $salam,',
                            style: titleSerif(size: 22),
                          ),
                        ),
                        if (nama.isNotEmpty)
                          Text(
                            nama,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: titleSerif(size: 22),
                          ),
                      ],
                    ),
                  ),
                  if (tamu)
                    FilledButton.icon(
                      onPressed: onSignIn,
                      icon: const Icon(Icons.login_rounded, size: 18),
                      label: const Text('Masuk'),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSizes.s4 + AppSizes.s1,
                        ),
                        textStyle: sans(size: 15, weight: FontWeight.w600),
                      ),
                    )
                  else
                    NotificationButton(
                      unread: unread,
                      onPressed: onNotifications,
                    ),
                ],
              ),
              const SizedBox(height: AppSizes.s4 + AppSizes.s1),
              SearchField(
                leading: const Icon(Icons.search, size: 24),
                showSubmit: false,
                label: 'Cari tempat atau tujuan',
                onSubmitted: onSearch,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user, required this.onTap});

  final Map<String, dynamic>? user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foto = user?['foto']?.toString();
    final nama = (user?['namaLengkap'] ?? user?['username'] ?? '?')
        .toString()
        .trim();
    final inisial = nama.isEmpty ? '?' : nama.characters.first.toUpperCase();
    final url = foto == null || foto.isEmpty
        ? null
        : foto.startsWith('http')
        ? foto
        : '${apiUrl.replaceAll(RegExp(r'/+$'), '')}$foto';

    return Semantics(
      button: true,
      label: user == null ? 'Masuk' : 'Akun',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 56,
          height: 56,
          clipBehavior: Clip.antiAlias,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.loginAvatar,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.white, width: 3),
            boxShadow: [
              BoxShadow(
                color: AppColors.inkViolet.withValues(alpha: 0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: user == null
              ? const Icon(
                  Icons.person_outline_rounded,
                  size: 30,
                  color: AppColors.white,
                )
              : url != null
              ? Image.network(
                  url,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _initial(inisial),
                )
              : _initial(inisial),
        ),
      ),
    );
  }

  Widget _initial(String s) =>
      Text(s, style: titleSerif(size: 24, color: AppColors.white));
}

class _MenuPanel extends StatelessWidget {
  const _MenuPanel({required this.onOpen});

  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    Widget tile(_MenuItem m) => Expanded(
      child: MenuTile(
        icon: Icon(m.icon),
        label: m.label,
        onTap: () => onOpen(m.label),
      ),
    );

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.s1,
        vertical: AppSizes.s3,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceMenu,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.inkViolet.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [tile(_menu[0]), tile(_menu[1])],
          ),
          const SizedBox(height: AppSizes.s1),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [tile(_menu[2]), tile(_menu[3])],
          ),
        ],
      ),
    );
  }
}

class _TripPlannerCard extends StatelessWidget {
  const _TripPlannerCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shadow = [
      Shadow(
        color: AppColors.inkViolet.withValues(alpha: 0.35),
        blurRadius: 2,
        offset: const Offset(0, 1),
      ),
    ];
    return Semantics(
      button: true,
      label: 'Trip Planner. Buat perencanaan terbaik untuk setiap perjalananmu',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: AppGradients.tripCard,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppColors.trip4.withValues(alpha: 0.9),
              blurRadius: 30,
              spreadRadius: -16,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 120),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.s4,
                  AppSizes.s4,
                  AppSizes.s3,
                  AppSizes.s4,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.white.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Image.asset(AppTextures.logoAsset, width: 46),
                    ),
                    const SizedBox(width: AppSizes.s4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trip Planner',
                            style: titleSerif(
                              size: 24,
                              color: AppColors.white,
                            ).copyWith(shadows: shadow),
                          ),
                          const SizedBox(height: AppSizes.s1),
                          Text(
                            'Buat perencanaan terbaik untuk setiap perjalananmu',
                            style: titleSerif(
                              size: 15,
                              color: AppColors.white,
                            ).copyWith(height: 1.3, shadows: shadow),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSizes.s2),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

const _amber = Color(0xFF9A5B00);

/// Pengganti ringkasan poin untuk tamu: ajakan masuk/daftar.
class _GuestCard extends StatelessWidget {
  const _GuestCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSizes.s4 + AppSizes.s1),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.ink.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Simpan perjalanan & kumpulkan poin',
              style: titleSerif(size: 20),
            ),
          ),
          const SizedBox(height: AppSizes.s1 + 2),
          Text(
            'Masuk untuk memakai Trip Planner, Rewards, dan pembayaran tiket.',
            style: sans(
              size: 15,
              height: 1.5,
              color: AppColors.ink.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: AppSizes.s4),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () => pushLogin(context),
                  child: const Text('Masuk'),
                ),
              ),
              const SizedBox(width: AppSizes.s2),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const RegisterScreen(),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.loginButton,
                    side: const BorderSide(
                      color: AppColors.loginButton,
                      width: 2,
                    ),
                  ),
                  child: const Text('Buat akun'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PointsTile extends StatelessWidget {
  const _PointsTile({
    required this.poin,
    required this.loading,
    required this.onTap,
  });

  final Map? poin;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final saldo = (poin?['saldo'] as num?)?.toInt() ?? 0;
    final bulanIni = (poin?['bulanIni'] as num?)?.toInt() ?? 0;
    return Material(
      color: AppColors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: AppColors.ink.withValues(alpha: 0.08)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.s4),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.trafficPadat.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.card_giftcard_rounded,
                  color: _amber,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSizes.s4),
              Expanded(
                child: loading
                    ? Container(
                        height: 28,
                        width: 112,
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: 112,
                          decoration: BoxDecoration(
                            color: AppColors.ink.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('$saldo poin', style: titleSerif(size: 24)),
                          Text(
                            bulanIni > 0
                                ? '+$bulanIni bulan ini'
                                : 'Kumpulkan dari perjalanan & pembayaran',
                            style: sans(
                              size: 14,
                              color: AppColors.ink.withValues(alpha: 0.65),
                            ),
                          ),
                        ],
                      ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.ink.withValues(alpha: 0.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OngoingEvents extends StatelessWidget {
  const _OngoingEvents({required this.events, required this.now});

  final List<Map> events;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.s1),
          child: Semantics(
            header: true,
            child: Text(
              'Sedang berlangsung',
              style: sans(size: 16, weight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: AppSizes.s2),
        DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.ink.withValues(alpha: 0.08)),
          ),
          child: Column(
            children: [
              for (final (i, e) in events.indexed) ...[
                if (i > 0)
                  Divider(
                    height: 1,
                    indent: AppSizes.s4,
                    endIndent: AppSizes.s4,
                    color: AppColors.ink.withValues(alpha: 0.07),
                  ),
                _EventRow(event: e, now: now),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, required this.now});

  final Map event;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final selesai = DateTime.tryParse('${event['selesai']}');
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.s4,
        vertical: AppSizes.s3 + 2,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.trafficPadat.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              _eventIcon[event['jenis']] ?? Icons.info_outline_rounded,
              size: 18,
              color: _amber,
            ),
          ),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${event['judul']}',
                  style: sans(size: 15, weight: FontWeight.w600, height: 1.3),
                ),
                if (selesai != null)
                  Text(
                    'Sampai ${jamAtauTanggal(selesai, now)} WIB',
                    style: sans(
                      size: 14,
                      color: AppColors.ink.withValues(alpha: 0.65),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
