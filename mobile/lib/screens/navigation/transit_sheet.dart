import 'package:material_ui/material_ui.dart';

import '../../navigasi.dart';
import '../../theme.dart';
import '../../transit.dart';
import '../../widgets/widgets.dart';

// Rute transportasi umum (T-203): ringkasan, pilihan opsi, dan garis perjalanan
// per bagian. Warna rel = warna garis di peta. Sama dengan web
// `components/nav/TransitSheet.jsx`.

Color get _muted => AppColors.ink.withValues(alpha: 0.65);

/// Ringkasan + pilihan opsi + garis perjalanan. [data] = respons /routes/transit.
class TransitRingkasan extends StatelessWidget {
  const TransitRingkasan({
    super.key,
    required this.data,
    required this.memuat,
    required this.galat,
    required this.onRetry,
    required this.idx,
    required this.onIdx,
  });

  final Map? data;
  final bool memuat;
  final Object? galat;
  final VoidCallback onRetry;
  final int idx;
  final ValueChanged<int> onIdx;

  @override
  Widget build(BuildContext context) {
    if (galat != null) return ErrorBanner(error: galat, onRetry: onRetry);
    final d = data;
    if (memuat || d == null) {
      return Semantics(
        label: 'Mencari rute transportasi umum',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _blok(128, 36),
            const SizedBox(height: AppSizes.s2),
            _blok(220, 16),
            const SizedBox(height: AppSizes.s4),
            _blok(double.infinity, 96),
          ],
        ),
      );
    }
    final opsi = (d['opsi'] as List? ?? const []).whereType<Map>().toList();
    if (opsi.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Belum ada angkot atau bus di rute ini',
              style: titleSerif(size: 24),
            ),
          ),
          const SizedBox(height: AppSizes.s1),
          Text(
            'Tidak ada trayek yang lewat dalam jarak jalan kaki dari titik asal dan tujuan. Geser titiknya ke jalan besar terdekat, atau pilih Mobil, Motor, atau Jalan kaki.',
            style: sans(size: 15, color: _muted, height: 1.45),
          ),
        ],
      );
    }
    final o = opsi[idx.clamp(0, opsi.length - 1)];
    final transfer = o['transfer'] as num? ?? 0;
    final tarifKosong = o['tarif'] is! num;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          liveRegion: true,
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: AppSizes.s3,
            children: [
              Text(
                formatDurasi(o['totalS'] as num? ?? 0),
                style: titleSerif(size: 36).copyWith(height: 1),
              ),
              Text(
                tarifKosong ? 'Tarif belum tersedia' : teksTarif(o['tarif']),
                style: sans(
                  size: 15,
                  weight: FontWeight.w600,
                  color: AppColors.ink.withValues(
                    alpha: tarifKosong ? 0.55 : 0.75,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${transfer > 0 ? '$transfer× pindah' : 'Tanpa pindah'}, jalan kaki ${formatJarak(o['jalanM'] as num? ?? 0)}'
          '${o['perkiraan'] == true ? '. Jarak jalan kaki masih perkiraan.' : '.'}',
          style: sans(size: 14, color: _muted),
        ),
        if (opsi.length > 1) ...[
          const SizedBox(height: AppSizes.s4),
          _PilihOpsi(opsi: opsi, idx: idx, onIdx: onIdx),
        ],
        const SizedBox(height: AppSizes.s4),
        _GarisPerjalanan(bagian: bagianOpsi(o)),
      ],
    );
  }
}

Widget _blok(double w, double h) => Container(
  width: w,
  height: h,
  decoration: BoxDecoration(
    color: AppColors.ink.withValues(alpha: 0.07),
    borderRadius: BorderRadius.circular(10),
  ),
);

/// Opsi sebagai rantai kecil: jalan · [KPUM 69] · jalan, plus durasinya.
class _PilihOpsi extends StatelessWidget {
  const _PilihOpsi({
    required this.opsi,
    required this.idx,
    required this.onIdx,
  });

  final List<Map> opsi;
  final int idx;
  final ValueChanged<int> onIdx;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          for (final (i, o) in opsi.indexed) ...[
            if (i > 0) const SizedBox(width: AppSizes.s2),
            _KartuOpsi(opsi: o, aktif: i == idx, onTap: () => onIdx(i)),
          ],
        ],
      ),
    );
  }
}

class _KartuOpsi extends StatelessWidget {
  const _KartuOpsi({
    required this.opsi,
    required this.aktif,
    required this.onTap,
  });

  final Map opsi;
  final bool aktif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bagian = bagianOpsi(opsi);
    final urut = indeksNaik(bagian);
    final durasi = formatDurasi(opsi['totalS'] as num? ?? 0);
    final naik = [
      for (final b in bagian)
        if (b['jenis'] == 'naik') judulNaik(b),
    ];
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: aktif,
      button: true,
      label: '$durasi, ${naik.join(', lalu ')}. ${ringkasOpsi(opsi)}',
      excludeSemantics: true,
      child: Material(
        color: aktif ? AppColors.white : AppColors.search,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: aktif
              ? const BorderSide(color: AppColors.pillVia, width: 2)
              : BorderSide(color: AppColors.ink.withValues(alpha: 0.06)),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            constraints: const BoxConstraints(minHeight: AppSizes.touch),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  durasi,
                  style: sans(
                    size: 15,
                    weight: aktif ? FontWeight.w700 : FontWeight.w600,
                    color: AppColors.ink.withValues(alpha: aktif ? 1 : 0.75),
                  ),
                ),
                const SizedBox(width: AppSizes.s2),
                for (final (j, b) in bagian.indexed) ...[
                  if (j > 0) const SizedBox(width: 4),
                  if (b['jenis'] == 'jalan')
                    Icon(
                      Icons.directions_walk_rounded,
                      size: 15,
                      color: AppColors.ink.withValues(alpha: 0.45),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: warnaNaik(urut[j]!),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        namaKoridor(b['koridor'] as Map?).nama,
                        style: sans(
                          size: 12,
                          weight: FontWeight.w700,
                          color: AppColors.white,
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Rel vertikal: jalan kaki titik-titik, kendaraan batang tebal berwarna sama
/// dengan garis di peta.
class _GarisPerjalanan extends StatelessWidget {
  const _GarisPerjalanan({required this.bagian});
  final List<Map> bagian;

  @override
  Widget build(BuildContext context) {
    final urut = indeksNaik(bagian);
    return Semantics(
      label: 'Langkah perjalanan',
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, b) in bagian.indexed)
            b['jenis'] == 'jalan'
                ? _BarisJalan(b: b, terakhir: i == bagian.length - 1)
                : _BarisNaik(b: b, warna: warnaNaik(urut[i]!)),
        ],
      ),
    );
  }
}

const _rel = 36.0;

class _BarisJalan extends StatelessWidget {
  const _BarisJalan({required this.b, required this.terakhir});
  final Map b;
  final bool terakhir;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: _rel,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _Titik(warnaJalan.withValues(alpha: 0.4)),
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.search,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.white, width: 4),
                  ),
                  child: const Icon(
                    Icons.directions_walk_rounded,
                    size: 16,
                    color: AppColors.inkViolet,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    teksJalan(b, terakhir),
                    style: sans(
                      size: 15,
                      weight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatDurasi(b['durasiS'] as num? ?? 0)}${b['perkiraan'] == true ? ', perkiraan' : ''}',
                    style: sans(
                      size: 14,
                      color: AppColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarisNaik extends StatelessWidget {
  const _BarisNaik({required this.b, required this.warna});
  final Map b;
  final Color warna;

  @override
  Widget build(BuildContext context) {
    final k = b['koridor'] as Map?;
    final nk = namaKoridor(k);
    final lain = [
      for (final x in (b['koridorLain'] as List? ?? const []).whereType<Map>())
        namaKoridor(x).nama,
    ];
    final meta = [
      formatJarak(b['jarakM'] as num? ?? 0),
      formatDurasi(b['durasiS'] as num? ?? 0),
      if (b['jumlahHalte'] is num && (b['jumlahHalte'] as num) > 0)
        '${b['jumlahHalte']} halte',
    ].join(', ');
    final tarifKosong = b['tarif'] is! num;
    Widget simpul() => Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        color: AppColors.white,
        shape: BoxShape.circle,
        border: Border.all(color: warna, width: 3.5),
      ),
    );
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: _rel,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Positioned(
                  top: 16,
                  bottom: 16,
                  child: Container(
                    width: 6,
                    decoration: BoxDecoration(
                      color: warna,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                Positioned(top: 12, child: simpul()),
                Positioned(bottom: 12, child: simpul()),
              ],
            ),
          ),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    teksNaik(b),
                    style: sans(
                      size: 15,
                      weight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    decoration: BoxDecoration(
                      color: warna.withValues(alpha: 0.07),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: AppSizes.s2,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: warna,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    ikonJenis(k?['jenis']),
                                    size: 13,
                                    color: AppColors.white,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    labelJenis[k?['jenis']] ?? 'Kendaraan',
                                    style: sans(
                                      size: 12,
                                      weight: FontWeight.w700,
                                      color: AppColors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              nk.nama,
                              style: sans(
                                size: 17,
                                weight: FontWeight.w700,
                                height: 1.2,
                              ),
                            ),
                          ],
                        ),
                        if (nk.trayek.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            nk.trayek,
                            style: sans(
                              size: 14,
                              color: AppColors.ink.withValues(alpha: 0.7),
                              height: 1.35,
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        Text.rich(
                          TextSpan(
                            text: '$meta, ',
                            children: [
                              TextSpan(
                                text: teksTarif(b['tarif']),
                                style: tarifKosong
                                    ? const TextStyle(
                                        fontStyle: FontStyle.italic,
                                      )
                                    : TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.ink.withValues(
                                          alpha: 0.8,
                                        ),
                                      ),
                              ),
                            ],
                          ),
                          style: sans(size: 14, color: _muted, height: 1.35),
                        ),
                        if (lain.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text.rich(
                            TextSpan(
                              text: 'Juga lewat sini: ',
                              children: [
                                TextSpan(
                                  text: lain.join(', '),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.ink.withValues(alpha: 0.8),
                                  ),
                                ),
                              ],
                            ),
                            style: sans(size: 14, color: _muted, height: 1.35),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      teksTurun(b),
                      style: sans(
                        size: 15,
                        weight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Garis titik-titik vertikal di tengah rel (jalan kaki).
class _Titik extends CustomPainter {
  _Titik(this.warna);
  final Color warna;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = warna;
    final x = size.width / 2;
    for (var y = 2.0; y < size.height; y += 7) {
      canvas.drawCircle(Offset(x, y), 1.6, p);
    }
  }

  @override
  bool shouldRepaint(_Titik old) => old.warna != warna;
}

/// Panduan per bagian (Play): satu bagian besar, maju/mundur.
class TransitPanduan extends StatelessWidget {
  const TransitPanduan({
    super.key,
    required this.opsi,
    required this.idx,
    required this.onPlay,
  });

  final Map opsi;
  final int idx;
  final ValueChanged<int?> onPlay;

  @override
  Widget build(BuildContext context) {
    final bagian = bagianOpsi(opsi);
    final total = bagian.length;
    final b = bagian[idx];
    final urut = indeksNaik(bagian);
    final jalan = b['jenis'] == 'jalan';
    final terakhir = idx == total - 1;
    final warna = jalan ? warnaJalan : warnaNaik(urut[idx]!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                liveRegion: true,
                child: Text(
                  'Bagian ${idx + 1} dari $total',
                  style: sans(size: 14, weight: FontWeight.w600, color: _muted),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: () => onPlay(null),
              icon: const Icon(Icons.close_rounded, size: 18),
              label: const Text('Selesai'),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: warna,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                jalan
                    ? Icons.directions_walk_rounded
                    : ikonJenis((b['koridor'] as Map?)?['jenis']),
                size: 28,
                color: AppColors.white,
              ),
            ),
            const SizedBox(width: AppSizes.s4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: jalan
                    ? [
                        Text(
                          teksJalan(b, terakhir),
                          style: titleSerif(size: 24),
                        ),
                        const SizedBox(height: AppSizes.s1),
                        Text(
                          'Sekitar ${formatDurasi(b['durasiS'] as num? ?? 0)}',
                          style: sans(size: 15, color: _muted),
                        ),
                      ]
                    : [
                        Text(judulNaik(b), style: titleSerif(size: 24)),
                        const SizedBox(height: AppSizes.s1),
                        Text(
                          teksNaik(b),
                          style: sans(size: 15, color: _muted, height: 1.35),
                        ),
                        Text(
                          teksTurun(b),
                          style: sans(size: 15, color: _muted, height: 1.35),
                        ),
                        const SizedBox(height: AppSizes.s1),
                        Text(
                          '${formatDurasi(b['durasiS'] as num? ?? 0)}, ${teksTarif(b['tarif'])}',
                          style: sans(
                            size: 14,
                            color: AppColors.ink.withValues(alpha: 0.6),
                          ),
                        ),
                      ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s4),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: SizedBox(
            height: 6,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: AppColors.ink.withValues(alpha: 0.08)),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (idx + 1) / total,
                  child: const DecoratedBox(
                    decoration: BoxDecoration(gradient: AppGradients.pill),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSizes.s4),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: idx == 0 ? null : () => onPlay(idx - 1),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSizes.touch),
                  foregroundColor: AppColors.inkViolet,
                  backgroundColor: AppColors.search,
                  side: BorderSide(
                    color: AppColors.ink.withValues(alpha: 0.06),
                  ),
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                icon: const Icon(Icons.chevron_left_rounded),
                label: const Text('Sebelumnya'),
              ),
            ),
            const SizedBox(width: AppSizes.s3),
            Expanded(
              child: FilledButton(
                onPressed: () => onPlay(terakhir ? null : idx + 1),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSizes.touch),
                  backgroundColor: AppColors.loginButton,
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(terakhir ? 'Selesai' : 'Berikutnya'),
                    if (!terakhir) const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
