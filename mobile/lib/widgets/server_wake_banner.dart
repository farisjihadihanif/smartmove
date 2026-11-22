import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../theme.dart';

/// Status "Membangunkan server…" di atas semua layar (T-305). API gratis di Render tidur
/// setelah ±15 menit; selama bangun (±1 menit) [ApiClient] mencoba ulang otomatis.
class ServerWakeBanner extends StatelessWidget {
  const ServerWakeBanner({
    super.key,
    required this.waking,
    required this.child,
  });

  final ValueListenable<bool> waking;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        ValueListenableBuilder<bool>(
          valueListenable: waking,
          builder: (context, bangun, _) => !bangun
              ? const SizedBox.shrink()
              : Positioned(
                  top: 0,
                  left: 16,
                  right: 16,
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Center(
                        child: Material(
                          color: AppColors.card,
                          elevation: 6,
                          borderRadius: BorderRadius.circular(16),
                          child: Semantics(
                            liveRegion: true,
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                10,
                                10,
                                16,
                                10,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox.square(
                                    dimension: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: AppColors.inkViolet,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Flexible(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          tr('Membangunkan server…'),
                                          style: TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.ink,
                                          ),
                                        ),
                                        Text(
                                          tr(
                                            'Server gratis sedang bangun, biasanya kurang dari 1 menit.',
                                          ),
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: AppColors.ink.withValues(
                                              alpha: 0.7,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}
