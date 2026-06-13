import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { resolveDoctorId, resolvePatientId } from '../lib/context.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Email ou mot de passe manquant' });

  const { email, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

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
