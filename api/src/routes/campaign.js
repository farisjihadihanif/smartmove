import express from 'express';
import Content from '../models/Content.js';
import Event from '../models/Event.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import {
  JENDELA_EVENT_MS,
  JENIS_KONTEN,
  MAKS_EVENT,
  bacaUmpanBalik,
  eventPublik,
  kirimUmpanBalik,
  kontenPublik,
  umpanBalikPublik,
} from '../services/campaign.js';

// Traffic Mitigation Campaign (PRD §6.5, API_SPECS §2): tips, poster, EventAlert, umpan balik.
export function campaignRouter() {
  const r = express.Router();

  // GET /campaign/contents?jenis=tips|poster → konten aktif, urut `urutan`.
  r.get('/contents', async (req, res) => {
    const { jenis } = req.query;
    if (jenis !== undefined && !JENIS_KONTEN.includes(jenis)) {
      throw httpError(400, `Jenis harus salah satu dari: ${JENIS_KONTEN.join(', ')}`);
    }
    const items = await Content.find({ aktif: true, ...(jenis ? { jenis } : {}) })
      .sort({ urutan: 1, createdAt: 1 })
      .lean();
    res.json({ items: items.map(kontenPublik) });
  });

  // GET /campaign/events → EventAlert yang berlangsung & mendatang (≤ 30 hari), urut mulai.
  r.get('/events', async (req, res) => {
    const now = Date.now();
    const items = await Event.find({
      selesai: { $gte: new Date(now) },
      mulai: { $lte: new Date(now + JENDELA_EVENT_MS) },
    })
      .sort({ mulai: 1 })
      .limit(MAKS_EVENT)
      .lean();
    res.json({ items: items.map((e) => eventPublik(e, now)) });
  });

  // POST /campaign/feedback (wajib masuk).
  r.post('/feedback', requireAuth, async (req, res) => {
    const input = bacaUmpanBalik(req.body || {});
    const fb = await kirimUmpanBalik(req.user, input);
    res.status(201).json({ feedback: umpanBalikPublik(fb) });
  });

  return r;
}
