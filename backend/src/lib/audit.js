import db from '../db.js';

// Enregistre une entree dans le journal d'audit : qui (user/role), quel cabinet,
// quelle action, sur quelle cible, et quand.
export function logAudit({ user, doctorId = null, action, cible = null }) {
  try {
    db.prepare(
      'INSERT INTO audit_log (user_id, role, doctor_id, action, cible) VALUES (?, ?, ?, ?, ?)'
    ).run(user?.id ?? null, user?.role ?? null, doctorId, action, cible);
  } catch (e) {
    console.error('audit log failed', e);
  }
}
