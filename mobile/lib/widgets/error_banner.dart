import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../i18n.dart';
import '../theme.dart';

// Pemetaan galat → teks pengguna (DESIGN §5). Samakan dengan web/src/lib/errors.js.
Map<String, String> get _byCode => {
  kOffline: tr('Kamu sedang offline'),
  kServerUnreachable: tr(
    'Tidak bisa terhubung ke server SmartMove. Coba lagi sebentar.',
  ),
  'DI_LUAR_WILAYAH': tr('SmartMove baru melayani Medan dan sekitarnya.'),
  'LAYANAN_PETA_GAGAL': tr(
    'Rute belum bisa dihitung. Coba lagi atau buka di OpenStreetMap.',
  ),
  'POIN_KURANG': tr('Poinmu belum cukup untuk voucher ini.'),
  'RUTE_TIDAK_ADA': tr(
    'Tidak ada jalan untuk moda ini di antara kedua titik. Coba moda lain atau geser titiknya.',
  ),
  'FOTO_JALAN_NONAKTIF': tr('Foto jalan belum tersedia saat ini.'),
};

/// True bila perangkat tidak punya internet.
bool isOfflineError(Object? error) =>
    error is ApiException && error.code == kOffline;

/// True bila galat jaringan apa pun (offline atau server tak terjangkau).
bool isNetworkError(Object? error) => error is ApiException && error.isNetwork;

/// Pesan pengguna untuk galat apa pun.
String errorMessageFor(Object? error) {
  if (error == null) return '';
  if (error is String) return error;
  if (error is ApiException) {
    if (error.isNetwork) {
      return _byCode[error.code] ?? _byCode[kServerUnreachable]!;
    }
    return _byCode[error.code] ?? error.message;
  }
  return tr('Terjadi kesalahan. Coba lagi.');
}

/// Banner galat. Isi [error] (mis. ApiException) atau [message].
/// Offline memakai ikon wifi_off, server tak terjangkau ikon cloud_off.
class ErrorBanner extends StatelessWidget {
  const ErrorBanner({
    super.key,
    this.error,
    this.message,
    this.onRetry,
    this.retryLabel,
    this.onDismiss,
  });

  final Object? error;
  final String? message;
  final VoidCallback? onRetry;
  final String? retryLabel;
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
          border: Border.all(
            color: AppColors.trafficMacet.withValues(alpha: 0.2),
          ),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(width: AppSizes.s2),
              Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.trafficMacet.withValues(alpha: 0.12),
                  ),
                  child: Icon(
                    isOfflineError(error)
                        ? Icons.wifi_off
                        : isNetworkError(error)
                        ? Icons.cloud_off
                        : Icons.error_outline,
                    size: 20,
                    color: AppColors.teksMerah,
                  ),
                ),
              ),
              const SizedBox(width: AppSizes.s3),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSizes.s3),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      text,
                      style: TextStyle(
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
                    textStyle: sans(size: 14, weight: FontWeight.w600),
                  ),
                  child: Text(retryLabel ?? tr('Coba lagi')),
                ),
              if (onDismiss != null)
                IconButton(
                  tooltip: tr('Tutup'),
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
