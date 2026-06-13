import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin', 'secretaire'));

const schema = z.object({
  nom: z.string().min(1),
  motif: z.string().optional().nullable(),
  contenu: z.string().optional().nullable(),
});

router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  res.json(db.prepare('SELECT * FROM consultation_templates WHERE doctor_id = ? ORDER BY nom').all(doctorId));
});

router.post('/', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  const info = db.prepare('INSERT INTO consultation_templates (doctor_id, nom, motif, contenu) VALUES (?, ?, ?, ?)')
    .run(doctorId, d.nom, d.motif ?? null, d.contenu ?? null);
  res.status(201).json(db.prepare('SELECT * FROM consultation_templates WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const row = db.prepare('SELECT id FROM consultation_templates WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!row) return res.status(404).json({ error: 'Modele introuvable' });
  db.prepare('DELETE FROM consultation_templates WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
