import 'package:material_ui/material_ui.dart';

import 'i18n.dart';
import 'navigasi.dart';
import 'transit.dart';
import 'wib.dart';
import 'kota.dart';

// Helper Trip Planner (T-109). Sama dengan web/src/lib/trip.js – ubah bersamaan.

/// Moda rencana (API: driving | motorcycle | walking | transit).
enum ModaTrip {
  driving(Icons.directions_car_rounded),
  motorcycle(Icons.two_wheeler_rounded),
  walking(Icons.directions_walk_rounded),
  transit(Icons.directions_bus_rounded);

  const ModaTrip(this.icon);
  final IconData icon;

  String get label => switch (this) {
    ModaTrip.driving => tr('Mobil'),
    ModaTrip.motorcycle => tr('Motor'),
    ModaTrip.walking => tr('Jalan kaki'),
    ModaTrip.transit => tr('Transportasi umum'),
  };

  static ModaTrip dari(Object? v) =>
      ModaTrip.values.firstWhere((m) => m.name == v, orElse: () => driving);

  /// Moda Smart Navigation.
  Moda get navigasi => switch (this) {
    driving => Moda.driving,
    motorcycle => Moda.motorcycle,
    walking => Moda.walking,
    transit => Moda.transit,
  };
}

/// Satu rencana perjalanan dari API (`publicTrip`).
class Trip {
  const Trip({
    required this.id,
    required this.asal,
    required this.tujuan,
    required this.moda,
    this.judul,
    this.berangkatPada,
    this.ringkasan,
  });

  factory Trip.fromJson(Map j) {
    final r = j['ringkasan'];
    return Trip(
      id: '${j['id']}',
      judul: (j['judul'] as String?)?.trim().isEmpty ?? true
          ? null
          : j['judul'] as String,
      asal: Tempat.fromJson(j['asal'] as Map),
      tujuan: Tempat.fromJson(j['tujuan'] as Map),
      moda: ModaTrip.dari(j['moda']),
      berangkatPada: j['berangkatPada'] == null
          ? null
          : DateTime.tryParse('${j['berangkatPada']}'),
      ringkasan: r is Map ? Map<String, dynamic>.from(r) : null,
    );
  }

  final String id;
  final String? judul;
  final Tempat asal;
  final Tempat tujuan;
  final ModaTrip moda;
  final DateTime? berangkatPada;
  final Map<String, dynamic>? ringkasan;
}

Map<String, Object?> tempatJson(Tempat t) => {
  'nama': t.nama,
  'lokasi': {'lat': t.lokasi.latitude, 'lng': t.lokasi.longitude},
};

/// "12 mnt · 4,9 km" dari ringkasan tersimpan, atau null.
/// Transit: + tarif ("tarif belum tersedia" bila kosong).
String? teksRingkasan(Map? r, [ModaTrip? moda]) {
  if (r == null) return null;
  final bagian = [
    if (r['durasiS'] is num) formatDurasi(r['durasiS'] as num),
    if (r['jarakM'] is num) formatJarak(r['jarakM'] as num),
  ];
  if (bagian.isEmpty) return null;
  if (moda == ModaTrip.transit) bagian.add(teksTarifRingkas(r));
  return bagian.join(' · ');
}

/// "Berangkat dalam 1 j 5 mnt" / "Waktunya berangkat".
String hitungMundur(DateTime t, DateTime now) {
  final s = t.difference(now).inSeconds;
  return s < 60
      ? tr('Waktunya berangkat')
      : tr('Berangkat dalam {0}', [formatDurasi(s)]);
}

/// Lewat lebih dari 30 menit dari jam berangkat.
bool sudahLewat(Trip t, DateTime now) =>
    t.berangkatPada != null &&
    t.berangkatPada!.isBefore(now.subtract(const Duration(minutes: 30)));

class GrupTrip {
  GrupTrip(this.judul, this.items);
  final String judul;
  final List<Trip> items;
}

/// Per hari (akan datang, jam naik), "Kapan saja" (tanpa jadwal), dan "Sudah lewat".
({Trip? berikutnya, List<GrupTrip> grup, List<Trip> lewat}) kelompokkan(
  List<Trip> trips,
  DateTime now,
) {
  final akan =
      trips
          .where((t) => t.berangkatPada != null && !sudahLewat(t, now))
          .toList()
        ..sort((a, b) => a.berangkatPada!.compareTo(b.berangkatPada!));
  final bebas = trips.where((t) => t.berangkatPada == null).toList();
  final lewat = trips.where((t) => sudahLewat(t, now)).toList()
    ..sort((a, b) => b.berangkatPada!.compareTo(a.berangkatPada!));

  final grup = <GrupTrip>[];
  for (final t in akan) {
    final judul = hariWib(t.berangkatPada!, now);
    if (grup.isNotEmpty && grup.last.judul == judul) {
      grup.last.items.add(t);
    } else {
      grup.add(GrupTrip(judul, [t]));
    }
  }
  if (bebas.isNotEmpty) grup.add(GrupTrip(tr('Kapan saja'), bebas));
  return (
    berikutnya: akan.isEmpty ? null : akan.first,
    grup: grup,
    lewat: lewat,
  );
}

/// Tanggal + jam WIB (dari pemilih) → waktu UTC.
DateTime waktuWib(DateTime tanggal, TimeOfDay jam) => DateTime.utc(
  tanggal.year,
  tanggal.month,
  tanggal.day,
  jam.hour,
  jam.minute,
).subtract(kota.offsetZona);

/// Waktu → tanggal & jam WIB untuk pemilih.
({DateTime tanggal, TimeOfDay jam}) keWib(DateTime t) {
  final w = t.toUtc().add(kota.offsetZona);
  return (
    tanggal: DateTime(w.year, w.month, w.day),
    jam: TimeOfDay(hour: w.hour, minute: w.minute),
  );
}

/// "Kam, 19 Nov" untuk tombol tanggal.
String labelTanggal(DateTime tanggal) =>
    '${hariPendek(tanggal.weekday)}, ${tanggalBulan(tanggal.day, tanggal.month)}';

String labelJam(TimeOfDay j) => jamMenit(j.hour, j.minute);
