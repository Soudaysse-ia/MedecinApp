import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDate } from '../utils.js';
import VitalsChart from './VitalsChart.jsx';

// Metriques traçables. systolic est extrait de "120/80".
const METRICS = [
  { key: 'poids', label: 'Poids', unit: 'kg', color: '#1d6fb8' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', color: '#7c3aed' },
  { key: 'systolic', label: 'Tension (sys.)', unit: 'mmHg', color: '#dc2626' },
  { key: 'temperature', label: 'Température', unit: '°C', color: '#ea580c' },
  { key: 'glycemie', label: 'Glycémie', unit: 'g/L', color: '#16a34a' },
];

function lastTaille(vitals) {
  for (let i = vitals.length - 1; i >= 0; i--) if (vitals[i].taille) return vitals[i].taille;
  return null;
}

function metricValue(v, key, tailleFallback) {
  if (key === 'systolic') {
    const m = (v.tension || '').match(/(\d+)\s*\/\s*\d+/);
    return m ? Number(m[1]) : null;
  }
  if (key === 'imc') {
    const t = v.taille || tailleFallback;
    if (!v.poids || !t) return null;
    return +(v.poids / Math.pow(t / 100, 2)).toFixed(1);
  }
  return v[key] ?? null;
}

// mode 'staff' -> /vitals (tous les champs) ; mode 'patient' -> /portal/vitals (poids + glycémie)
export default function VitalsSection({ patientId, mode = 'staff' }) {
  const isStaff = mode === 'staff';
  const fetchPath = isStaff ? `/vitals?patient_id=${patientId}` : '/portal/vitals';
  const [vitals, setVitals] = useState([]);
  const [metric, setMetric] = useState('poids');
  const [open, setOpen] = useState(false);
  const blank = { date: new Date().toISOString().slice(0, 10), poids: '', taille: '', tension: '', temperature: '', glycemie: '' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  function load() { api.get(fetchPath).then(setVitals).catch(() => setVitals([])); }
  useEffect(() => { load(); }, [patientId]);

  const taille = lastTaille(vitals);
  const points = vitals.map((v) => ({ date: v.date, value: metricValue(v, metric, taille) }));
  const activeMetric = METRICS.find((m) => m.key === metric);

  async function add(e) {
    e.preventDefault(); setError('');
    const num = (x) => (x === '' || x == null ? null : Number(x));
    try {
      if (isStaff) {
        await api.post('/vitals', {
          patient_id: patientId, date: form.date,
          poids: num(form.poids), taille: num(form.taille), tension: form.tension || null,
          temperature: num(form.temperature), glycemie: num(form.glycemie),
        });
      } else {
        await api.post('/portal/vitals', { date: form.date, poids: num(form.poids), glycemie: num(form.glycemie) });
      }
      setForm(blank); setOpen(false); load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="card">
      <div className="row between">
        <h2>Constantes & suivi {!isStaff && '(saisie à domicile)'}</h2>
        <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Mesure'}</button>
      </div>

      {open && (
        <form onSubmit={add} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          <div className="grid cols-2">
            <div className="field"><label>Date *</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="field"><label>Poids (kg)</label><input type="number" step="0.1" value={form.poids} onChange={(e) => setForm({ ...form, poids: e.target.value })} /></div>
            {isStaff && <>
              <div className="field"><label>Taille (cm)</label><input type="number" step="0.1" value={form.taille} onChange={(e) => setForm({ ...form, taille: e.target.value })} /></div>
              <div className="field"><label>Tension (ex: 120/80)</label><input value={form.tension} onChange={(e) => setForm({ ...form, tension: e.target.value })} /></div>
              <div className="field"><label>Température (°C)</label><input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
            </>}
            <div className="field"><label>Glycémie (g/L)</label><input type="number" step="0.01" value={form.glycemie} onChange={(e) => setForm({ ...form, glycemie: e.target.value })} /></div>
          </div>
          {!isStaff && <p className="pill-info">Vous pouvez renseigner votre poids et votre glycémie ; votre médecin pourra les consulter.</p>}
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary">Enregistrer</button>
        </form>
      )}

      {vitals.length === 0 ? <p className="muted">Aucune mesure enregistrée.</p> : <>
        <div className="row" style={{ gap: '.4rem', marginBottom: '.75rem' }}>
          {METRICS.map((m) => (
            <button key={m.key} className={`btn-sm ${metric === m.key ? 'btn-primary' : ''}`} onClick={() => setMetric(m.key)}>{m.label}</button>
          ))}
        </div>
        <VitalsChart points={points} unit={activeMetric.unit} color={activeMetric.color} />

        <table style={{ marginTop: '1rem' }}>
          <thead><tr><th>Date</th><th>Poids</th><th>IMC</th><th>Tension</th><th>Temp.</th><th>Glycémie</th><th>Source</th></tr></thead>
          <tbody>
            {[...vitals].reverse().map((v) => (
              <tr key={v.id}>
                <td>{formatDate(v.date)}</td>
                <td>{v.poids != null ? `${v.poids} kg` : '—'}</td>
                <td>{metricValue(v, 'imc', taille) ?? '—'}</td>
                <td>{v.tension || '—'}</td>
                <td>{v.temperature != null ? `${v.temperature}°C` : '—'}</td>
                <td>{v.glycemie != null ? `${v.glycemie} g/L` : '—'}</td>
                <td><span className="badge muted">{v.saisi_par || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}
