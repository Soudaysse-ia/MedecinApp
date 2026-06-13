import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin', 'secretaire'));

const schema = z.object({
  patient_id: z.number().int(),
  date: z.string().min(1),
  poids: z.number().positive().optional().nullable(),
  taille: z.number().positive().optional().nullable(),
  tension: z.string().optional().nullable(),
  temperature: z.number().optional().nullable(),
  glycemie: z.number().optional().nullable(),
});

router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patientId = Number(req.query.patient_id);
  if (!patientBelongsToDoctor(patientId, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });
  const rows = db.prepare('SELECT * FROM vitals WHERE patient_id = ? ORDER BY date ASC, id ASC').all(patientId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  if (!patientBelongsToDoctor(d.patient_id, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });

  const info = db.prepare(`
    INSERT INTO vitals (patient_id, date, poids, taille, tension, temperature, glycemie, saisi_par)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(d.patient_id, d.date, d.poids ?? null, d.taille ?? null, d.tension ?? null,
    d.temperature ?? null, d.glycemie ?? null, req.user.role);
  res.status(201).json(db.prepare('SELECT * FROM vitals WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const row = db.prepare(`
    SELECT v.* FROM vitals v JOIN patients p ON p.id = v.patient_id
    WHERE v.id = ? AND p.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!row) return res.status(404).json({ error: 'Mesure introuvable' });
  db.prepare('DELETE FROM vitals WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
