// Seed de PREMIER DEMARRAGE uniquement.
// Contrairement a `seed.js` (qui vide et recharge la base de facon
// destructive), ce script ne seme QUE si la base est vide. Il est concu
// pour la commande de demarrage en production : au premier deploiement la
// base est vide -> on charge les donnees de demo ; aux deploiements suivants
// les donnees existantes sont preservees.
import db, { initSchema } from './db.js';

initSchema();

const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();

if (n === 0) {
  console.log('Base vide -> chargement des donnees de demonstration initiales.');
  await import('./seed.js');
} else {
  console.log(`Base deja peuplee (${n} utilisateurs) -> seed ignore.`);
}
