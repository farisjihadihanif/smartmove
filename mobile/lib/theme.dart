import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

/// Token warna dari piksel mockup – DESIGN.md §2.1.
/// Ubah bersamaan dengan DESIGN.md dan web/src/index.css.
abstract final class AppColors {
  // Login (hal. 2)
  static const loginFrom = Color(0xFF333399);
  static const loginTo = Color(0xFFFF00CC);
  static const indigo = Color(0xFF333399);
  static const loginButton = Color(0xFF7324A9);
  static const loginField = Color(0xFFFCEDED);
  static const loginAvatar = Color(0xFFB79FD1);

  // Splash (hal. 1)
  static const splashBg = Color(0xFFF6FFF4);
  static const olive = Color(0xFF7B7147);
  static const oliveSoft = Color(0xFF918555);
  static const leaf = Color(0xFFE1E6D3);

  // Warna dasar tekstur (fallback saat gambar belum termuat)
  static const lilacWash = Color(0xFFDAB8F6);
  static const barDark = Color(0xFF3B0B64);

  // Kapsul & bar
  static const pillFrom = Color(0xFF4B3572);
  static const pillVia = Color(0xFFA2028A);
  static const pillTo = Color(0xFF6B217B);
  static const pillDeepFrom = Color(0xFF43376F);
  static const pillDeepVia = Color(0xFF720D81);
  static const pillDeepTo = Color(0xFF512A77);
  static const pillSoft = Color(0xFF9B59B6);
  static const inkViolet = Color(0xFF41396F);
  static const actionPill = Color(0xFFF4F0F0);
  static const sysnavFrom = Color(0xFF4C2F73);
  static const sysnavVia = Color(0xFF740C82);
  static const sysnavTo = Color(0xFF4D2F76);

  // Kartu Trip Planner (hal. 3)
  static const trip1 = Color(0xFFF29BB8);
  static const trip2 = Color(0xFFD684A7);
  static const trip3 = Color(0xFF9C6193);
  static const trip4 = Color(0xFF5F3F73);

  // Ikon, teks, permukaan
  static const iconBlue = Color(0xFF68B4E7);
  static const iconBlueDeep = Color(0xFF1E63C3);
  static const ink = Color(0xFF000000);
  static const white = Color(0xFFFFFFFF);
  static const surfaceMenu = Color(0xFFFAFDFD);
  static const surfaceNav = Color(0xFFF4F4F3);
  static const search = Color(0xFFF6F6F6);

  // Peta & lalu lintas (hal. 4, 6)
  static const route = Color(0xFF0F53FF);
  static const routeOutline = Color(0xFF0A11D8);
  static const trafficLancar = Color(0xFF2E9E5B);
  static const trafficPadat = Color(0xFFFFA000);
  static const trafficMacet = Color(0xFFF44336);
}

/// Gradasi dari mockup (titik henti diukur dari gambar).
abstract final class AppGradients {
  static const login = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [AppColors.loginFrom, AppColors.loginTo],
  );
  static const pill = LinearGradient(
    colors: [AppColors.pillFrom, AppColors.pillVia, AppColors.pillTo],
    stops: [0, 0.66, 1],
  );
  static const pillDeep = LinearGradient(
    colors: [
      AppColors.pillDeepFrom,
      AppColors.pillDeepVia,
      AppColors.pillDeepTo,
    ],
    stops: [0, 0.62, 1],
  );
  static const sysnav = LinearGradient(
    colors: [AppColors.sysnavFrom, AppColors.sysnavVia, AppColors.sysnavTo],
    stops: [0, 0.45, 1],
  );
  static const tripCard = LinearGradient(
    colors: [
      AppColors.trip1,
      AppColors.trip2,
      AppColors.trip3,
      AppColors.trip4,
    ],
    stops: [0, 0.5, 0.82, 1],
  );
}

/// Tekstur yang dipotong dari mockup (bukan gradasi buatan).
abstract final class AppTextures {
  static const lilacWashAsset = 'assets/textures/lilac-wash.webp';
  static const barDarkAsset = 'assets/textures/bar-dark.webp';

  /// Logo dari mockup hal. 1 (sementara sampai logo final, DESIGN §9).
  static const logoAsset = 'assets/brand/logo.webp';

  /// Latar header lilac: gambar menutupi area, rata atas.
  static const lilacWash = BoxDecoration(
    color: AppColors.lilacWash,
    image: DecorationImage(
      image: AssetImage(lilacWashAsset),
      fit: BoxFit.cover,
      alignment: Alignment.topCenter,
    ),
  );

  /// Latar bar aksi bawah ungu tua.
  static const barDark = BoxDecoration(
    color: AppColors.barDark,
    image: DecorationImage(image: AssetImage(barDarkAsset), fit: BoxFit.cover),
  );
}

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

/// Gaya Open Sans dengan bobot yang benar. google_fonts mendaftarkan family
/// per bobot (mis. `OpenSans_600`), jadi `copyWith(fontWeight: ...)` atau
/// `TextStyle(fontWeight: ...)` yang mewarisi family lain TIDAK mengganti
/// file font. Selalu pakai helper ini (atau [titleSerif]) bila mengubah bobot.
/// Bobot yang dibundel: 400, 500, 600, 700, 800.
TextStyle sans({
  double? size,
  FontWeight weight = FontWeight.w400,
  Color? color,
  double? height,
  double? letterSpacing,
  TextDecoration? decoration,
  Color? decorationColor,
}) => GoogleFonts.openSans(
  fontSize: size,
  fontWeight: weight,
  color: color,
  height: height,
  letterSpacing: letterSpacing,
  decoration: decoration,
  decorationColor: decorationColor,
);

/// Gaya judul Bree Serif (judul kartu besar, sapaan).
TextStyle titleSerif({double size = 22, Color color = AppColors.ink}) =>
    GoogleFonts.breeSerif(fontSize: size, color: color, height: 1.2);

ThemeData buildTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: AppColors.loginButton,
    onPrimary: AppColors.white,
    primaryContainer: AppColors.lilacWash,
    onPrimaryContainer: AppColors.ink,
    secondary: AppColors.pillVia,
    onSecondary: AppColors.white,
    tertiary: AppColors.inkViolet,
    onTertiary: AppColors.white,
    error: AppColors.trafficMacet,
    onError: AppColors.white,
    surface: AppColors.white,
    onSurface: AppColors.ink,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  // Gabungkan geometri tipografi (ukuran + bobot M3, mis. titleMedium w500)
  // SEBELUM diberi Open Sans, agar tiap gaya mendapat family sesuai bobotnya.
  // Tanpa ini bobot baru ditambahkan Theme.of() dan family tetap regular.
  final text = GoogleFonts.openSansTextTheme(
    base.typography.englishLike.merge(base.textTheme),
  ).apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);
  const pill = StadiumBorder();
  const minTouch = Size(AppSizes.touch, AppSizes.touch);

  return base.copyWith(
    textTheme: text,
    scaffoldBackgroundColor: AppColors.white,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.lilacWash,
      foregroundColor: AppColors.ink,
      elevation: 0,
      titleTextStyle: sans(
        size: text.titleLarge?.fontSize,
        weight: FontWeight.w600,
        color: AppColors.ink,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.loginButton,
        foregroundColor: AppColors.white,
        minimumSize: minTouch,
        shape: pill,
        textStyle: sans(
          size: text.labelLarge?.fontSize,
          weight: FontWeight.w600,
        ),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.pillDeepVia,
        foregroundColor: AppColors.white,
        minimumSize: minTouch,
        shape: pill,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.inkViolet,
        side: const BorderSide(color: AppColors.inkViolet),
        minimumSize: minTouch,
        shape: pill,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.inkViolet,
        minimumSize: minTouch,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: minTouch),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.pillSoft,
      selectedColor: AppColors.pillVia,
      shape: pill,
      side: BorderSide.none,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.search,
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
        borderSide: const BorderSide(color: AppColors.inkViolet, width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surfaceNav,
      indicatorColor: AppColors.lilacWash,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected)
              ? AppColors.iconBlueDeep
              : AppColors.ink.withValues(alpha: 0.55),
        ),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.inkViolet,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
