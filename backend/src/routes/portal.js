import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolvePatientId } from '../lib/context.js';
import { buildOrdonnancePdf } from '../lib/pdf.js';

const router = Router();
router.use(requireAuth, requireRole('patient'));

// Resout le patient courant ou renvoie une 404 (via la fonction passee en next)
function currentPatient(req, res) {
  const patientId = resolvePatientId(req.user);
  if (!patientId) { res.status(404).json({ error: 'Aucun dossier patient associe a ce compte' }); return null; }
  return patientId;
}

// Espace patient (lecture seule de son propre dossier)
router.get('/dossier', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const consultations = db.prepare(
    'SELECT date, motif, diagnostic FROM consultations WHERE patient_id = ? ORDER BY date DESC'
  ).all(patientId);
  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC'
  ).all(patientId);
  const doctor = db.prepare(`
    SELECT d.specialite, d.cabinet_nom, d.cabinet_tel, u.nom
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(patient.doctor_id);

  res.json({ patient, consultations, prescriptions, doctor });
});

// --- Rendez-vous ---
router.get('/appointments', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  res.json(db.prepare('SELECT id, date, motif, statut FROM appointments WHERE patient_id = ? ORDER BY date DESC').all(patientId));
});

// Demande de RDV (a confirmer par le cabinet) : statut force a 'demande'
const apptSchema = z.object({ date: z.string().min(1), motif: z.string().optional().nullable() });
router.post('/appointments', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  const parsed = apptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides' });
  const patient = db.prepare('SELECT doctor_id FROM patients WHERE id = ?').get(patientId);
  const info = db.prepare(`
    INSERT INTO appointments (patient_id, doctor_id, date, motif, statut, cree_par)
    VALUES (?, ?, ?, ?, 'demande', 'patient')
  `).run(patientId, patient.doctor_id, parsed.data.date, parsed.data.motif ?? null);
  res.status(201).json(db.prepare('SELECT id, date, motif, statut FROM appointments WHERE id = ?').get(info.lastInsertRowid));
});

// --- Documents partages (lecture + telechargement) ---
router.get('/documents', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  res.json(db.prepare('SELECT id, type, filename, mime, date FROM documents WHERE patient_id = ? ORDER BY date DESC').all(patientId));
});

router.get('/documents/:id/download', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  const d = db.prepare('SELECT * FROM documents WHERE id = ? AND patient_id = ?').get(req.params.id, patientId);
  if (!d) return res.status(404).json({ error: 'Document introuvable' });
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${d.filename}"`);
  res.end(Buffer.from(d.data, 'base64'));
});

// Telechargement PDF d'une de ses prescriptions
router.get('/prescriptions/:id/pdf', async (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  const presc = db.prepare('SELECT * FROM prescriptions WHERE id = ? AND patient_id = ?').get(req.params.id, patientId);
  if (!presc) return res.status(404).json({ error: 'Prescription introuvable' });

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const doctor = db.prepare(`
    SELECT u.nom, d.specialite, d.cabinet_nom, d.cabinet_adresse, d.cabinet_tel
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(patient.doctor_id);
  const bytes = await buildOrdonnancePdf({ doctor, patient, prescriptions: [presc], date: presc.date });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ordonnance-${presc.id}.pdf"`);
  res.end(Buffer.from(bytes));
});

export default router;
