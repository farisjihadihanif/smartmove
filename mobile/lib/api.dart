import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show ValueNotifier;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';
import 'i18n.dart';

/// Galat API (format API_SPECS §1: `{ message, code }`).
class ApiException implements Exception {
  ApiException(this.status, this.message, [this.code]);

  /// 0 = gagal jaringan / waktu habis.
  final int status;
  final String message;
  final String? code;

  bool get isNetwork => status == 0;

  @override
  String toString() => 'ApiException($status, $code): $message';
}

/// Penyimpanan token JWT. Default: `flutter_secure_storage` (AGENTS §Keamanan).
abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'auth_token';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// Simpan di memori saja (tes).
class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this._token]);
  String? _token;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> write(String token) async => _token = token;

  @override
  Future<void> clear() async => _token = null;
}

/// Kode galat jaringan buatan klien (status 0).
const kOffline = 'OFFLINE';
const kServerUnreachable = 'SERVER_TAK_TERJANGKAU';

/// Cek cepat apakah perangkat punya internet: buka koneksi TCP ke resolver
/// DNS publik (tanpa mengirim data). Dipanggil hanya saat permintaan ke API gagal.
Future<bool> probeInternet() async {
  for (final host in const ['1.1.1.1', '8.8.8.8']) {
    try {
      final s = await Socket.connect(
        host,
        53,
        timeout: const Duration(seconds: 2),
      );
      s.destroy();
      return true;
    } catch (_) {}
  }
  return false;
}

String _defaultMessage(int status) {
  if (status == 401) return tr('Sesi berakhir, silakan masuk lagi');
  if (status == 403) return tr('Kamu tidak punya akses');
  if (status == 404) return tr('Data tidak ditemukan');
  if (status == 429) return tr('Terlalu banyak permintaan, coba lagi nanti');
  if (status >= 500) return tr('Terjadi kesalahan pada server');
  return tr('Permintaan gagal');
}

/// Ubah koordinat ke format query `lat,lng` (API_SPECS §1).
String latLngQuery(double lat, double lng) => '$lat,$lng';

/// Penanganan server yang sedang tidur (T-305). API di Render free tidur setelah ±15 menit
/// tanpa trafik; permintaan pertama sesudahnya bisa butuh ±60 detik. Saat server mungkin
/// tidur, permintaan diberi batas waktu lebih panjang, [ApiClient.waking] bernilai true
/// ("Membangunkan server…"), dan dicoba ulang otomatis sampai [window] habis.
class WakeUp {
  const WakeUp({
    this.timeout = const Duration(seconds: 70),
    this.window = const Duration(seconds: 100),
    this.retryDelay = const Duration(seconds: 3),
    this.showAfter = const Duration(seconds: 4),
    this.mayBeAsleepAfter = const Duration(minutes: 14),
  });

  /// Batas satu percobaan saat server mungkin tidur.
  final Duration timeout;

  /// Total waktu mencoba ulang sebelum menyerah (lalu galat jaringan biasa).
  final Duration window;
  final Duration retryDelay;

  /// Permintaan yang lambat selama ini → tampilkan status bangun.
  final Duration showAfter;

  /// Tanpa respons selama ini → server dianggap mungkin tidur.
  final Duration mayBeAsleepAfter;
}

const _statusSementara = {502, 503, 504};

/// Klien API mobile. Autentikasi `Authorization: Bearer <token>`.
class ApiClient {
  ApiClient({
    http.Client? client,
    TokenStore? tokens,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
    Future<bool> Function()? hasInternet,
    this.wakeUp,
  }) : _http = client ?? http.Client(),
       _hasInternet = hasInternet ?? probeInternet,
       tokens = tokens ?? SecureTokenStore(),
       _base = baseUrl ?? apiBase;

  final http.Client _http;
  final TokenStore tokens;
  final String _base;
  final Duration timeout;
  final Future<bool> Function() _hasInternet;

  /// Null = tanpa penanganan server tidur (tes); aplikasi memakai `WakeUp()`.
  final WakeUp? wakeUp;

  /// true selama menunggu server bangun (lihat [WakeUp]).
  final ValueNotifier<bool> waking = ValueNotifier(false);
  DateTime? _terakhirOk;

  /// Token sesi tanpa "Ingat saya": hanya di memori, hilang saat aplikasi ditutup.
  /// Bila diisi, dipakai menggantikan token di [tokens].
  String? sessionToken;

  /// Dipanggil saat API membalas 401 (mis. kosongkan sesi di [AppState]).
  void Function()? onUnauthorized;

  Future<bool> _online() async {
    try {
      return await _hasInternet();
    } catch (_) {
      return false;
    }
  }

  /// Bedakan "perangkat offline" dari "server SmartMove tidak terjangkau".
  Future<ApiException> _networkError() async {
    var online = false;
    try {
      online = await _hasInternet();
    } catch (_) {}
    return online
        ? ApiException(
            0,
            tr('Tidak bisa terhubung ke server SmartMove. Coba lagi sebentar.'),
            kServerUnreachable,
          )
        : ApiException(0, tr('Kamu sedang offline'), kOffline);
  }

  Uri uri(String path, [Map<String, Object?>? query]) {
    final p = path.startsWith('/') ? path : '/$path';
    final qp = <String, String>{
      for (final e in (query ?? const {}).entries)
        if (e.value != null && e.value.toString().isNotEmpty)
          e.key: e.value.toString(),
    };
    final u = Uri.parse('$_base$p');
    return qp.isEmpty ? u : u.replace(queryParameters: qp);
  }

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    bool auth = true,
  }) async {
    final u = uri(path, query);
    final isi = body == null ? null : jsonEncode(body);
    http.BaseRequest buat() {
      final req = http.Request(method, u);
      if (isi != null) {
        req.headers['Content-Type'] = 'application/json; charset=utf-8';
        req.body = isi;
      }
      return req;
    }

    // GET aman diulang walau gagal jaringan; selain GET hanya bila 502/503/504.
    return _kirim(buat, auth: auth, ulangGagalJaringan: method == 'GET');
  }

  /// Unggah berkas (multipart/form-data), mis. foto profil `PATCH /users/me`.
  Future<dynamic> multipart(
    String method,
    String path, {
    Map<String, String> fields = const {},
    required String fileField,
    required List<int> bytes,
    required String filename,
  }) {
    final u = uri(path);
    return _kirim(
      () => http.MultipartRequest(method, u)
        ..fields.addAll(fields)
        ..files.add(
          http.MultipartFile.fromBytes(fileField, bytes, filename: filename),
        ),
    );
  }

  /// Satu percobaan. → Response, atau null bila gagal jaringan / habis waktu.
  Future<http.Response?> _sekali(http.BaseRequest req, Duration batas) async {
    try {
      return await http.Response.fromStream(
        await _http.send(req).timeout(batas),
      ).timeout(batas);
    } on TimeoutException {
      return null;
    } on SocketException {
      return null;
    } on http.ClientException {
      return null;
    }
  }

  Future<dynamic> _kirim(
    http.BaseRequest Function() buat, {
    bool auth = true,
    bool ulangGagalJaringan = false,
  }) async {
    String? token;
    if (auth) {
      token = sessionToken ?? await tokens.read();
      if (token != null && token.isEmpty) token = null;
    }

    final w = wakeUp;
    final mulai = DateTime.now();
    http.Response? res;
    while (true) {
      final req = buat();
      req.headers['Accept'] = 'application/json';
      // Teks dari API (galat, sapaan, langkah rute) mengikuti bahasa pilihan (T-111).
      req.headers['Accept-Language'] = bahasa;
      if (token != null) req.headers['Authorization'] = 'Bearer $token';

      final ok = _terakhirOk;
      final mungkinTidur =
          w != null &&
          (ok == null || DateTime.now().difference(ok) > w.mayBeAsleepAfter);
      final lambat = mungkinTidur
          ? Timer(w.showAfter, () => waking.value = true)
          : null;
      try {
        res = await _sekali(req, mungkinTidur ? w.timeout : timeout);
      } finally {
        lambat?.cancel();
      }

      final sementara =
          res == null || _statusSementara.contains(res.statusCode);
      final bolehUlang =
          w != null &&
          sementara &&
          (mungkinTidur || waking.value) &&
          (res != null || ulangGagalJaringan) &&
          DateTime.now().difference(mulai) < w.window;
      // Perangkat offline → jangan menunggu server, langsung galat "offline".
      if (bolehUlang && (res != null || await _online())) {
        waking.value = true;
        await Future<void>.delayed(w.retryDelay);
        continue;
      }
      break;
    }
    waking.value = false;
    if (res == null) throw await _networkError();
    if (!_statusSementara.contains(res.statusCode)) {
      _terakhirOk = DateTime.now();
    }

    if (res.statusCode == 204) return null;
    dynamic data;
    if (res.bodyBytes.isNotEmpty) {
      try {
        data = jsonDecode(utf8.decode(res.bodyBytes));
      } on FormatException {
        data = null;
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (res.statusCode == 401 && auth) onUnauthorized?.call();
      final map = data is Map ? data : const {};
      throw ApiException(
        res.statusCode,
        map['message'] is String
            ? map['message'] as String
            : _defaultMessage(res.statusCode),
        map['code'] is String ? map['code'] as String : null,
      );
    }
    return data;
  }

  Future<dynamic> get(String path, {Map<String, Object?>? query}) =>
      request('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) =>
      request('POST', path, body: body);
  Future<dynamic> put(String path, [Object? body]) =>
      request('PUT', path, body: body);
  Future<dynamic> patch(String path, [Object? body]) =>
      request('PATCH', path, body: body);
  Future<dynamic> delete(String path) => request('DELETE', path);

  void close() => _http.close();
}
