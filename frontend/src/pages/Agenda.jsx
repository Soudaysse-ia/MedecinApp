import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function fmtDT(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUT_BADGE = {
  demande: { label: 'Demande', cls: '', style: { background: '#fffbeb', color: '#b45309' } },
  confirme: { label: 'Confirmé', cls: 'ok', style: {} },
  annule: { label: 'Annulé', cls: 'muted', style: {} },
};

export default function Agenda() {
  const [appts, setAppts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const blank = { patient_id: '', date: '', motif: '' };
  const [form, setForm] = useState(blank);

  function load() { api.get('/appointments').then(setAppts); }
  useEffect(() => { load(); api.get('/patients').then(setPatients); }, []);

  async function create(e) {
    e.preventDefault();
    await api.post('/appointments', { patient_id: Number(form.patient_id), date: form.date, motif: form.motif || null });
    setForm(blank); setOpen(false); load();
  }
  async function setStatut(a, statut) { await api.patch(`/appointments/${a.id}`, { statut }); load(); }
  async function del(a) { if (confirm('Supprimer ce rendez-vous ?')) { await api.del(`/appointments/${a.id}`); load(); } }
  async function reminders() {
    const r = await api.get('/appointments/reminders');
    setMsg(`${r.envoyes.length} rappel(s) envoyé(s) (simulation — voir la console du serveur).`);
    setTimeout(() => setMsg(''), 5000);
  }

  const now = new Date().toISOString();
  const pending = appts.filter((a) => a.statut === 'demande');
  const upcoming = appts.filter((a) => a.statut === 'confirme' && a.date >= now);
  const others = appts.filter((a) => a.statut === 'annule' || (a.statut === 'confirme' && a.date < now));

  return (
    <div>
      <div className="row between">
        <h1>Agenda</h1>
        <div className="row" style={{ gap: '.4rem' }}>
          <button className="btn-sm" onClick={reminders}>🔔 Envoyer les rappels (48h)</button>
          <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Rendez-vous'}</button>
        </div>
      </div>
      {msg && <div className="demo-banner" style={{ background: '#ecfdf5', color: '#166534', borderColor: '#bbf7d0' }}>{msg}</div>}

      {open && (
        <form onSubmit={create} className="card" style={{ maxWidth: 600 }}>
          <div className="grid cols-2">
            <div className="field"><label>Patient *</label>
              <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} required>
                <option value="">— Choisir —</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
              </select>
            </div>
            <div className="field"><label>Date et heure *</label><input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          </div>
          <div className="field"><label>Motif</label><input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          <button className="btn-primary">Créer</button>
        </form>
      )}

      {pending.length > 0 && (
        <div className="card">
          <h2>Demandes à confirmer ({pending.length})</h2>
          <Table rows={pending} onStatut={setStatut} onDel={del} showActions />
        </div>
      )}

      <div className="card">
        <h2>Rendez-vous à venir ({upcoming.length})</h2>
        {upcoming.length === 0 ? <p className="muted">Aucun rendez-vous à venir.</p> : <Table rows={upcoming} onStatut={setStatut} onDel={del} showActions />}
      </div>

      {others.length > 0 && (
        <div className="card">
          <h2>Passés / annulés</h2>
          <Table rows={others} onStatut={setStatut} onDel={del} />
        </div>
      )}
    </div>
  );
}

function Table({ rows, onStatut, onDel, showActions }) {
  return (
    <table>
      <thead><tr><th>Date</th><th>Patient</th><th>Motif</th><th>Statut</th><th></th></tr></thead>
      <tbody>
        {rows.map((a) => {
          const b = STATUT_BADGE[a.statut] || STATUT_BADGE.confirme;
          return (
            <tr key={a.id}>
              <td>{fmtDT(a.date)}</td>
              <td>{a.patient ? <Link to={`/patients/${a.patient_id}`}>{a.patient.nom} {a.patient.prenom}</Link> : `#${a.patient_id}`}</td>
              <td>{a.motif || '—'}</td>
              <td><span className={`badge ${b.cls}`} style={b.style}>{b.label}</span></td>
              <td>
                {showActions && a.statut === 'demande' && <button className="btn-sm btn-primary" onClick={() => onStatut(a, 'confirme')}>Confirmer</button>}
                {showActions && a.statut !== 'annule' && <> <button className="btn-sm" onClick={() => onStatut(a, 'annule')}>Annuler</button></>}
                {' '}<button className="btn-sm btn-danger" onClick={() => onDel(a)}>×</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
