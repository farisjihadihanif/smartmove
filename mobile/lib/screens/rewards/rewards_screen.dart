import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../i18n.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../../kota.dart';

// Rewards (DESIGN §3, PRD §6.4, T-304): saldo poin, tukar voucher, voucher saya, riwayat.
// Sama dengan web pages/Rewards.jsx. Voucher digambar sebagai kupon sobek (bahasa visual e-tiket).

String _poin(num n) => angka(n.abs().round());

String _tanggal(Object? iso) {
  final d = DateTime.tryParse('$iso');
  if (d == null) return '';
  final w = d.toUtc().add(kota.offsetZona);
  return tanggalBulanTahun(w.day, w.month, w.year);
}

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => RewardsScreenState();
}

class RewardsScreenState extends State<RewardsScreen> {
  String tab = 'tukar';
  int? saldo;
  List<Map>? vouchers;
  List<Map>? saya;
  List<Map>? riwayat;
  Object? galat;
  Object? galatTukar;
  String? yakin; // id voucher yang menunggu konfirmasi
  String? menukar;
  Map? hasil;

  ApiClient get _api => AppScope.read(context).api;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => muat());
  }

  Future<void> muat() async {
    setState(() => galat = null);
    try {
      final r = await Future.wait([
        _api.get('/rewards', query: {'limit': 20}),
        _api.get('/rewards/vouchers'),
        _api.get('/rewards/redemptions', query: {'limit': 50}),
      ]);
      if (!mounted) return;
      setState(() {
        final ringkas = r[0] as Map;
        saldo = ringkas['saldo'] as int?;
        riwayat = (ringkas['items'] as List).cast<Map>();
        vouchers = ((r[1] as Map)['items'] as List).cast<Map>();
        saya = ((r[2] as Map)['items'] as List).cast<Map>();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => galat = e);
    }
  }

  Future<void> _tukar(Map v) async {
    setState(() {
      menukar = '${v['id']}';
      galatTukar = null;
    });
    try {
      final res = await _api.post('/rewards/vouchers/${v['id']}/redeem') as Map;
      if (!mounted) return;
      setState(() {
        hasil = res['redemption'] as Map;
        saldo = res['saldo'] as int?;
        yakin = null;
        menukar = null;
      });
      await muat();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        galatTukar = e;
        yakin = null;
        menukar = null;
      });
      if (e.code == 'STOK_HABIS') await muat();
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: 'Rewards',
            leading: canPop
                ? IconButton(
                    tooltip: tr('Kembali'),
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
            children: [
              PillToggle<String>(
                options: [
                  PillOption('tukar', tr('Tukar poin')),
                  PillOption('saya', tr('Voucher saya')),
                  PillOption('riwayat', tr('Riwayat')),
                ],
                selected: {tab},
                onChanged: (v) => setState(() => tab = v.first),
              ),
            ],
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: muat,
              child: ListView(
                key: PageStorageKey('rewards-$tab'),
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                children: [
                  _KartuSaldo(saldo: saldo),
                  if (tab == 'tukar') ...[
                    const SizedBox(height: AppSizes.s4),
                    const _CaraDapat(),
                  ],
                  const SizedBox(height: AppSizes.s6),
                  if (galat != null)
                    ErrorBanner(error: galat, onRetry: muat)
                  else if (tab == 'tukar')
                    ..._katalog()
                  else if (tab == 'saya')
                    ..._saya()
                  else
                    ..._riwayat(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget get _memuat => const Padding(
    padding: EdgeInsets.all(AppSizes.s6),
    child: Center(child: CircularProgressIndicator()),
  );

  List<Widget> _katalog() {
    final list = vouchers;
    return [
      Text(tr('Tukar poin'), style: titleSerif(size: 24)),
      const SizedBox(height: AppSizes.s3),
      if (hasil != null)
        Semantics(
          liveRegion: true,
          child: Container(
            margin: const EdgeInsets.only(bottom: AppSizes.s4),
            padding: const EdgeInsets.all(AppSizes.s4),
            decoration: BoxDecoration(
              color: AppColors.trafficLancar.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppColors.trafficLancar.withValues(alpha: 0.35),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr('Voucher ditukar: {0}', [
                    (hasil!['voucher'] as Map?)?['nama'] ?? '',
                  ]),
                  style: sans(
                    size: 15,
                    weight: FontWeight.w600,
                    color: AppColors.teksHijau,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${hasil!['kode']}',
                  style: titleSerif(size: 22, color: AppColors.inkViolet),
                ),
                TextButton(
                  onPressed: () => setState(() => tab = 'saya'),
                  child: Text(tr('Lihat di Voucher saya')),
                ),
              ],
            ),
          ),
        ),
      if (galatTukar != null)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSizes.s3),
          child: ErrorBanner(
            error: (galatTukar as ApiException?)?.code == 'POIN_KURANG'
                ? null
                : galatTukar,
            message: (galatTukar as ApiException?)?.code == 'POIN_KURANG'
                ? tr('Poinmu belum cukup untuk voucher ini.')
                : null,
            onDismiss: () => setState(() => galatTukar = null),
          ),
        ),
      if (list == null)
        _memuat
      else if (list.isEmpty)
        EmptyState(
          icon: Icons.card_giftcard_rounded,
          title: tr('Belum ada voucher'),
          message: tr(
            'Voucher baru akan muncul di sini. Sambil menunggu, kumpulkan poinnya dulu.',
          ),
        )
      else
        for (final v in list) _kuponVoucher(v),
    ];
  }

  Widget _kuponVoucher(Map v) {
    final id = '${v['id']}';
    final harga = v['poin'] as int;
    final tersedia = v['tersedia'] == true;
    final kurang = saldo != null && saldo! < harga;
    final bisa = tersedia && !kurang;
    final redup = sans(size: 12, color: AppColors.ink.withValues(alpha: 0.55));
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.s4),
      child: Kupon(
        redup: !tersedia,
        kiri: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _poin(harga),
              style: titleSerif(size: 24, color: AppColors.white),
            ),
            Text(
              tr('poin'),
              style: sans(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.white.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${v['nama']}',
              style: sans(size: 15, weight: FontWeight.w600, height: 1.3),
            ),
            if (v['deskripsi'] != null)
              Text(
                '${v['deskripsi']}',
                style: sans(
                  size: 13,
                  color: AppColors.ink.withValues(alpha: 0.65),
                ),
              ),
            const SizedBox(height: 2),
            Text(
              '${tersedia ? tr('Sisa {0}', [v['stok']]) : tr('Stok habis')}'
              '${v['berlakuSampai'] != null ? tr(', berlaku sampai {0}', [_tanggal(v['berlakuSampai'])]) : ''}',
              style: redup,
            ),
            if (v['syarat'] != null) _Syarat(teks: '${v['syarat']}'),
            const SizedBox(height: AppSizes.s2),
            if (yakin == id)
              Wrap(
                spacing: AppSizes.s2,
                children: [
                  FilledButton(
                    onPressed: menukar == id ? null : () => _tukar(v),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.pillVia,
                      minimumSize: const Size(0, AppSizes.touch),
                    ),
                    child: Text(
                      menukar == id
                          ? tr('Menukar…')
                          : tr('Tukar {0} poin?', [_poin(harga)]),
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => yakin = null),
                    child: Text(tr('Batal')),
                  ),
                ],
              )
            else
              OutlinedButton(
                onPressed: bisa ? () => setState(() => yakin = id) : null,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, AppSizes.touch),
                ),
                child: Text(
                  !tersedia
                      ? tr('Habis')
                      : kurang
                      ? tr('Kurang {0} poin', [_poin(harga - saldo!)])
                      : tr('Tukar'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _saya() {
    final list = saya;
    return [
      Text(tr('Voucher saya'), style: titleSerif(size: 24)),
      const SizedBox(height: AppSizes.s3),
      if (list == null)
        _memuat
      else if (list.isEmpty)
        EmptyState(
          icon: Icons.confirmation_number_outlined,
          title: tr('Belum ada voucher'),
          message: tr(
            'Tukar poinmu di Tukar poin, vouchernya tersimpan di sini.',
          ),
        )
      else
        for (final r in list) _kuponSaya(r),
    ];
  }

  Widget _kuponSaya(Map r) {
    final v = (r['voucher'] as Map?) ?? const {};
    final status = '${r['status']}';
    final (label, warna) = switch (status) {
      'aktif' => (tr('Bisa dipakai'), AppColors.teksHijau),
      'dipakai' => (tr('Sudah dipakai'), AppColors.teksAbu),
      _ => (tr('Kedaluwarsa'), AppColors.teksAbu),
    };
    final kode = '${r['kode']}';
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.s4),
      child: Kupon(
        redup: status != 'aktif',
        kiri: const Icon(
          Icons.confirmation_number_outlined,
          size: 30,
          color: AppColors.white,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${v['nama'] ?? 'Voucher'}',
              style: sans(size: 15, weight: FontWeight.w600, height: 1.3),
            ),
            const SizedBox(height: 4),
            Container(
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
            ),
            Row(
              children: [
                Flexible(
                  child: Text(
                    kode,
                    style: titleSerif(size: 20, color: AppColors.inkViolet),
                  ),
                ),
                IconButton(
                  tooltip: tr('Salin kode {0}', [kode]),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: kode));
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(tr('Kode disalin'))),
                      );
                    }
                  },
                  icon: Icon(
                    Icons.copy_rounded,
                    size: 18,
                    color: AppColors.inkViolet,
                  ),
                ),
              ],
            ),
            Text(
              tr('Ditukar {0}', [_tanggal(r['createdAt'])]) +
                  (v['berlakuSampai'] != null
                      ? tr(', berlaku sampai {0}', [
                          _tanggal(v['berlakuSampai']),
                        ])
                      : ''),
              style: sans(
                size: 12,
                color: AppColors.ink.withValues(alpha: 0.55),
              ),
            ),
            if (v['syarat'] != null) _Syarat(teks: '${v['syarat']}'),
          ],
        ),
      ),
    );
  }

  List<Widget> _riwayat() {
    final list = riwayat;
    return [
      Text(tr('Riwayat poin'), style: titleSerif(size: 24)),
      const SizedBox(height: AppSizes.s2),
      if (list == null)
        _memuat
      else if (list.isEmpty)
        EmptyState(
          icon: Icons.card_giftcard_rounded,
          title: tr('Belum ada poin'),
          message: tr(
            'Poin pertamamu datang dari pemesanan yang lunas atau umpan balik.',
          ),
        )
      else
        for (final l in list)
          Container(
            padding: const EdgeInsets.symmetric(vertical: AppSizes.s3),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppColors.ink.withValues(alpha: 0.07),
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${l['label']}',
                        style: sans(size: 15, weight: FontWeight.w600),
                      ),
                      Text(
                        _tanggal(l['createdAt']),
                        style: sans(
                          size: 13,
                          color: AppColors.ink.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '${(l['jumlah'] as num) > 0 ? '+' : '−'}${_poin(l['jumlah'] as num)}',
                  style: titleSerif(
                    size: 20,
                    color: (l['jumlah'] as num) > 0
                        ? AppColors.teksHijau
                        : AppColors.ink.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
    ];
  }
}

class _KartuSaldo extends StatelessWidget {
  const _KartuSaldo({required this.saldo});
  final int? saldo;

  @override
  Widget build(BuildContext context) {
    const bayang = [
      Shadow(color: Color(0x5941396F), blurRadius: 2, offset: Offset(0, 1)),
    ];
    return Semantics(
      label: saldo == null
          ? tr('Memuat poin')
          : tr('Poin kamu {0}', [_poin(saldo!)]),
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        decoration: BoxDecoration(
          gradient: AppGradients.tripCard,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppColors.trip4.withValues(alpha: 0.6),
              blurRadius: 30,
              offset: const Offset(0, 14),
              spreadRadius: -16,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('Poin kamu'),
              style: titleSerif(
                size: 15,
                color: AppColors.white.withValues(alpha: 0.9),
              ).copyWith(shadows: bayang),
            ),
            Text(
              saldo == null ? '…' : _poin(saldo!),
              style: titleSerif(
                size: 56,
                color: AppColors.white,
              ).copyWith(height: 1.05, shadows: bayang),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaraDapat extends StatelessWidget {
  const _CaraDapat();

  @override
  Widget build(BuildContext context) {
    final teks = sans(
      size: 14,
      height: 1.4,
      color: AppColors.ink.withValues(alpha: 0.75),
    );
    Widget baris(IconData i, String judul, String isi) => Padding(
      padding: const EdgeInsets.only(top: AppSizes.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(i, size: 20, color: AppColors.pillVia),
          const SizedBox(width: AppSizes.s3),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: judul,
                    style: sans(
                      size: 14,
                      weight: FontWeight.w600,
                      color: AppColors.inkViolet,
                    ),
                  ),
                  TextSpan(text: isi),
                ],
              ),
              style: teks,
            ),
          ),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tr('Cara dapat poin'),
          style: sans(size: 14, weight: FontWeight.w700),
        ),
        baris(
          Icons.confirmation_number_outlined,
          tr('Pesan tiket atau parkir'),
          tr(': 1 poin tiap Rp1.000 setelah lunas (simulasi).'),
        ),
        baris(
          Icons.rate_review_outlined,
          tr('Kirim umpan balik'),
          tr(': 5 poin, sekali seminggu.'),
        ),
      ],
    );
  }
}

class _Syarat extends StatefulWidget {
  const _Syarat({required this.teks});
  final String teks;

  @override
  State<_Syarat> createState() => _SyaratState();
}

class _SyaratState extends State<_Syarat> {
  bool buka = false;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        expanded: buka,
        child: InkWell(
          onTap: () => setState(() => buka = !buka),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 36),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tr('Syarat'),
                  style: sans(
                    size: 13,
                    weight: FontWeight.w600,
                    color: AppColors.inkViolet,
                  ),
                ),
                Icon(
                  buka ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                  size: 18,
                  color: AppColors.inkViolet,
                ),
              ],
            ),
          ),
        ),
      ),
      if (buka)
        Text(
          widget.teks,
          style: sans(
            size: 12,
            height: 1.4,
            color: AppColors.ink.withValues(alpha: 0.65),
          ),
        ),
    ],
  );
}

/// Kupon sobek: sobekan kiri ungu (harga/ikon), takik di sambungan, isi putih di kanan.
class Kupon extends StatelessWidget {
  const Kupon({
    super.key,
    required this.kiri,
    required this.child,
    this.redup = false,
  });
  final Widget kiri;
  final Widget child;
  final bool redup;

  @override
  Widget build(BuildContext context) {
    final latar = Theme.of(context).scaffoldBackgroundColor;
    return Opacity(
      opacity: redup ? 0.6 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppColors.inkViolet.withValues(alpha: 0.12),
          ),
          boxShadow: redup
              ? null
              : [
                  BoxShadow(
                    color: AppColors.inkViolet.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                    spreadRadius: -18,
                  ),
                ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 88,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: AppGradients.pillDeep,
                ),
                alignment: Alignment.center,
                child: kiri,
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 96),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(88 + 16, 14, 12, 14),
                child: child,
              ),
            ),
            Positioned(left: 78, top: -10, child: _bulat(latar)),
            Positioned(left: 78, bottom: -10, child: _bulat(latar)),
          ],
        ),
      ),
    );
  }

  Widget _bulat(Color c) => Container(
    width: 20,
    height: 20,
    decoration: BoxDecoration(shape: BoxShape.circle, color: c),
  );
}
