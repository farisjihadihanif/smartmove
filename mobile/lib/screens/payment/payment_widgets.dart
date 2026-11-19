import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../pembayaran.dart';
import '../../theme.dart';

// Potongan tampilan Digital Payment & e-tiket (T-302). Sama dengan web components/pembayaran/*.

/// Pita "Simulasi" (AGENTS aturan 7): wajib ada di setiap layar pembayaran & e-tiket.
class PitaSimulasi extends StatelessWidget {
  const PitaSimulasi({super.key, this.gelap = false});
  final bool gelap;

  @override
  Widget build(BuildContext context) {
    final warna = gelap ? AppColors.white : AppColors.teksKuning;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSizes.s4,
        vertical: gelap ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: gelap
            ? AppColors.white.withValues(alpha: 0.12)
            : AppColors.trafficPadat.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: gelap
              ? AppColors.white.withValues(alpha: 0.25)
              : AppColors.trafficPadat.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.science_outlined, size: 15, color: warna),
          const SizedBox(width: AppSizes.s2),
          Flexible(
            child: Text(
              gelap
                  ? labelSimulasi
                  : '$labelSimulasi. Tidak ada uang sungguhan.',
              textAlign: TextAlign.center,
              style: sans(
                size: gelap ? 12 : 13,
                weight: FontWeight.w600,
                color: warna,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pita 14 hari ke depan (WIB).
class PitaTanggal extends StatelessWidget {
  const PitaTanggal({
    super.key,
    required this.hariIni,
    required this.value,
    required this.onChanged,
  });
  final String hariIni;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final awal = DateTime.parse('${hariIni}T12:00:00+07:00');
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 14,
        separatorBuilder: (_, _) => const SizedBox(width: AppSizes.s2),
        itemBuilder: (context, i) {
          final t = tanggalWib(awal, i);
          final (hari, tgl, bulan) = pecahTanggal(t);
          final on = t == value;
          final kecil = sans(
            size: 12,
            weight: FontWeight.w600,
            color: on
                ? AppColors.white.withValues(alpha: 0.85)
                : AppColors.ink.withValues(alpha: 0.55),
          );
          return Semantics(
            selected: on,
            inMutuallyExclusiveGroup: true,
            button: true,
            label: '${t == hariIni ? 'Hari ini, ' : ''}$hari $tgl $bulan',
            excludeSemantics: true,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onChanged(t),
                borderRadius: BorderRadius.circular(16),
                child: Ink(
                  width: 60,
                  decoration: BoxDecoration(
                    gradient: on ? AppGradients.pill : null,
                    color: on ? null : AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: on
                        ? null
                        : Border.all(
                            color: AppColors.ink.withValues(alpha: 0.1),
                          ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(t == hariIni ? 'Ini' : hari, style: kecil),
                      Text(
                        '$tgl',
                        style: titleSerif(
                          size: 22,
                          color: on ? AppColors.white : AppColors.ink,
                        ),
                      ),
                      Text(
                        bulan,
                        style: kecil.copyWith(fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Medali ikon bulat biru (gaya ikon mockup hal. 5).
class MedaliIkon extends StatelessWidget {
  const MedaliIkon(
    this.ikon, {
    super.key,
    this.warna = AppColors.iconBlue,
    this.gradasi,
  });
  final IconData ikon;
  final Color warna;
  final Gradient? gradasi;

  @override
  Widget build(BuildContext context) => Container(
    width: 44,
    height: 44,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: gradasi == null ? warna : null,
      gradient: gradasi,
    ),
    child: Icon(ikon, size: 22, color: AppColors.white),
  );
}

/// Satu layanan; terpilih → jam keberangkatan.
class BarisLayanan extends StatelessWidget {
  const BarisLayanan({
    super.key,
    required this.layanan,
    required this.slot,
    required this.terpilih,
    required this.jam,
    required this.onPilih,
    required this.onJam,
  });
  final Map layanan;
  final List<({String jam, DateTime waktu, bool tersedia})> slot;
  final bool terpilih;
  final String? jam;
  final VoidCallback onPilih;
  final ValueChanged<({String jam, DateTime waktu, bool tersedia})> onJam;

  @override
  Widget build(BuildContext context) {
    final l = layanan;
    final parkir = adalahParkir(l);
    final tampil = parkir ? slot.where((s) => s.tersedia).toList() : slot;
    final redup = AppColors.ink.withValues(alpha: 0.6);
    final operator = l['operator'] == null ? '' : '${l['operator']}, ';
    return Container(
      decoration: BoxDecoration(
        color: terpilih ? AppColors.lilacWash.withValues(alpha: 0.25) : null,
        borderRadius: BorderRadius.circular(16),
        border: terpilih
            ? null
            : Border(
                bottom: BorderSide(
                  color: AppColors.ink.withValues(alpha: 0.07),
                ),
              ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: onPilih,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                vertical: AppSizes.s3,
                horizontal: AppSizes.s1,
              ),
              child: Row(
                children: [
                  MedaliIkon(ikonJenis('${l['jenis']}')),
                  const SizedBox(width: AppSizes.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${l['nama']}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: sans(size: 15, weight: FontWeight.w600),
                        ),
                        Text(
                          '$operator${ruteLayanan(l)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: sans(size: 13, color: redup),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSizes.s2),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        rupiah(l['harga'] as num),
                        style: titleSerif(size: 17, color: AppColors.inkViolet),
                      ),
                      Text(
                        'per ${satuan(l)}',
                        style: sans(size: 12, color: redup),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (terpilih)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                56,
                0,
                AppSizes.s2,
                AppSizes.s4,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${parkir ? 'Mulai parkir' : 'Jam keberangkatan'} (WIB)',
                    style: sans(size: 14, weight: FontWeight.w600),
                  ),
                  const SizedBox(height: AppSizes.s2),
                  if (!slot.any((s) => s.tersedia))
                    Text(
                      'Semua jadwal di tanggal ini sudah lewat. Pilih tanggal lain.',
                      style: sans(size: 14, color: redup),
                    )
                  else
                    Wrap(
                      spacing: AppSizes.s2,
                      runSpacing: AppSizes.s2,
                      children: [
                        for (final s in tampil)
                          _ChipJam(
                            slot: s,
                            aktif: jam == s.jam,
                            onTap: () => onJam(s),
                          ),
                      ],
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ChipJam extends StatelessWidget {
  const _ChipJam({
    required this.slot,
    required this.aktif,
    required this.onTap,
  });
  final ({String jam, DateTime waktu, bool tersedia}) slot;
  final bool aktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final teks = slot.jam.replaceAll(':', '.');
    return Semantics(
      selected: aktif,
      enabled: slot.tersedia,
      button: true,
      label: slot.tersedia ? teks : '$teks, sudah lewat',
      excludeSemantics: true,
      child: Material(
        color: aktif ? AppColors.inkVioletIsi : AppColors.card,
        shape: StadiumBorder(
          side: aktif
              ? BorderSide.none
              : BorderSide(color: AppColors.ink.withValues(alpha: 0.15)),
        ),
        child: InkWell(
          onTap: slot.tersedia ? onTap : null,
          customBorder: const StadiumBorder(),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSizes.touch,
              minWidth: 72,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.s3),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (aktif) ...[
                    const Icon(
                      Icons.check_rounded,
                      size: 15,
                      color: AppColors.white,
                    ),
                    const SizedBox(width: 2),
                  ],
                  Text(
                    teks,
                    style:
                        titleSerif(
                          size: 16,
                          color: aktif
                              ? AppColors.white
                              : slot.tersedia
                              ? AppColors.ink
                              : AppColors.ink.withValues(alpha: 0.3),
                        ).copyWith(
                          decoration: slot.tersedia
                              ? null
                              : TextDecoration.lineThrough,
                        ),
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

/// Baris metode pembayaran (ikon bulat + nama + keterangan, radio di kanan).
class BarisMetode extends StatelessWidget {
  const BarisMetode({
    super.key,
    required this.label,
    required this.keterangan,
    required this.ikon,
    required this.onTap,
    this.aktif = false,
    this.panah = false,
    this.warna = AppColors.iconBlue,
  });
  final String label;
  final String keterangan;
  final IconData ikon;
  final VoidCallback onTap;
  final bool aktif;
  final bool panah;
  final Color warna;

  @override
  Widget build(BuildContext context) => Semantics(
    selected: panah ? null : aktif,
    inMutuallyExclusiveGroup: !panah,
    button: true,
    child: InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 60),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: AppColors.ink.withValues(alpha: 0.07)),
          ),
        ),
        padding: const EdgeInsets.symmetric(vertical: AppSizes.s2),
        child: Row(
          children: [
            MedaliIkon(
              ikon,
              warna: warna,
              gradasi: aktif ? AppGradients.pill : null,
            ),
            const SizedBox(width: AppSizes.s4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: sans(size: 15, weight: FontWeight.w600)),
                  Text(
                    keterangan,
                    style: sans(
                      size: 13,
                      color: AppColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            if (panah)
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.ink.withValues(alpha: 0.4),
              )
            else
              Icon(
                aktif
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: aktif
                    ? AppColors.inkViolet
                    : AppColors.ink.withValues(alpha: 0.3),
              ),
          ],
        ),
      ),
    ),
  );
}

/// Garis putus-putus tipis (pemisah total, perforasi tiket).
class GarisPutus extends StatelessWidget {
  const GarisPutus({super.key, this.warna});
  final Color? warna;

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: const Size.fromHeight(2),
    painter: _GarisPutusPainter(
      warna ?? AppColors.inkViolet.withValues(alpha: 0.25),
    ),
  );
}

class _GarisPutusPainter extends CustomPainter {
  _GarisPutusPainter(this.warna);
  final Color warna;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = warna
      ..strokeWidth = 2;
    for (double x = 0; x < size.width; x += 10) {
      canvas.drawLine(Offset(x, 1), Offset((x + 5).clamp(0, size.width), 1), p);
    }
  }

  @override
  bool shouldRepaint(_GarisPutusPainter old) => old.warna != warna;
}

/// Chip status berlabel (warna tidak berdiri sendiri).
class ChipStatus extends StatelessWidget {
  const ChipStatus(this.status, {super.key});
  final String? status;

  @override
  Widget build(BuildContext context) {
    final (label, warna) = statusPembayaran(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: warna.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: warna.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: sans(size: 12, weight: FontWeight.w600, color: warna),
      ),
    );
  }
}

/// E-tiket simulasi (DESIGN §3): kepala ungu, perforasi bertakik, detail, cap SIMULASI, QR + kode.
class ETiket extends StatelessWidget {
  const ETiket({super.key, required this.payment});
  final Map payment;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final l = (p['layanan'] as Map?) ?? const {};
    final parkir = adalahParkir(l);
    final kode = '${(p['eTiket'] as Map?)?['kode'] ?? ''}';
    final jadwal = DateTime.tryParse('${p['jadwal']}');
    final redup = sans(size: 13, color: AppColors.ink.withValues(alpha: 0.55));
    final isi = sans(size: 14, weight: FontWeight.w600);
    final operator = l['operator'] == null ? '' : ', ${l['operator']}';

    Widget detail(String k, String v) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(k, style: redup),
        Text(v, style: isi),
      ],
    );

    return Semantics(
      label: 'E-tiket simulasi ${l['nama']}',
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppColors.inkViolet.withValues(alpha: 0.1)),
          boxShadow: [
            BoxShadow(
              color: AppColors.inkViolet.withValues(alpha: 0.35),
              blurRadius: 40,
              offset: const Offset(0, 20),
              spreadRadius: -20,
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              decoration: const BoxDecoration(gradient: AppGradients.pillDeep),
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        ikonJenis('${l['jenis']}'),
                        size: 16,
                        color: AppColors.white,
                      ),
                      const SizedBox(width: AppSizes.s2),
                      Text(
                        '${labelJenis('${l['jenis']}')}$operator',
                        style: sans(
                          size: 13,
                          weight: FontWeight.w600,
                          color: AppColors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${l['nama']}',
                    style: titleSerif(size: 24, color: AppColors.white),
                  ),
                  if (!parkir && l['tujuan'] != null) ...[
                    const SizedBox(height: AppSizes.s3),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${l['asal']}',
                            overflow: TextOverflow.ellipsis,
                            style: sans(size: 15, color: AppColors.white),
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSizes.s2,
                          ),
                          child: Icon(
                            Icons.arrow_forward_rounded,
                            size: 18,
                            color: AppColors.white,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            '${l['tujuan']}',
                            textAlign: TextAlign.right,
                            overflow: TextOverflow.ellipsis,
                            style: sans(
                              size: 15,
                              weight: FontWeight.w600,
                              color: AppColors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (parkir && l['asal'] != null) ...[
                    const SizedBox(height: AppSizes.s2),
                    Text(
                      '${l['asal']}',
                      style: sans(size: 15, color: AppColors.white),
                    ),
                  ],
                ],
              ),
            ),
            // Perforasi: takik setengah lingkaran di kedua sisi + garis putus-putus.
            SizedBox(
              height: 24,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Positioned(
                    left: 20,
                    right: 20,
                    top: 11,
                    child: GarisPutus(),
                  ),
                  Positioned(left: -12, top: 0, child: _Takik()),
                  Positioned(right: -12, top: 0, child: _Takik()),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  detail(
                    parkir ? 'Mulai parkir' : 'Berangkat',
                    jadwal == null ? '—' : waktuLengkap(jadwal),
                  ),
                  const SizedBox(height: AppSizes.s3),
                  Row(
                    children: [
                      Expanded(
                        child: detail(
                          parkir ? 'Lama' : 'Penumpang',
                          '${p['penumpang']} ${satuan(l)}',
                        ),
                      ),
                      Expanded(
                        child: detail(
                          'Total',
                          rupiah(p['jumlah'] as num? ?? 0),
                        ),
                      ),
                    ],
                  ),
                  if (p['metode'] != null) ...[
                    const SizedBox(height: AppSizes.s3),
                    detail('Metode', namaMetode('${p['metode']}')!),
                  ],
                  const SizedBox(height: AppSizes.s3),
                  detail('No. pesanan', '${p['orderId']}'),
                  const SizedBox(height: AppSizes.s6),
                  // Cap karet: besar & miring supaya tidak bisa dikira tiket resmi.
                  Center(
                    child: Transform.rotate(
                      angle: -0.1,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.pillVia,
                            width: 3,
                          ),
                        ),
                        child: Column(
                          children: [
                            Text(
                              'SIMULASI',
                              style: titleSerif(
                                size: 30,
                                color: AppColors.pillVia,
                              ).copyWith(letterSpacing: 3.6, height: 1),
                            ),
                            Text(
                              'bukan tiket resmi',
                              style: sans(
                                size: 13,
                                weight: FontWeight.w700,
                                color: AppColors.pillVia,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSizes.s4),
                  Center(
                    child: Semantics(
                      label: 'Kode QR e-tiket simulasi $kode',
                      excludeSemantics: true,
                      child: QrImageView(
                        data: '$kode|${p['orderId']}|SIMULASI',
                        size: 168,
                        backgroundColor: AppColors.white,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Color(0xFF1D1640),
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Color(0xFF1D1640),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSizes.s2),
                  Text(
                    kode,
                    textAlign: TextAlign.center,
                    style: titleSerif(
                      size: 22,
                      color: AppColors.inkViolet,
                    ).copyWith(letterSpacing: 1.8),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Takik extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    width: 24,
    height: 24,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: Theme.of(context).scaffoldBackgroundColor,
      border: Border.all(color: AppColors.inkViolet.withValues(alpha: 0.1)),
    ),
  );
}
