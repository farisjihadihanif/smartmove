import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

/// Token warna mockup – DESIGN.md §2.1. Jangan diubah tanpa memperbarui DESIGN.md.
abstract final class AppColors {
  static const primaryDeep = Color(0xFF361254);
  static const primary = Color(0xFF4B1D6D);
  static const magenta = Color(0xFF8B3AA8);
  static const violet = Color(0xFF6D28D9);
  static const lavender = Color(0xFFF3E8FF);
  static const accent = Color(0xFFD35428);
  static const route = Color(0xFF0D3AA9);
  static const trafficLancar = Color(0xFF2E9E5B);
  static const trafficPadat = Color(0xFFF2A20C);
  static const trafficMacet = Color(0xFFD93636);
  static const white = Color(0xFFFFFFFF);
}

/// Gradasi header nebula: #361254 → #4B1D6D → #8B3AA8.
const nebulaGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [AppColors.primaryDeep, AppColors.primary, AppColors.magenta],
);

/// Ukuran (DESIGN §2.3): spasi kelipatan 4, target sentuh ≥ 48 dp.
abstract final class AppSizes {
  static const touch = 48.0;
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
}

/// Gaya judul Bree Serif (judul kartu besar, sapaan).
TextStyle titleSerif({double size = 22, Color color = AppColors.primaryDeep}) =>
    GoogleFonts.breeSerif(fontSize: size, color: color, height: 1.2);

ThemeData buildTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: AppColors.primary,
    onPrimary: AppColors.white,
    primaryContainer: AppColors.lavender,
    onPrimaryContainer: AppColors.primaryDeep,
    secondary: AppColors.magenta,
    onSecondary: AppColors.white,
    tertiary: AppColors.violet,
    onTertiary: AppColors.white,
    error: AppColors.trafficMacet,
    onError: AppColors.white,
    surface: AppColors.white,
    onSurface: AppColors.primaryDeep,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final text = GoogleFonts.openSansTextTheme(base.textTheme).apply(
    bodyColor: AppColors.primaryDeep,
    displayColor: AppColors.primaryDeep,
  );
  const pill = StadiumBorder();
  const minTouch = Size(AppSizes.touch, AppSizes.touch);

  return base.copyWith(
    textTheme: text,
    scaffoldBackgroundColor: AppColors.white,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.primaryDeep,
      foregroundColor: AppColors.white,
      elevation: 0,
      titleTextStyle: text.titleLarge?.copyWith(
        color: AppColors.white,
        fontWeight: FontWeight.w600,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        minimumSize: minTouch,
        shape: pill,
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        minimumSize: minTouch,
        shape: pill,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.primary),
        minimumSize: minTouch,
        shape: pill,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.violet,
        minimumSize: minTouch,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: minTouch),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.lavender,
      selectedColor: AppColors.magenta,
      shape: pill,
      side: BorderSide.none,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.lavender,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSizes.s4,
        vertical: AppSizes.s3,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(999),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(999),
        borderSide: const BorderSide(color: AppColors.violet, width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.white,
      indicatorColor: AppColors.lavender,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.primaryDeep.withValues(alpha: 0.55),
        ),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.primaryDeep,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
