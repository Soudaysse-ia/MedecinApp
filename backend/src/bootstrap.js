// Amorcage de production (idempotent), lance au demarrage du serveur.
//   1. S'assure que le schema existe.
//   2. Supprime les comptes de demonstration (*@demo.test) une bonne fois.
//   3. Cree le compte proprietaire (admin) a partir des variables d'environnement
//      ADMIN_EMAIL / ADMIN_PASSWORD (jamais stockees dans le code).
//
// Aucune donnee fictive n'est inseree : c'est une vraie base de production vide.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db, { initSchema } from './db.js';

initSchema();

// --- 1. Nettoyage des comptes de demonstration -----------------------------
// La suppression des utilisateurs cascade sur doctors -> patients -> dossiers.
const demo = db.prepare("SELECT id FROM users WHERE email LIKE '%@demo.test'").all();
if (demo.length) {
  const del = db.prepare('DELETE FROM users WHERE id = ?');
  db.exec('BEGIN');
  try {
    for (const u of demo) del.run(u.id);
    db.exec('COMMIT');
    console.log(`[bootstrap] ${demo.length} compte(s) de demonstration supprime(s).`);
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('[bootstrap] echec suppression comptes demo :', e.message);
  }
}

// --- 2. Compte proprietaire (owner / admin) --------------------------------
const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || '';
const nom = (process.env.ADMIN_NOM || 'Proprietaire').trim();

if (!email || !password) {
  console.warn('[bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD non definis : aucun compte owner cree.');
} else {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!existing) {
    db.prepare(
      "INSERT INTO users (role, nom, email, password_hash, active) VALUES ('admin', ?, ?, ?, 1)"
    ).run(nom, email, bcrypt.hashSync(password, 10));
    console.log(`[bootstrap] compte owner cree : ${email}`);
  } else if (process.env.ADMIN_RESET_PASSWORD === '1') {
    // Rotation de mot de passe : mettre ADMIN_RESET_PASSWORD=1 le temps d'un deploiement.
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', active = 1 WHERE id = ?")
      .run(bcrypt.hashSync(password, 10), existing.id);
    console.log(`[bootstrap] mot de passe owner mis a jour : ${email}`);
  } else {
    console.log(`[bootstrap] compte owner deja present : ${email}`);
  }
}
