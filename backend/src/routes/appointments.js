import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId, patientBelongsToDoctor } from '../lib/context.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('medecin'));

const schema = z.object({
  patient_id: z.number().int(),
  date: z.string().min(1),
  motif: z.string().optional().nullable(),
  statut: z.enum(['demande', 'confirme', 'annule']).optional(),
});

function withPatient(rows) {
  return rows.map((a) => {
    const p = db.prepare('SELECT nom, prenom, telephone FROM patients WHERE id = ?').get(a.patient_id);
    return { ...a, patient: p };
  });
}

// Agenda du cabinet (optionnel ?statut=)
router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const rows = req.query.statut
    ? db.prepare('SELECT * FROM appointments WHERE doctor_id = ? AND statut = ? ORDER BY date').all(doctorId, req.query.statut)
    : db.prepare('SELECT * FROM appointments WHERE doctor_id = ? ORDER BY date').all(doctorId);
  res.json(withPatient(rows));
});

// Rappels a envoyer : RDV confirmes dans les prochaines 48h, non encore rappeles.
// Dans un vrai systeme, un job enverrait ici un email / SMS. On simule (log + flag).
router.get('/reminders', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const now = new Date();
  const horizon = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const due = db.prepare(`
    SELECT * FROM appointments
    WHERE doctor_id = ? AND statut = 'confirme' AND rappel_envoye = 0 AND date <= ? AND date >= ?
    ORDER BY date
  `).all(doctorId, horizon, now.toISOString());

  for (const a of due) {
    const p = db.prepare('SELECT nom, prenom, email, telephone FROM patients WHERE id = ?').get(a.patient_id);
    console.log(`[RAPPEL SIMULE] RDV le ${a.date} -> ${p?.prenom} ${p?.nom} (${p?.email || p?.telephone || 'pas de contact'})`);
    db.prepare('UPDATE appointments SET rappel_envoye = 1 WHERE id = ?').run(a.id);
  }
  res.json({ envoyes: withPatient(due) });
});

router.post('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Donnees invalides', details: parsed.error.flatten() });
  const d = parsed.data;
  if (!patientBelongsToDoctor(d.patient_id, doctorId)) return res.status(404).json({ error: 'Patient introuvable' });

  const info = db.prepare(`
    INSERT INTO appointments (patient_id, doctor_id, date, motif, statut, cree_par)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(d.patient_id, doctorId, d.date, d.motif ?? null, d.statut || 'confirme', req.user.role);
  logAudit({ user: req.user, doctorId, action: 'creation_rdv', cible: `patient #${d.patient_id} @ ${d.date}` });
  res.status(201).json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid));
});

// Modifier (date/motif/statut : confirmer une demande, annuler, replanifier)
router.patch('/:id', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!appt) return res.status(404).json({ error: 'Rendez-vous introuvable' });

  const date = req.body.date ?? appt.date;
  const motif = req.body.motif ?? appt.motif;
  const statut = req.body.statut ?? appt.statut;
  if (!['demande', 'confirme', 'annule'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
  db.prepare('UPDATE appointments SET date = ?, motif = ?, statut = ? WHERE id = ?').run(date, motif, statut, req.params.id);
  logAudit({ user: req.user, doctorId, action: 'modif_rdv', cible: `rdv #${appt.id} -> ${statut}` });
  res.json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?').get(req.params.id, doctorId);
  if (!appt) return res.status(404).json({ error: 'Rendez-vous introuvable' });
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
