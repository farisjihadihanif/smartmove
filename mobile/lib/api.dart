import 'dart:async';
import 'dart:convert';
import 'dart:io';

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

/// Klien API mobile. Autentikasi `Authorization: Bearer <token>`.
class ApiClient {
  ApiClient({
    http.Client? client,
    TokenStore? tokens,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
    Future<bool> Function()? hasInternet,
  }) : _http = client ?? http.Client(),
       _hasInternet = hasInternet ?? probeInternet,
       tokens = tokens ?? SecureTokenStore(),
       _base = baseUrl ?? apiBase;

  final http.Client _http;
  final TokenStore tokens;
  final String _base;
  final Duration timeout;
  final Future<bool> Function() _hasInternet;

  /// Token sesi tanpa "Ingat saya": hanya di memori, hilang saat aplikasi ditutup.
  /// Bila diisi, dipakai menggantikan token di [tokens].
  String? sessionToken;

  /// Dipanggil saat API membalas 401 (mis. kosongkan sesi di [AppState]).
  void Function()? onUnauthorized;

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
    final req = http.Request(method, uri(path, query));
    if (body != null) {
      req.headers['Content-Type'] = 'application/json; charset=utf-8';
      req.body = jsonEncode(body);
    }
    return _kirim(req, auth: auth);
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
    final req = http.MultipartRequest(method, uri(path))
      ..fields.addAll(fields)
      ..files.add(
        http.MultipartFile.fromBytes(fileField, bytes, filename: filename),
      );
    return _kirim(req);
  }

  Future<dynamic> _kirim(http.BaseRequest req, {bool auth = true}) async {
    req.headers['Accept'] = 'application/json';
    // Teks dari API (galat, sapaan, langkah rute) mengikuti bahasa pilihan (T-111).
    req.headers['Accept-Language'] = bahasa;
    if (auth) {
      final token = sessionToken ?? await tokens.read();
      if (token != null && token.isNotEmpty) {
        req.headers['Authorization'] = 'Bearer $token';
      }
    }

    final http.Response res;
    try {
      res = await http.Response.fromStream(
        await _http.send(req).timeout(timeout),
      ).timeout(timeout);
    } on TimeoutException {
      throw await _networkError();
    } on SocketException {
      throw await _networkError();
    } on http.ClientException {
      throw await _networkError();
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
