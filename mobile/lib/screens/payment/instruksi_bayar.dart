import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../pembayaran.dart';
import '../../theme.dart';
import 'payment_widgets.dart';

/// Instruksi bayar Midtrans Core API (T-113): QR (QRIS), nomor virtual account / kode Mandiri Bill,
/// atau tombol buka e-wallet, dengan hitung mundur batas bayar. Sama dengan web InstruksiBayar.jsx.
class InstruksiBayar extends StatelessWidget {
  const InstruksiBayar({
    super.key,
    required this.payment,
    required this.sekarang,
    required this.memeriksa,
    required this.onCek,
    required this.bukaTautan,
  });

  final Map payment;
  final DateTime sekarang;
  final bool memeriksa;
  final VoidCallback onCek;
  final void Function(Uri) bukaTautan;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final ins = (p['instruksi'] as Map?) ?? const {};
    final batas = DateTime.tryParse('${p['batasBayar']}');
    final sisa = batas?.difference(sekarang);
    final habis = sisa != null && sisa <= Duration.zero;
    final mendesak =
        sisa != null && !habis && sisa < const Duration(minutes: 3);
    final redup = sans(size: 13, color: AppColors.ink.withValues(alpha: 0.6));
    final metode = '${ins['metode'] ?? p['metode'] ?? ''}';
    final grup = '${ins['grup'] ?? ''}';
    final mandiri = metode == 'mandiri';
    final namaEwallet = metode == 'shopeepay' ? 'ShopeePay' : 'GoPay';
    final langkah = switch (grup) {
      'qris' => const [
        'Buka aplikasi bank atau e-wallet yang punya menu QRIS.',
        'Pindai kode QR di atas.',
        'Periksa nama penerima dan jumlah, lalu bayar.',
      ],
      'va' when mandiri => const [
        'Buka Livin’ by Mandiri atau ATM Mandiri.',
        'Pilih Bayar → Multipayment, masukkan kode perusahaan.',
        'Masukkan kode bayar, periksa jumlah, lalu bayar.',
      ],
      'va' => const [
        'Buka m-banking, internet banking, atau ATM bank yang sama.',
        'Pilih Transfer ke Virtual Account.',
        'Masukkan nomor di atas, periksa jumlah, lalu bayar.',
      ],
      _ => const [
        'Ketuk tombol untuk membuka aplikasinya.',
        'Periksa jumlah, lalu konfirmasi pembayaran.',
        'Kembali ke sini; status diperbarui otomatis.',
      ],
    };

    Widget nomor(String label, String nilai, String salin) => Padding(
      padding: const EdgeInsets.only(top: AppSizes.s3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: redup),
                Text(
                  nilai,
                  style: titleSerif(size: 24).copyWith(letterSpacing: 1.4),
                ),
              ],
            ),
          ),
          TombolSalin(teks: nilai, label: salin),
        ],
      ),
    );

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.inkViolet.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Menunggu pembayaran',
                  style: sans(
                    size: 15,
                    weight: FontWeight.w600,
                    color: AppColors.teksKuning,
                  ),
                ),
              ),
              Text(namaMetode(metode) ?? '', style: redup),
            ],
          ),
          if (batas != null) ...[
            const SizedBox(height: AppSizes.s2),
            Text(
              habis ? 'Batas bayar sudah lewat' : 'Bayar sebelum waktu habis',
              style: redup,
            ),
            Semantics(
              label: habis
                  ? 'Waktu bayar habis'
                  : 'Sisa waktu ${sisaWaktu(sisa!)}',
              excludeSemantics: true,
              child: Text(
                sisaWaktu(sisa),
                style:
                    titleSerif(
                      size: 48,
                      color: habis
                          ? AppColors.ink.withValues(alpha: 0.4)
                          : mendesak
                          ? AppColors.trafficMacet
                          : AppColors.inkViolet,
                    ).copyWith(
                      height: 1.05,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
              ),
            ),
            Text('Batas: ${waktuLengkap(batas)}', style: redup),
          ],
          const SizedBox(height: AppSizes.s4),
          const GarisPutus(),
          const SizedBox(height: AppSizes.s3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total bayar', style: redup),
                    Text(
                      rupiah(p['jumlah'] as num? ?? 0),
                      style: titleSerif(size: 26),
                    ),
                  ],
                ),
              ),
              TombolSalin(teks: '${p['jumlah']}', label: 'jumlah'),
            ],
          ),
          if (!habis && grup == 'qris') ...[
            const SizedBox(height: AppSizes.s4),
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Semantics(
                  label: 'Kode QRIS untuk dibayar',
                  excludeSemantics: true,
                  child: ins['qrString'] != null
                      ? QrImageView(
                          data: '${ins['qrString']}',
                          size: 220,
                          backgroundColor: AppColors.white,
                          eyeStyle: const QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: Color(0xFF1D1640),
                          ),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: Color(0xFF1D1640),
                          ),
                        )
                      : Image.network(
                          '${ins['qrUrl']}',
                          width: 220,
                          height: 220,
                        ),
                ),
              ),
            ),
            const SizedBox(height: AppSizes.s2),
            Center(
              child: Text(
                'QRIS, bisa dipindai semua aplikasi pembayaran',
                style: redup,
              ),
            ),
          ],
          if (!habis && grup == 'va') ...[
            if (mandiri) ...[
              nomor(
                'Kode perusahaan',
                '${ins['kodePerusahaan']}',
                'kode perusahaan',
              ),
              nomor('Kode bayar', '${ins['kodeBayar']}', 'kode bayar'),
            ] else
              nomor(
                'Nomor virtual account ${'${ins['bank'] ?? ''}'.toUpperCase()}',
                '${ins['nomorVa']}',
                'nomor virtual account',
              ),
          ],
          if (!habis && grup == 'ewallet' && ins['deeplink'] != null) ...[
            const SizedBox(height: AppSizes.s4),
            Center(
              child: FilledButton.icon(
                onPressed: () => bukaTautan(Uri.parse('${ins['deeplink']}')),
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: Text('Buka $namaEwallet'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.pillVia,
                  minimumSize: const Size(200, AppSizes.touch),
                ),
              ),
            ),
          ],
          if (!habis) ...[
            const SizedBox(height: AppSizes.s4),
            for (final (i, l) in langkah.indexed)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSizes.s2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.lilacWash.withValues(alpha: 0.4),
                      ),
                      child: Text(
                        '${i + 1}',
                        style: sans(
                          size: 12,
                          weight: FontWeight.w700,
                          color: AppColors.inkViolet,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSizes.s3),
                    Expanded(
                      child: Text(
                        l,
                        style: sans(
                          size: 14,
                          height: 1.35,
                          color: AppColors.ink.withValues(alpha: 0.8),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          const Divider(height: AppSizes.s6),
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.trafficLancar,
                ),
              ),
              const SizedBox(width: AppSizes.s2),
              Expanded(child: Text('Status diperbarui otomatis', style: redup)),
              OutlinedButton.icon(
                onPressed: memeriksa ? null : onCek,
                icon: memeriksa
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Cek sekarang'),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.s2),
          InkWell(
            onTap: () => bukaTautan(Uri.parse(simulatorMidtrans)),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSizes.s2),
              child: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Ini simulasi; tidak ada uang sungguhan. Untuk uji coba, bayar lewat ',
                    ),
                    TextSpan(
                      text: 'simulator Midtrans sandbox',
                      style: sans(
                        size: 12,
                        weight: FontWeight.w600,
                        color: AppColors.inkViolet,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                    const TextSpan(text: '.'),
                  ],
                ),
                style: sans(
                  size: 12,
                  color: AppColors.ink.withValues(alpha: 0.55),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tombol Salin (nomor VA, kode bayar, jumlah).
class TombolSalin extends StatefulWidget {
  const TombolSalin({super.key, required this.teks, required this.label});
  final String teks;
  final String label;

  @override
  State<TombolSalin> createState() => _TombolSalinState();
}

class _TombolSalinState extends State<TombolSalin> {
  bool ok = false;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: () async {
      await Clipboard.setData(ClipboardData(text: widget.teks));
      if (!mounted) return;
      setState(() => ok = true);
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => ok = false);
      });
    },
    icon: Icon(ok ? Icons.check_rounded : Icons.copy_rounded, size: 16),
    label: Semantics(
      liveRegion: true,
      label: ok ? '${widget.label} disalin' : 'Salin ${widget.label}',
      excludeSemantics: true,
      child: Text(ok ? 'Disalin' : 'Salin'),
    ),
  );
}
