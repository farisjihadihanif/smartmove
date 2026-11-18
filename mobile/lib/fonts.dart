import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Font Open Sans & Bree Serif dibundel di `assets/google_fonts/`.
/// Unduhan font saat runtime dimatikan agar tampilan sama walau offline.
void setupFonts() {
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    for (final (family, file) in const [
      ('Open Sans', 'OFL-OpenSans.txt'),
      ('Bree Serif', 'OFL-BreeSerif.txt'),
    ]) {
      final text = await rootBundle.loadString('assets/google_fonts/$file');
      yield LicenseEntryWithLineBreaks([family], text);
    }
  });
}
