import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Kolom "Telusuri di sini" (mockup hal. 3–7): kapsul abu muda, pin kiri,
/// kaca pembesar kanan. Beranda: `leading: Icon(Icons.search)` + `showSubmit: false`.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.hint = 'Telusuri di sini',
    this.label = 'Cari tempat',
    this.leading = const _DefaultPin(),
    this.showSubmit = true,
    this.autofocus = false,
  });

  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String hint;
  final String label;
  final Widget? leading;
  final bool showSubmit;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.titleMedium
        ?.copyWith(fontSize: 18, color: AppColors.ink);

    return Container(
      height: AppSizes.touch,
      padding: const EdgeInsets.only(left: AppSizes.s2, right: AppSizes.s1),
      decoration: ShapeDecoration(
        color: AppColors.search,
        // Garis tipis lewat bayangan (bukan BorderSide) agar area ketuk tetap 48 dp.
        shape: const StadiumBorder(),
        shadows: [
          BoxShadow(
            color: AppColors.ink.withValues(alpha: 0.05),
            spreadRadius: 1,
          ),
          BoxShadow(
            color: AppColors.inkViolet.withValues(alpha: 0.18),
            blurRadius: 3,
            offset: const Offset(0, 1),
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
                hintText: hint,
                hintStyle: textStyle,
                semanticCounterText: label,
                filled: false,
                isCollapsed: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
          if (showSubmit)
            IconButton(
              tooltip: 'Cari',
              onPressed: () => onSubmitted?.call(controller?.text ?? ''),
              icon: const Icon(Icons.search, size: 28, color: AppColors.ink),
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
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Icon(
        Icons.location_on,
        size: 24,
        color: AppColors.trafficMacet,
      ),
    );
  }
}
