import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Pilihan kapsul.
class PillOption<T> {
  const PillOption(this.value, this.label);
  final T value;
  final String label;
}

enum PillTone { pill, deep, soft }

/// Deretan kapsul gradasi ungu → magenta (mockup hal. 4, 6).
///
/// - Tunggal (tab Estimasi Waktu · Peta Interaktif): [multiple] = false,
///   [onChanged] menerima himpunan berisi satu nilai.
/// - [multiple] (lapisan Traffic · Transportasi umum · Street view).
/// Yang aktif diberi cincin putih tebal + teks tebal (bukan warna saja).
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

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final (i, o) in options.indexed) ...[
          if (i > 0) const SizedBox(width: AppSizes.s2),
          // Lebar sama untuk semua kapsul (seperti mockup), maksimal 152 dp.
          Expanded(
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

/// Satu kapsul gradasi; dipakai ulang oleh PillToggle, MenuTile, EmptyState.
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
  });

  final String label;
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
    final shape = StadiumBorder(
      side: on
          ? const BorderSide(color: AppColors.white, width: 3)
          : BorderSide.none,
    );
    return Semantics(
      button: true,
      toggled: selected,
      child: Material(
        type: MaterialType.transparency,
        child: Ink(
          decoration: ShapeDecoration(
            color: tone == PillTone.soft ? AppColors.pillSoft : null,
            gradient: _gradient,
            shape: shape,
            shadows: [
              BoxShadow(
                color: AppColors.barDark.withValues(alpha: 0.25),
                blurRadius: 4,
                offset: const Offset(0, 2),
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
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: sans(
                      color: AppColors.white,
                      size: fontSize,
                      height: 1.15,
                      weight: on || bold ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
