import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartmove/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('aset tekstur mockup terdaftar di bundle', () async {
    for (final path in [AppTextures.lilacWashAsset, AppTextures.barDarkAsset]) {
      final data = await rootBundle.load(path);
      // Header WebP: "RIFF....WEBP"
      expect(
        String.fromCharCodes(data.buffer.asUint8List(8, 4)),
        'WEBP',
        reason: path,
      );
    }
  });
}
