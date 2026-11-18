import 'package:shared_preferences/shared_preferences.dart';

// "Belum dibaca" untuk lonceng Beranda, dihitung di perangkat (API_SPECS §5):
// simpan kapan panel notifikasi terakhir dibuka, lalu hitung notifikasi yang
// `muncul` setelahnya. Samakan dengan web/src/lib/notifications.js.

String notifSeenKey(String userId) => 'smartmove:notif-dibuka:$userId';

DateTime? _shownAt(Map<dynamic, dynamic> n) =>
    DateTime.tryParse((n['muncul'] ?? n['waktu'] ?? '').toString());

/// True bila notifikasi muncul setelah [lastSeen]. Belum pernah dibuka = semua.
bool isUnread(Map<dynamic, dynamic> n, DateTime? lastSeen) {
  if (lastSeen == null) return true;
  final t = _shownAt(n);
  return t != null && t.isAfter(lastSeen);
}

int countUnread(List<dynamic>? list, DateTime? lastSeen) => (list ?? const [])
    .whereType<Map<dynamic, dynamic>>()
    .where((n) => isUnread(n, lastSeen))
    .length;

/// Penyimpanan waktu terakhir panel notifikasi dibuka (`shared_preferences`).
/// Galat penyimpanan diabaikan: lencana hanya muncul lagi, data tidak hilang.
class NotifSeenStore {
  const NotifSeenStore();

  Future<DateTime?> read(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ms = prefs.getInt(notifSeenKey(userId));
      return ms == null || ms <= 0
          ? null
          : DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
    } on Exception {
      return null;
    }
  }

  Future<void> write(String userId, DateTime seen) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(notifSeenKey(userId), seen.millisecondsSinceEpoch);
    } on Exception {
      // Abaikan.
    }
  }
}
