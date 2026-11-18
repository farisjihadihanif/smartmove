import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:smartmove/api.dart';
import 'package:smartmove/state.dart';
import 'package:smartmove/theme.dart';

ApiClient _client(
  Future<http.Response> Function(http.Request) handler, {
  String? token,
}) =>
    ApiClient(
      client: MockClient(handler),
      tokens: MemoryTokenStore(token),
      baseUrl: 'http://api.test/api',
    );

http.Response _json(Object body, [int status = 200]) => http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  group('ApiClient', () {
    test('mengirim Bearer token dan membuang query kosong', () async {
      late http.Request seen;
      final api = _client((req) async {
        seen = req;
        return _json({'ok': true});
      }, token: 'abc');

      final data = await api.get('/places/search', query: {
        'q': 'Kualanamu',
        'near': latLngQuery(3.5, 98.6),
        'kosong': '',
        'nol': null,
      });

      expect(data, {'ok': true});
      expect(seen.headers['Authorization'], 'Bearer abc');
      expect(seen.url.path, '/api/places/search');
      expect(seen.url.queryParameters, {'q': 'Kualanamu', 'near': '3.5,98.6'});
    });

    test('tanpa token tidak ada header Authorization', () async {
      late http.Request seen;
      final api = _client((req) async {
        seen = req;
        return _json({});
      });
      await api.post('/auth/login', {'email': 'a@b.c'});
      expect(seen.headers.containsKey('Authorization'), isFalse);
      expect(jsonDecode(seen.body), {'email': 'a@b.c'});
    });

    test('galat memakai message & code dari API', () async {
      final api = _client((_) async =>
          _json({'message': 'Poin kamu kurang', 'code': 'POIN_KURANG'}, 409));
      await expectLater(
        api.post('/rewards/redeem'),
        throwsA(isA<ApiException>()
            .having((e) => e.status, 'status', 409)
            .having((e) => e.code, 'code', 'POIN_KURANG')
            .having((e) => e.message, 'message', 'Poin kamu kurang')),
      );
    });

    test('galat tanpa body memakai pesan bawaan', () async {
      final api = _client((_) async => http.Response('', 500));
      await expectLater(
        api.get('/home'),
        throwsA(isA<ApiException>().having(
            (e) => e.message, 'message', 'Terjadi kesalahan pada server')),
      );
    });

    test('gagal jaringan → status 0', () async {
      final api = _client((_) async => throw http.ClientException('putus'));
      await expectLater(
        api.get('/home'),
        throwsA(isA<ApiException>().having((e) => e.isNetwork, 'isNetwork', true)),
      );
    });
  });

  group('AppState', () {
    test('bootstrap tanpa token → signedOut', () async {
      final state = AppState(_client((_) async => _json({})));
      await state.bootstrap();
      expect(state.status, AuthStatus.signedOut);
    });

    test('bootstrap dengan token valid → signedIn', () async {
      final state = AppState(_client(
        (_) async => _json({'user': {'name': 'Rina', 'role': 'user'}}),
        token: 't',
      ));
      await state.bootstrap();
      expect(state.status, AuthStatus.signedIn);
      expect(state.user?['name'], 'Rina');
      expect(state.isAdmin, isFalse);
    });

    test('bootstrap 401 → token dihapus', () async {
      final api = _client((_) async => _json({'message': 'x'}, 401), token: 't');
      final state = AppState(api);
      await state.bootstrap();
      expect(state.status, AuthStatus.signedOut);
      expect(await api.tokens.read(), isNull);
    });

    test('setSession menyimpan token, signOut menghapus', () async {
      final api = _client((_) async => http.Response('', 204));
      final state = AppState(api);
      await state.setSession({
        'token': 'jwt',
        'user': {'name': 'Budi', 'role': 'user'},
      });
      expect(await api.tokens.read(), 'jwt');
      expect(state.isSignedIn, isTrue);

      await state.signOut();
      expect(await api.tokens.read(), isNull);
      expect(state.status, AuthStatus.signedOut);
    });
  });

  test('warna mockup persis (DESIGN §2.1)', () {
    expect(AppColors.primaryDeep.toARGB32(), 0xFF361254);
    expect(AppColors.primary.toARGB32(), 0xFF4B1D6D);
    expect(AppColors.magenta.toARGB32(), 0xFF8B3AA8);
    expect(AppColors.violet.toARGB32(), 0xFF6D28D9);
    expect(AppColors.lavender.toARGB32(), 0xFFF3E8FF);
    expect(AppColors.accent.toARGB32(), 0xFFD35428);
    expect(AppColors.route.toARGB32(), 0xFF0D3AA9);
    expect(nebulaGradient.colors,
        [AppColors.primaryDeep, AppColors.primary, AppColors.magenta]);
  });
}
