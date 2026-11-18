import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../auth_rules.dart';
import '../../state.dart';
import '../../theme.dart';
import 'auth_shell.dart';

/// Daftar akun: gaya sama dengan Member Login (mockup hal. 2).
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nama = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  Object? _error;

  @override
  void dispose() {
    for (final c in [_nama, _username, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final body = {
      'namaLengkap': _nama.text.trim(),
      'username': _username.text.trim().toLowerCase(),
      'email': _email.text.trim().toLowerCase(),
      'password': _password.text,
    };
    final invalid = checkRegister(
      username: body['username']!,
      email: body['email']!,
      password: body['password']!,
    );
    if (invalid != null) {
      setState(() => _error = invalid);
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
      final res = await state.api.post('/auth/register', body);
      await state.setSession(Map<String, dynamic>.from(res as Map));
      // Layar dasar sudah berganti ke Beranda; tutup layar Daftar.
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
      title: 'BUAT AKUN',
      showBack: true,
      footer: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            'Sudah punya akun?',
            style: sans(
              color: AppColors.white,
              size: 15,
              weight: FontWeight.w600,
            ),
          ),
          AuthLink(label: 'Masuk', onTap: () => Navigator.pop(context)),
        ],
      ),
      children: [
        const SizedBox(height: 32),
        AutofillGroup(
          child: Column(
            children: [
              AuthField(
                icon: Icons.badge,
                label: 'Nama lengkap',
                controller: _nama,
                keyboardType: TextInputType.name,
                autofillHints: const [AutofillHints.name],
              ),
              const SizedBox(height: AppSizes.s4),
              AuthField(
                icon: Icons.person,
                label: 'Username',
                controller: _username,
                autofillHints: const [AutofillHints.newUsername],
              ),
              const SizedBox(height: AppSizes.s4),
              AuthField(
                icon: Icons.email,
                label: 'Email',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
              ),
              const SizedBox(height: AppSizes.s4),
              AuthField(
                icon: Icons.lock,
                label: 'Password',
                controller: _password,
                password: true,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.s3),
        Text(
          'Username pakai huruf kecil, angka, titik, atau garis bawah. '
          'Password minimal 8 karakter.',
          textAlign: TextAlign.center,
          style: sans(
            color: AppColors.white.withValues(alpha: 0.92),
            size: 14,
            height: 1.45,
          ),
        ),
        AuthError(_error),
        const SizedBox(height: AppSizes.s6),
        AuthButton(label: 'Buat akun', busy: _busy, onPressed: _submit),
      ],
    );
  }
}
