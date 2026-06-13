import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  dosage: z.string().optional().nullable(),
  forme: z.string().optional().nullable(),
  posologie_standard: z.string().optional().nullable(),
  contre_indications: z.string().optional().nullable(),
});

// Liste des medicaments du cabinet
router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const rows = db.prepare('SELECT * FROM medications WHERE doctor_id = ? ORDER BY nom').all(doctorId);
  res.json(rows);
});

// La gestion du catalogue (creation/modif/suppression) est reservee au medecin
router.post('/', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  const info = db.prepare(`
    INSERT INTO medications (doctor_id, nom, dosage, forme, posologie_standard, contre_indications)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(doctorId, d.nom, d.dosage ?? null, d.forme ?? null, d.posologie_standard ?? null, d.contre_indications ?? null);
  res.status(201).json(db.prepare('SELECT * FROM medications WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const existing = db.prepare('SELECT * FROM medications WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!existing) return res.status(404).json({ error: 'Medicament introuvable' });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  db.prepare(`
    UPDATE medications SET nom=?, dosage=?, forme=?, posologie_standard=?, contre_indications=?
    WHERE id=?
  `).run(d.nom, d.dosage ?? null, d.forme ?? null, d.posologie_standard ?? null, d.contre_indications ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const existing = db.prepare('SELECT * FROM medications WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!existing) return res.status(404).json({ error: 'Medicament introuvable' });
  db.prepare('DELETE FROM medications WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
