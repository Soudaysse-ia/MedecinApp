import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { resolveDoctorId } from '../lib/context.js';

const router = Router();
// Journal d'audit reserve au medecin (responsable du cabinet)
router.use(requireAuth, requireRole('medecin'));

router.get('/', (req, res) => {
  const doctorId = resolveDoctorId(req.user);
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  // Entrees rattachees au cabinet OU produites par l'utilisateur courant
  const rows = db.prepare(`
    SELECT a.*, u.nom AS user_nom
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.doctor_id = ? OR a.user_id = ?
    ORDER BY a.date DESC, a.id DESC
    LIMIT ?
  `).all(doctorId, req.user.id, limit);
  res.json(rows);
});

export default router;
