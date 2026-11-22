import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../api.dart';
import '../../config.dart';
import '../../i18n.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../widgets/widgets.dart';
import '../payment/payment_history_screen.dart';
import '../rewards/rewards_screen.dart';
import '../../kota.dart';

/// Pilih foto (galeri). Tes menggantinya. → (bytes, nama berkas) atau null bila batal.
typedef PilihFoto = Future<(List<int>, String)?> Function();

Future<(List<int>, String)?> pilihFotoGaleri() async {
  final f = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    maxWidth: 1024,
    maxHeight: 1024,
    imageQuality: 85,
  );
  if (f == null) return null;
  return (await f.readAsBytes(), f.name);
}

const _fotoMaks = 2 * 1024 * 1024;

/// Akun (DESIGN §3, T-116): foto profil, nama & username, ganti password, Tampilan,
/// riwayat pemesanan, Rewards, keluar. Sama dengan web pages/Akun.jsx.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, this.pilihFoto = pilihFotoGaleri});
  final PilihFoto pilihFoto;

  @override
  State<AccountScreen> createState() => AccountScreenState();
}

class AccountScreenState extends State<AccountScreen> {
  final _nama = TextEditingController();
  final _username = TextEditingController();
  final _lama = TextEditingController();
  final _baru = TextEditingController();
  final _ulang = TextEditingController();
  String? _awalNama;
  String? _awalUsername;

  bool mengunggah = false;
  Object? galatFoto;
  bool simpanProfil = false;
  Object? galatProfil;
  bool profilOk = false;
  bool simpanPw = false;
  Object? galatPw;
  bool pwOk = false;
  bool lihatPw = false;

  AppState get _app => AppScope.read(context);
  ApiClient get _api => _app.api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final u = AppScope.of(context).user;
    final n = '${u?['namaLengkap'] ?? ''}';
    final un = '${u?['username'] ?? ''}';
    if (n != _awalNama || un != _awalUsername) {
      _awalNama = n;
      _awalUsername = un;
      _nama.text = n;
      _username.text = un;
    }
  }

  @override
  void dispose() {
    for (final c in [_nama, _username, _lama, _baru, _ulang]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _profilBerubah =>
      _nama.text.trim() != _awalNama ||
      _username.text.trim().toLowerCase() != _awalUsername;

  Future<void> _gantiFoto() async {
    final hasil = await widget.pilihFoto();
    if (hasil == null || !mounted) return;
    final (bytes, nama) = hasil;
    if (bytes.length > _fotoMaks) {
      setState(
        () => galatFoto = ApiException(400, tr('Ukuran foto maksimal 2 MB.')),
      );
      return;
    }
    setState(() {
      mengunggah = true;
      galatFoto = null;
    });
    try {
      final res = await _api.multipart(
        'PATCH',
        '/users/me',
        fileField: 'foto',
        bytes: bytes,
        filename: nama,
      ) as Map;
      _app.updateUser(Map<String, dynamic>.from(res['user'] as Map));
    } on ApiException catch (e) {
      if (mounted) setState(() => galatFoto = e);
    } finally {
      if (mounted) setState(() => mengunggah = false);
    }
  }

  Future<void> _simpanProfil() async {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      simpanProfil = true;
      galatProfil = null;
      profilOk = false;
    });
    try {
      final res = await _api.patch('/users/me', {
        'namaLengkap': _nama.text.trim(),
        'username': _username.text.trim().toLowerCase(),
      }) as Map;
      _app.updateUser(Map<String, dynamic>.from(res['user'] as Map));
      if (mounted) setState(() => profilOk = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => galatProfil = e);
    } finally {
      if (mounted) setState(() => simpanProfil = false);
    }
  }

  String? get _masalahPw {
    if (_baru.text.isNotEmpty && _baru.text.length < 8) {
      return tr('Password baru minimal 8 karakter.');
    }
    if (_ulang.text.isNotEmpty && _ulang.text != _baru.text) {
      return tr('Ulangi password belum sama dengan password baru.');
    }
    return null;
  }

  Future<void> _simpanPassword() async {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      simpanPw = true;
      galatPw = null;
      pwOk = false;
    });
    try {
      final res = await _api.put('/users/me/password', {
        'passwordLama': _lama.text,
        'passwordBaru': _baru.text,
      }) as Map;
      await _app.perbaruiSesi(res);
      _lama.clear();
      _baru.clear();
      _ulang.clear();
      if (mounted) setState(() => pwOk = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => galatPw = e);
    } finally {
      if (mounted) setState(() => simpanPw = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final user = app.user;
    if (user == null) return const SizedBox.shrink();
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NebulaHeader(
            title: tr('Akun'),
            leading: canPop
                ? IconButton(
                    tooltip: tr('Kembali'),
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  )
                : null,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
              children: [
                _identitas(user),
                const SizedBox(height: AppSizes.s6),
                PilihTema(value: app.tema, onChanged: app.setTema),
                PilihBahasa(value: app.pilihanBahasa, onChanged: app.setBahasa),
                _baris(
                  Icons.receipt_long_rounded,
                  tr('Riwayat pemesanan'),
                  () => _buka(const PaymentHistoryScreen()),
                ),
                _baris(
                  Icons.card_giftcard_rounded,
                  'Rewards',
                  () => _buka(const RewardsScreen()),
                ),
                _baris(
                  Icons.logout_rounded,
                  tr('Keluar'),
                  app.signOut,
                  merah: true,
                ),
                const SizedBox(height: AppSizes.s8),
                ..._formProfil(),
                const SizedBox(height: AppSizes.s8),
                Divider(color: AppColors.ink.withValues(alpha: 0.08)),
                const SizedBox(height: AppSizes.s6),
                ..._formPassword(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _buka(Widget w) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => w));

  Widget _identitas(Map user) {
    final nama = '${user['namaLengkap'] ?? ''}'.trim().isEmpty
        ? '${user['username']}'
        : '${user['namaLengkap']}';
    final foto = user['foto']?.toString();
    final url = foto == null || foto.isEmpty
        ? null
        : foto.startsWith('http')
        ? foto
        : '${apiUrl.replaceAll(RegExp(r'/+$'), '')}$foto';
    final dibuat = DateTime.tryParse('${user['createdAt']}');
    final redup = sans(size: 14, color: AppColors.ink.withValues(alpha: 0.6));
    return Column(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 112,
              height: 112,
              alignment: Alignment.center,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.loginAvatar,
                border: Border.all(color: AppColors.card, width: 4),
              ),
              child: url != null
                  ? Image.network(
                      url,
                      width: 112,
                      height: 112,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _inisial(nama),
                    )
                  : _inisial(nama),
            ),
            if (mengunggah)
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0x66000000),
                  ),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.white),
                  ),
                ),
              ),
            Positioned(
              right: -4,
              bottom: -4,
              child: Material(
                color: Colors.transparent,
                child: Ink(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppGradients.pill,
                    border: Border.all(color: AppColors.surface, width: 4),
                  ),
                  child: IconButton(
                    tooltip: url == null
                        ? tr('Tambah foto profil')
                        : tr('Ganti foto profil'),
                    onPressed: mengunggah ? null : _gantiFoto,
                    icon: const Icon(
                      Icons.photo_camera_rounded,
                      color: AppColors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSizes.s3),
        Text(nama, textAlign: TextAlign.center, style: titleSerif(size: 26)),
        Text('@${user['username']}', style: redup),
        Text('${user['email'] ?? ''}', style: redup),
        if (dibuat != null)
          Text(
            tr('Bergabung {0}', [
              '${bulanPanjang(dibuat.toUtc().add(kota.offsetZona).month)} ${dibuat.year}',
            ]),
            style: sans(size: 13, color: AppColors.ink.withValues(alpha: 0.5)),
          ),
        const SizedBox(height: AppSizes.s1),
        Text(
          tr('Foto JPG, PNG, atau WEBP, maksimal 2 MB.'),
          style: sans(size: 12, color: AppColors.ink.withValues(alpha: 0.5)),
        ),
        if (galatFoto != null) ...[
          const SizedBox(height: AppSizes.s3),
          ErrorBanner(
            error: galatFoto,
            onDismiss: () => setState(() => galatFoto = null),
          ),
        ],
      ],
    );
  }

  Widget _inisial(String nama) => Text(
    nama.trim().isEmpty ? '?' : nama.trim()[0].toUpperCase(),
    style: titleSerif(size: 44, color: AppColors.white),
  );

  Widget _baris(
    IconData ikon,
    String label,
    VoidCallback onTap, {
    bool merah = false,
  }) {
    final warna = merah ? AppColors.teksMerah : AppColors.inkViolet;
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.ink.withValues(alpha: 0.07)),
          ),
        ),
        child: Row(
          children: [
            Icon(ikon, color: warna, size: 22),
            const SizedBox(width: AppSizes.s3),
            Expanded(
              child: Text(
                label,
                style: sans(
                  size: 15,
                  weight: FontWeight.w600,
                  color: merah ? warna : AppColors.ink,
                ),
              ),
            ),
            if (!merah)
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.ink.withValues(alpha: 0.4),
              ),
          ],
        ),
      ),
    );
  }

  InputDecoration _dekor({String? prefix, String? helper, Widget? suffix}) =>
      InputDecoration(
        filled: true,
        fillColor: AppColors.search,
        prefixText: prefix,
        helperText: helper,
        helperMaxLines: 2,
        suffixIcon: suffix,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
      );

  Widget _label(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 6, top: AppSizes.s3),
    child: Text(t, style: sans(size: 14, weight: FontWeight.w600)),
  );

  Widget _berhasil(String t) => Semantics(
    liveRegion: true,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.check_rounded, color: AppColors.teksHijau, size: 18),
        const SizedBox(width: 4),
        Text(
          t,
          style: sans(
            size: 14,
            weight: FontWeight.w600,
            color: AppColors.teksHijau,
          ),
        ),
      ],
    ),
  );

  List<Widget> _formProfil() => [
    Text(tr('Profil'), style: titleSerif(size: 24)),
    _label(tr('Nama lengkap')),
    TextField(
      controller: _nama,
      maxLength: 80,
      textInputAction: TextInputAction.next,
      autofillHints: const [AutofillHints.name],
      onChanged: (_) => setState(() => profilOk = false),
      decoration: _dekor().copyWith(counterText: ''),
    ),
    _label(tr('Username')),
    TextField(
      controller: _username,
      maxLength: 30,
      autocorrect: false,
      autofillHints: const [AutofillHints.username],
      onChanged: (_) => setState(() => profilOk = false),
      decoration: _dekor(
        prefix: '@',
        helper: tr(
          '3–30 karakter: huruf kecil, angka, titik, atau garis bawah. Dipakai untuk masuk.',
        ),
      ).copyWith(counterText: ''),
    ),
    if (galatProfil != null) ...[
      const SizedBox(height: AppSizes.s3),
      ErrorBanner(error: galatProfil),
    ],
    const SizedBox(height: AppSizes.s4),
    Wrap(
      spacing: AppSizes.s4,
      runSpacing: AppSizes.s2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        FilledButton(
          onPressed: !_profilBerubah || simpanProfil ? null : _simpanProfil,
          child: Text(simpanProfil ? tr('Menyimpan…') : tr('Simpan profil')),
        ),
        if (profilOk && !_profilBerubah) _berhasil(tr('Profil disimpan.')),
      ],
    ),
  ];

  List<Widget> _formPassword() {
    final masalah = _masalahPw;
    final siap =
        _lama.text.isNotEmpty &&
        _baru.text.isNotEmpty &&
        _ulang.text.isNotEmpty &&
        masalah == null;
    Widget isian(String label, TextEditingController c, List<String> hints) =>
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _label(label),
            TextField(
              controller: c,
              obscureText: !lihatPw,
              maxLength: 72,
              autofillHints: hints,
              onChanged: (_) => setState(() => pwOk = false),
              decoration: _dekor(
                suffix: IconButton(
                  tooltip: lihatPw
                      ? tr('Sembunyikan password')
                      : tr('Tampilkan password'),
                  onPressed: () => setState(() => lihatPw = !lihatPw),
                  icon: Icon(
                    lihatPw
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ).copyWith(counterText: ''),
            ),
          ],
        );
    return [
      Text(tr('Ganti password'), style: titleSerif(size: 24)),
      const SizedBox(height: 4),
      Text(
        tr(
          'Setelah diganti, perangkat lain yang masuk dengan akun ini otomatis keluar.',
        ),
        style: sans(size: 14, color: AppColors.ink.withValues(alpha: 0.6)),
      ),
      isian(tr('Password lama'), _lama, const [AutofillHints.password]),
      isian(tr('Password baru'), _baru, const [AutofillHints.newPassword]),
      isian(tr('Ulangi password baru'), _ulang, const [
        AutofillHints.newPassword,
      ]),
      if (masalah != null)
        Padding(
          padding: const EdgeInsets.only(top: AppSizes.s2),
          child: Text(
            masalah,
            style: sans(size: 13, color: AppColors.teksMerah),
          ),
        ),
      if (galatPw != null) ...[
        const SizedBox(height: AppSizes.s3),
        ErrorBanner(error: galatPw),
      ],
      const SizedBox(height: AppSizes.s4),
      Wrap(
        spacing: AppSizes.s4,
        runSpacing: AppSizes.s2,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          FilledButton(
            onPressed: !siap || simpanPw ? null : _simpanPassword,
            child: Text(simpanPw ? tr('Menyimpan…') : tr('Simpan password')),
          ),
          if (pwOk) _berhasil(tr('Password diganti.')),
        ],
      ),
    ];
  }
}
