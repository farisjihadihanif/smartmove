import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../theme.dart';

/// Kolom "Telusuri di sini" (mockup hal. 3–7): kapsul abu muda, pin kiri,
/// tombol cari bulat ungu di kanan. Beranda: `leading: Icon(Icons.search)` + `showSubmit: false`.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.hint,
    this.label,
    this.leading = const _DefaultPin(),
    this.showSubmit = true,
    this.autofocus = false,
  });

  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String? hint;
  final String? label;
  final Widget? leading;
  final bool showSubmit;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.titleMedium
        ?.copyWith(fontSize: 16, color: AppColors.ink);

    return Container(
      height: 52,
      padding: const EdgeInsets.only(left: AppSizes.s2, right: AppSizes.s1),
      decoration: ShapeDecoration(
        color: AppColors.search,
        // Garis tipis lewat bayangan (bukan BorderSide) agar area ketuk tetap 48 dp.
        shape: const StadiumBorder(),
        shadows: [
          BoxShadow(
            color: AppColors.card.withValues(alpha: 0.7),
            spreadRadius: 1,
          ),
          BoxShadow(
            color: AppColors.inkViolet.withValues(alpha: 0.45),
            blurRadius: 18,
            spreadRadius: -8,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          if (leading != null)
            SizedBox(width: 36, height: 36, child: Center(child: leading)),
          const SizedBox(width: AppSizes.s2),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              autofocus: autofocus,
              textInputAction: TextInputAction.search,
              style: textStyle,
              decoration: InputDecoration(
                hintText: hint ?? tr('Telusuri di sini'),
                hintStyle: textStyle?.copyWith(
                  color: AppColors.ink.withValues(alpha: 0.6),
                ),
                semanticCounterText: label ?? tr('Cari tempat'),
                filled: false,
                isCollapsed: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
          if (showSubmit)
            IconButton.filled(
              tooltip: tr('Cari'),
              onPressed: () => onSubmitted?.call(controller?.text ?? ''),
              style: IconButton.styleFrom(
                backgroundColor: AppColors.inkVioletIsi,
                foregroundColor: AppColors.white,
                minimumSize: const Size(44, 44),
                fixedSize: const Size(44, 44),
              ),
              icon: const Icon(Icons.search, size: 22),
            ),
        ],
      ),
    );
  }
}

class _DefaultPin extends StatelessWidget {
  const _DefaultPin();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 36,
      height: 36,
      child: Icon(Icons.location_on, size: 24, color: AppColors.trafficMacet),
    );
  }
}
