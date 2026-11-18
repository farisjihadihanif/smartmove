import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../theme.dart';

// Pemetaan galat → teks pengguna (DESIGN §5). Samakan dengan web/src/lib/errors.js.
const _byCode = {
  'JARINGAN': 'Kamu sedang offline. Periksa koneksi, lalu coba lagi.',
  'DI_LUAR_WILAYAH': 'SmartMove baru melayani Medan dan sekitarnya.',
  'LAYANAN_PETA_GAGAL':
      'Rute belum bisa dihitung. Coba lagi atau buka di OpenStreetMap.',
  'POIN_KURANG': 'Poinmu belum cukup untuk voucher ini.',
};

/// True bila galat berasal dari jaringan.
bool isOfflineError(Object? error) =>
    error is ApiException && (error.isNetwork || error.code == 'JARINGAN');

/// Pesan pengguna untuk galat apa pun.
String errorMessageFor(Object? error) {
  if (error == null) return '';
  if (error is String) return error;
  if (error is ApiException) {
    if (isOfflineError(error)) return _byCode['JARINGAN']!;
    return _byCode[error.code] ?? error.message;
  }
  return 'Terjadi kesalahan. Coba lagi.';
}

/// Banner galat. Isi [error] (mis. ApiException) atau [message].
/// Galat jaringan otomatis memakai ikon offline.
class ErrorBanner extends StatelessWidget {
  const ErrorBanner({
    super.key,
    this.error,
    this.message,
    this.onRetry,
    this.retryLabel = 'Coba lagi',
    this.onDismiss,
  });

  final Object? error;
  final String? message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final text = message ?? errorMessageFor(error);
    if (text.isEmpty) return const SizedBox.shrink();

    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: AppColors.loginField,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1F000000),
              blurRadius: 3,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const ColoredBox(
                color: AppColors.trafficMacet,
                child: SizedBox(width: 4),
              ),
              const SizedBox(width: AppSizes.s3),
              Icon(
                isOfflineError(error) ? Icons.wifi_off : Icons.error_outline,
                size: 22,
                color: AppColors.trafficMacet,
              ),
              const SizedBox(width: AppSizes.s3),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSizes.s3),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      text,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.35,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                ),
              ),
              if (onRetry != null)
                TextButton(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.inkViolet,
                    textStyle: Theme.of(context).textTheme.labelLarge
                        ?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  child: Text(retryLabel),
                ),
              if (onDismiss != null)
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: onDismiss,
                  icon: Icon(
                    Icons.close,
                    size: 18,
                    color: AppColors.ink.withValues(alpha: 0.6),
                  ),
                ),
              const SizedBox(width: AppSizes.s1),
            ],
          ),
        ),
      ),
    );
  }
}
