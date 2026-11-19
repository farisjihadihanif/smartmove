import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TARIF_BAWAAN, golonganTarif, tarifKoridor } from '../src/services/tarif.js';

describe('tarif bawaan', () => {
  test('golongan: TMD dikenali walau bertanda angkot; kereta tanpa bawaan', () => {
    assert.equal(golonganTarif({ kode: 'TMD-K1M', jenis: 'angkot' }), 'bus_listrik');
    assert.equal(golonganTarif({ kode: 'X', jenis: 'angkot', operator: 'TRANS METRO DELI' }), 'bus_listrik');
    assert.equal(golonganTarif({ kode: 'BUS-4', jenis: 'bus', nama: 'KPUM 4' }), 'angkot');
    assert.equal(golonganTarif({ kode: 'KA-1', jenis: 'kereta' }), null);
  });

  test('bus listrik Rp5.000 sesuai Kepwal 550/16.K, tetap ditandai perkiraan', () => {
    assert.equal(TARIF_BAWAAN.bus_listrik.tarif, 5000);
    assert.match(TARIF_BAWAAN.bus_listrik.dasar, /550\/16\.K/);
    assert.deepEqual(tarifKoridor({ kode: 'TMD-K1', jenis: 'bus', tarif: null }), { tarif: 5000, tarifPerkiraan: true });
  });

  test('tarif admin dipakai apa adanya; tarif OSM tetap perkiraan; kereta kosong', () => {
    assert.deepEqual(tarifKoridor({ jenis: 'angkot', tarif: 6000, tarifSumber: 'admin' }), { tarif: 6000, tarifPerkiraan: false });
    assert.deepEqual(tarifKoridor({ jenis: 'angkot', tarif: 6000, tarifSumber: 'osm' }), { tarif: 6000, tarifPerkiraan: true });
    assert.deepEqual(tarifKoridor({ jenis: 'angkot', tarif: null }), { tarif: TARIF_BAWAAN.angkot.tarif, tarifPerkiraan: true });
    assert.deepEqual(tarifKoridor({ jenis: 'kereta', tarif: null }), { tarif: null, tarifPerkiraan: false });
  });
});
