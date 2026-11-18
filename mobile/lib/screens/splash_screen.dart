import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Fitur unggulan, teks persis dari poster (mockup hal. 1).
const splashFeatures = [
  'Navigasi rute alternatif',
  'Pemantau lalu lintas real time',
  'Sistem pembayaran terintegrasi transportasi umum',
  'Kampanye kesadaran penggunaan transportasi umum',
];

/// Splash (mockup hal. 1): latar mint, logo, judul olive, 4 fitur unggulan.
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
    final titleSize = (width * 0.125).clamp(36.0, 64.0);

    return Scaffold(
      backgroundColor: AppColors.splashBg,
      body: Stack(
        children: [
          const Positioned(
            left: -40,
            top: 64,
            width: 140,
            child: Leaf(angle: -0.2),
          ),
          const Positioned(
            right: -48,
            top: -8,
            width: 176,
            child: Leaf(angle: 0.32),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 32, 16, 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    children: [
                      _rise(0, const _LogoLockup()),
                      const SizedBox(height: 28),
                      _rise(
                        1,
                        Semantics(
                          header: true,
                          label: 'Permudah kegiatanmu',
                          child: ExcludeSemantics(
                            child: Text(
                              'PERMUDAH\nKEGIATANMU',
                              textAlign: TextAlign.center,
                              style: sans(
                                color: AppColors.olive,
                                size: titleSize,
                                weight: FontWeight.w800,
                                height: 0.98,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _rise(
                        2,
                        Text(
                          'Dengan aplikasi rencana SmartMove',
                          textAlign: TextAlign.center,
                          style: sans(color: AppColors.oliveSoft, size: 17),
                        ),
                      ),
                      const SizedBox(height: 28),
                      for (final (i, f) in splashFeatures.indexed) ...[
                        if (i > 0) const SizedBox(height: 12),
                        _rise(3 + i, _FeatureChip(f)),
                      ],
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(AppTextures.logoAsset, width: 84),
            const SizedBox(width: 10),
            Text(
              'Smart\nMove.\nMedan',
              style: sans(
                color: AppColors.oliveSoft,
                size: 17,
                weight: FontWeight.w600,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.fromLTRB(12, 10, 16, 10),
      decoration: BoxDecoration(
        color: AppColors.olive,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: AppColors.white,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check, color: AppColors.olive, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: sans(color: AppColors.white, size: 15, height: 1.35),
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
