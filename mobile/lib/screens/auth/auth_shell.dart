import 'package:material_ui/material_ui.dart';

import '../../i18n.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';

/// Gradasi login (indigo → magenta) dikalikan dengan tekstur lilac:
/// warna mockup tetap, ada guratan cat air. Sama dengan `bg-login-wash` di web.
class LoginWash extends StatelessWidget {
  const LoginWash({super.key});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ShaderMask(
        blendMode: BlendMode.multiply,
        shaderCallback: AppGradients.login.createShader,
        child: Image.asset(
          AppTextures.lilacWashAsset,
          fit: BoxFit.cover,
          alignment: Alignment.topCenter,
          width: double.infinity,
          height: double.infinity,
        ),
      ),
    );
  }
}

/// Kerangka layar akun (identitas mockup hal. 2, dimodernkan): pita gradasi
/// bertekstur di atas, lembar putih membulat yang menutupinya, dan medali
/// avatar yang menumpang di sambungan keduanya.
class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.footer,
    this.showBack = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;

  /// Bagian bawah (mis. "Belum punya akun?"), menempel di dasar layar bila muat.
  final Widget? footer;
  final bool showBack;

  static const _bandBody = 140.0; // tinggi pita di bawah status bar
  static const _overlap = 36.0; // lembar putih menutupi pita sebesar ini

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: AppColors.card,
      body: LayoutBuilder(
        builder: (context, box) => SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight),
            child: IntrinsicHeight(
              child: Stack(
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    height: top + _bandBody,
                    child: const LoginWash(),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          showBack ? AppSizes.s2 : AppSizes.s6,
                          top + AppSizes.s2,
                          AppSizes.s6,
                          0,
                        ),
                        child: SizedBox(
                          height: 56,
                          child: Row(
                            children: [
                              if (showBack)
                                IconButton(
                                  tooltip: tr('Kembali'),
                                  color: AppColors.white,
                                  onPressed: () => Navigator.maybePop(context),
                                  icon: const Icon(Icons.arrow_back),
                                ),
                              const _Brand(),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(
                        height: _bandBody - AppSizes.s2 - 56 - _overlap,
                      ),
                      Expanded(
                        child: _Sheet(
                          title: title,
                          subtitle: subtitle,
                          footer: footer,
                          children: children,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'SmartMove Medan',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x40140A3C),
                    blurRadius: 14,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Image.asset(AppTextures.logoAsset, width: 34),
            ),
            const SizedBox(width: AppSizes.s3),
            Text(
              'SmartMove Medan',
              style: titleSerif(size: 20, color: AppColors.white),
            ),
          ],
        ),
      ),
    );
  }
}

class _Sheet extends StatelessWidget {
  const _Sheet({
    required this.title,
    required this.subtitle,
    required this.footer,
    required this.children,
  });

  final String title;
  final String? subtitle;
  final Widget? footer;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    style: titleSerif(size: 30),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: AppSizes.s2),
                  Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    style: sans(
                      size: 15,
                      height: 1.5,
                      color: AppColors.ink.withValues(alpha: 0.65),
                    ),
                  ),
                ],
                ...children,
                if (footer != null) ...[
                  const Spacer(),
                  const SizedBox(height: AppSizes.s8),
                  footer!,
                ],
              ],
            ),
          ),
          const Positioned(top: -44, left: 0, right: 0, child: _Medallion()),
        ],
      ),
    );
  }
}

/// Avatar mockup hal. 2, dikecilkan jadi medali bercincin putih.
class _Medallion extends StatelessWidget {
  const _Medallion();

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Center(
        child: Container(
          width: 92,
          height: 92,
          padding: const EdgeInsets.all(6),
          decoration: const BoxDecoration(
            color: AppColors.white,
            shape: BoxShape.circle,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.loginAvatar,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.person, size: 48, color: AppColors.indigo),
          ),
        ),
      ),
    );
  }
}

/// Kolom isian: label di atas, lalu sel ikon + celah tipis + sel isian
/// (motif mockup hal. 2) berlatar `loginField`. Teks rata kiri agar isian
/// panjang (email) tetap terbaca.
class AuthField extends StatefulWidget {
  const AuthField({
    super.key,
    required this.icon,
    required this.label,
    required this.controller,
    this.placeholder,
    this.helper,
    this.password = false,
    this.keyboardType,
    this.autofillHints,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
  });

  final IconData icon;
  final String label;
  final TextEditingController controller;

  /// Contoh isian (mis. "nama@email.com").
  final String? placeholder;

  /// Keterangan kecil di bawah kolom.
  final String? helper;
  final bool password;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  bool _shown = false;
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const radius = Radius.circular(16);
    final focused = _focus.hasFocus;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              widget.label,
              style: sans(
                size: 14,
                weight: FontWeight.w600,
                color: AppColors.ink.withValues(alpha: 0.8),
              ),
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 56,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.all(Radius.circular(18)),
            border: Border.all(
              color: focused
                  ? AppColors.loginButton
                  : AppColors.loginButton.withValues(alpha: 0),
              width: 2,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 48,
                decoration: BoxDecoration(
                  color: AppColors.loginField,
                  borderRadius: BorderRadius.horizontal(left: radius),
                ),
                child: Icon(widget.icon, color: AppColors.indigo, size: 22),
              ),
              const SizedBox(width: AppSizes.s1),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.loginField,
                    borderRadius: BorderRadius.horizontal(right: radius),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        // Label terlihat di atas dikecualikan; label dipasang di sini.
                        child: Semantics(
                          label: widget.label,
                          child: TextField(
                            controller: widget.controller,
                            focusNode: _focus,
                            obscureText: widget.password && !_shown,
                            enableSuggestions: !widget.password,
                            autocorrect: false,
                            keyboardType: widget.keyboardType,
                            autofillHints: widget.autofillHints,
                            textInputAction: widget.textInputAction,
                            onSubmitted: widget.onSubmitted,
                            cursorColor: AppColors.indigo,
                            style: sans(
                              color: AppColors.indigo,
                              size: 16,
                              weight: FontWeight.w500,
                            ),
                            decoration: InputDecoration(
                              hintText: widget.placeholder,
                              hintStyle: sans(
                                color: AppColors.indigo.withValues(alpha: 0.45),
                                size: 16,
                              ),
                              filled: false,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                            ),
                          ),
                        ),
                      ),
                      if (widget.password)
                        IconButton(
                          tooltip: _shown
                              ? tr('Sembunyikan password')
                              : tr('Tampilkan password'),
                          onPressed: () => setState(() => _shown = !_shown),
                          icon: Icon(
                            _shown
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: AppColors.indigo.withValues(alpha: 0.6),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (widget.helper != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              widget.helper!,
              style: sans(
                size: 13,
                height: 1.35,
                color: AppColors.ink.withValues(alpha: 0.55),
              ),
            ),
          ),
      ],
    );
  }
}

const _buttonSize = Size.fromHeight(52);

/// Tombol utama ungu (mockup: "Login"), penuh lebar.
class AuthButton extends StatelessWidget {
  const AuthButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.all(Radius.circular(26)),
        boxShadow: [
          BoxShadow(
            color: Color(0x4D7324A9),
            blurRadius: 18,
            spreadRadius: -6,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: _buttonSize,
          disabledBackgroundColor: AppColors.loginButton.withValues(alpha: 0.7),
          disabledForegroundColor: AppColors.white,
          textStyle: sans(size: 16, weight: FontWeight.w600),
        ),
        child: Text(busy ? tr('Tunggu sebentar…') : label),
      ),
    );
  }
}

/// Tombol kedua bergaris ungu (mockup: "Create account"), penuh lebar.
class AuthSecondary extends StatelessWidget {
  const AuthSecondary({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.loginButton,
        minimumSize: _buttonSize,
        side: const BorderSide(color: AppColors.loginButton, width: 2),
        textStyle: sans(size: 16, weight: FontWeight.w600),
      ),
      child: Text(label),
    );
  }
}

/// Tautan ungu bergaris bawah.
class AuthLink extends StatelessWidget {
  const AuthLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.loginButton,
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.s2),
        textStyle: sans(
          size: 15,
          weight: FontWeight.w600,
          decoration: TextDecoration.underline,
          decorationColor: AppColors.loginButton.withValues(alpha: 0.4),
        ),
      ),
      child: Text(label),
    );
  }
}

/// Baris "Sudah punya akun? Masuk" di dasar lembar.
class AuthFooter extends StatelessWidget {
  const AuthFooter({super.key, required this.text, required this.link});

  final String text;
  final AuthLink link;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          text,
          style: sans(size: 15, color: AppColors.ink.withValues(alpha: 0.7)),
        ),
        link,
      ],
    );
  }
}

/// Pesan sukses (mis. email reset terkirim). [detail] ditebalkan dan boleh
/// patah di mana saja (alamat email panjang).
class AuthNotice extends StatelessWidget {
  const AuthNotice(this.text, {super.key, this.title, this.detail, this.icon});

  final String text;
  final String? title;
  final String? detail;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final body = sans(color: AppColors.indigo, size: 14, height: 1.5);
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: BoxDecoration(
          color: AppColors.loginField,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (icon != null) ...[
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(icon, size: 22, color: AppColors.indigo),
              ),
              const SizedBox(width: AppSizes.s3),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!,
                      style: sans(
                        color: AppColors.indigo,
                        size: 14,
                        weight: FontWeight.w600,
                        height: 1.5,
                      ),
                    ),
                  Text(
                    text,
                    style: body.copyWith(
                      color: AppColors.indigo.withValues(alpha: 0.85),
                    ),
                  ),
                  if (detail != null) ...[
                    const SizedBox(height: AppSizes.s1),
                    Text(
                      breakAnywhere(detail!),
                      style: sans(
                        color: AppColors.indigo,
                        size: 14,
                        weight: FontWeight.w600,
                        height: 1.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sisipkan zero-width space setelah `@ . - _` agar alamat email panjang
/// bisa patah baris dengan rapi (Flutter tidak punya overflow-wrap:anywhere).
String breakAnywhere(String s) =>
    s.replaceAllMapped(RegExp(r'([@._-])'), (m) => '${m[1]}​');

/// Banner galat dengan jarak atas; kosong bila tidak ada galat.
class AuthError extends StatelessWidget {
  const AuthError(this.error, {super.key});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    if (error == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSizes.s3),
      child: ErrorBanner(error: error),
    );
  }
}
