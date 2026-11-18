import 'package:material_ui/material_ui.dart';

import '../../theme.dart';
import '../../widgets/widgets.dart';

/// Kerangka layar akun (mockup hal. 2): gradasi indigo → magenta,
/// avatar bulat, judul kapital, teks putih.
class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.title,
    required this.children,
    this.footer,
    this.showBack = false,
  });

  final String title;
  final List<Widget> children;

  /// Bagian bawah (mis. "Belum punya akun?"), menempel di dasar layar bila muat.
  final Widget? footer;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.login),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight - 24),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: 56,
                        child: showBack
                            ? Align(
                                alignment: Alignment.centerLeft,
                                child: IconButton(
                                  tooltip: 'Kembali',
                                  color: AppColors.white,
                                  onPressed: () => Navigator.maybePop(context),
                                  icon: const Icon(Icons.arrow_back),
                                ),
                              )
                            : null,
                      ),
                      const _Avatar(),
                      const SizedBox(height: 24),
                      Semantics(
                        header: true,
                        child: Text(
                          title,
                          textAlign: TextAlign.center,
                          style: sans(
                            color: AppColors.white,
                            size: 26,
                            weight: FontWeight.w700,
                            height: 1.15,
                          ),
                        ),
                      ),
                      ...children,
                      if (footer != null) ...[
                        const Spacer(),
                        const SizedBox(height: 32),
                        footer!,
                      ],
                    ],
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

class _Avatar extends StatelessWidget {
  const _Avatar();

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Center(
        child: Container(
          width: 128,
          height: 128,
          decoration: BoxDecoration(
            color: AppColors.loginAvatar.withValues(alpha: 0.9),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.person, size: 92, color: AppColors.indigo),
        ),
      ),
    );
  }
}

/// Kolom berikon (mockup hal. 2): sel ikon + celah tipis + sel isian,
/// latar `loginField`, teks indigo rata tengah.
class AuthField extends StatefulWidget {
  const AuthField({
    super.key,
    required this.icon,
    required this.label,
    required this.controller,
    this.password = false,
    this.keyboardType,
    this.autofillHints,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
  });

  final IconData icon;
  final String label;
  final TextEditingController controller;
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
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      height: 56,
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.all(Radius.circular(18)),
        border: Border.all(
          color: focused ? AppColors.white : const Color(0x00FFFFFF),
          width: 2,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 54,
            decoration: const BoxDecoration(
              color: AppColors.loginField,
              borderRadius: BorderRadius.horizontal(left: radius),
            ),
            child: Icon(widget.icon, color: AppColors.indigo, size: 26),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                color: AppColors.loginField,
                borderRadius: BorderRadius.horizontal(right: radius),
              ),
              child: Row(
                children: [
                  if (widget.password) const SizedBox(width: 48),
                  Expanded(
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
                      textAlign: TextAlign.center,
                      cursorColor: AppColors.indigo,
                      style: sans(
                        color: AppColors.indigo,
                        size: 18,
                        weight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        hintText: widget.label,
                        hintStyle: sans(
                          color: AppColors.indigo.withValues(alpha: 0.6),
                          size: 18,
                          weight: FontWeight.w600,
                        ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppSizes.s2,
                        ),
                      ),
                    ),
                  ),
                  if (widget.password)
                    IconButton(
                      tooltip: _shown
                          ? 'Sembunyikan password'
                          : 'Tampilkan password',
                      onPressed: () => setState(() => _shown = !_shown),
                      icon: Icon(
                        _shown
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        size: 20,
                        color: AppColors.indigo.withValues(alpha: 0.75),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tombol utama ungu (mockup: "Login").
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
    return Center(
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size(176, 50),
          padding: const EdgeInsets.symmetric(horizontal: 32),
          disabledBackgroundColor: AppColors.loginButton.withValues(alpha: 0.7),
          disabledForegroundColor: AppColors.white,
          textStyle: sans(size: 18, weight: FontWeight.w600),
        ),
        child: Text(busy ? 'Tunggu sebentar…' : label),
      ),
    );
  }
}

/// Tautan bergaris bawah putih di atas gradasi.
class AuthLink extends StatelessWidget {
  const AuthLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.white,
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.s2),
        textStyle: sans(
          size: 15,
          weight: FontWeight.w600,
          decoration: TextDecoration.underline,
          decorationColor: AppColors.white,
        ),
      ),
      child: Text(label),
    );
  }
}

/// Pesan sukses di atas gradasi (mis. email reset terkirim).
class AuthNotice extends StatelessWidget {
  const AuthNotice(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.loginField,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          text,
          style: sans(color: AppColors.indigo, size: 14, height: 1.45),
        ),
      ),
    );
  }
}

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
