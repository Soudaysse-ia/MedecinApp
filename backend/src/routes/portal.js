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

// Constantes du patient (lecture)
router.get('/vitals', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  res.json(db.prepare('SELECT * FROM vitals WHERE patient_id = ? ORDER BY date ASC, id ASC').all(patientId));
});

// Saisie a domicile : le patient ne peut renseigner que poids et glycemie
const homeSchema = z.object({
  date: z.string().min(1),
  poids: z.number().positive().optional().nullable(),
  glycemie: z.number().optional().nullable(),
});
router.post('/vitals', (req, res) => {
  const patientId = currentPatient(req, res);
  if (!patientId) return;
  const parsed = homeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  if (d.poids == null && d.glycemie == null) return res.status(400).json({ error: 'Renseignez au moins le poids ou la glycemie' });
  const info = db.prepare(`
    INSERT INTO vitals (patient_id, date, poids, glycemie, saisi_par)
    VALUES (?, ?, ?, ?, 'patient')
  `).run(patientId, d.date, d.poids ?? null, d.glycemie ?? null);
  res.status(201).json(db.prepare('SELECT * FROM vitals WHERE id = ?').get(info.lastInsertRowid));
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
