import 'package:material_ui/material_ui.dart';

import 'trip.dart';

// Pemesanan & Digital Payment — SELALU simulasi (T-302, PRD §6.3).
// Sama dengan web lib/pembayaran.js.

const labelSimulasi = 'Simulasi – bukan tiket resmi';

const jenisLayanan = <(String, String, IconData)>[
  ('kereta', 'Kereta', Icons.train_rounded),
  ('bus', 'Bus', Icons.directions_bus_rounded),
  ('bus_antarkota', 'Antarkota', Icons.airport_shuttle_rounded),
  ('travel', 'Travel', Icons.directions_car_rounded),
  ('parkir', 'Parkir', Icons.local_parking_rounded),
];

String labelJenis(String? v) =>
    jenisLayanan.where((j) => j.$1 == v).firstOrNull?.$2 ?? (v ?? '');
IconData ikonJenis(String? v) =>
    jenisLayanan.where((j) => j.$1 == v).firstOrNull?.$3 ??
    Icons.confirmation_number_outlined;

/// Metode di mockup hal. 5. "Pay for parking" = pintasan ke layanan parkir.
const metodeBayar = <(String, String, String, IconData)>[
  ('kartu', 'Kartu kredit', 'Visa, Mastercard, JCB', Icons.credit_card_rounded),
  (
    'ewallet',
    'E-Wallet',
    'GoPay, ShopeePay',
    Icons.account_balance_wallet_rounded,
  ),
  (
    'transfer',
    'Transfer bank',
    'Virtual account BCA, BNI, BRI, dan lainnya',
    Icons.account_balance_rounded,
  ),
  (
    'qris',
    'QRIS',
    'Pindai dari aplikasi bank atau e-wallet',
    Icons.qr_code_2_rounded,
  ),
];

const _namaMetode = {
  'kartu': 'Kartu kredit',
  'ewallet': 'E-Wallet',
  'transfer': 'Transfer bank',
  'qris': 'QRIS',
  'credit_card': 'Kartu kredit',
  'gopay': 'GoPay',
  'shopeepay': 'ShopeePay',
  'bank_transfer': 'Transfer bank',
  'echannel': 'Transfer bank (Mandiri)',
  'permata': 'Transfer bank (Permata)',
  'cstore': 'Gerai ritel',
};
String? namaMetode(String? m) =>
    m == null ? null : (_namaMetode[m] ?? m.replaceAll('_', ' '));

/// Label + warna status (warna selalu disertai teks).
(String, Color) statusPembayaran(String? s) => switch (s) {
  'menunggu' => ('Menunggu pembayaran', const Color(0xFF8A5300)),
  'lunas' => ('Lunas', const Color(0xFF1D6B3D)),
  'gagal' => ('Gagal', const Color(0xFFB42318)),
  'kedaluwarsa' => ('Kedaluwarsa', const Color(0xFF5F5F6B)),
  'dibatalkan' => ('Dibatalkan', const Color(0xFF5F5F6B)),
  _ => (s ?? '', const Color(0xFF5F5F6B)),
};

/// "Rp35.000"
String rupiah(num n) {
  final s = n.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return 'Rp$b';
}

bool adalahParkir(Map l) => l['jenis'] == 'parkir';
String satuan(Map l) => adalahParkir(l) ? 'jam' : 'orang';
int maksJumlah(Map l) => adalahParkir(l) ? 24 : 8;

/// "Stasiun Medan → Bandara Kualanamu" atau lokasi parkir.
String ruteLayanan(Map l) {
  final tujuan = l['tujuan'];
  if (tujuan == null || '$tujuan'.isEmpty) return '${l['asal'] ?? ''}';
  return '${l['asal'] ?? '—'} → $tujuan';
}

const _wib = Duration(hours: 7);
String _dua(int n) => n.toString().padLeft(2, '0');
const _hari = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const _bulan = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', //
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/// Tanggal WIB "YYYY-MM-DD" untuk [offset] hari dari [now].
String tanggalWib(DateTime now, [int offset = 0]) {
  final w = now.toUtc().add(_wib).add(Duration(days: offset));
  return '${w.year}-${_dua(w.month)}-${_dua(w.day)}';
}

/// "2026-11-20" → ("Jum", 20, "Nov")
(String, int, String) pecahTanggal(String iso) {
  final d = DateTime.parse('${iso}T00:00:00Z');
  return (_hari[d.weekday - 1], d.day, _bulan[d.month - 1]);
}

/// "Jum, 20 Nov 2026, 06.40 WIB"
String waktuLengkap(DateTime t) {
  final w = t.toUtc().add(_wib);
  return '${_hari[w.weekday - 1]}, ${w.day} ${_bulan[w.month - 1]} ${w.year}, '
      '${_dua(w.hour)}.${_dua(w.minute)} WIB';
}

/// Slot jam layanan: dari API (`slot`), atau tiap 30 menit untuk parkir.
List<({String jam, DateTime waktu, bool tersedia})> slotLayanan(
  Map l,
  String tanggal,
  DateTime now,
) {
  if (!adalahParkir(l)) {
    return [
      for (final s in (l['slot'] as List? ?? const []).cast<Map>())
        (
          jam: '${s['jam']}',
          waktu: DateTime.parse('${s['waktu']}'),
          tersedia: s['tersedia'] == true,
        ),
    ];
  }
  final batas = now.subtract(const Duration(minutes: 15));
  return [
    for (var m = 0; m < 24 * 60; m += 30)
      () {
        final jam = '${_dua(m ~/ 60)}:${_dua(m % 60)}';
        final waktu = DateTime.parse('${tanggal}T$jam:00+07:00');
        return (jam: jam, waktu: waktu, tersedia: waktu.isAfter(batas));
      }(),
  ];
}

/// Teks bagikan e-tiket / pesanan.
String teksBagikan(Map p) {
  final l = (p['layanan'] as Map?) ?? const {};
  final jadwal = DateTime.tryParse('${p['jadwal']}');
  final kode = (p['eTiket'] as Map?)?['kode'];
  return [
    '${l['nama']} ($labelSimulasi)',
    ruteLayanan(l),
    if (jadwal != null) waktuLengkap(jadwal),
    '${p['penumpang']} ${satuan(l)} · ${rupiah(p['jumlah'] as num? ?? 0)}',
    if (kode != null) 'Kode: $kode',
    'Dipesan lewat SmartMove Medan',
  ].join('\n');
}

/// Parameter Digital Payment dari sebuah rencana (Trip Planner, T-302):
/// transportasi umum → tiket asal–tujuan; mobil/motor → parkir di tujuan.
({String? asal, String? tujuan, String? tanggal, String? jenis})?
pesananDariTrip(Trip t) {
  if (t.moda == ModaTrip.walking) return null;
  final tanggal = t.berangkatPada == null ? null : tanggalWib(t.berangkatPada!);
  if (t.moda == ModaTrip.transit) {
    return (
      asal: t.asal.nama,
      tujuan: t.tujuan.nama,
      tanggal: tanggal,
      jenis: null,
    );
  }
  return (asal: t.tujuan.nama, tujuan: null, tanggal: tanggal, jenis: 'parkir');
}
