import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import kota, { KOTA, pilihKota } from '../src/cities/index.js';
import { BATAS, dalamWilayah } from '../src/lib/wilayah.js';

describe('config kota (T-112)', () => {
  test('bawaan = Medan dengan batas Mebidang', () => {
    assert.equal(kota.id, 'medan');
    assert.deepEqual(BATAS, { minLat: 3.25, maxLat: 3.9, minLng: 98.35, maxLng: 99.0 });
    assert.ok(dalamWilayah(kota.pusat));
    assert.equal(kota.zonaWaktu.offset, '+07:00');
  });

  test('pilihKota: tidak peka huruf besar, kota tak dikenal ditolak', () => {
    assert.equal(pilihKota('MEDAN'), KOTA.medan);
    assert.throws(() => pilihKota('atlantis'), /Kota tidak dikenal/);
  });

  test('tiap kota punya bentuk config yang sama', () => {
    for (const k of Object.values(KOTA)) {
      for (const f of ['id', 'nama', 'wilayahLayanan', 'batas', 'pusat', 'acuanProyeksi', 'zonaWaktu', 'nominatim', 'osm', 'koridorJalan', 'tarif']) {
        assert.ok(k[f] !== undefined, `${k.id}.${f}`);
      }
    }
  });
});
