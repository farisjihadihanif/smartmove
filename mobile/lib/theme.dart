import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

/// Mode gelap (T-110, DESIGN §2.1b). Diatur [buildTheme]; warna adaptif di [AppColors]
/// membaca nilai ini. Pohon widget dibangun ulang saat tema berganti (lihat main.dart).
abstract final class AppPalette {
  static bool gelap = false;
}

/// Token warna dari piksel mockup – DESIGN.md §2.1.
/// Ubah bersamaan dengan DESIGN.md dan web/src/index.css.
/// Warna identitas (gradasi, kartu Trip Planner, bar aksi, lalu lintas) tetap di kedua mode;
/// permukaan, teks, dan aksen ungu tua adaptif (getter, nilai gelap = web `[data-theme=dark]`).
abstract final class AppColors {
  static bool get _g => AppPalette.gelap;
  // Login (hal. 2)
  static const loginFrom = Color(0xFF333399);
  static const loginTo = Color(0xFFFF00CC);
  static Color get indigo =>
      _g ? const Color(0xFFADA8F5) : const Color(0xFF333399);
  static const loginButton = Color(0xFF7324A9);
  static Color get loginField =>
      _g ? const Color(0xFF2C2240) : const Color(0xFFFCEDED);
  static const loginAvatar = Color(0xFFB79FD1);

  // Splash (hal. 1)
  static const splashBg = Color(0xFFF6FFF4);
  static const olive = Color(0xFF7B7147);
  static const oliveSoft = Color(0xFF918555);
  static const leaf = Color(0xFFE1E6D3);

  // Warna dasar tekstur (fallback saat gambar belum termuat)
  static Color get lilacWash =>
      _g ? const Color(0xFF3A2A57) : const Color(0xFFDAB8F6);
  static const barDark = Color(0xFF3B0B64);

  // Kapsul & bar
  static const pillFrom = Color(0xFF4B3572);
  static const pillVia = Color(0xFFA2028A);
  static const pillTo = Color(0xFF6B217B);
  static const pillDeepFrom = Color(0xFF43376F);
  static const pillDeepVia = Color(0xFF720D81);
  static const pillDeepTo = Color(0xFF512A77);
  static const pillSoft = Color(0xFF9B59B6);
  static Color get inkViolet => _g ? const Color(0xFFC9B8F2) : inkVioletTetap;

  /// Ungu tua yang tidak berubah (teks di atas kapsul putih #F4F0F0, isian chip terpilih).
  static const inkVioletTetap = Color(0xFF41396F);

  /// Isian solid "ungu tua" bertulisan putih (chip/kapsul terpilih).
  static Color get inkVioletIsi =>
      _g ? const Color(0xFF5A4A9C) : inkVioletTetap;
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
  static Color get ink =>
      _g ? const Color(0xFFF2EDFA) : const Color(0xFF000000);
  static const white = Color(0xFFFFFFFF);

  /// Latar halaman.
  static Color get surface => _g ? const Color(0xFF15101E) : white;

  /// Kartu & lembar di atas latar (putih di mode terang).
  static Color get card => _g ? const Color(0xFF211A2E) : white;
  static Color get surfaceMenu =>
      _g ? const Color(0xFF1A1426) : const Color(0xFFFAFDFD);
  static Color get surfaceNav =>
      _g ? const Color(0xFF1B1527) : const Color(0xFFF4F4F3);

  /// Teks status di atas tint (hijau / kuning / merah / abu), dicerahkan di mode gelap.
  static Color get teksHijau =>
      _g ? const Color(0xFF86DCA8) : const Color(0xFF1D6B3D);
  static Color get teksKuning =>
      _g ? const Color(0xFFFFC870) : const Color(0xFF8A5300);
  static Color get teksMerah =>
      _g ? const Color(0xFFFF9A8F) : const Color(0xFFB42318);
  static Color get teksAbu =>
      _g ? const Color(0xFFB8B3C4) : const Color(0xFF5F5F6B);
  static Color get search =>
      _g ? const Color(0xFF2A2239) : const Color(0xFFF6F6F6);

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

  /// Latar header lilac: gambar menutupi area, rata atas. Mode gelap: tekstur yang sama
  /// dikalikan ungu tua (guratan cat air tetap terlihat, teks terang terbaca) = web multiply.
  static BoxDecoration get lilacWash => BoxDecoration(
    color: AppColors.lilacWash,
    image: DecorationImage(
      image: const AssetImage(lilacWashAsset),
      fit: BoxFit.cover,
      alignment: Alignment.topCenter,
      colorFilter: AppPalette.gelap
          ? ColorFilter.mode(AppColors.lilacWash, BlendMode.multiply)
          : null,
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
TextStyle titleSerif({double size = 22, Color? color}) => GoogleFonts.breeSerif(
  fontSize: size,
  color: color ?? AppColors.ink,
  height: 1.2,
);

ThemeData buildTheme({bool gelap = false}) {
  AppPalette.gelap = gelap;
  final scheme = ColorScheme(
    brightness: gelap ? Brightness.dark : Brightness.light,
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
    surface: AppColors.card,
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
    scaffoldBackgroundColor: AppColors.surface,
    canvasColor: AppColors.surface,
    dividerColor: AppColors.ink.withValues(alpha: 0.1),
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
        side: BorderSide(color: AppColors.inkViolet),
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
        borderSide: BorderSide(color: AppColors.inkViolet, width: 2),
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
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.inkVioletIsi,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
