import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { calcAge, formatDate, lines } from '../utils.js';
import Icon from '../components/Icons.jsx';
import Avatar from '../components/Avatar.jsx';

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
        <div>
          <h1>Patients</h1>
          <p className="muted" style={{ margin: 0 }}>{patients.length} dossier{patients.length > 1 ? 's' : ''} dans votre cabinet</p>
        </div>
        <Link to="/patients/nouveau" className="btn btn-primary btn-lg"><Icon name="plus" size={16} /> Nouveau patient</Link>
      </div>

      <form onSubmit={onSearch} className="searchbar">
        <Icon name="search" size={17} />
        <input
          placeholder="Rechercher par nom, prénom ou n° d'identité…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <button type="button" className="btn-sm" onClick={() => { setQ(''); load(); }}>Effacer</button>}
        <button className="btn-primary btn-sm">Rechercher</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Patient</th><th>Âge</th><th>Allergies</th><th>Maladies chroniques</th><th>Dernière consultation</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="muted" style={{ padding: '1.25rem' }}>Chargement…</td></tr>}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <Icon name="patients" size={30} />
                  <p>{q ? `Aucun patient ne correspond à « ${q} ».` : 'Aucun patient pour le moment.'}</p>
                  {!q && <Link to="/patients/nouveau" className="btn btn-primary btn-sm">Créer le premier dossier</Link>}
                </div>
              </td></tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                <td>
                  <span className="row" style={{ gap: '.7rem', flexWrap: 'nowrap' }}>
                    <Avatar nom={p.nom} prenom={p.prenom} size={38} />
                    <span>
                      <strong>{p.prenom} {p.nom}</strong><br />
                      <span className="pill-info">{p.numero_identite || 'N° non renseigné'}</span>
                    </span>
                  </span>
                </td>
                <td>{calcAge(p.date_naissance) != null ? `${calcAge(p.date_naissance)} ans` : '—'}</td>
                <td>{p.allergies
                  ? <span className="badge badge-danger">⚠ {lines(p.allergies).length} allergie{lines(p.allergies).length > 1 ? 's' : ''}</span>
                  : <span className="muted">Aucune</span>}</td>
                <td>{lines(p.maladies_chroniques).length
                  ? lines(p.maladies_chroniques).slice(0, 2).map((m, i) => <span key={i} className="tag-chip">{m}</span>)
                  : <span className="muted">—</span>}</td>
                <td>{p.derniere_consultation
                  ? formatDate(p.derniere_consultation.date)
                  : <span className="muted">Jamais</span>}</td>
                <td><Icon name="arrow" size={15} style={{ color: 'var(--text-muted)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
