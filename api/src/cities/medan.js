// Konfigurasi kota: Medan (kota pertama SmartMove, T-112 / Keputusan #21).
// Semua aturan & batas yang khusus Medan dikumpulkan di sini. Kota baru = berkas baru
// dengan bentuk yang sama + didaftarkan di ./index.js (lihat ARCHITECTURE §11).

export default {
  id: 'medan',
  nama: 'Medan',
  // Nama wilayah layanan untuk pesan "di luar wilayah".
  wilayahLayanan: 'Medan dan sekitarnya',
  // Kotak kasar Mebidang (Medan, Binjai, Deli Serdang): Binjai (barat), Belawan (utara),
  // Kualanamu (timur), Pancur Batu/Sibolangit (selatan). Cukup untuk menolak titik di luar.
  batas: { minLat: 3.25, maxLat: 3.9, minLng: 98.35, maxLng: 99.0 },
  pusat: { lat: 3.5913, lng: 98.6776 },
  // Titik acuan proyeksi datar lokal (meter) untuk hitungan geometri skala kota.
  acuanProyeksi: { lat: 3.6, lng: 98.67 },
  // Zona waktu bisnis kota (jam dinding pemesanan, sapaan, minggu poin). Tanpa musim panas.
  zonaWaktu: { nama: 'WIB', iana: 'Asia/Jakarta', offset: '+07:00', offsetMs: 7 * 60 * 60 * 1000 },
  nominatim: { countrycodes: 'id' },
  osm: {
    // Relasi batas administratif "Kota Medan" (admin_level 5), untuk koridor jalan utama.
    relasiBatas: 8484616,
    // Penanda di tag network/operator: angkot Medan di OSM banyak bertanda route=bus
    // dengan network "Angkot Kota Medan".
    polaAngkot: /angkot|angkutan kota/i,
    // Awalan kode koridor berdasarkan jaringan (urutan = prioritas).
    awalanJaringan: [
      { pola: /trans\s*metro\s*deli/i, awalan: 'TMD' },
      { pola: /railink/i, awalan: 'RAILINK' },
    ],
  },
  // Koridor jalan utama (tab Estimasi Waktu, Keputusan Final #4). Nama di OSM dicocokkan
  // persis (tanpa beda huruf besar/kecil); jalan layang/akses (mis. "Overpass Jamin
  // Ginting") sengaja tidak ikut. `cari` = kata kunci Overpass (longgar), `pola` = penyaring tepat.
  koridorJalan: [
    { kode: 'GATSU', nama: 'Jl. Gatot Subroto', cari: 'Gatot Subroto', pola: /^Jalan (Jenderal )?Gatot Subroto$/i },
    { kode: 'SMRAJA', nama: 'Jl. Sisingamangaraja', cari: 'Sisingamangaraja', pola: /^Jalan Sisingamangaraja$/i },
    { kode: 'JAMINGINTING', nama: 'Jl. Jamin Ginting', cari: 'Jamin Ginting', pola: /^Jalan Jamin Ginting$/i },
    { kode: 'RINGROAD', nama: 'Jl. Gagak Hitam (Ring Road)', cari: 'Gagak Hitam', pola: /^Jalan Gagak Hitam$/i },
    {
      kode: 'PUTRIHIJAU',
      nama: 'Jl. Putri Hijau – Yos Sudarso',
      cari: 'Putri Hijau|Yos Sudarso',
      pola: /^Jalan (Putri Hijau|K\. ?L\. Yos Sudarso)$/i,
    },
    { kode: 'KATAMSO', nama: 'Jl. Brigjend Katamso', cari: 'Katamso', pola: /^Jalan Brigjen(d)? Katamso$/i },
    {
      kode: 'AHNASUTION',
      nama: 'Jl. A.H. Nasution',
      cari: 'Nasution',
      pola: /^Jalan (Jenderal )?(Abdul Haris|A\. ?H\.) Nasution$/i,
    },
  ],
  /*
   * Tarif bawaan per golongan angkutan (dipakai bila tarif koridor `null`; selalu "perkiraan").
   * Sumber (dicek 19 November 2026):
   * - Bus listrik / Trans Metro Deli: Rp5.000 umum, Keputusan Wali Kota Medan No. 550/16.K,
   *   berlaku 1 Januari 2025 (portal.medan.go.id, Antara Sumut). Pelajar/lansia/difabel
   *   Rp3.000 — belum dipakai karena aplikasi belum membedakan penumpang.
   * - Angkot: aturan tarif resmi terbaru tidak ditemukan. Perwal Medan 24/2013 menetapkan
   *   Rp4.500 per estafet (sudah lama); berita Okt 2022 (program Sibonas) menyebut penumpang
   *   membayar Rp5.000 per estafet. Dipakai Rp5.000 sebagai PERKIRAAN.
   * - Kereta: tarif berbeda per lintas/kelas, tidak ada bawaan (tetap "Tarif belum tersedia").
   */
  tarif: {
    bawaan: {
      bus_listrik: { tarif: 5000, dasar: 'Keputusan Wali Kota Medan No. 550/16.K (berlaku 1 Januari 2025)' },
      angkot: { tarif: 5000, dasar: 'Perkiraan; tarif resmi angkot terbaru tidak ditemukan' },
    },
    // Trans Metro Deli di data OSM ada yang bertanda angkot, jadi dikenali dari
    // kode/operator/nama, bukan dari `jenis`. Bus lain di Medan = angkutan kota.
    golongan: [{ golongan: 'bus_listrik', kode: /^TMD-/i, pola: /trans\s*metro\s*deli|bus\s*listrik/i }],
    golonganLain: 'angkot',
  },
};
