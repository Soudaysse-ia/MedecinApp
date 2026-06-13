import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { buildInvoicePdf } from '../lib/pdf.js';

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

  // Enrichit avec dernier paiement et prochaine facture (premiere facture impayee)
  for (const r of rows) {
    r.dernier_paiement = db.prepare(
      "SELECT MAX(date_paiement) m FROM invoices WHERE doctor_id = ? AND statut = 'payee'"
    ).get(r.doctor_id).m;
    r.prochaine_facture = db.prepare(
      "SELECT numero, date_emission, montant, devise FROM invoices WHERE doctor_id = ? AND statut = 'impayee' ORDER BY date_emission LIMIT 1"
    ).get(r.doctor_id) || null;
  }
  res.json(rows);
});

// Factures d'un medecin
router.get('/doctors/:id/invoices', (req, res) => {
  const exists = db.prepare('SELECT id FROM doctors WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Medecin introuvable' });
  res.json(db.prepare('SELECT * FROM invoices WHERE doctor_id = ? ORDER BY date_emission DESC').all(req.params.id));
});

// Telechargement d'une facture en PDF
router.get('/invoices/:id/pdf', async (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
  const doctor = db.prepare(`
    SELECT u.nom, u.email, d.cabinet_nom, d.cabinet_adresse
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(invoice.doctor_id);
  const bytes = await buildInvoicePdf({ invoice, doctor });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="facture-${invoice.numero}.pdf"`);
  res.end(Buffer.from(bytes));
});

// Marque une facture payee / impayee, et recalcule le statut d'abonnement du medecin
router.patch('/invoices/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
  const statut = req.body.statut;
  if (!['payee', 'impayee'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });

  const datePaiement = statut === 'payee' ? (req.body.date_paiement || new Date().toISOString().slice(0, 10)) : null;
  db.prepare('UPDATE invoices SET statut = ?, date_paiement = ? WHERE id = ?').run(statut, datePaiement, invoice.id);

  // Le medecin est "paye" s'il ne reste aucune facture impayee
  const reste = db.prepare("SELECT COUNT(*) c FROM invoices WHERE doctor_id = ? AND statut = 'impayee'").get(invoice.doctor_id).c;
  db.prepare('UPDATE doctors SET abonnement_statut = ? WHERE id = ?').run(reste > 0 ? 'impaye' : 'paye', invoice.doctor_id);

  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id));
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
