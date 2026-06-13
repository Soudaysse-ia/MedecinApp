import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolvePatientId } from '../lib/context.js';

const router = Router();

// Espace patient (lecture seule de son propre dossier)
router.get('/dossier', requireAuth, requireRole('patient'), (req, res) => {
  const patientId = resolvePatientId(req.user);
  if (!patientId) return res.status(404).json({ error: 'Aucun dossier patient associe a ce compte' });

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const consultations = db.prepare(
    'SELECT date, motif, diagnostic FROM consultations WHERE patient_id = ? ORDER BY date DESC'
  ).all(patientId);
  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC'
  ).all(patientId);
  const doctor = db.prepare(`
    SELECT d.specialite, d.cabinet_nom, d.cabinet_tel, u.nom
    FROM doctors d JOIN users u ON u.id = d.user_id
    WHERE d.id = ?
  `).get(patient.doctor_id);

  res.json({ patient, consultations, prescriptions, doctor });
});

export default router;
