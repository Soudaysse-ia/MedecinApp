import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';
import { buildOrdonnancePdf } from '../lib/pdf.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

// Prescriptions en cours d'un patient (pour le controle d'interactions)
function activePrescriptions(patientId, excludeId = null) {
  return db.prepare(
    `SELECT * FROM prescriptions WHERE patient_id = ? AND statut = 'en_cours'${excludeId ? ' AND id != ?' : ''}`
  ).all(...(excludeId ? [patientId, excludeId] : [patientId]));
}

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
function computeAlerts(patient, medicationNom, contreIndications, actives = []) {
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

  // Interaction avec un traitement en cours : le nom d'un medicament actif
  // apparait-il dans les contre-indications du nouveau medicament (ou inversement) ?
  const newName = (medicationNom || '').toLowerCase();
  for (const act of actives) {
    const actName = (act.medication_nom || '').toLowerCase();
    const actRoot = actName.slice(0, Math.max(5, actName.length - 2));
    if (!actRoot) continue;
    const ciHit = ci && ci.includes(actRoot);
    // contre-indications du medicament actif (depuis le catalogue, si disponible)
    let actCi = '';
    if (act.medication_id) {
      const m = db.prepare('SELECT contre_indications FROM medications WHERE id = ?').get(act.medication_id);
      actCi = (m?.contre_indications || '').toLowerCase();
    }
    const reverseHit = actCi && newName && actCi.includes(newName.slice(0, Math.max(5, newName.length - 2)));
    if (ciHit || reverseHit) {
      alerts.push({
        type: 'interaction',
        message: `Interaction possible avec un traitement en cours : "${act.medication_nom}".`,
      });
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
  res.json({ alerts: computeAlerts(patient, nom, ci, activePrescriptions(patientId)) });
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
  const actives = activePrescriptions(d.patient_id, created.id);
  logAudit({ user: req.user, doctorId, action: 'creation_prescription', cible: `patient #${d.patient_id} : ${nom}` });
  res.status(201).json({ prescription: created, alerts: computeAlerts(patient, nom, ci, actives) });
});

// --- Generation PDF ---
// Helper partage : recupere medecin + patient et renvoie le PDF d'une ordonnance.
async function sendOrdonnance(res, doctorId, patientId, prescriptions, filename) {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const doctor = db.prepare(`
    SELECT u.nom, d.specialite, d.cabinet_nom, d.cabinet_adresse, d.cabinet_tel
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(doctorId);
  const date = prescriptions[0]?.date || new Date().toISOString().slice(0, 10);
  const bytes = await buildOrdonnancePdf({ doctor, patient, prescriptions, date });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.end(Buffer.from(bytes));
}

// PDF d'une prescription unique
router.get('/:id/pdf', async (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const presc = db.prepare(`
    SELECT p.* FROM prescriptions p JOIN patients pa ON pa.id = p.patient_id
    WHERE p.id = ? AND pa.doctor_id = ?
  `).get(req.params.id, doctorId);
  if (!presc) return res.status(404).json({ error: 'Prescription introuvable' });
  await sendOrdonnance(res, doctorId, presc.patient_id, [presc], `ordonnance-${presc.id}.pdf`);
});

// PDF de l'ordonnance complete (toutes les prescriptions en cours d'un patient)
router.get('/patient/:patientId/ordonnance.pdf', async (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  if (!patientBelongsToDoctor(req.params.patientId, doctorId)) {
    return res.status(404).json({ error: 'Patient introuvable' });
  }
  const actives = activePrescriptions(req.params.patientId);
  if (actives.length === 0) return res.status(400).json({ error: 'Aucune prescription en cours' });
  await sendOrdonnance(res, doctorId, Number(req.params.patientId), actives, `ordonnance-patient-${req.params.patientId}.pdf`);
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
