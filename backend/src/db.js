import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

// Utilise le module SQLite integre a Node (node:sqlite) : aucune compilation
// native requise. API tres proche de better-sqlite3 (prepare/run/get/all).
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Schema ecrit en SQL portable (compatible PostgreSQL moyennant des ajustements
// mineurs : AUTOINCREMENT -> SERIAL, TEXT -> VARCHAR, etc.).
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL CHECK (role IN ('medecin','patient','secretaire')),
      nom           TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      specialite      TEXT,
      cabinet_nom     TEXT,
      cabinet_adresse TEXT,
      cabinet_tel     TEXT
    );

    -- Une secretaire est rattachee a un medecin
    CREATE TABLE IF NOT EXISTS staff (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS patients (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
      doctor_id          INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      nom                TEXT NOT NULL,
      prenom             TEXT NOT NULL,
      date_naissance     TEXT,
      sexe               TEXT CHECK (sexe IN ('M','F','Autre') OR sexe IS NULL),
      numero_identite    TEXT,
      telephone          TEXT,
      email              TEXT,
      adresse            TEXT,
      contact_urgence    TEXT,
      photo_url          TEXT,
      allergies          TEXT,          -- texte libre (liste separee par des retours ligne)
      maladies_chroniques TEXT,         -- texte libre
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      date       TEXT NOT NULL,
      motif      TEXT,
      diagnostic TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medications (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id          INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      nom                TEXT NOT NULL,
      dosage             TEXT,
      forme              TEXT,
      posologie_standard TEXT,
      contre_indications TEXT
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      consultation_id      INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
      medication_id        INTEGER REFERENCES medications(id) ON DELETE SET NULL,
      medication_nom       TEXT NOT NULL,   -- copie au moment de la prescription
      posologie_specifique TEXT,
      duree                TEXT,
      instructions         TEXT,
      date                 TEXT NOT NULL,
      statut               TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','terminee')),
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_medications_doctor ON medications(doctor_id);
  `);
}

export default db;
