import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';

const router = Router();

const patientSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prenom requis'),
  date_naissance: z.string().optional().nullable(),
  sexe: z.enum(['M', 'F', 'Autre']).optional().nullable(),
  numero_identite: z.string().optional().nullable(),
  telephone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  adresse: z.string().optional().nullable(),
  contact_urgence: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  maladies_chroniques: z.string().optional().nullable(),
});

// Toutes les routes ci-dessous sont reservees au personnel du cabinet
router.use(requireAuth, requireRole('medecin', 'secretaire'));

// Liste des patients du cabinet (recherche simple via ?q=)
router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!doctorId) return res.status(403).json({ error: 'Aucun cabinet associe' });

  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT * FROM patients
      WHERE doctor_id = ?
        AND (nom LIKE ? OR prenom LIKE ? OR numero_identite LIKE ?)
      ORDER BY nom, prenom
    `).all(doctorId, like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM patients WHERE doctor_id = ? ORDER BY nom, prenom').all(doctorId);
  }
  res.json(rows.map(withDerniereConsultation));
});

// Fiche complete d'un patient
router.get('/:id', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?')
    .get(req.params.id, doctorId);
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });

  const consultations = db.prepare(
    'SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC'
  ).all(patient.id);
  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC'
  ).all(patient.id);

  res.json({
    ...patient,
    derniere_consultation: consultations[0] || null,
    consultations,
    prescriptions,
  });
});

// Creation
router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!doctorId) return res.status(403).json({ error: 'Aucun cabinet associe' });

  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const info = db.prepare(`
    INSERT INTO patients
      (doctor_id, nom, prenom, date_naissance, sexe, numero_identite, telephone, email,
       adresse, contact_urgence, photo_url, allergies, maladies_chroniques)
    VALUES (@doctor_id, @nom, @prenom, @date_naissance, @sexe, @numero_identite, @telephone,
            @email, @adresse, @contact_urgence, @photo_url, @allergies, @maladies_chroniques)
  `).run({ doctor_id: doctorId, ...normalize(d) });

  const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// Mise a jour
router.put('/:id', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!patientBelongsToDoctor(req.params.id, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  }
  const d = normalize(parsed.data);
  db.prepare(`
    UPDATE patients SET
      nom=@nom, prenom=@prenom, date_naissance=@date_naissance, sexe=@sexe,
      numero_identite=@numero_identite, telephone=@telephone, email=@email,
      adresse=@adresse, contact_urgence=@contact_urgence, photo_url=@photo_url,
      allergies=@allergies, maladies_chroniques=@maladies_chroniques
    WHERE id=@id
  `).run({ id: Number(req.params.id), ...d });

  const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Suppression (medecin uniquement)
router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!patientBelongsToDoctor(req.params.id, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

function normalize(d) {
  // Convertit les champs optionnels manquants en null pour SQLite
  const keys = ['date_naissance', 'sexe', 'numero_identite', 'telephone', 'email',
    'adresse', 'contact_urgence', 'photo_url', 'allergies', 'maladies_chroniques'];
  const out = { nom: d.nom, prenom: d.prenom };
  for (const k of keys) out[k] = d[k] === undefined || d[k] === '' ? null : d[k];
  return out;
}

function withDerniereConsultation(patient) {
  const last = db.prepare(
    'SELECT date, motif FROM consultations WHERE patient_id = ? ORDER BY date DESC LIMIT 1'
  ).get(patient.id);
  return { ...patient, derniere_consultation: last || null };
}

export default router;
