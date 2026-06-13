import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { calcAge, formatDate, lines } from '../utils.js';
import DocumentsSection from '../components/DocumentsSection.jsx';

function fmtDT(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Appointments({ patientId }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: '', motif: '' });
  const [msg, setMsg] = useState('');

  function load() { api.get('/portal/appointments').then(setList); }
  useEffect(() => { load(); }, []);

  async function request(e) {
    e.preventDefault();
    await api.post('/portal/appointments', { date: form.date, motif: form.motif || null });
    setForm({ date: '', motif: '' }); setOpen(false); setMsg('Demande envoyée — en attente de confirmation du cabinet.');
    setTimeout(() => setMsg(''), 5000); load();
  }

  const now = new Date().toISOString();
  const upcoming = list.filter((a) => a.date >= now && a.statut !== 'annule');

  return (
    <div className="card">
      <div className="row between">
        <h2>Mes rendez-vous</h2>
        <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : 'Demander un RDV'}</button>
      </div>
      {msg && <p style={{ color: '#166534' }}>{msg}</p>}
      {open && (
        <form onSubmit={request} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          <div className="grid cols-2">
            <div className="field"><label>Date et heure souhaitées *</label><input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="field"><label>Motif</label><input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          </div>
          <button className="btn-primary">Envoyer la demande</button>
        </form>
      )}
      {upcoming.length === 0 ? <p className="muted">Aucun rendez-vous à venir.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Motif</th><th>Statut</th></tr></thead>
          <tbody>
            {upcoming.map((a) => (
              <tr key={a.id}><td>{fmtDT(a.date)}</td><td>{a.motif || '—'}</td>
                <td><span className={`badge ${a.statut === 'confirme' ? 'ok' : 'muted'}`}>{a.statut === 'confirme' ? 'Confirmé' : 'En attente'}</span></td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

      <Appointments patientId={patient.id} />
      <DocumentsSection patientId={patient.id} mode="patient" />

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
