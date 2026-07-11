import db from '../db.js';

// ─── Cycle d'abonnement J+30 ─────────────────────────────────────────────
// - A la 1ere connexion du medecin : abonnement_debut = aujourd'hui,
//   echeance = J+30, et une premiere facture est emise.
// - J-4 avant l'echeance : rappel affiche a chaque connexion tant que la
//   facture n'est pas reglee.
// - Echeance depassee sans paiement : acces desactive automatiquement.
//   Aucune donnee n'est supprimee ; tout est restaure a la reactivation.
// - Paiement (facture marquee payee par l'admin) : echeance prolongee de 30j.

const MONTANT_DEFAUT = 49;   // EUR / mois (modifiable facture par facture)
const RAPPEL_JOURS = 4;      // rappel a J-4

const today = () => new Date().toISOString().slice(0, 10);

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextInvoiceNumero(year) {
  const n = db.prepare('SELECT COUNT(*) c FROM invoices').get().c + 1;
  return `FAC-${year}-${String(n).padStart(4, '0')}`;
}

function createInvoice(doctorId, dateEmission, debut, fin, montant) {
  db.prepare(`
    INSERT INTO invoices (doctor_id, numero, date_emission, periode_debut, periode_fin, montant, devise, statut, date_paiement)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR', 'impayee', NULL)
  `).run(doctorId, nextInvoiceNumero(dateEmission.slice(0, 4)), dateEmission, debut, fin, montant);
}

// Dernier montant facture (pour reconduire le meme tarif), sinon tarif par defaut.
function lastMontant(doctorId) {
  const r = db.prepare('SELECT montant FROM invoices WHERE doctor_id = ? ORDER BY date_emission DESC LIMIT 1').get(doctorId);
  return r ? r.montant : MONTANT_DEFAUT;
}

// A la premiere connexion : demarre l'abonnement et emet la premiere facture.
export function initSubscription(doctorId) {
  const doc = db.prepare('SELECT abonnement_debut FROM doctors WHERE id = ?').get(doctorId);
  if (!doc || doc.abonnement_debut) return;
  const debut = today();
  const echeance = addDays(debut, 30);
  db.prepare('UPDATE doctors SET abonnement_debut = ?, echeance = ? WHERE id = ?').run(debut, echeance, doctorId);
  const hasInvoice = db.prepare('SELECT 1 FROM invoices WHERE doctor_id = ? LIMIT 1').get(doctorId);
  if (!hasInvoice) createInvoice(doctorId, debut, debut, echeance, MONTANT_DEFAUT);
  console.log(`[ABONNEMENT] Debut d'abonnement doctor #${doctorId} : ${debut} (echeance ${echeance})`);
}

// S'assure qu'une facture impayee existe des qu'on approche de l'echeance,
// pour que le rappel pointe vers une facture concrete.
export function ensureUpcomingInvoice(doctorId) {
  const doc = db.prepare('SELECT echeance FROM doctors WHERE id = ?').get(doctorId);
  if (!doc?.echeance) return;
  if (addDays(today(), RAPPEL_JOURS) < doc.echeance) return; // encore loin de l'echeance
  const unpaid = db.prepare("SELECT 1 FROM invoices WHERE doctor_id = ? AND statut = 'impayee' LIMIT 1").get(doctorId);
  if (!unpaid) createInvoice(doctorId, today(), doc.echeance, addDays(doc.echeance, 30), lastMontant(doctorId));
}

// Etat d'abonnement expose au portail medecin (banniere de rappel).
export function subscriptionInfo(doctorId) {
  const doc = db.prepare('SELECT abonnement_debut, echeance FROM doctors WHERE id = ?').get(doctorId);
  if (!doc?.echeance) return null;
  const joursRestants = Math.ceil((new Date(doc.echeance + 'T00:00') - new Date(today() + 'T00:00')) / 86400000);
  const facture = db.prepare(
    "SELECT numero, montant, devise FROM invoices WHERE doctor_id = ? AND statut = 'impayee' ORDER BY date_emission LIMIT 1"
  ).get(doctorId) || null;
  return {
    debut: doc.abonnement_debut,
    echeance: doc.echeance,
    jours_restants: joursRestants,
    rappel: joursRestants <= RAPPEL_JOURS && !!facture,
    facture,
  };
}

// L'echeance de ce medecin est-elle depassee ? (=> suspension)
export function subscriptionExpired(doctorId) {
  const doc = db.prepare('SELECT echeance FROM doctors WHERE id = ?').get(doctorId);
  return !!doc?.echeance && doc.echeance < today();
}

// Paiement enregistre : prolonge l'echeance de 30 jours.
// Si l'echeance etait deja passee (suspension), on repart d'aujourd'hui.
export function extendOnPayment(doctorId) {
  const doc = db.prepare('SELECT echeance FROM doctors WHERE id = ?').get(doctorId);
  if (!doc) return;
  const base = doc.echeance && doc.echeance >= today() ? doc.echeance : today();
  db.prepare('UPDATE doctors SET echeance = ? WHERE id = ?').run(addDays(base, 30), doctorId);
}

// Desactive les medecins dont l'echeance est depassee (J+30 sans paiement).
// Ne supprime RIEN et ne reactive personne : la reactivation est manuelle (admin).
export function enforceOverdueAccess() {
  const overdue = db.prepare(`
    SELECT u.id AS user_id, u.nom
    FROM doctors d JOIN users u ON u.id = d.user_id
    WHERE d.echeance IS NOT NULL AND d.echeance < date('now') AND u.active = 1
  `).all();
  const stmt = db.prepare('UPDATE users SET active = 0 WHERE id = ?');
  for (const u of overdue) stmt.run(u.user_id);
  if (overdue.length) {
    console.log(`[ABONNEMENT] ${overdue.length} medecin(s) suspendu(s) (echeance depassee) : ${overdue.map((u) => u.nom).join(', ')}`);
  }
  return overdue.length;
}
