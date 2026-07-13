import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { buildInvoicePdf } from '../lib/pdf.js';
import { extendOnPayment } from '../lib/billing.js';

const router = Router();
// Interface proprietaire : reservee au role admin
router.use(requireAuth, requireRole('admin'));

// Le statut d'abonnement d'un medecin decoule de ses factures :
// "impaye" s'il reste une facture ECHUE (date d'emission <= aujourd'hui) non reglee.
// Les factures futures (ex. mois a venir) ne rendent pas le medecin impaye.
function recomputeDoctorStatus(doctorId) {
  const reste = db.prepare(
    "SELECT COUNT(*) c FROM invoices WHERE doctor_id = ? AND statut = 'impayee' AND date_emission <= date('now')"
  ).get(doctorId).c;
  db.prepare('UPDATE doctors SET abonnement_statut = ? WHERE id = ?').run(reste > 0 ? 'impaye' : 'paye', doctorId);
}

// Genere un numero de facture du type FAC-YYYY-NNNN
function nextInvoiceNumero(year) {
  const n = db.prepare('SELECT COUNT(*) c FROM invoices').get().c + 1;
  return `FAC-${year}-${String(n).padStart(4, '0')}`;
}

// Liste de tous les medecins avec : paiement, acces, nb de patients, derniere activite
router.get('/doctors', (req, res) => {
  const rows = db.prepare(`
    SELECT
      d.id              AS doctor_id,
      d.specialite,
      d.cabinet_nom,
      d.abonnement_statut,
      d.statut,
      d.abonnement_debut,
      d.echeance,
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

  // Enrichit chaque medecin avec ses indicateurs d'activite et de facturation
  const nowIso = new Date().toISOString();
  for (const r of rows) {
    r.dernier_paiement = db.prepare(
      "SELECT MAX(date_paiement) m FROM invoices WHERE doctor_id = ? AND statut = 'payee'"
    ).get(r.doctor_id).m;
    r.prochaine_facture = db.prepare(
      "SELECT numero, date_emission, montant, devise FROM invoices WHERE doctor_id = ? AND statut = 'impayee' ORDER BY date_emission LIMIT 1"
    ).get(r.doctor_id) || null;
    r.consultations = db.prepare(
      'SELECT COUNT(*) c FROM consultations WHERE doctor_id = ?'
    ).get(r.doctor_id).c;
    r.rdv_a_venir = db.prepare(
      "SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND statut = 'confirme' AND date >= ?"
    ).get(r.doctor_id, nowIso).c;
    r.patients_avec_acces = db.prepare(
      'SELECT COUNT(*) c FROM patients WHERE doctor_id = ? AND user_id IS NOT NULL'
    ).get(r.doctor_id).c;
    r.revenu = db.prepare(
      "SELECT COALESCE(SUM(montant), 0) s FROM invoices WHERE doctor_id = ? AND statut = 'payee'"
    ).get(r.doctor_id).s;
  }
  res.json(rows);
});

// Vue detaillee d'un medecin : identite, abonnement, indicateurs, tendance, activite
router.get('/doctors/:id/overview', (req, res) => {
  const doc = db.prepare(`
    SELECT d.id AS doctor_id, d.specialite, d.cabinet_nom, d.cabinet_adresse, d.cabinet_tel,
           d.abonnement_statut, d.abonnement_debut, d.echeance, d.statut,
           u.nom, u.email, u.active, u.last_seen, u.created_at
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Medecin introuvable' });
  const id = doc.doctor_id;
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;

  const nowIso = new Date().toISOString();
  const kpis = {
    patients: one('SELECT COUNT(*) c FROM patients WHERE doctor_id = ?', id),
    patients_avec_acces: one('SELECT COUNT(*) c FROM patients WHERE doctor_id = ? AND user_id IS NOT NULL', id),
    consultations: one('SELECT COUNT(*) c FROM consultations WHERE doctor_id = ?', id),
    consultations_30j: one("SELECT COUNT(*) c FROM consultations WHERE doctor_id = ? AND date >= date('now','-30 days')", id),
    prescriptions: one('SELECT COUNT(*) c FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id WHERE p.doctor_id = ?', id),
    prescriptions_en_cours: one("SELECT COUNT(*) c FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id WHERE p.doctor_id = ? AND pr.statut = 'en_cours'", id),
    rdv_a_venir: one("SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND statut = 'confirme' AND date >= ?", id, nowIso),
    demandes_rdv: one("SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND statut = 'demande'", id),
    documents: one('SELECT COUNT(*) c FROM documents doc JOIN patients p ON p.id = doc.patient_id WHERE p.doctor_id = ?', id),
    factures_payees: one("SELECT COUNT(*) c FROM invoices WHERE doctor_id = ? AND statut = 'payee'", id),
    factures_impayees: one("SELECT COUNT(*) c FROM invoices WHERE doctor_id = ? AND statut = 'impayee'", id),
    revenu: db.prepare("SELECT COALESCE(SUM(montant),0) s FROM invoices WHERE doctor_id = ? AND statut = 'payee'").get(id).s,
  };

  // Consultations par mois sur les 6 derniers mois (tendance d'activite)
  const parMois = db.prepare(`
    SELECT substr(date, 1, 7) AS mois, COUNT(*) AS c
    FROM consultations
    WHERE doctor_id = ? AND date >= date('now', '-5 months', 'start of month')
    GROUP BY mois ORDER BY mois
  `).all(id);

  // Dernieres actions de ce cabinet (journal d'audit filtre)
  const activite = db.prepare(`
    SELECT a.action, a.cible, a.date, u.nom AS user_nom
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.doctor_id = ?
    ORDER BY a.date DESC, a.id DESC LIMIT 10
  `).all(id);

  res.json({ doctor: doc, kpis, consultations_par_mois: parMois, activite });
});

// Liste des patients (clients) d'un medecin, avec leur activite
router.get('/doctors/:id/patients', (req, res) => {
  const exists = db.prepare('SELECT id FROM doctors WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Medecin introuvable' });
  const rows = db.prepare(`
    SELECT p.id, p.nom, p.prenom, p.date_naissance, p.telephone, p.allergies, p.maladies_chroniques,
           (p.user_id IS NOT NULL) AS a_un_acces,
           (SELECT COUNT(*) FROM consultations c WHERE c.patient_id = p.id) AS nb_consultations,
           (SELECT MAX(date) FROM consultations c WHERE c.patient_id = p.id) AS derniere_consultation
    FROM patients p WHERE p.doctor_id = ? ORDER BY p.nom, p.prenom
  `).all(req.params.id);
  res.json(rows);
});

// Flux d'activite recente sur toute la plateforme (journal d'audit global)
router.get('/activity', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const rows = db.prepare(`
    SELECT a.action, a.cible, a.date, a.role, u.nom AS user_nom, du.nom AS cabinet
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN users du ON du.id = d.user_id
    ORDER BY a.date DESC, a.id DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// Factures d'un medecin
router.get('/doctors/:id/invoices', (req, res) => {
  const exists = db.prepare('SELECT id FROM doctors WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Medecin introuvable' });
  res.json(db.prepare('SELECT * FROM invoices WHERE doctor_id = ? ORDER BY date_emission DESC').all(req.params.id));
});

// Emettre une nouvelle facture (l'admin choisit les dates et le montant)
router.post('/doctors/:id/invoices', (req, res) => {
  const doctor = db.prepare('SELECT id FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Medecin introuvable' });

  const { date_emission, periode_debut, periode_fin, montant, devise } = req.body;
  if (!date_emission) return res.status(400).json({ error: "Date d'emission requise" });
  const m = Number(montant);
  if (!(m >= 0)) return res.status(400).json({ error: 'Montant invalide' });

  const numero = (req.body.numero && String(req.body.numero).trim()) || nextInvoiceNumero(date_emission.slice(0, 4));
  const info = db.prepare(`
    INSERT INTO invoices (doctor_id, numero, date_emission, periode_debut, periode_fin, montant, devise, statut, date_paiement)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'impayee', NULL)
  `).run(doctor.id, numero, date_emission, periode_debut || null, periode_fin || null, m, devise || 'EUR');

  recomputeDoctorStatus(doctor.id);
  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid));
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

// Met a jour une facture : statut/date de paiement ET/OU dates + montant
router.patch('/invoices/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

  const b = req.body;
  // Champs editables (dates et montant choisis par l'admin)
  const date_emission = b.date_emission ?? invoice.date_emission;
  const periode_debut = b.periode_debut !== undefined ? b.periode_debut : invoice.periode_debut;
  const periode_fin   = b.periode_fin   !== undefined ? b.periode_fin   : invoice.periode_fin;
  const montant       = b.montant !== undefined ? Number(b.montant) : invoice.montant;
  const devise        = b.devise ?? invoice.devise;
  if (!(montant >= 0)) return res.status(400).json({ error: 'Montant invalide' });

  // Statut + date de paiement (l'admin peut choisir la date)
  let statut = invoice.statut;
  let date_paiement = invoice.date_paiement;
  if (b.statut !== undefined) {
    if (!['payee', 'impayee'].includes(b.statut)) return res.status(400).json({ error: 'Statut invalide' });
    statut = b.statut;
    date_paiement = statut === 'payee'
      ? (b.date_paiement || invoice.date_paiement || new Date().toISOString().slice(0, 10))
      : null;
  } else if (b.date_paiement !== undefined && statut === 'payee') {
    date_paiement = b.date_paiement;
  }

  // Paiement enregistre -> l'echeance d'abonnement est prolongee de 30 jours
  // (la notification de rappel disparait alors cote portail medecin).
  if (invoice.statut === 'impayee' && statut === 'payee') {
    extendOnPayment(invoice.doctor_id);
  }

  db.prepare(`
    UPDATE invoices SET date_emission=?, periode_debut=?, periode_fin=?, montant=?, devise=?, statut=?, date_paiement=?
    WHERE id=?
  `).run(date_emission, periode_debut, periode_fin, montant, devise, statut, date_paiement, invoice.id);

  recomputeDoctorStatus(invoice.doctor_id);
  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id));
});

// Supprimer une facture
router.delete('/invoices/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);
  recomputeDoctorStatus(invoice.doctor_id);
  res.status(204).end();
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
  const enAttente = db.prepare("SELECT COUNT(*) c FROM doctors WHERE statut='en_attente'").get().c;
  const totalConsultations = db.prepare('SELECT COUNT(*) c FROM consultations').get().c;
  const rdvAVenir = db.prepare(
    "SELECT COUNT(*) c FROM appointments WHERE statut='confirme' AND date >= ?"
  ).get(new Date().toISOString()).c;
  const revenuEncaisse = db.prepare("SELECT COALESCE(SUM(montant),0) s FROM invoices WHERE statut='payee'").get().s;
  const revenuEnAttente = db.prepare("SELECT COALESCE(SUM(montant),0) s FROM invoices WHERE statut='impayee'").get().s;
  res.json({
    totalDoctors, actifs, payes, totalPatients, enLigne, enAttente,
    totalConsultations, rdvAVenir, revenuEncaisse, revenuEnAttente,
  });
});

// Met a jour l'acces et/ou le statut de paiement d'un medecin
router.patch('/doctors/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Medecin introuvable' });

  // Le statut de paiement decoule des factures (gere via les routes /invoices).
  // Ici on gere : l'acces a la plateforme (active) et la validation (statut).
  const { active, statut } = req.body;
  if (active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, doctor.user_id);
  }
  if (statut !== undefined) {
    if (!['en_attente', 'valide', 'refuse'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    db.prepare('UPDATE doctors SET statut = ? WHERE id = ?').run(statut, doctor.id);
  }

  const updated = db.prepare(`
    SELECT d.id AS doctor_id, d.abonnement_statut, d.statut, u.active, u.nom
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `).get(doctor.id);
  res.json(updated);
});

export default router;
