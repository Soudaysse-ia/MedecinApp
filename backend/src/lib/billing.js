import db from '../db.js';

// Un medecin est "en impaye echu" s'il a une facture non reglee dont la periode
// (fin de mois) est deja passee. On retombe sur la date d'emission si la periode
// n'est pas renseignee.
export function doctorHasOverdueInvoice(doctorId) {
  const row = db.prepare(`
    SELECT 1 FROM invoices
    WHERE doctor_id = ? AND statut = 'impayee'
      AND COALESCE(periode_fin, date_emission) < date('now')
    LIMIT 1
  `).get(doctorId);
  return !!row;
}

// Desactive l'acces des medecins ayant une facture echue impayee (fin de mois passee).
// Ne reactive personne : la reactivation est manuelle (admin), apres reglement.
export function enforceOverdueAccess() {
  const overdue = db.prepare(`
    SELECT DISTINCT u.id AS user_id, u.nom
    FROM doctors d
    JOIN invoices i ON i.doctor_id = d.id
    JOIN users u    ON u.id = d.user_id
    WHERE i.statut = 'impayee'
      AND COALESCE(i.periode_fin, i.date_emission) < date('now')
      AND u.active = 1
  `).all();

  const stmt = db.prepare('UPDATE users SET active = 0 WHERE id = ?');
  for (const u of overdue) stmt.run(u.user_id);
  if (overdue.length) {
    console.log(`[FACTURATION] ${overdue.length} medecin(s) desactive(s) (facture echue impayee) : ` +
      overdue.map((u) => u.nom).join(', '));
  }
  return overdue.length;
}
