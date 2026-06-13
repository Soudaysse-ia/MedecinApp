import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

const schema = z.object({
  patient_id: z.number().int(),
  date: z.string().min(1),
  motif: z.string().optional().nullable(),
  diagnostic: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Ajoute une consultation.
router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });

  const d = parsed.data;
  if (!patientBelongsToDoctor(d.patient_id, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }

  const info = db.prepare(`
    INSERT INTO consultations (patient_id, doctor_id, date, motif, diagnostic, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(d.patient_id, doctorId, d.date, d.motif ?? null, d.diagnostic ?? null, d.notes ?? null);

  res.status(201).json(db.prepare('SELECT * FROM consultations WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const row = db.prepare('SELECT * FROM consultations WHERE id = ? AND doctor_id = ?')
    .get(req.params.id, doctorId);
  if (!row) return res.status(404).json({ error: 'Consultation introuvable' });
  db.prepare('DELETE FROM consultations WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
