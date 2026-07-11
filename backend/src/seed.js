// Insere des donnees FICTIVES de demonstration.
// Lancer avec : npm run seed
import bcrypt from 'bcryptjs';
import db, { initSchema } from './db.js';

initSchema();

console.log('Reinitialisation des donnees de demonstration...');

// On vide tout pour un seed reproductible
db.exec(`
  DELETE FROM prescriptions;
  DELETE FROM consultations;
  DELETE FROM medications;
  DELETE FROM patients;
  DELETE FROM doctors;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

// --- Utilisateurs ---
const insertUser = db.prepare(
  'INSERT INTO users (role, nom, email, password_hash) VALUES (?, ?, ?, ?)'
);

// Proprietaire de la plateforme (interface admin)
insertUser.run('admin', 'Owner (Admin)', 'admin@demo.test', hash('demo1234'));

const medUserId = insertUser.run('medecin', 'Dr Amina Bakary', 'medecin@demo.test', hash('demo1234')).lastInsertRowid;

// Dates d'abonnement relatives a aujourd'hui pour une demo parlante
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Dr Amina : abonnement demarre il y a 27 jours -> echeance dans 3 jours
// (la banniere de rappel J-4 est visible, facture de juillet impayee)
const doctorId = db.prepare(`
  INSERT INTO doctors (user_id, specialite, cabinet_nom, cabinet_adresse, cabinet_tel, abonnement_statut, abonnement_debut, echeance)
  VALUES (?, 'Medecine generale', 'Cabinet de la Place', '12 rue des Lilas, Moroni', '+269 33 12 345', 'paye', ?, ?)
`).run(medUserId, addDays(-27), addDays(3)).lastInsertRowid;

// Dr Omar : echeance depassee depuis 10 jours -> suspension automatique
const med2UserId = insertUser.run('medecin', 'Dr Omar Said', 'medecin2@demo.test', hash('demo1234')).lastInsertRowid;
const doctor2Id = db.prepare(`
  INSERT INTO doctors (user_id, specialite, cabinet_nom, cabinet_adresse, cabinet_tel, abonnement_statut, abonnement_debut, echeance)
  VALUES (?, 'Pediatrie', 'Cabinet du Lagon', '3 bd Maritime, Mutsamudu', '+269 33 98 765', 'impaye', ?, ?)
`).run(med2UserId, addDays(-40), addDays(-10)).lastInsertRowid;

// --- Patients (dont un avec compte personnel) ---
const patUserId = insertUser.run('patient', 'Yssouf Said', 'patient@demo.test', hash('demo1234')).lastInsertRowid;

const insertPatient = db.prepare(`
  INSERT INTO patients
    (user_id, doctor_id, nom, prenom, date_naissance, sexe, numero_identite, telephone, email,
     adresse, contact_urgence, allergies, maladies_chroniques)
  VALUES (@user_id, @doctor_id, @nom, @prenom, @date_naissance, @sexe, @numero_identite, @telephone,
          @email, @adresse, @contact_urgence, @allergies, @maladies_chroniques)
`);

const p1 = insertPatient.run({
  user_id: patUserId, doctor_id: doctorId, nom: 'Said', prenom: 'Yssouf',
  date_naissance: '1985-04-12', sexe: 'M', numero_identite: 'CNI-100245', telephone: '+269 44 11 222',
  email: 'patient@demo.test', adresse: '5 avenue du Port, Moroni', contact_urgence: 'Fatima Said +269 44 99 888',
  allergies: 'Penicilline\nArachides', maladies_chroniques: 'Hypertension arterielle',
}).lastInsertRowid;

const p2 = insertPatient.run({
  user_id: null, doctor_id: doctorId, nom: 'Abdou', prenom: 'Nadia',
  date_naissance: '1992-09-30', sexe: 'F', numero_identite: 'CNI-203381', telephone: '+269 44 55 666',
  email: 'nadia.abdou@demo.test', adresse: '18 rue Magoudjou, Moroni', contact_urgence: 'Ali Abdou +269 44 77 111',
  allergies: null, maladies_chroniques: 'Diabete de type 2',
}).lastInsertRowid;

const p3 = insertPatient.run({
  user_id: null, doctor_id: doctorId, nom: 'Mhadji', prenom: 'Karim',
  date_naissance: '1970-01-05', sexe: 'M', numero_identite: 'CNI-309912', telephone: '+269 44 33 444',
  email: null, adresse: 'Mitsamiouli', contact_urgence: null,
  allergies: 'Aspirine', maladies_chroniques: null,
}).lastInsertRowid;

// Patients du second medecin (Dr Omar Said)
insertPatient.run({
  user_id: null, doctor_id: doctor2Id, nom: 'Combo', prenom: 'Inaya',
  date_naissance: '2018-02-20', sexe: 'F', numero_identite: 'CNI-410022', telephone: '+269 44 22 880',
  email: null, adresse: 'Mutsamudu', contact_urgence: 'Halima Combo +269 44 22 881',
  allergies: null, maladies_chroniques: null,
});
insertPatient.run({
  user_id: null, doctor_id: doctor2Id, nom: 'Bacar', prenom: 'Nassim',
  date_naissance: '2015-11-03', sexe: 'M', numero_identite: 'CNI-410099', telephone: '+269 44 22 770',
  email: null, adresse: 'Mutsamudu', contact_urgence: null,
  allergies: null, maladies_chroniques: 'Asthme',
});

// --- Medicaments (catalogue du cabinet) ---
const insertMed = db.prepare(`
  INSERT INTO medications (doctor_id, nom, dosage, forme, posologie_standard, contre_indications)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const mAmox = insertMed.run(doctorId, 'Amoxicilline', '500 mg', 'Gelule', '1 gelule x3/jour pendant 7 jours', 'Allergie aux penicillines').lastInsertRowid;
const mParac = insertMed.run(doctorId, 'Paracetamol', '1000 mg', 'Comprime', '1 cp x3/jour si douleur', 'Insuffisance hepatique grave').lastInsertRowid;
insertMed.run(doctorId, 'Metformine', '850 mg', 'Comprime', '1 cp x2/jour aux repas', 'Insuffisance renale severe');
const mIbu = insertMed.run(doctorId, 'Ibuprofene', '400 mg', 'Comprime', '1 cp x3/jour apres repas', 'Hypertension non controlee, ulcere').lastInsertRowid;

// --- Consultations ---
const insertConsult = db.prepare(`
  INSERT INTO consultations (patient_id, doctor_id, date, motif, diagnostic, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertConsult.run(p1, doctorId, '2026-05-20', 'Controle tension', 'HTA stable', 'Maintien du traitement. Revoir dans 3 mois.');
const c1 = insertConsult.run(p1, doctorId, '2026-06-02', 'Angine', 'Angine bacterienne', 'Prescription antibiotique.').lastInsertRowid;
insertConsult.run(p2, doctorId, '2026-06-08', 'Suivi diabete', 'Glycemie elevee', 'Ajustement du traitement.');
insertConsult.run(p3, doctorId, '2026-03-15', 'Lombalgie', 'Lombalgie aigue', 'Repos + antalgiques.');

// --- Prescriptions ---
const insertPresc = db.prepare(`
  INSERT INTO prescriptions
    (patient_id, consultation_id, medication_id, medication_nom, posologie_specifique, duree, instructions, date, statut)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertPresc.run(p1, c1, mParac, 'Paracetamol', '1 cp matin/midi/soir', '5 jours', 'Si fievre ou douleur', '2026-06-02', 'en_cours');
insertPresc.run(p2, null, null, 'Metformine', '1 cp x2/jour', '3 mois', 'A prendre pendant les repas', '2026-06-08', 'en_cours');
insertPresc.run(p3, null, mIbu, 'Ibuprofene', '1 cp x3/jour', '5 jours', 'Apres les repas', '2026-03-15', 'terminee');

// --- Constantes (vitals) ---
const insertVital = db.prepare(`
  INSERT INTO vitals (patient_id, date, poids, taille, tension, temperature, glycemie, saisi_par)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
// Yssouf (HTA) : suivi tension + poids
insertVital.run(p1, '2026-02-10', 82.0, 178, '145/92', 36.8, null, 'medecin');
insertVital.run(p1, '2026-04-05', 81.0, 178, '138/88', 36.7, null, 'medecin');
insertVital.run(p1, '2026-05-20', 80.2, 178, '135/85', 36.9, null, 'medecin');
insertVital.run(p1, '2026-06-09', 79.5, null, null, null, null, 'patient'); // saisie domicile
// Nadia (diabete) : suivi glycemie + poids
insertVital.run(p2, '2026-03-01', 68.0, 165, '120/78', 36.6, 1.45, 'medecin');
insertVital.run(p2, '2026-05-15', 67.0, 165, '118/76', 36.7, 1.62, 'medecin');
insertVital.run(p2, '2026-06-08', 66.5, 165, '119/77', 36.6, 1.38, 'medecin');
insertVital.run(p2, '2026-06-11', null, null, null, null, 1.30, 'patient'); // saisie domicile

// --- Rendez-vous ---
const insertAppt = db.prepare(`
  INSERT INTO appointments (patient_id, doctor_id, date, motif, statut, cree_par)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16); // dans 24h
insertAppt.run(p1, doctorId, soon, 'Controle tension', 'confirme', 'medecin');
insertAppt.run(p2, doctorId, '2026-06-25T10:30', 'Suivi diabete', 'confirme', 'medecin');
insertAppt.run(p1, doctorId, '2026-07-02T09:00', 'Renouvellement ordonnance', 'demande', 'patient'); // demande a confirmer

// --- Vaccinations ---
const insertVac = db.prepare('INSERT INTO vaccinations (patient_id, vaccin, date, rappel_prevu, notes) VALUES (?, ?, ?, ?, ?)');
insertVac.run(p1, 'Tetanos (dTP)', '2020-03-15', '2030-03-15', 'Rappel decennal');
insertVac.run(p1, 'Grippe saisonniere', '2025-10-12', '2026-10-01', null);
insertVac.run(p2, 'Hepatite B', '2018-06-01', null, 'Schema complet');

// --- Document joint (petit PDF fictif encode en base64) ---
const fakePdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');
db.prepare('INSERT INTO documents (patient_id, type, filename, mime, data, date) VALUES (?, ?, ?, ?, ?, ?)')
  .run(p1, 'analyse', 'bilan-sanguin-2026-05.pdf', 'application/pdf', fakePdf, '2026-05-18');

// --- Modele de consultation ---
db.prepare('INSERT INTO consultation_templates (doctor_id, nom, motif, contenu) VALUES (?, ?, ?, ?)')
  .run(doctorId, 'Controle HTA', 'Controle tension', 'TA mesuree : __/__\nObservance traitement : oui/non\nEffets indesirables : \nConduite a tenir : ');
db.prepare('INSERT INTO consultation_templates (doctor_id, nom, motif, contenu) VALUES (?, ?, ?, ?)')
  .run(doctorId, 'Suivi diabete', 'Suivi diabete', 'Glycemie a jeun : \nHbA1c : \nPoids : \nObservance : \nAdaptation traitement : ');

// --- Factures d'abonnement ---
const insertInvoice = db.prepare(`
  INSERT INTO invoices (doctor_id, numero, date_emission, periode_debut, periode_fin, montant, devise, statut, date_paiement)
  VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, ?)
`);
// Dr Amina (a jour) : 3 factures payees + 1 a venir impayee
insertInvoice.run(doctorId, 'FAC-2026-0001', '2026-04-01', '2026-04-01', '2026-04-30', 49, 'payee', '2026-04-03');
insertInvoice.run(doctorId, 'FAC-2026-0002', '2026-05-01', '2026-05-01', '2026-05-31', 49, 'payee', '2026-05-02');
insertInvoice.run(doctorId, 'FAC-2026-0003', '2026-06-01', '2026-06-01', '2026-06-30', 49, 'payee', '2026-06-04');
insertInvoice.run(doctorId, 'FAC-2026-0004', '2026-07-01', '2026-07-01', '2026-07-31', 49, 'impayee', null);
// Dr Omar (impaye) : facture du mois en cours non reglee
insertInvoice.run(doctor2Id, 'FAC-2026-0005', '2026-06-01', '2026-06-01', '2026-06-30', 39, 'impayee', null);

console.log('Donnees de demonstration inserees.');
console.log('\nComptes de connexion (mot de passe : demo1234) :');
console.log('  Admin    -> admin@demo.test');
console.log('  Medecin  -> medecin@demo.test   (abonnement paye)');
console.log('  Medecin2 -> medecin2@demo.test  (abonnement impaye)');
console.log('  Patient  -> patient@demo.test');
