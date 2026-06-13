import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { calcAge, formatDate, lines } from '../utils.js';

export default function Search() {
  const navigate = useNavigate();
  const [f, setF] = useState({ q: '', maladie_chronique: '', medicament: '', derniere_avant: '', sans_consultation: false });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.maladie_chronique) params.set('maladie_chronique', f.maladie_chronique);
    if (f.medicament) params.set('medicament', f.medicament);
    if (f.derniere_avant) params.set('derniere_avant', f.derniere_avant);
    if (f.sans_consultation) params.set('sans_consultation', 'true');
    const rows = await api.get(`/search/patients?${params}`);
    setResults(rows);
    setLoading(false);
  }

  return (
    <div>
      <h1>Recherche & filtres avancés</h1>
      <p className="muted">Identifier les patients à recontacter (par maladie chronique, médicament prescrit, ou ancienneté de la dernière consultation).</p>

      <form onSubmit={run} className="card">
        <div className="grid cols-2">
          <div className="field"><label>Nom / prénom / n° d'identité</label><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          <div className="field"><label>Maladie chronique</label><input value={f.maladie_chronique} onChange={(e) => setF({ ...f, maladie_chronique: e.target.value })} placeholder="ex: diabète" /></div>
          <div className="field"><label>Médicament prescrit</label><input value={f.medicament} onChange={(e) => setF({ ...f, medicament: e.target.value })} placeholder="ex: Metformine" /></div>
          <div className="field"><label>Dernière consultation avant le</label><input type="date" value={f.derniere_avant} onChange={(e) => setF({ ...f, derniere_avant: e.target.value })} /></div>
        </div>
        <label className="row" style={{ gap: '.5rem', fontSize: '.9rem' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={f.sans_consultation} onChange={(e) => setF({ ...f, sans_consultation: e.target.checked })} />
          Uniquement les patients sans aucune consultation
        </label>
        <div style={{ marginTop: '.75rem' }}><button className="btn-primary">Lancer la recherche</button></div>
      </form>

      {loading && <p className="muted">Recherche…</p>}
      {results && !loading && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '.75rem 1rem' }} className="muted">{results.length} résultat(s)</div>
          <table>
            <thead><tr><th>Nom</th><th>Âge</th><th>Maladies chroniques</th><th>Dernière consultation</th></tr></thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                  <td><strong>{p.nom} {p.prenom}</strong></td>
                  <td>{calcAge(p.date_naissance) ?? '—'}</td>
                  <td>{lines(p.maladies_chroniques).map((m, i) => <span key={i} className="tag-chip">{m}</span>)}</td>
                  <td>{p.derniere_consultation ? formatDate(p.derniere_consultation.date) : <span className="muted">Jamais</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
