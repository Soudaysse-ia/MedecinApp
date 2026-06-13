import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { calcAge, formatDate, lines } from '../utils.js';
import VitalsSection from '../components/VitalsSection.jsx';

export default function PatientPortal() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/portal/dossier').then(setData).catch(() => setData(false)); }, []);

  if (data === null) return <p className="muted">Chargement…</p>;
  if (data === false) return <p className="muted">Aucun dossier patient n'est associé à ce compte.</p>;

  const { patient, consultations, prescriptions, doctor } = data;
  const allergies = lines(patient.allergies);

  return (
    <div>
      <h1>Mon dossier</h1>
      <p className="muted">Médecin traitant : {doctor?.nom} {doctor?.specialite ? `— ${doctor.specialite}` : ''} {doctor?.cabinet_nom ? `(${doctor.cabinet_nom})` : ''}</p>

      {allergies.length > 0 && (
        <div className="alert-banner"><span className="label">⚠ Mes allergies</span>
          <ul>{allergies.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
      )}

      <div className="card">
        <h2>Mes informations</h2>
        <p>{patient.nom} {patient.prenom} — {calcAge(patient.date_naissance)} ans<br />
          <span className="muted">{patient.telephone} · {patient.email}</span></p>
      </div>

      <div className="card">
        <h2>Mes prescriptions</h2>
        {prescriptions.length === 0 ? <p className="muted">Aucune.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Médicament</th><th>Posologie</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {prescriptions.map((pr) => (
                <tr key={pr.id}><td>{formatDate(pr.date)}</td><td><strong>{pr.medication_nom}</strong></td><td>{pr.posologie_specifique || '—'}</td>
                  <td><span className={`badge ${pr.statut === 'en_cours' ? 'ok' : 'muted'}`}>{pr.statut === 'en_cours' ? 'En cours' : 'Terminée'}</span></td>
                  <td><button className="btn-sm" onClick={() => api.download(`/portal/prescriptions/${pr.id}/pdf`, `ordonnance-${pr.id}.pdf`).catch((e) => alert(e.message))} title="Télécharger en PDF">📄 PDF</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <VitalsSection patientId={patient.id} mode="patient" />

      <div className="card">
        <h2>Mes consultations</h2>
        {consultations.length === 0 ? <p className="muted">Aucune.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Motif</th><th>Diagnostic</th></tr></thead>
            <tbody>
              {consultations.map((c, i) => (
                <tr key={i}><td>{formatDate(c.date)}</td><td>{c.motif || '—'}</td><td>{c.diagnostic || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
