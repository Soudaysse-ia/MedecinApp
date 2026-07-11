import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';
import { logAudit } from '../lib/audit.js';
import { buildDossierPdf } from '../lib/pdf.js';

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
router.use(requireAuth, requireRole('medecin'));

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

  logAudit({ user: req.user, doctorId, action: 'consultation_fiche', cible: `patient #${patient.id} (${patient.nom} ${patient.prenom})` });

  // Etat de l'acces a l'espace patient (compte lie)
  const acces = patient.user_id
    ? db.prepare('SELECT email, active, last_seen FROM users WHERE id = ?').get(patient.user_id) || null
    : null;

  res.json({
    ...patient,
    acces,
    derniere_consultation: consultations[0] || null,
    consultations,
    prescriptions,
  });
});

// --- Acces a l'espace patient (compte cree par le medecin) ---

function generatePassword() {
  // Mot de passe lisible : 10 caracteres sans ambiguite (0/O, 1/l...)
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10)).map((b) => chars[b % chars.length]).join('');
}

// Donner l'acces : cree le compte patient et renvoie le mot de passe UNE SEULE FOIS
router.post('/:id/access', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });
  if (patient.user_id) return res.status(400).json({ error: 'Ce patient a deja un acces' });

  const email = (req.body.email || patient.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email valide requis pour creer l\'acces' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: 'Un compte existe deja avec cet email' });
  }

  const password = generatePassword();
  const info = db.prepare(
    "INSERT INTO users (role, nom, email, password_hash) VALUES ('patient', ?, ?, ?)"
  ).run(`${patient.prenom} ${patient.nom}`, email, bcrypt.hashSync(password, 10));
  db.prepare('UPDATE patients SET user_id = ? WHERE id = ?').run(info.lastInsertRowid, patient.id);

  logAudit({ user: req.user, doctorId, action: 'creation_acces_patient', cible: `patient #${patient.id} (${email})` });
  res.status(201).json({ email, password }); // affiche une seule fois, non stocke en clair
});

// Reinitialiser le mot de passe : nouveau mot de passe renvoye UNE SEULE FOIS
router.post('/:id/access/reset', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!patient || !patient.user_id) return res.status(404).json({ error: 'Aucun acces pour ce patient' });

  const password = generatePassword();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), patient.user_id);
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(patient.user_id);

  logAudit({ user: req.user, doctorId, action: 'reset_mdp_patient', cible: `patient #${patient.id}` });
  res.json({ email: u.email, password });
});

// Revoquer l'acces : supprime le compte (le dossier medical est conserve)
router.delete('/:id/access', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!patient || !patient.user_id) return res.status(404).json({ error: 'Aucun acces pour ce patient' });

  db.prepare('UPDATE patients SET user_id = NULL WHERE id = ?').run(patient.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(patient.user_id);

  logAudit({ user: req.user, doctorId, action: 'revocation_acces_patient', cible: `patient #${patient.id}` });
  res.status(204).end();
});

// Export PDF du dossier complet
router.get('/:id/dossier.pdf', async (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });

  const data = {
    doctor: db.prepare('SELECT u.nom FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?').get(doctorId),
    patient,
    consultations: db.prepare('SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC').all(patient.id),
    prescriptions: db.prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC').all(patient.id),
    vitals: db.prepare('SELECT * FROM vitals WHERE patient_id = ? ORDER BY date ASC').all(patient.id),
    vaccinations: db.prepare('SELECT * FROM vaccinations WHERE patient_id = ? ORDER BY date DESC').all(patient.id),
    documents: db.prepare('SELECT id, type, filename, date FROM documents WHERE patient_id = ? ORDER BY date DESC').all(patient.id),
  };
  const bytes = await buildDossierPdf(data);
  logAudit({ user: req.user, doctorId, action: 'export_dossier', cible: `patient #${patient.id}` });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="dossier-${patient.nom}-${patient.id}.pdf"`);
  res.end(Buffer.from(bytes));
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
  logAudit({ user: req.user, doctorId, action: 'creation_patient', cible: `patient #${created.id} (${created.nom} ${created.prenom})` });
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
  logAudit({ user: req.user, doctorId, action: 'modif_patient', cible: `patient #${updated.id} (${updated.nom} ${updated.prenom})` });
  res.json(updated);
});

// Suppression (medecin uniquement)
router.delete('/:id', requireRole('medecin'), (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!patientBelongsToDoctor(req.params.id, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  logAudit({ user: req.user, doctorId, action: 'suppression_patient', cible: `patient #${req.params.id}` });
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
