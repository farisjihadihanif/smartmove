import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import 'auth_shell.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

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
      title: 'MEMBER LOGIN',
      footer: Column(
        children: [
          Text(
            'Belum punya akun?',
            style: sans(
              color: AppColors.white,
              size: 15,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSizes.s2),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 288),
            child: OutlinedButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const RegisterScreen()),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.white,
                minimumSize: const Size.fromHeight(56),
                side: const BorderSide(color: AppColors.loginButton, width: 2),
                textStyle: sans(size: 20, weight: FontWeight.w600),
              ),
              child: const Text('Buat akun'),
            ),
          ),
        ],
      ),
      children: [
        const SizedBox(height: 40),
        AutofillGroup(
          child: Column(
            children: [
              AuthField(
                icon: Icons.person,
                label: 'Username atau email',
                controller: _username,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.username],
              ),
              const SizedBox(height: 20),
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
                          side: const BorderSide(
                            color: AppColors.white,
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
                              color: AppColors.white,
                              size: 15,
                              weight: FontWeight.w600,
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
        const SizedBox(height: AppSizes.s6),
        AuthButton(label: 'Masuk', busy: _busy, onPressed: _submit),
      ],
    );
  }
}
