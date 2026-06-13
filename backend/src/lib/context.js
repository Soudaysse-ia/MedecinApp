import db from '../db.js';

// Resout le doctor_id "de travail" pour l'utilisateur courant.
// - medecin    -> son propre doctor.id
// - secretaire -> le doctor.id du medecin auquel elle est rattachee
// - patient    -> null (pas d'acces a la gestion cabinet)
export function resolveDoctorId(user) {
  if (user.role === 'medecin') {
    const row = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id);
    return row ? row.id : null;
  }
  if (user.role === 'secretaire') {
    const row = db.prepare('SELECT doctor_id FROM staff WHERE user_id = ?').get(user.id);
    return row ? row.doctor_id : null;
  }
  return null;
}

// Resout le patient_id pour un compte patient.
export function resolvePatientId(user) {
  if (user.role !== 'patient') return null;
  const row = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id);
  return row ? row.id : null;
}

// Verifie qu'un patient appartient bien au cabinet du medecin/secretaire.
export function patientBelongsToDoctor(patientId, doctorId) {
  const row = db.prepare('SELECT id FROM patients WHERE id = ? AND doctor_id = ?').get(patientId, doctorId);
  return !!row;
}
