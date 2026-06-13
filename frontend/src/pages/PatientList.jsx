import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { calcAge, formatDate, lines } from '../utils.js';

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function load(query = '') {
    setLoading(true);
    api.get(`/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setPatients)
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function onSearch(e) { e.preventDefault(); load(q); }

  return (
    <div>
      <div className="row between">
        <h1>Patients</h1>
        <Link to="/patients/nouveau" className="btn btn-primary">+ Nouveau patient</Link>
      </div>

      <form onSubmit={onSearch} className="row" style={{ margin: '1rem 0' }}>
        <input
          placeholder="Rechercher par nom, prénom ou n° d'identité…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 380 }}
        />
        <button className="btn-primary">Rechercher</button>
        {q && <button type="button" onClick={() => { setQ(''); load(); }}>Réinitialiser</button>}
      </form>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Nom</th><th>Âge</th><th>Allergies</th><th>Maladies chroniques</th><th>Dernière consultation</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="muted" style={{ padding: '1rem' }}>Chargement…</td></tr>}
            {!loading && patients.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: '1rem' }}>Aucun patient.</td></tr>}
            {patients.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                <td><strong>{p.nom} {p.prenom}</strong><br /><span className="pill-info">{p.numero_identite || '—'}</span></td>
                <td>{calcAge(p.date_naissance) ?? '—'}</td>
                <td>{p.allergies ? <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>⚠ {lines(p.allergies).length}</span> : <span className="muted">—</span>}</td>
                <td>{lines(p.maladies_chroniques).map((m, i) => <span key={i} className="tag-chip">{m}</span>) || '—'}</td>
                <td>{p.derniere_consultation ? formatDate(p.derniere_consultation.date) : <span className="muted">Jamais</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
