import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'i18n.dart';

/// Status sesi aplikasi.
enum AuthStatus { unknown, signedOut, signedIn }

/// State global: sesi pengguna. Token di secure storage lewat [ApiClient.tokens].
class AppState extends ChangeNotifier {
  AppState(this.api) {
    api.onUnauthorized = _handleUnauthorized;
  }

  final ApiClient api;

  AuthStatus _status = AuthStatus.unknown;
  Map<String, dynamic>? _user;

  /// Mode gelap (T-110): 'sistem' | 'terang' | 'gelap', disimpan di perangkat.
  static const kunciTema = 'smartmove-tema';
  String _tema = 'sistem';
  String get tema => _tema;

  Future<void> muatTema() async {
    try {
      final v = (await SharedPreferences.getInstance()).getString(kunciTema);
      if (v == 'terang' || v == 'gelap') {
        _tema = v!;
        notifyListeners();
      }
    } catch (_) {
      // Penyimpanan tidak tersedia: ikut sistem.
    }
  }

  Future<void> setTema(String v) async {
    if (v != 'sistem' && v != 'terang' && v != 'gelap') return;
    _tema = v;
    notifyListeners();
    try {
      final p = await SharedPreferences.getInstance();
      if (v == 'sistem') {
        await p.remove(kunciTema);
      } else {
        await p.setString(kunciTema, v);
      }
    } catch (_) {}
  }

  /// Bahasa (T-111): 'sistem' (ikut perangkat) | 'id' | 'en', disimpan di perangkat.
  static const kunciBahasa = 'smartmove-bahasa';
  String _pilihanBahasa = 'sistem';
  String get pilihanBahasa => _pilihanBahasa;

  /// Muat kamus + pilihan tersimpan, lalu pasang bahasa aktif. Dipanggil sebelum runApp.
  Future<void> muatBahasa() async {
    await muatKamus();
    try {
      final v = (await SharedPreferences.getInstance()).getString(kunciBahasa);
      if (v == 'id' || v == 'en') _pilihanBahasa = v!;
    } catch (_) {
      // Penyimpanan tidak tersedia: ikut perangkat.
    }
    terapkanBahasa();
  }

  /// Hitung ulang bahasa aktif (mis. bahasa perangkat berganti). Memberi tahu bila berubah.
  void terapkanBahasa() {
    final b = bahasaDari(_pilihanBahasa);
    if (b == bahasa) return;
    aturBahasa(b);
    notifyListeners();
  }

  Future<void> setBahasa(String v) async {
    if (v != 'sistem' && v != 'id' && v != 'en') return;
    _pilihanBahasa = v;
    terapkanBahasa();
    notifyListeners();
    try {
      final p = await SharedPreferences.getInstance();
      if (v == 'sistem') {
        await p.remove(kunciBahasa);
      } else {
        await p.setString(kunciBahasa, v);
      }
    } catch (_) {}
  }

  AuthStatus get status => _status;
  Map<String, dynamic>? get user => _user;
  bool get isSignedIn => _status == AuthStatus.signedIn;
  bool get isAdmin => _user?['role'] == 'admin';

  /// Dipanggil sekali saat aplikasi mulai: pulihkan sesi dari token tersimpan.
  Future<void> bootstrap() async {
    final token = await api.tokens.read();
    if (token == null || token.isEmpty) {
      _set(AuthStatus.signedOut, null);
      return;
    }
    try {
      final data = await api.get('/auth/me');
      final user = _extractUser(data);
      if (user == null) {
        await api.tokens.clear();
        _set(AuthStatus.signedOut, null);
      } else {
        _set(AuthStatus.signedIn, user);
      }
    } on ApiException catch (e) {
      if (e.status == 401) {
        await api.tokens.clear();
        _set(AuthStatus.signedOut, null);
      } else {
        // Offline / server bermasalah: anggap masih masuk, data diambil ulang nanti.
        _set(AuthStatus.signedIn, _user);
      }
    }
  }

  /// Simpan sesi dari respons `/auth/login` atau `/auth/register` → `{user, token}`.
  /// [remember] false ("Ingat saya" tidak dicentang): token hanya di memori.
  Future<void> setSession(
    Map<String, dynamic> response, {
    bool remember = true,
  }) async {
    final token = response['token'];
    final user = _extractUser(response);
    if (token is! String || token.isEmpty || user == null) {
      throw ApiException(500, tr('Respons masuk tidak valid'));
    }
    if (remember) {
      api.sessionToken = null;
      await api.tokens.write(token);
    } else {
      api.sessionToken = token;
      await api.tokens.clear();
    }
    _set(AuthStatus.signedIn, user);
  }

  /// Setelah ganti password (`{user, token}`): token baru disimpan di tempat yang sama
  /// dengan token lama (secure storage, atau memori bila "Ingat saya" tidak dicentang).
  Future<void> perbaruiSesi(Map res) async {
    final token = res['token'];
    if (token is String && token.isNotEmpty) {
      if (api.sessionToken != null) {
        api.sessionToken = token;
      } else {
        await api.tokens.write(token);
      }
    }
    final user = _extractUser(res);
    if (user != null) updateUser(user);
  }

  void updateUser(Map<String, dynamic> user) {
    _user = user;
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await api.post('/auth/logout');
    } on ApiException {
      // Abaikan: sesi lokal tetap dihapus.
    }
    api.sessionToken = null;
    await api.tokens.clear();
    _set(AuthStatus.signedOut, null);
  }

  Future<void> _handleUnauthorized() async {
    if (_status == AuthStatus.signedOut) return;
    api.sessionToken = null;
    await api.tokens.clear();
    _set(AuthStatus.signedOut, null);
  }

  static Map<String, dynamic>? _extractUser(dynamic data) {
    if (data is! Map) return null;
    final u = data['user'];
    return u is Map ? Map<String, dynamic>.from(u) : null;
  }

  void _set(AuthStatus status, Map<String, dynamic>? user) {
    _status = status;
    _user = user;
    notifyListeners();
  }
}

/// Sediakan [AppState] ke pohon widget. Akses: `AppScope.of(context)`.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope tidak ditemukan di atas widget ini');
    return scope!.notifier!;
  }

  /// Akses tanpa berlangganan perubahan (untuk aksi di onPressed).
  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope tidak ditemukan di atas widget ini');
    return scope!.notifier!;
  }
}
