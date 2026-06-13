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
  DELETE FROM staff;
  DELETE FROM doctors;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

// --- Utilisateurs ---
const insertUser = db.prepare(
  'INSERT INTO users (role, nom, email, password_hash) VALUES (?, ?, ?, ?)'
);

const medUserId = insertUser.run('medecin', 'Dr Amina Bakary', 'medecin@demo.test', hash('demo1234')).lastInsertRowid;
const secUserId = insertUser.run('secretaire', 'Sophie Martin', 'secretaire@demo.test', hash('demo1234')).lastInsertRowid;

const doctorId = db.prepare(`
  INSERT INTO doctors (user_id, specialite, cabinet_nom, cabinet_adresse, cabinet_tel)
  VALUES (?, 'Medecine generale', 'Cabinet de la Place', '12 rue des Lilas, Moroni', '+269 33 12 345')
`).run(medUserId).lastInsertRowid;

db.prepare('INSERT INTO staff (user_id, doctor_id) VALUES (?, ?)').run(secUserId, doctorId);

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

console.log('Donnees de demonstration inserees.');
console.log('\nComptes de connexion (mot de passe : demo1234) :');
console.log('  Medecin     -> medecin@demo.test');
console.log('  Secretaire  -> secretaire@demo.test');
console.log('  Patient     -> patient@demo.test');
