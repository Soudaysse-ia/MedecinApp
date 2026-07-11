import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { resolveDoctorId, resolvePatientId } from '../lib/context.js';
import { doctorHasOverdueInvoice } from '../lib/billing.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  nom: z.string().trim().min(2, 'Nom trop court'),
  email: z.string().email(),
  password: z.string().min(8, 'Mot de passe : 8 caracteres minimum'),
  specialite: z.string().trim().optional(),
  cabinet_nom: z.string().trim().optional(),
  cabinet_adresse: z.string().trim().optional(),
  cabinet_tel: z.string().trim().optional(),
});

// Inscription d'un medecin. Le compte est cree "en_attente" : il ne pourra se
// connecter qu'une fois valide par l'administrateur (owner).
router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Formulaire invalide', details: parsed.error.flatten().fieldErrors });
  }
  const { nom, email, password, specialite, cabinet_nom, cabinet_adresse, cabinet_tel } = parsed.data;
  const em = email.toLowerCase().trim();

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(em)) {
    return res.status(409).json({ error: 'Un compte existe deja avec cet email.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.exec('BEGIN');
  try {
    const info = db.prepare(
      "INSERT INTO users (role, nom, email, password_hash, active) VALUES ('medecin', ?, ?, ?, 1)"
    ).run(nom, em, hash);
    db.prepare(`
      INSERT INTO doctors (user_id, specialite, cabinet_nom, cabinet_adresse, cabinet_tel, statut, abonnement_statut)
      VALUES (?, ?, ?, ?, ?, 'en_attente', 'impaye')
    `).run(info.lastInsertRowid, specialite || null, cabinet_nom || null, cabinet_adresse || null, cabinet_tel || null);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.status(201).json({
    ok: true,
    message: "Compte cree. Il sera actif apres validation par l'administrateur.",
  });
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Email ou mot de passe manquant' });

  const { email, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Un medecin doit avoir ete valide par l'administrateur avant de se connecter.
  if (user.role === 'medecin') {
    const d = db.prepare('SELECT statut FROM doctors WHERE user_id = ?').get(user.id);
    if (d && d.statut === 'en_attente') {
      return res.status(403).json({ error: "Votre compte est en attente de validation par l'administrateur." });
    }
    if (d && d.statut === 'refuse') {
      return res.status(403).json({ error: "Votre inscription a ete refusee. Contactez l'administrateur." });
    }
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Acces desactive. Contactez l\'administrateur pour regulariser votre abonnement.' });
  }

  // Verification a la connexion : un medecin avec une facture echue impayee
  // est desactive immediatement (la reactivation est manuelle, cote admin).
  if (user.role === 'medecin') {
    const doc = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id);
    if (doc && doctorHasOverdueInvoice(doc.id)) {
      db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);
      return res.status(403).json({ error: 'Acces suspendu : facture impayee arrivee a echeance. Contactez l\'administrateur.' });
    }
  }

  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(user.id);
  const token = signToken({ id: user.id, role: user.role, nom: user.nom });
  res.json({ token, user: publicUser(user) });
});

// Renvoie l'utilisateur courant + ids de contexte (doctor_id / patient_id)
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({
    user: publicUser(user),
    doctorId: resolveDoctorId(req.user),
    patientId: resolvePatientId(req.user),
  });
});

function publicUser(u) {
  return { id: u.id, role: u.role, nom: u.nom, email: u.email };
}

export default router;
