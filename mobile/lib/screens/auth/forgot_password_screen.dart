import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../auth_rules.dart';
import '../../state.dart';
import '../../theme.dart';
import 'auth_shell.dart';

/// Lupa password: kirim tautan reset ke email (API_SPECS §4).
/// Tautan dibuka di website (`/reset-password`).
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  Object? _error;
  ({String to, String message})? _sent;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim().toLowerCase();
    if (!emailRe.hasMatch(email)) {
      setState(() => _error = 'Format email belum benar.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await AppScope.read(context).api
          .request('POST', '/auth/forgot', body: {'email': email}, auth: false);
      final msg = res is Map ? res['message'] : null;
      if (mounted) {
        setState(
          () => _sent = (
            to: email,
            message: msg is String ? msg : 'Tautan reset password sudah dikirim. Cek kotak masuk email kamu.',
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      title: 'Lupa password',
      subtitle: 'Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.',
      showBack: true,
      footer: AuthFooter(
        text: 'Sudah ingat?',
        link: AuthLink(
          label: 'Kembali ke Masuk',
          onTap: () => Navigator.pop(context),
        ),
      ),
      children: [
        const SizedBox(height: 28),
        AuthField(
          icon: Icons.email,
          label: 'Email',
          placeholder: 'nama@email.com',
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        AuthError(_error),
        if (_sent != null) ...[
          const SizedBox(height: AppSizes.s4),
          AuthNotice(
            _sent!.message,
            icon: Icons.mark_email_read_outlined,
            title: 'Cek kotak masuk',
            detail: _sent!.to,
          ),
        ],
        const SizedBox(height: AppSizes.s6),
        AuthButton(
          label: _sent == null ? 'Kirim tautan' : 'Kirim ulang tautan',
          busy: _busy,
          onPressed: _submit,
        ),
      ],
    );
  }
}
