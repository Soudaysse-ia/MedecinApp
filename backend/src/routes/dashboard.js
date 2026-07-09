import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

// Tableau de bord du medecin : compteurs + RDV du jour + demandes + patients recents
router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!doctorId) return res.status(403).json({ error: 'Aucun cabinet associe' });

  const today = new Date().toISOString().slice(0, 10);

  const counts = {
    patients: db.prepare('SELECT COUNT(*) c FROM patients WHERE doctor_id = ?').get(doctorId).c,
    rdv_aujourdhui: db.prepare(
      "SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND statut = 'confirme' AND date LIKE ? || '%'"
    ).get(doctorId, today).c,
    demandes_en_attente: db.prepare(
      "SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND statut = 'demande'"
    ).get(doctorId).c,
    prescriptions_en_cours: db.prepare(`
      SELECT COUNT(*) c FROM prescriptions pr
      JOIN patients p ON p.id = pr.patient_id
      WHERE p.doctor_id = ? AND pr.statut = 'en_cours'
    `).get(doctorId).c,
  };

  const withPatient = (rows) => rows.map((a) => ({
    ...a,
    patient: db.prepare('SELECT id, nom, prenom FROM patients WHERE id = ?').get(a.patient_id),
  }));

  const rdv_du_jour = withPatient(db.prepare(
    "SELECT * FROM appointments WHERE doctor_id = ? AND statut = 'confirme' AND date LIKE ? || '%' ORDER BY date"
  ).all(doctorId, today));

  const prochains_rdv = withPatient(db.prepare(
    "SELECT * FROM appointments WHERE doctor_id = ? AND statut = 'confirme' AND date > ? || 'T23:59' ORDER BY date LIMIT 5"
  ).all(doctorId, today));

  const demandes = withPatient(db.prepare(
    "SELECT * FROM appointments WHERE doctor_id = ? AND statut = 'demande' ORDER BY date LIMIT 5"
  ).all(doctorId));

  // Derniers patients vus (par date de consultation la plus recente)
  const patients_recents = db.prepare(`
    SELECT p.id, p.nom, p.prenom, p.allergies, MAX(c.date) AS derniere_consultation
    FROM patients p JOIN consultations c ON c.patient_id = p.id
    WHERE p.doctor_id = ?
    GROUP BY p.id ORDER BY derniere_consultation DESC LIMIT 5
  `).all(doctorId);

  res.json({ counts, rdv_du_jour, prochains_rdv, demandes, patients_recents });
});

export default router;
