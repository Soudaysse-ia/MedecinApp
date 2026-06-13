import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';

const router = Router();
router.use(requireAuth, requireRole('medecin', 'secretaire'));

const schema = z.object({
  patient_id: z.number().int(),
  consultation_id: z.number().int().optional().nullable(),
  medication_id: z.number().int().optional().nullable(),
  medication_nom: z.string().min(1).optional(),
  posologie_specifique: z.string().optional().nullable(),
  duree: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  date: z.string().min(1),
});

// Verifie les alertes d'allergie / contre-indication pour un patient + medicament.
// Expose aussi en GET pour permettre au front d'alerter avant validation.
function computeAlerts(patient, medicationNom, contreIndications) {
  const alerts = [];
  const allergies = (patient.allergies || '').toLowerCase();
  const ci = (contreIndications || '').toLowerCase();

  // Croisement allergies du patient <-> nom du medicament ET ses contre-indications.
  // On compare les racines (5 premiers caracteres) pour rattraper les familles
  // de molecules : "penicilline" <-> "penicillines", "amoxicilline" partage la
  // contre-indication "allergie aux penicillines", etc.
  if (allergies) {
    const haystack = `${(medicationNom || '').toLowerCase()} ${ci}`;
    const allergyTokens = allergies.split(/[\s,;\n]+/).filter((t) => t.length > 3);
    for (const token of allergyTokens) {
      const root = token.slice(0, Math.max(5, token.length - 2));
      if (haystack.includes(root)) {
        alerts.push({
          type: 'allergie',
          message: `Allergie possible : "${medicationNom}" recoupe une allergie declaree du patient ("${token}").`,
        });
        break;
      }
    }
  }

  // Contre-indication vs maladies chroniques
  const chroniques = (patient.maladies_chroniques || '').toLowerCase();
  if (ci && chroniques) {
    for (const token of chroniques.split(/[\s,;\n]+/).filter((t) => t.length > 3)) {
      if (ci.includes(token)) {
        alerts.push({
          type: 'contre_indication',
          message: `Contre-indication possible avec une maladie chronique du patient ("${token}").`,
        });
        break;
      }
    }
  }
  return alerts;
}

// Pre-verification (avant de creer la prescription)
router.get('/alerts', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const patientId = Number(req.query.patient_id);
  const medicationId = req.query.medication_id ? Number(req.query.medication_id) : null;
  const medicationNom = req.query.medication_nom || null;

  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(patientId, doctorId);
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });

  let nom = medicationNom;
  let ci = null;
  if (medicationId) {
    const med = db.prepare('SELECT * FROM medications WHERE id = ? AND doctor_id = ?').get(medicationId, doctorId);
    if (med) { nom = med.nom; ci = med.contre_indications; }
  }
  res.json({ alerts: computeAlerts(patient, nom, ci) });
});

router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;

  if (!patientBelongsToDoctor(d.patient_id, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }

  let nom = d.medication_nom;
  let ci = null;
  if (d.medication_id) {
    const med = db.prepare('SELECT * FROM medications WHERE id = ? AND doctor_id = ?').get(d.medication_id, doctorId);
    if (!med) return res.status(400).json({ error: 'Medicament introuvable' });
    nom = nom || med.nom;
    ci = med.contre_indications;
  }
  if (!nom) return res.status(400).json({ error: 'Medicament requis' });

  const info = db.prepare(`
    INSERT INTO prescriptions
      (patient_id, consultation_id, medication_id, medication_nom, posologie_specifique, duree, instructions, date, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_cours')
  `).run(d.patient_id, d.consultation_id ?? null, d.medication_id ?? null, nom,
    d.posologie_specifique ?? null, d.duree ?? null, d.instructions ?? null, d.date);

  const created = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(info.lastInsertRowid);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(d.patient_id);
  res.status(201).json({ prescription: created, alerts: computeAlerts(patient, nom, ci) });
});

// Changer le statut (en_cours <-> terminee)
router.patch('/:id', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const presc = db.prepare(`
    SELECT p.* FROM prescriptions p
    JOIN patients pa ON pa.id = p.patient_id
    WHERE p.id = ? AND pa.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!presc) return res.status(404).json({ error: 'Prescription introuvable' });

  const statut = req.body.statut;
  if (!['en_cours', 'terminee'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
  db.prepare('UPDATE prescriptions SET statut = ? WHERE id = ?').run(statut, req.params.id);
  res.json(db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(req.params.id));
});

export default router;
