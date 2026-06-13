import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initSchema } from './db.js';

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
import searchRoutes from './routes/search.js';
import portalRoutes from './routes/portal.js';

initSchema();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '15mb' })); // marge pour l'upload de documents (base64)

app.get('/api/health', (req, res) => res.json({ ok: true, demo: true }));

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
app.use('/api/search', searchRoutes);
app.use('/api/portal', portalRoutes);

// Gestion d'erreur generique
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API medecin-app demarree sur http://localhost:${PORT}`);
  console.log('PROTOTYPE - donnees fictives uniquement (aucune donnee de sante reelle).');
});
