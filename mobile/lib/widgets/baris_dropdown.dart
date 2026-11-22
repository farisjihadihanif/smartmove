import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../theme.dart';

/// Baris pengaturan Tampilan (T-110, dropdown T-115): ikon + label, dropdown di kanan
/// (pola `D:\project\chemistry`). Sama dengan web PilihTema.jsx.
class PilihTema extends StatelessWidget {
  const PilihTema({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  static List<(String, String, IconData)> get opsi => [
    ('sistem', tr('Ikuti sistem'), Icons.brightness_auto_rounded),
    ('terang', tr('Terang'), Icons.light_mode_rounded),
    ('gelap', tr('Gelap'), Icons.dark_mode_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return BarisDropdown<String>(
      ikon: Icons.palette_outlined,
      label: tr('Tampilan'),
      value: value,
      onChanged: onChanged,
      items: [for (final (v, l, i) in opsi) (v, l, i)],
    );
  }
}

/// Baris pengaturan Bahasa (T-111): Ikuti perangkat · Bahasa Indonesia · English.
/// Sama dengan web components/PilihBahasa.jsx. Disimpan di perangkat ini.
class PilihBahasa extends StatelessWidget {
  const PilihBahasa({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  static List<(String, String, IconData?)> get opsi => [
    ('sistem', tr('Ikuti perangkat'), Icons.phone_android_rounded),
    ('id', 'Bahasa Indonesia', null),
    ('en', 'English', null),
  ];

  @override
  Widget build(BuildContext context) {
    return BarisDropdown<String>(
      ikon: Icons.translate_rounded,
      label: tr('Bahasa'),
      value: value,
      onChanged: onChanged,
      items: opsi,
    );
  }
}

/// Baris pengaturan dengan dropdown (Tampilan, Bahasa).
class BarisDropdown<T> extends StatelessWidget {
  const BarisDropdown({
    super.key,
    required this.ikon,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final IconData ikon;
  final String label;
  final T value;
  final List<(T, String, IconData?)> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: AppSizes.touch + 8),
      child: Row(
        children: [
          Icon(ikon, color: AppColors.inkViolet, size: 22),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Text(label, style: sans(size: 15, weight: FontWeight.w600)),
          ),
          Container(
            padding: const EdgeInsets.only(
              left: AppSizes.s3,
              right: AppSizes.s1,
            ),
            decoration: BoxDecoration(
              color: AppColors.search,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink.withValues(alpha: 0.1)),
            ),
            child: DropdownButton<T>(
              value: value,
              underline: const SizedBox.shrink(),
              borderRadius: BorderRadius.circular(12),
              dropdownColor: AppColors.card,
              iconEnabledColor: AppColors.ink.withValues(alpha: 0.55),
              style: sans(
                size: 15,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
              itemHeight: AppSizes.touch,
              items: [
                for (final (v, l, i) in items)
                  DropdownMenuItem<T>(
                    value: v,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (i != null) ...[
                          Icon(i, size: 18, color: AppColors.inkViolet),
                          const SizedBox(width: AppSizes.s2),
                        ],
                        Text(l),
                      ],
                    ),
                  ),
              ],
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ),
        ],
      ),
    );
  }
}
