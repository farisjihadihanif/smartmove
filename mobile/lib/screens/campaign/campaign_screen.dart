import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';

import '../../api.dart';
import '../../i18n.dart';
import '../../kampanye.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../auth/login_screen.dart';
import 'event_screen.dart';

// Traffic Mitigation Campaign (mockup hal. 7, PRD §6.5, T-207).
// Sama dengan web pages/Kampanye.jsx + pages/kampanye/*.

/// GET sederhana dengan status memuat / galat / ok dan muat ulang.
class _Muat extends StatefulWidget {
  const _Muat({required this.path, this.query, required this.builder});
  final String path;
  final Map<String, Object?>? query;
  final Widget Function(BuildContext, Map data) builder;

  @override
  State<_Muat> createState() => _MuatState();
}

class _MuatState extends State<_Muat> {
  late Future<dynamic> _f;
  bool _mulai = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_mulai) return;
    _mulai = true;
    _muat();
  }

  void _muat() {
    _f = AppScope.of(context).api.get(widget.path, query: widget.query);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<dynamic>(
      future: _f,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSizes.s6),
            child: Row(
              children: [
                const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: AppSizes.s2),
                Text(
                  tr('Memuat…'),
                  style: sans(
                    size: 14,
                    color: AppColors.ink.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          );
        }
        if (snap.hasError) {
          return ErrorBanner(error: snap.error, onRetry: () => setState(_muat));
        }
        return widget.builder(context, snap.data as Map? ?? const {});
      },
    );
  }
}

/// Kerangka layar kampanye: header lilac + isi bergulir.
class _Halaman extends StatelessWidget {
  const _Halaman({
    required this.title,
    required this.children,
    this.headerChildren = const [],
  });
  final String title;
  final List<Widget> children;
  final List<Widget> headerChildren;

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: title,
            leading: canPop
                ? IconButton(
                    tooltip: tr('Kembali'),
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
            children: headerChildren,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
              children: children,
            ),
          ),
        ],
      ),
    );
  }
}

Widget _judul(String t) => Padding(
  padding: const EdgeInsets.only(bottom: AppSizes.s2),
  child: Text(t, style: titleSerif(size: 22)),
);

void _buka(BuildContext context, Widget layar) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => layar));

/// Hub kampanye: grid 2×2 + cari tips/event + event yang sedang berlangsung.
class CampaignScreen extends StatefulWidget {
  const CampaignScreen({super.key});

  @override
  State<CampaignScreen> createState() => _CampaignScreenState();
}

class _CampaignScreenState extends State<CampaignScreen> {
  final _q = TextEditingController();
  List<Map> _tips = const [];
  List<Map> _events = const [];
  Object? _galat;
  bool _memuat = true;
  bool _mulai = false;
  final _now = DateTime.now();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_mulai) return;
    _mulai = true;
    _muat();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _muat() async {
    final api = AppScope.of(context).api;
    setState(() {
      _memuat = true;
      _galat = null;
    });
    try {
      final r = await Future.wait([
        api.get('/campaign/contents', query: {'jenis': 'tips'}),
        api.get('/campaign/events'),
      ]);
      if (!mounted) return;
      setState(() {
        _tips = ((r[0] as Map)['items'] as List).whereType<Map>().toList();
        _events = ((r[1] as Map)['items'] as List).whereType<Map>().toList();
        _memuat = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _galat = e;
          _memuat = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _q.text;
    final cari = q.trim().isNotEmpty;
    return _Halaman(
      title: 'Traffic Mitigation Campaign',
      headerChildren: [
        SearchField(
          controller: _q,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => setState(() {}),
          hint: tr('Telusuri di sini'),
          label: tr('Cari tips atau event'),
        ),
      ],
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 0.95,
          children: [
            MenuTile(
              variant: MenuTileVariant.pill,
              label: tr('Tips Keselamatan'),
              icon: const Icon(
                Icons.health_and_safety_outlined,
                size: 60,
                color: AppColors.trafficPadat,
              ),
              onTap: () => _buka(context, const TipsScreen()),
            ),
            MenuTile(
              variant: MenuTileVariant.pill,
              label: tr('Poster'),
              icon: Icon(
                Icons.image_outlined,
                size: 60,
                color: AppColors.indigo,
              ),
              onTap: () => _buka(context, const PosterScreen()),
            ),
            MenuTile(
              variant: MenuTileVariant.pill,
              label: 'EventAlert',
              icon: const Icon(
                Icons.event_note_outlined,
                size: 60,
                color: AppColors.trafficMacet,
              ),
              onTap: () => _buka(context, const EventAlertScreen()),
            ),
            MenuTile(
              variant: MenuTileVariant.pill,
              label: tr('Umpan Balik'),
              icon: const Icon(
                Icons.assignment_outlined,
                size: 60,
                color: AppColors.iconBlue,
              ),
              onTap: () => _buka(context, const FeedbackScreen()),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s6),
        if (_galat != null)
          ErrorBanner(error: _galat, onRetry: _muat)
        else if (_memuat)
          const SizedBox.shrink()
        else if (cari)
          ..._hasilCari(q)
        else
          ..._berlangsung(),
      ],
    );
  }

  List<Widget> _berlangsung() {
    final aktif = _events.where((e) => e['status'] == 'berlangsung').toList();
    return [
      _judul(tr('Sedang berlangsung')),
      if (aktif.isEmpty)
        Text.rich(
          TextSpan(
            text: tr('Tidak ada event lalu lintas saat ini. '),
            children: [
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: GestureDetector(
                  onTap: () => _buka(context, const EventAlertScreen()),
                  child: Text(
                    tr('Lihat jadwal mendatang'),
                    style: sans(
                      size: 15,
                      weight: FontWeight.w600,
                      color: AppColors.inkViolet,
                    ),
                  ),
                ),
              ),
            ],
          ),
          style: sans(
            size: 15,
            color: AppColors.ink.withValues(alpha: 0.65),
            height: 1.45,
          ),
        ),
      for (final e in aktif) _barisEvent(e),
    ];
  }

  Widget _barisEvent(Map e) {
    final j = infoJenisEvent(e['jenis'] as String?);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      minTileHeight: AppSizes.touch,
      leading: Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(color: j.warna, shape: BoxShape.circle),
      ),
      minLeadingWidth: 12,
      title: Text(
        '${e['judul']}',
        style: sans(size: 15, weight: FontWeight.w600),
      ),
      subtitle: Text(
        '${j.label}, ${rentangEvent(e, _now)}',
        style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.6)),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: AppColors.ink.withValues(alpha: 0.4),
      ),
      onTap: () =>
          _buka(context, EventAlertScreen(pilihId: e['id'] as String?)),
    );
  }

  List<Widget> _hasilCari(String q) {
    final tips = _tips.where((t) => cocok(q, [t['judul'], t['isi']])).toList();
    final ev = _events.where((e) => cocok(q, [e['judul'], e['isi']])).toList();
    if (tips.isEmpty && ev.isEmpty) {
      return [
        Text(
          tr('Tidak ada tips atau event yang cocok dengan “{0}”.', [q.trim()]),
          style: sans(size: 15, color: AppColors.ink.withValues(alpha: 0.65)),
        ),
      ];
    }
    return [
      if (tips.isNotEmpty) ...[
        _judul(tr('Tips')),
        for (final t in tips)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Rambu(ukuran: 28),
            title: Text(
              '${t['judul']}',
              style: sans(size: 15, weight: FontWeight.w600),
            ),
            onTap: () => _buka(context, const TipsScreen()),
          ),
        const SizedBox(height: AppSizes.s4),
      ],
      if (ev.isNotEmpty) ...[
        _judul(tr('Event')),
        for (final e in ev) _barisEvent(e),
      ],
    ];
  }
}

/// Rambu peringatan belah ketupat kuning (dari "SAFETY FIRST" mockup hal. 7).
class Rambu extends StatelessWidget {
  const Rambu({super.key, this.ukuran = 44});
  final double ukuran;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(size: Size.square(ukuran), painter: _RambuPainter()),
  );
}

class _RambuPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 44;
    canvas.save();
    canvas.scale(s);
    canvas.translate(22, 22);
    canvas.rotate(0.785398);
    final luar = RRect.fromRectAndRadius(
      const Rect.fromLTWH(-15, -15, 30, 30),
      const Radius.circular(4),
    );
    canvas.drawRRect(luar, Paint()..color = const Color(0xFFFFC20E));
    final garis = Paint()
      ..color = const Color(0xFF1A1A1A)
      ..style = PaintingStyle.stroke;
    canvas.drawRRect(luar, garis..strokeWidth = 2.5);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-11.5, -11.5, 23, 23),
        const Radius.circular(2),
      ),
      garis..strokeWidth = 1.2,
    );
    canvas.restore();
    canvas.save();
    canvas.scale(s);
    canvas.drawLine(
      const Offset(22, 14.5),
      const Offset(22, 24),
      Paint()
        ..color = const Color(0xFF1A1A1A)
        ..strokeWidth = 3.2
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(
      const Offset(22, 29),
      2,
      Paint()..color = const Color(0xFF1A1A1A),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RambuPainter old) => false;
}

/// Tips Keselamatan: konten `tips` aktif, urut `urutan`.
class TipsScreen extends StatelessWidget {
  const TipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _Halaman(
      title: tr('Tips Keselamatan'),
      children: [
        _Muat(
          path: '/campaign/contents',
          query: const {'jenis': 'tips'},
          builder: (context, data) {
            final items = (data['items'] as List? ?? const [])
                .whereType<Map>()
                .toList();
            if (items.isEmpty) {
              return EmptyState(
                icon: Icons.health_and_safety_outlined,
                title: tr('Belum ada tips'),
                message: tr(
                  'Tips keselamatan dari pengelola SmartMove akan muncul di sini.',
                ),
              );
            }
            return Column(
              children: [
                for (final (i, t) in items.indexed) ...[
                  if (i > 0)
                    Divider(
                      height: 1,
                      color: AppColors.ink.withValues(alpha: 0.07),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Rambu(),
                        const SizedBox(width: AppSizes.s4),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${t['judul']}',
                                style: titleSerif(size: 20),
                              ),
                              if (t['isi'] != null) ...[
                                const SizedBox(height: 6),
                                Text(
                                  '${t['isi']}',
                                  style: sans(
                                    size: 15,
                                    height: 1.5,
                                    color: AppColors.ink.withValues(
                                      alpha: 0.75,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Poster kampanye: galeri 2 kolom; ketuk → tampilan penuh + Share.
class PosterScreen extends StatelessWidget {
  const PosterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _Halaman(
      title: tr('Poster'),
      children: [
        _Muat(
          path: '/campaign/contents',
          query: const {'jenis': 'poster'},
          builder: (context, data) {
            final items = (data['items'] as List? ?? const [])
                .whereType<Map>()
                .toList();
            if (items.isEmpty) {
              return EmptyState(
                icon: Icons.image_outlined,
                title: tr('Belum ada poster'),
                message: tr(
                  'Poster kampanye keselamatan dari pengelola SmartMove akan muncul di sini.',
                ),
              );
            }
            return GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.62,
              children: [
                for (final p in items)
                  Material(
                    color: AppColors.surfaceNav,
                    borderRadius: BorderRadius.circular(16),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => _buka(context, _PenampilPoster(poster: p)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(child: _gambar(p, BoxFit.cover)),
                          Padding(
                            padding: const EdgeInsets.all(10),
                            child: Text(
                              '${p['judul']}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: sans(size: 14, weight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

Widget _gambar(Map p, BoxFit fit) {
  final url = urlBerkas(p['gambar']);
  final kosong = Center(
    child: Icon(
      Icons.image_outlined,
      size: 40,
      color: AppColors.ink.withValues(alpha: 0.3),
    ),
  );
  if (url == null) return kosong;
  return Image.network(
    url,
    fit: fit,
    semanticLabel: '${p['judul']}',
    errorBuilder: (_, _, _) => kosong,
  );
}

class _PenampilPoster extends StatelessWidget {
  const _PenampilPoster({required this.poster});
  final Map poster;

  @override
  Widget build(BuildContext context) {
    final url = urlBerkas(poster['gambar']);
    return Scaffold(
      backgroundColor: AppColors.barDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.white,
        title: Text(
          '${poster['judul']}',
          style: titleSerif(size: 20, color: AppColors.white),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: InteractiveViewer(
              child: Center(child: _gambar(poster, BoxFit.contain)),
            ),
          ),
          if (poster['isi'] != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Text(
                '${poster['isi']}',
                textAlign: TextAlign.center,
                style: sans(size: 15, color: AppColors.white, height: 1.45),
              ),
            ),
          SafeArea(
            top: false,
            minimum: const EdgeInsets.all(AppSizes.s4),
            child: FilledButton.icon(
              onPressed: () => SharePlus.instance.share(
                ShareParams(
                  text: tr('{0}{1}\n\nKampanye keselamatan SmartMove Medan', [
                    poster['judul'],
                    url != null ? '\n$url' : '',
                  ]),
                  subject: '${poster['judul']}',
                ),
              ),
              icon: const Icon(Icons.share_outlined),
              label: Text(tr('Share')),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.actionPill,
                foregroundColor: AppColors.inkVioletTetap,
                minimumSize: const Size(160, AppSizes.touch),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Umpan Balik: rating 1–5, fitur (opsional), komentar ≤ 1000.
class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => FeedbackScreenState();
}

class FeedbackScreenState extends State<FeedbackScreen> {
  int rating = 0;
  String? fitur;
  final _komentar = TextEditingController();
  bool kirim = false;
  bool selesai = false;
  int poin = 0;
  Object? galat;

  @override
  void dispose() {
    _komentar.dispose();
    super.dispose();
  }

  Future<void> _kirim() async {
    final api = AppScope.of(context).api;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      kirim = true;
      galat = null;
    });
    try {
      final res = await api.post('/campaign/feedback', {
        'rating': rating,
        if (_komentar.text.trim().isNotEmpty) 'komentar': _komentar.text.trim(),
        'fitur': ?fitur,
      });
      if (mounted) {
        setState(() {
          kirim = false;
          selesai = true;
          poin = res is Map ? (res['poin'] as int? ?? 0) : 0;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          kirim = false;
          galat = e;
        });
      }
    }
  }

  void _ulang() => setState(() {
    rating = 0;
    fitur = null;
    _komentar.clear();
    selesai = false;
  });

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).user;
    return _Halaman(
      title: tr('Umpan Balik'),
      children: [
        if (user == null)
          _kartu(
            judul: tr('Masuk dulu untuk memberi masukan'),
            isi: tr(
              'Satu akun bisa mengirim beberapa masukan, jadi kami bisa menindaklanjutinya.',
            ),
            aksi: FilledButton.icon(
              onPressed: () => pushLogin(context),
              icon: const Icon(Icons.login_rounded, size: 18),
              label: Text(tr('Masuk')),
            ),
          )
        else if (selesai)
          _kartu(
            judul: tr('Terima kasih!'),
            isi:
                tr(
                  'Masukanmu sudah terkirim dan akan dibaca tim SmartMove Medan.',
                ) +
                (poin > 0 ? tr(' Kamu dapat +{0} poin.', [poin]) : ''),
            aksi: Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                FilledButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(tr('Kembali ke Kampanye')),
                ),
                OutlinedButton(
                  onPressed: _ulang,
                  child: Text(tr('Kirim masukan lain')),
                ),
              ],
            ),
          )
        else
          ..._form(),
      ],
    );
  }

  Widget _kartu({
    required String judul,
    required String isi,
    required Widget aksi,
  }) => Semantics(
    liveRegion: true,
    child: Container(
      padding: const EdgeInsets.all(AppSizes.s6),
      decoration: BoxDecoration(
        color: AppColors.lilacWash.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Text(judul, textAlign: TextAlign.center, style: titleSerif(size: 22)),
          const SizedBox(height: AppSizes.s2),
          Text(
            isi,
            textAlign: TextAlign.center,
            style: sans(
              size: 15,
              height: 1.45,
              color: AppColors.ink.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: AppSizes.s4),
          aksi,
        ],
      ),
    ),
  );

  List<Widget> _form() {
    final label = sans(size: 14, weight: FontWeight.w600);
    return [
      Text(
        tr('Seberapa membantu SmartMove buatmu?'),
        style: titleSerif(size: 22),
      ),
      const SizedBox(height: AppSizes.s3),
      Row(
        children: [
          for (var n = 1; n <= 5; n++)
            Semantics(
              selected: rating == n,
              inMutuallyExclusiveGroup: true,
              label: tr('{0} dari 5, {1}', [n, labelRating[n].toLowerCase()]),
              excludeSemantics: true,
              child: IconButton(
                onPressed: () => setState(() => rating = n),
                iconSize: 34,
                icon: Icon(
                  n <= rating ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: n <= rating
                      ? AppColors.trafficPadat
                      : AppColors.ink.withValues(alpha: 0.3),
                ),
              ),
            ),
          const SizedBox(width: AppSizes.s1),
          Flexible(
            child: Text(
              labelRating[rating],
              style: sans(
                size: 15,
                weight: FontWeight.w600,
                color: AppColors.ink.withValues(alpha: 0.75),
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: AppSizes.s6),
      Text(tr('Tentang fitur apa? (boleh dilewati)'), style: label),
      const SizedBox(height: AppSizes.s2),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final (v, l) in fiturUmpanBalik)
            ChoiceChip(
              label: Text(l),
              selected: fitur == v,
              onSelected: (on) => setState(() => fitur = on ? v : null),
              showCheckmark: false,
              materialTapTargetSize: MaterialTapTargetSize.padded,
              labelStyle: sans(
                size: 14,
                weight: FontWeight.w600,
                color: fitur == v
                    ? AppColors.white
                    : AppColors.ink.withValues(alpha: 0.8),
              ),
              selectedColor: AppColors.inkVioletIsi,
              backgroundColor: AppColors.card,
              side: BorderSide(
                color: fitur == v
                    ? AppColors.inkViolet
                    : AppColors.ink.withValues(alpha: 0.15),
              ),
              shape: const StadiumBorder(),
            ),
        ],
      ),
      const SizedBox(height: AppSizes.s6),
      Text(tr('Ceritakan lebih lanjut (boleh kosong)'), style: label),
      const SizedBox(height: AppSizes.s2),
      TextField(
        controller: _komentar,
        maxLength: 1000,
        minLines: 3,
        maxLines: 6,
        style: sans(size: 15),
        decoration: InputDecoration(
          hintText: tr('Apa yang sudah bagus, apa yang perlu diperbaiki?'),
          filled: true,
          fillColor: AppColors.search,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
        ),
      ),
      if (galat != null) ...[
        const SizedBox(height: AppSizes.s2),
        ErrorBanner(error: galat),
      ],
      const SizedBox(height: AppSizes.s3),
      FilledButton.icon(
        onPressed: rating == 0 || kirim ? null : _kirim,
        icon: kirim
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.white,
                ),
              )
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(tr('Kirim umpan balik')),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.loginButton,
          minimumSize: const Size.fromHeight(AppSizes.touch),
          textStyle: sans(size: 16, weight: FontWeight.w600),
        ),
      ),
      if (rating == 0)
        Padding(
          padding: const EdgeInsets.only(top: AppSizes.s2),
          child: Text(
            tr('Pilih bintang dulu untuk mengirim.'),
            textAlign: TextAlign.center,
            style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.55)),
          ),
        ),
    ];
  }
}
