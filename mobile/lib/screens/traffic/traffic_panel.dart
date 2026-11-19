import 'package:material_ui/material_ui.dart';

import '../../lalulintas.dart';
import '../../theme.dart';
import '../../wib.dart';
import '../../widgets/widgets.dart';

// Isi lembar bawah Live Traffic Information. Sama dengan web
// components/traffic/TrafficPanel.jsx.

Widget _judul(String teks) => Text(teks, style: titleSerif(size: 22));

/// Tab Estimasi Waktu: daftar koridor jalan utama, waktu sekarang vs normal.
class DaftarKoridor extends StatelessWidget {
  const DaftarKoridor({
    super.key,
    required this.data,
    required this.pilih,
    required this.onPilih,
  });

  final LaluLintasData data;
  final String? pilih;
  final ValueChanged<String?> onPilih;

  @override
  Widget build(BuildContext context) {
    final muted = AppColors.ink.withValues(alpha: 0.65);
    if (data.status == 'memuat' && data.koridor.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.s6),
        child: Row(
          children: [
            const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: AppSizes.s2),
            Expanded(
              child: Text(
                'Menghitung waktu tempuh jalan utama…',
                style: sans(size: 14, color: muted),
              ),
            ),
          ],
        ),
      );
    }
    if (data.status == 'galat' && data.koridor.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.s2),
        child: ErrorBanner(error: data.galat, onRetry: data.muatUlang),
      );
    }
    if (data.koridor.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.s6),
        child: Text(
          'Data jalan utama belum tersedia. Coba lagi nanti.',
          style: sans(size: 14, color: muted, height: 1.45),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final k in data.koridor) _baris(k, muted),
        if (data.diperbaruiPada != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSizes.s3),
            child: Text(
              'Diperbarui ${jamWib(data.diperbaruiPada!)} WIB. Waktu dihitung dari laporan warga dan waktu tempuh normal.',
              style: sans(
                size: 12,
                color: AppColors.ink.withValues(alpha: 0.55),
                height: 1.45,
              ),
            ),
          ),
      ],
    );
  }

  Widget _baris(Map k, Color muted) {
    final kode = k['kode'] as String;
    final tingkat = k['tingkat'] as String?;
    final t = infoTingkat(tingkat);
    final tunda = teksTunda(k);
    final aktif = pilih == kode;
    final kejadian = [
      for (final x in (k['kejadian'] as List? ?? const []))
        kejadianLaluLintas[x] ?? '$x',
    ];
    return Semantics(
      selected: aktif,
      button: true,
      child: Material(
        color: aktif
            ? AppColors.lilacWash.withValues(alpha: 0.35)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onPilih(aktif ? null : kode),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 6,
                    decoration: BoxDecoration(
                      color: t.warna,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: AppSizes.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${k['nama']}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: sans(size: 15, weight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: t.label,
                                style: sans(
                                  size: 13,
                                  weight: FontWeight.w600,
                                  color: warnaTeksTingkat(tingkat),
                                ),
                              ),
                              if (tunda.isNotEmpty) TextSpan(text: '  $tunda'),
                              TextSpan(
                                text: '  ${formatKm(k['jarakM'] as num?)}',
                              ),
                            ],
                          ),
                          style: sans(size: 13, color: muted),
                        ),
                        if (kejadian.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              kejadian.join(', '),
                              style: sans(
                                size: 13,
                                weight: FontWeight.w600,
                                color: AppColors.teksMerah,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSizes.s2),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: k['tersedia'] == true
                        ? [
                            Text(
                              formatMenit(k['durasiS'] as num?),
                              style: titleSerif(size: 22),
                            ),
                            if (tunda.isNotEmpty)
                              Text(
                                'biasanya ${formatMenit(k['durasiNormalS'] as num?)}',
                                style: sans(
                                  size: 12,
                                  color: AppColors.ink.withValues(alpha: 0.55),
                                ),
                              ),
                          ]
                        : [
                            Text(
                              'Belum bisa dihitung',
                              style: sans(
                                size: 12,
                                color: AppColors.ink.withValues(alpha: 0.55),
                              ),
                            ),
                          ],
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

/// Ringkasan tab Peta Interaktif (tanpa laporan terpilih).
class RingkasanPeta extends StatelessWidget {
  const RingkasanPeta({super.key, required this.jumlah});
  final int jumlah;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _judul(
          jumlah > 0
              ? '$jumlah laporan warga di area ini'
              : 'Belum ada laporan di area ini',
        ),
        const SizedBox(height: 4),
        Text(
          jumlah > 0
              ? 'Ketuk penanda untuk melihat detail atau mengonfirmasi.'
              : 'Lihat kemacetan, banjir, atau penutupan jalan? Ketuk Laporkan supaya warga lain tahu.',
          style: sans(
            size: 14,
            color: AppColors.ink.withValues(alpha: 0.65),
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

/// Detail satu laporan warga.
class DetailLaporan extends StatelessWidget {
  const DetailLaporan({
    super.key,
    required this.laporan,
    required this.now,
    required this.onTutup,
    required this.onKonfirmasi,
    this.mengirim = false,
  });

  final Map laporan;
  final DateTime now;
  final VoidCallback onTutup;
  final VoidCallback onKonfirmasi;
  final bool mengirim;

  @override
  Widget build(BuildContext context) {
    final t = infoTingkat(laporan['tingkat'] as String?);
    final k = laporan['kejadian'] as String? ?? 'none';
    final dibuat = DateTime.tryParse('${laporan['createdAt']}') ?? now;
    final habis = DateTime.tryParse('${laporan['expiresAt']}');
    final konfirmasi = (laporan['konfirmasi'] as num?)?.toInt() ?? 0;
    final catatan = laporan['catatan'] as String?;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 4, 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.ink.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: t.warna,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              const SizedBox(width: AppSizes.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        text: t.label,
                        children: [
                          if (k != 'none')
                            TextSpan(
                              text: ', ${kejadianLaluLintas[k]!.toLowerCase()}',
                              style: sans(
                                size: 16,
                                weight: FontWeight.w600,
                                color: AppColors.teksMerah,
                              ),
                            ),
                        ],
                      ),
                      style: sans(size: 16, weight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Dilaporkan ${sejak(dibuat, now).toLowerCase()}'
                      '${konfirmasi > 0 ? ', dikonfirmasi $konfirmasi warga' : ''}.'
                      '${habis != null ? ' Hilang otomatis pukul ${jamWib(habis)}.' : ''}',
                      style: sans(
                        size: 13,
                        color: AppColors.ink.withValues(alpha: 0.6),
                        height: 1.4,
                      ),
                    ),
                    if (catatan != null && catatan.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '“$catatan”',
                          style: sans(size: 15, height: 1.35),
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Tutup detail laporan',
                onPressed: onTutup,
                icon: Icon(
                  Icons.close,
                  size: 20,
                  color: AppColors.ink.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.s3),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton(
              onPressed: mengirim ? null : onKonfirmasi,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.actionPill,
                foregroundColor: AppColors.inkVioletTetap,
                minimumSize: const Size.fromHeight(AppSizes.touch),
                textStyle: sans(size: 15, weight: FontWeight.w600),
              ),
              child: mengirim
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Masih begini di sini'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Form Laporkan. `onKirim` melempar galat bila gagal (ditampilkan di form).
class FormLaporan extends StatefulWidget {
  const FormLaporan({
    super.key,
    required this.adaTitik,
    required this.namaTitik,
    required this.onLokasiSaya,
    required this.onBatal,
    required this.onKirim,
  });

  final bool adaTitik;
  final String namaTitik;
  final VoidCallback onLokasiSaya;
  final VoidCallback onBatal;
  final Future<void> Function(String tingkat, String kejadian, String catatan)
  onKirim;

  @override
  State<FormLaporan> createState() => _FormLaporanState();
}

class _FormLaporanState extends State<FormLaporan> {
  String? tingkat;
  String kejadian = 'none';
  final _catatan = TextEditingController();
  bool kirim = false;
  Object? galat;

  @override
  void dispose() {
    _catatan.dispose();
    super.dispose();
  }

  Future<void> _kirim() async {
    final t = tingkat;
    if (t == null || !widget.adaTitik) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      kirim = true;
      galat = null;
    });
    try {
      await widget.onKirim(t, kejadian, _catatan.text);
    } catch (e) {
      if (mounted) {
        setState(() {
          kirim = false;
          galat = e;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = sans(size: 14, weight: FontWeight.w600);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _judul('Laporkan kondisi jalan'),
                  const SizedBox(height: 4),
                  Text(
                    'Ketuk peta untuk memindahkan titik. Laporan hilang sendiri setelah 2 jam.',
                    style: sans(
                      size: 13,
                      color: AppColors.ink.withValues(alpha: 0.65),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Batal melapor',
              onPressed: widget.onBatal,
              icon: Icon(
                Icons.close,
                color: AppColors.ink.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s4),
        Container(
          padding: const EdgeInsets.only(left: 12),
          decoration: BoxDecoration(
            color: AppColors.search,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppColors.pillVia,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.white, width: 2),
                ),
              ),
              const SizedBox(width: AppSizes.s3),
              Expanded(
                child: Text(
                  widget.adaTitik
                      ? (widget.namaTitik.isEmpty
                            ? 'Titik di peta'
                            : widget.namaTitik)
                      : 'Ketuk peta untuk memilih titik',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sans(size: 15),
                ),
              ),
              TextButton.icon(
                onPressed: widget.onLokasiSaya,
                icon: const Icon(Icons.my_location_rounded, size: 18),
                label: const Text('Lokasiku'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.inkViolet,
                  minimumSize: const Size(0, AppSizes.touch),
                  textStyle: sans(size: 14, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.s4),
        Text('Seberapa ramai?', style: label),
        const SizedBox(height: AppSizes.s2),
        Row(
          children: [
            for (final (i, v) in const [
              'lancar',
              'padat',
              'macet',
            ].indexed) ...[
              if (i > 0) const SizedBox(width: AppSizes.s2),
              Expanded(child: _tombolTingkat(v)),
            ],
          ],
        ),
        const SizedBox(height: AppSizes.s4),
        Text('Ada kejadian?', style: label),
        const SizedBox(height: AppSizes.s2),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in kejadianLaluLintas.entries)
              ChoiceChip(
                label: Text(e.value),
                selected: kejadian == e.key,
                onSelected: (_) => setState(() => kejadian = e.key),
                showCheckmark: false,
                materialTapTargetSize: MaterialTapTargetSize.padded,
                labelStyle: sans(
                  size: 14,
                  weight: FontWeight.w600,
                  color: kejadian == e.key
                      ? AppColors.white
                      : AppColors.ink.withValues(alpha: 0.8),
                ),
                selectedColor: AppColors.inkVioletIsi,
                backgroundColor: AppColors.card,
                side: BorderSide(
                  color: kejadian == e.key
                      ? AppColors.inkViolet
                      : AppColors.ink.withValues(alpha: 0.15),
                ),
                shape: const StadiumBorder(),
              ),
          ],
        ),
        const SizedBox(height: AppSizes.s4),
        Text('Catatan (boleh kosong)', style: label),
        const SizedBox(height: AppSizes.s2),
        TextField(
          controller: _catatan,
          maxLength: 200,
          minLines: 1,
          maxLines: 3,
          style: sans(size: 15),
          decoration: InputDecoration(
            hintText: 'Mis. lajur kiri tergenang',
            filled: true,
            fillColor: AppColors.search,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        if (galat != null) ...[
          const SizedBox(height: AppSizes.s2),
          ErrorBanner(error: galat),
        ],
        const SizedBox(height: AppSizes.s3),
        FilledButton.icon(
          onPressed: tingkat == null || !widget.adaTitik || kirim
              ? null
              : _kirim,
          icon: kirim
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.white,
                  ),
                )
              : const Icon(Icons.send_rounded, size: 18),
          label: const Text('Kirim laporan'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.loginButton,
            minimumSize: const Size.fromHeight(AppSizes.touch),
            textStyle: sans(size: 16, weight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  Widget _tombolTingkat(String v) {
    final on = tingkat == v;
    final t = tingkatLaluLintas[v]!;
    return Semantics(
      selected: on,
      button: true,
      child: Material(
        color: on ? t.warna.withValues(alpha: 0.12) : AppColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: on ? t.warna : AppColors.ink.withValues(alpha: 0.08),
            width: 2,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() => tingkat = v),
          child: SizedBox(
            height: 56,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 28,
                  height: 6,
                  decoration: BoxDecoration(
                    color: t.warna,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 4),
                Text(t.label, style: sans(size: 15, weight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
