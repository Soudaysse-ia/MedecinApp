import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

// Recherche + filtres avances
// Query params :
//   q                  -> nom / prenom / numero d'identite
//   maladie_chronique  -> filtre sur le champ maladies_chroniques
//   medicament         -> patients ayant une prescription de ce medicament
//   derniere_avant     -> derniere consultation avant cette date (YYYY-MM-DD)
//   sans_consultation  -> 'true' : patients sans aucune consultation
router.get('/patients', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!doctorId) return res.status(403).json({ error: 'Aucun cabinet associe' });

  const { q, maladie_chronique, medicament, derniere_avant, sans_consultation } = req.query;

  const where = ['p.doctor_id = ?'];
  const params = [doctorId];

  if (q) {
    where.push('(p.nom LIKE ? OR p.prenom LIKE ? OR p.numero_identite LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (maladie_chronique) {
    where.push('p.maladies_chroniques LIKE ?');
    params.push(`%${maladie_chronique}%`);
  }
  if (medicament) {
    where.push(`p.id IN (SELECT patient_id FROM prescriptions WHERE medication_nom LIKE ?)`);
    params.push(`%${medicament}%`);
  }

  let sql = `SELECT p.* FROM patients p WHERE ${where.join(' AND ')} ORDER BY p.nom, p.prenom`;
  let rows = db.prepare(sql).all(...params);

  // Filtres bases sur la derniere consultation (post-traitement pour rester lisible)
  rows = rows.map((p) => {
    const last = db.prepare(
      'SELECT date, motif FROM consultations WHERE patient_id = ? ORDER BY date DESC LIMIT 1'
    ).get(p.id);
    return { ...p, derniere_consultation: last || null };
  });

  if (sans_consultation === 'true') {
    rows = rows.filter((p) => !p.derniere_consultation);
  }
  if (derniere_avant) {
    rows = rows.filter((p) =>
      p.derniere_consultation && p.derniere_consultation.date < derniere_avant
    );
  }

  res.json(rows);
});

export default router;
