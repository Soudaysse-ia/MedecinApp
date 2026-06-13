import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin', 'secretaire'));

const schema = z.object({
  patient_id: z.number().int(),
  vaccin: z.string().min(1),
  date: z.string().optional().nullable(),
  rappel_prevu: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patientId = Number(req.query.patient_id);
  if (!patientBelongsToDoctor(patientId, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });
  res.json(db.prepare('SELECT * FROM vaccinations WHERE patient_id = ? ORDER BY date DESC').all(patientId));
});

router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  if (!patientBelongsToDoctor(d.patient_id, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });
  const info = db.prepare(`
    INSERT INTO vaccinations (patient_id, vaccin, date, rappel_prevu, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(d.patient_id, d.vaccin, d.date ?? null, d.rappel_prevu ?? null, d.notes ?? null);
  res.status(201).json(db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const row = db.prepare(`
    SELECT v.* FROM vaccinations v JOIN patients p ON p.id = v.patient_id
    WHERE v.id = ? AND p.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!row) return res.status(404).json({ error: 'Vaccination introuvable' });
  db.prepare('DELETE FROM vaccinations WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
