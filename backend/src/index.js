import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initSchema } from './db.js';
import { enforceOverdueAccess } from './lib/billing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import consultationRoutes from './routes/consultations.js';
import medicationRoutes from './routes/medications.js';
import prescriptionRoutes from './routes/prescriptions.js';
import vitalsRoutes from './routes/vitals.js';
import appointmentRoutes from './routes/appointments.js';
import vaccinationRoutes from './routes/vaccinations.js';
import documentRoutes from './routes/documents.js';
import templateRoutes from './routes/templates.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import searchRoutes from './routes/search.js';
import portalRoutes from './routes/portal.js';

initSchema();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '15mb' })); // marge pour l'upload de documents (base64)

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/vaccinations', vaccinationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/portal', portalRoutes);

// --- Service du frontend (build Vite) en production ---
// Deploiement mono-service : Express sert l'app React compilee (frontend/dist)
// et renvoie index.html pour toute route non-API (routage cote client).
const FRONTEND_DIST = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  console.log(`Frontend servi depuis ${FRONTEND_DIST}`);
} else {
  console.log('frontend/dist introuvable : mode API seule (lancez `npm run build` cote frontend).');
}

// Gestion d'erreur generique
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// Desactivation automatique des medecins en impaye echu (fin de mois passee) :
// au demarrage puis toutes les 6 heures. La reactivation reste manuelle (admin).
enforceOverdueAccess();
setInterval(enforceOverdueAccess, 6 * 3600 * 1000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API medecin-app demarree sur http://localhost:${PORT}`);
});
