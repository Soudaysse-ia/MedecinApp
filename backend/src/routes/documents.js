import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

const schema = z.object({
  patient_id: z.number().int(),
  type: z.enum(['analyse', 'imagerie', 'compte-rendu', 'autre']).optional(),
  filename: z.string().min(1),
  mime: z.string().optional().nullable(),
  data: z.string().min(1),          // base64
  date: z.string().min(1),
});

// Liste (metadonnees uniquement, sans le contenu)
router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patientId = Number(req.query.patient_id);
  if (!patientBelongsToDoctor(patientId, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });
  res.json(db.prepare(
    'SELECT id, patient_id, type, filename, mime, date, created_at FROM documents WHERE patient_id = ? ORDER BY date DESC'
  ).all(patientId));
});

router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  if (!patientBelongsToDoctor(d.patient_id, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });
  const info = db.prepare(`
    INSERT INTO documents (patient_id, type, filename, mime, data, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(d.patient_id, d.type || 'autre', d.filename, d.mime ?? null, d.data, d.date);
  logAudit({ user: req.user, doctorId, action: 'ajout_document', cible: `patient #${d.patient_id} : ${d.filename}` });
  res.status(201).json(db.prepare('SELECT id, patient_id, type, filename, mime, date FROM documents WHERE id = ?').get(info.lastInsertRowid));
});

// Telechargement du contenu
router.get('/:id/download', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const doc = db.prepare(`
    SELECT d.* FROM documents d JOIN patients p ON p.id = d.patient_id
    WHERE d.id = ? AND p.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  logAudit({ user: req.user, doctorId, action: 'consultation_document', cible: `document #${doc.id} (${doc.filename})` });
  res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.end(Buffer.from(doc.data, 'base64'));
});

router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const doc = db.prepare(`
    SELECT d.id FROM documents d JOIN patients p ON p.id = d.patient_id
    WHERE d.id = ? AND p.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
