import 'package:flutter/painting.dart';

import 'config.dart';
import 'i18n.dart';
import 'wib.dart';

// Traffic Mitigation Campaign (T-207). Samakan dengan web/src/lib/kampanye.js.

class InfoJenisEvent {
  const InfoJenisEvent(this.label, this.warna);
  final String label;
  final Color warna;
}

Map<String, InfoJenisEvent> get jenisEvent => {
  'cfd': InfoJenisEvent(tr('Car Free Day'), Color(0xFF2E9E5B)),
  'rekayasa_arus': InfoJenisEvent(tr('Rekayasa arus'), Color(0xFFFFA000)),
  'acara': InfoJenisEvent(tr('Acara'), Color(0xFFA2028A)),
  'lainnya': InfoJenisEvent(tr('Lainnya'), Color(0xFF41396F)),
};

InfoJenisEvent infoJenisEvent(String? j) =>
    jenisEvent[j] ?? jenisEvent['lainnya']!;

List<(String, String)> get fiturUmpanBalik => [
  ('navigasi', 'Smart Navigation'),
  ('lalu_lintas', 'Live Traffic'),
  ('trip_planner', 'Trip Planner'),
  ('pembayaran', 'Digital Payment'),
  ('rewards', 'Rewards'),
  ('kampanye', tr('Kampanye')),
  ('lainnya', tr('Lainnya')),
];

List<String> get labelRating => [
  '',
  tr('Kurang sekali'),
  tr('Kurang'),
  tr('Cukup'),
  tr('Bagus'),
  tr('Bagus sekali'),
];

DateTime _waktu(Object? v) => DateTime.parse('$v');

/// "Hari ini, 06.00–10.00 WIB" atau "21 Nov, 06.00 – 22 Nov, 10.00 WIB".
String rentangEvent(Map e, DateTime now) {
  final mulai = _waktu(e['mulai']), selesai = _waktu(e['selesai']);
  final hMulai = hariWib(mulai, now), hSelesai = hariWib(selesai, now);
  if (hMulai == hSelesai) {
    return tr('{0}, {1}–{2} WIB', [hMulai, jamWib(mulai), jamWib(selesai)]);
  }
  return tr('{0}, {1} – {2}, {3} WIB', [
    hMulai,
    jamWib(mulai),
    hSelesai,
    jamWib(selesai),
  ]);
}

/// Cocokkan kata kunci ke beberapa teks (tanpa beda huruf besar-kecil).
bool cocok(String q, List<Object?> teks) {
  final s = q.trim().toLowerCase();
  return s.isEmpty ||
      teks.any((t) => t != null && '$t'.toLowerCase().contains(s));
}

/// Path berkas dari API (`/uploads/...`) → URL lengkap.
String? urlBerkas(Object? path) {
  if (path == null || '$path'.isEmpty) return null;
  final p = '$path';
  if (p.startsWith('http')) return p;
  return '${apiUrl.replaceAll(RegExp(r'/+$'), '')}$p';
}
