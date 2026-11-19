import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Pilihan kapsul. [icon] + [short]: lihat [PillToggle].
class PillOption<T> {
  const PillOption(this.value, this.label, {this.icon, this.short});
  final T value;
  final String label;
  final IconData? icon;

  /// Label pendek bila label lengkap tidak muat satu baris; label lengkap
  /// tetap dibacakan pembaca layar.
  final String? short;
}

enum PillTone { pill, deep, soft }

/// Deretan kapsul (mockup hal. 4, 6). Yang aktif bergradasi ungu → magenta,
/// yang tidak aktif putih tembus pandang – gradasi hanya untuk pilihan aktif.
///
/// - Tunggal (tab Estimasi Waktu · Peta Interaktif): [multiple] = false,
///   [onChanged] menerima himpunan berisi satu nilai.
/// - [multiple] (lapisan Traffic · Transportasi umum · Street view).
/// Yang aktif juga diberi ikon centang + teks tebal (bukan warna saja).
///
/// Bila opsi punya [PillOption.icon], kapsul selalu satu baris: centang
/// menggantikan ikon saat aktif (lebar tetap). Urutan: label lengkap → label
/// pendek ([PillOption.short]) → baris bisa digeser (mis. huruf diperbesar).
class PillToggle<T> extends StatelessWidget {
  const PillToggle({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.multiple = false,
    this.tone = PillTone.pill,
  });

  final List<PillOption<T>> options;
  final Set<T> selected;
  final ValueChanged<Set<T>> onChanged;
  final bool multiple;
  final PillTone tone;

  void _toggle(T v) {
    if (!multiple) return onChanged({v});
    final next = {...selected};
    if (!next.remove(v)) next.add(v);
    onChanged(next);
  }

  /// Bobot lebar kapsul: kata terpanjang (lebar minimum tanpa memotong kata)
  /// + separuh sisa label, ditambah centang (bila aktif) dan padding.
  double _lebar(BuildContext context, PillOption<T> o) {
    final on = selected.contains(o.value);
    final style = sans(
      size: 14,
      weight: on ? FontWeight.w600 : FontWeight.w400,
    );
    double ukur(String s) {
      final tp = TextPainter(
        text: TextSpan(text: s, style: style),
        textDirection: TextDirection.ltr,
        textScaler: MediaQuery.textScalerOf(context),
        maxLines: 1,
      )..layout();
      final w = tp.width;
      tp.dispose();
      return w;
    }

    final penuh = ukur(o.label);
    final kata = o.label.split(' ').map(ukur).reduce((a, b) => a > b ? a : b);
    return kata + (penuh - kata) / 2 + 12 + (on ? 20 : 0) + 8;
  }

  static const _padSatuBaris = 12.0;

  /// Lebar satu baris: teks tebal (lebar sama aktif/tidak) + ikon + padding.
  double _lebarSatuBaris(BuildContext context, String teks) {
    final tp = TextPainter(
      text: TextSpan(
        text: teks,
        style: sans(size: 14, weight: FontWeight.w600),
      ),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final w = tp.width;
    tp.dispose();
    return (w + 16 + 6 + _padSatuBaris * 2 + 2).ceilToDouble();
  }

  Widget _satuBaris(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        const jarak = AppSizes.s2;
        final celah = jarak * (options.length - 1);
        List<double> ukur(bool pendek) => [
          for (final o in options)
            _lebarSatuBaris(context, pendek ? (o.short ?? o.label) : o.label),
        ];
        var pendek = false;
        var lebar = ukur(false);
        double total() => lebar.fold<double>(celah, (a, b) => a + b);
        if (total() > c.maxWidth) {
          pendek = true;
          lebar = ukur(true);
        }
        final muat = total() <= c.maxWidth;
        Widget pil(PillOption<T> o) => GradientPill(
          label: pendek ? (o.short ?? o.label) : o.label,
          semanticLabel: o.label,
          icon: o.icon,
          maxLines: 1,
          tone: tone,
          fontSize: 14,
          padding: const EdgeInsets.symmetric(horizontal: _padSatuBaris),
          selected: selected.contains(o.value),
          onTap: () => _toggle(o.value),
        );
        final isi = [
          for (final (i, o) in options.indexed) ...[
            if (i > 0) const SizedBox(width: jarak),
            muat
                ? Expanded(flex: lebar[i].round(), child: pil(o))
                : SizedBox(width: lebar[i], child: pil(o)),
          ],
        ];
        if (muat) return Row(children: isi);
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          child: Row(children: isi),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (options.any((o) => o.icon != null)) return _satuBaris(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final (i, o) in options.indexed) ...[
          if (i > 0) const SizedBox(width: AppSizes.s2),
          // Lebar sebanding dengan isi (label panjang + centang tetap satu
          // kata utuh), maksimal 152 dp; bila sempit, label turun ke baris 2.
          Expanded(
            flex: (_lebar(context, o) * 10).round(),
            child: Align(
              alignment: switch (i) {
                0 => Alignment.centerLeft,
                _ when i == options.length - 1 => Alignment.centerRight,
                _ => Alignment.center,
              },
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 152),
                child: SizedBox(
                  width: double.infinity,
                  child: GradientPill(
                    label: o.label,
                    tone: tone,
                    fontSize: 14,
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    selected: selected.contains(o.value),
                    onTap: () => _toggle(o.value),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Satu kapsul; dipakai ulang oleh PillToggle dan MenuTile.
/// [selected] null = label biasa (selalu gradasi); false = putih; true = gradasi + centang.
class GradientPill extends StatelessWidget {
  const GradientPill({
    super.key,
    required this.label,
    this.onTap,
    this.selected,
    this.tone = PillTone.pill,
    this.fontSize = 15,
    this.bold = false,
    this.padding = const EdgeInsets.symmetric(horizontal: AppSizes.s3),
    this.icon,
    this.maxLines = 2,
    this.semanticLabel,
  });

  final String label;

  /// Ikon di depan label; saat aktif diganti centang (lebar tetap).
  final IconData? icon;
  final int maxLines;

  /// Dibacakan pembaca layar bila berbeda dari [label] (label pendek).
  final String? semanticLabel;
  final VoidCallback? onTap;

  /// null = bukan toggle (tanpa status terpilih).
  final bool? selected;
  final PillTone tone;
  final double fontSize;
  final bool bold;
  final EdgeInsets padding;

  Gradient? get _gradient => switch (tone) {
    PillTone.pill => AppGradients.pill,
    PillTone.deep => AppGradients.pillDeep,
    PillTone.soft => null,
  };

  @override
  Widget build(BuildContext context) {
    final on = selected ?? false;
    final plain = selected == false;
    final fg = plain ? AppColors.inkViolet : AppColors.white;
    final shape = StadiumBorder(
      side: plain
          ? BorderSide(color: AppColors.inkViolet.withValues(alpha: 0.15))
          : BorderSide.none,
    );
    final ikon = on ? Icons.check : icon;
    return Semantics(
      button: true,
      toggled: selected,
      label: semanticLabel,
      excludeSemantics: semanticLabel != null,
      child: Material(
        type: MaterialType.transparency,
        child: Ink(
          decoration: ShapeDecoration(
            color: plain
                ? AppColors.card.withValues(alpha: 0.8)
                : tone == PillTone.soft
                ? AppColors.pillSoft
                : null,
            gradient: plain ? null : _gradient,
            shape: shape,
            shadows: plain
                ? const []
                : [
                    BoxShadow(
                      color: AppColors.pillDeepVia.withValues(alpha: 0.8),
                      blurRadius: 14,
                      spreadRadius: -6,
                      offset: const Offset(0, 6),
                    ),
                  ],
          ),
          child: InkWell(
            onTap: onTap,
            customBorder: shape,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: AppSizes.touch),
              child: Padding(
                padding: padding,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (ikon != null) ...[
                      Icon(ikon, size: 16, color: fg),
                      SizedBox(width: icon != null ? 6 : 4),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: maxLines,
                        softWrap: maxLines > 1,
                        overflow: maxLines > 1 ? null : TextOverflow.fade,
                        style: sans(
                          color: fg,
                          size: fontSize,
                          height: 1.15,
                          weight: on || bold
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
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
