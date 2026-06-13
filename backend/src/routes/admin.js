import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const router = Router();
// Interface proprietaire : reservee au role admin
router.use(requireAuth, requireRole('admin'));

// Liste de tous les medecins avec : paiement, acces, nb de patients, derniere activite
router.get('/doctors', (req, res) => {
  const rows = db.prepare(`
    SELECT
      d.id              AS doctor_id,
      d.specialite,
      d.cabinet_nom,
      d.abonnement_statut,
      u.id              AS user_id,
      u.nom,
      u.email,
      u.active,
      u.last_seen,
      u.created_at,
      (SELECT COUNT(*) FROM patients p WHERE p.doctor_id = d.id) AS patients
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    ORDER BY u.nom
  `).all();
  res.json(rows);
});

// Statistiques globales pour l'en-tete du tableau de bord
router.get('/stats', (req, res) => {
  const totalDoctors = db.prepare('SELECT COUNT(*) c FROM doctors').get().c;
  const actifs = db.prepare("SELECT COUNT(*) c FROM users WHERE role='medecin' AND active=1").get().c;
  const payes = db.prepare("SELECT COUNT(*) c FROM doctors WHERE abonnement_statut='paye'").get().c;
  const totalPatients = db.prepare('SELECT COUNT(*) c FROM patients').get().c;
  // "en ligne" = activite dans les 5 dernieres minutes
  const enLigne = db.prepare(
    "SELECT COUNT(*) c FROM users WHERE role='medecin' AND last_seen >= datetime('now','-5 minutes')"
  ).get().c;
  res.json({ totalDoctors, actifs, payes, totalPatients, enLigne });
});

// Met a jour l'acces et/ou le statut de paiement d'un medecin
router.patch('/doctors/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Medecin introuvable' });

  const { active, abonnement_statut } = req.body;

  if (active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, doctor.user_id);
  }
  if (abonnement_statut !== undefined) {
    if (!['paye', 'impaye'].includes(abonnement_statut)) {
      return res.status(400).json({ error: 'Statut de paiement invalide' });
    }
    db.prepare('UPDATE doctors SET abonnement_statut = ? WHERE id = ?').run(abonnement_statut, doctor.id);
  }

  const updated = db.prepare(`
    SELECT d.id AS doctor_id, d.abonnement_statut, u.active, u.nom
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(doctor.id);
  res.json(updated);
});

export default router;
