import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../theme.dart';

/// Fitur unggulan, teks dari poster (mockup hal. 1); ikon garis menggantikan
/// centang clip-art. Sama dengan FITUR di web/src/pages/Splash.jsx.
List<String> get splashFeatures => [
  tr('Navigasi rute alternatif'),
  tr('Pemantau lalu lintas real time'),
  tr('Sistem pembayaran terintegrasi transportasi umum'),
  tr('Kampanye kesadaran penggunaan transportasi umum'),
];

const _featureIcons = [
  Icons.alt_route,
  Icons.traffic_outlined,
  Icons.confirmation_number_outlined,
  Icons.campaign_outlined,
];

/// Splash (identitas mockup hal. 1, dimodernkan): latar mint, logo, judul
/// olive rata kiri, dan satu panel olive berisi 4 fitur unggulan.
/// Tampil sebentar saat aplikasi dibuka; perpindahan diatur oleh pemanggil.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _intro.value = 1;
    } else if (!_intro.isAnimating && _intro.value == 0) {
      _intro.forward();
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  /// Satu urutan muncul: logo → judul → fitur (bergeser 12 px ke atas).
  Widget _rise(int i, Widget child) {
    final start = i * 0.07; // indeks maks. 6 → selesai di 0,92
    final anim = CurvedAnimation(
      parent: _intro,
      curve: Interval(start, start + 0.5, curve: Curves.easeOutCubic),
    );
    return AnimatedBuilder(
      animation: anim,
      builder: (_, c) => Opacity(
        opacity: anim.value,
        child: Transform.translate(
          offset: Offset(0, 12 * (1 - anim.value)),
          child: c,
        ),
      ),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final titleSize = (width * 0.13).clamp(36.0, 64.0);

    return Scaffold(
      backgroundColor: AppColors.splashBg,
      body: Stack(
        children: [
          const Positioned(
            left: -48,
            top: 96,
            width: 140,
            child: Leaf(angle: -0.2),
          ),
          const Positioned(
            right: -56,
            top: -24,
            width: 176,
            child: Leaf(angle: 0.32),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _rise(0, const _LogoLockup()),
                      const SizedBox(height: 36),
                      _rise(
                        1,
                        Semantics(
                          header: true,
                          label: tr('Permudah kegiatanmu'),
                          child: ExcludeSemantics(
                            child: Text(
                              'PERMUDAH\nKEGIATANMU',
                              style: sans(
                                color: AppColors.olive,
                                size: titleSize,
                                weight: FontWeight.w800,
                                height: 0.95,
                                letterSpacing: -0.8,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _rise(
                        2,
                        Text(
                          tr(
                            'Rute, lalu lintas, dan tiket transportasi umum Medan dalam satu aplikasi.',
                          ),
                          style: sans(
                            color: AppColors.oliveSoft,
                            size: 17,
                            height: 1.4,
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      _rise(3, const _FeaturePanel()),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogoLockup extends StatelessWidget {
  const _LogoLockup();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'SmartMove Medan',
      child: ExcludeSemantics(
        child: Row(
          children: [
            Image.asset(AppTextures.logoAsset, width: 72),
            const SizedBox(width: 12),
            Text(
              'SmartMove\nMedan',
              style: titleSerif(
                size: 20,
                color: AppColors.oliveSoft,
              ).copyWith(height: 1.05),
            ),
          ],
        ),
      ),
    );
  }
}

/// Satu panel olive (bukan 4 kapsul seragam) dengan pembatas tipis.
class _FeaturePanel extends StatelessWidget {
  const _FeaturePanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.olive,
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x664A4428),
            blurRadius: 40,
            spreadRadius: -20,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        children: [
          for (final (i, f) in splashFeatures.indexed)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: i == splashFeatures.length - 1
                  ? null
                  : const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0x26FFFFFF)),
                      ),
                    ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: AppColors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _featureIcons[i],
                      color: AppColors.olive,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      f,
                      style: sans(
                        color: AppColors.white,
                        size: 15,
                        height: 1.35,
                      ),
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

/// Garis daun dekoratif dari poster: tepi daun, tangkai, dan urat yang
/// menyebar dari pangkal. Sama dengan `Leaf` di web/src/pages/Splash.jsx.
class Leaf extends StatelessWidget {
  const Leaf({super.key, this.angle = 0});

  final double angle;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ExcludeSemantics(
        child: Transform.rotate(
          angle: angle,
          child: AspectRatio(
            aspectRatio: 200 / 310,
            child: CustomPaint(painter: _LeafPainter()),
          ),
        ),
      ),
    );
  }
}

class _LeafPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 200;
    canvas.scale(s);
    final paint = Paint()
      ..color = AppColors.leaf
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5 / s; // ±1,5 px di layar

    final outline = Path()
      ..moveTo(100, 250)
      ..cubicTo(30, 205, 2, 120, 40, 52)
      ..cubicTo(70, 0, 140, -4, 172, 46)
      ..cubicTo(212, 112, 180, 206, 100, 250)
      ..close();
    canvas.drawPath(outline, paint);
    canvas.drawLine(const Offset(100, 250), const Offset(114, 306), paint);

    canvas.save();
    canvas.clipPath(outline);
    for (var i = 0; i < 15; i++) {
      final a = math.pi * (1.08 + (i / 14) * 0.84);
      canvas.drawLine(
        const Offset(100, 250),
        Offset(100 + math.cos(a) * 130, 130 + math.sin(a) * 150),
        paint,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_LeafPainter oldDelegate) => false;
}
