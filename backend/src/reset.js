// DESTRUCTIF : vide entierement la base (toutes les tables).
// Usage manuel via `npm run reset` (ex. depuis le Shell Render) si l'on veut
// repartir d'une base totalement vierge. Le compte owner est recree au prochain
// demarrage par bootstrap.js (a partir des variables d'environnement).
import db, { initSchema } from './db.js';

initSchema();

db.exec('PRAGMA foreign_keys = OFF');
db.exec(`
  DELETE FROM audit_log;
  DELETE FROM invoices;
  DELETE FROM consultation_templates;
  DELETE FROM documents;
  DELETE FROM vaccinations;
  DELETE FROM appointments;
  DELETE FROM vitals;
  DELETE FROM prescriptions;
  DELETE FROM consultations;
  DELETE FROM medications;
  DELETE FROM patients;
  DELETE FROM doctors;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);
db.exec('PRAGMA foreign_keys = ON');

console.log('[reset] base entierement videe. Le compte owner sera recree au demarrage.');
