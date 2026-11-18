import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import 'auth_shell.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

/// Buka Member Login di atas layar sekarang (tamu menekan Masuk atau fitur
/// yang wajib login). Setelah berhasil, tumpukan kembali ke Beranda.
Future<void> pushLogin(BuildContext context) =>
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const LoginScreen()));

/// Member Login (mockup hal. 2).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _remember = true;
  bool _busy = false;
  Object? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final id = _username.text.trim();
    if (id.isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Isi username/email dan password dulu.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    final nav = Navigator.of(context);
    try {
      final res = await state.api.post('/auth/login', {
        'username': id,
        'password': _password.text,
        'ingat': _remember,
      });
      await state.setSession(
        Map<String, dynamic>.from(res as Map),
        remember: _remember,
      );
      nav.popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      title: 'Member Login',
      showBack: ModalRoute.of(context)?.canPop ?? false,
      subtitle: 'Masuk untuk melanjutkan rencana perjalananmu di Medan.',
      footer: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(child: Divider(color: Color(0x1A000000))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSizes.s3),
                child: Text(
                  'Belum punya akun?',
                  style: sans(
                    size: 14,
                    color: AppColors.ink.withValues(alpha: 0.55),
                  ),
                ),
              ),
              const Expanded(child: Divider(color: Color(0x1A000000))),
            ],
          ),
          const SizedBox(height: AppSizes.s3),
          AuthSecondary(
            label: 'Buat akun',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const RegisterScreen()),
            ),
          ),
        ],
      ),
      children: [
        const SizedBox(height: 28),
        AutofillGroup(
          child: Column(
            children: [
              AuthField(
                icon: Icons.person,
                label: 'Username atau email',
                placeholder: 'mis. budi_medan',
                controller: _username,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.username],
              ),
              const SizedBox(height: AppSizes.s4),
              AuthField(
                icon: Icons.lock,
                label: 'Password',
                controller: _password,
                password: true,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.s1),
        Row(
          children: [
            Expanded(
              child: MergeSemantics(
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => setState(() => _remember = !_remember),
                  child: SizedBox(
                    height: AppSizes.touch,
                    child: Row(
                      children: [
                        Checkbox(
                          value: _remember,
                          onChanged: (v) => setState(() => _remember = v!),
                          activeColor: AppColors.loginButton,
                          checkColor: AppColors.white,
                          side: BorderSide(
                            color: AppColors.ink.withValues(alpha: 0.4),
                            width: 2,
                          ),
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ),
                        Flexible(
                          child: Text(
                            'Ingat saya',
                            overflow: TextOverflow.ellipsis,
                            style: sans(
                              color: AppColors.ink.withValues(alpha: 0.8),
                              size: 15,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            AuthLink(
              label: 'Lupa password?',
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
              ),
            ),
          ],
        ),
        AuthError(_error),
        const SizedBox(height: AppSizes.s4),
        AuthButton(label: 'Masuk', busy: _busy, onPressed: _submit),
      ],
    );
  }
}
