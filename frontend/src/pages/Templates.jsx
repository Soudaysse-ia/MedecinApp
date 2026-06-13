import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const blank = { nom: '', motif: '', contenu: '' };

export default function Templates() {
  const { user } = useAuth();
  const isMedecin = user.role === 'medecin';
  const [list, setList] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  function load() { api.get('/templates').then(setList); }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setError('');
    try { await api.post('/templates', form); setForm(blank); load(); }
    catch (err) { setError(err.message); }
  }
  async function del(t) { if (confirm(`Supprimer le modèle "${t.nom}" ?`)) { await api.del(`/templates/${t.id}`); load(); } }

  return (
    <div>
      <h1>Modèles de consultation</h1>
      <p className="muted">Notes prédéfinies par motif fréquent, réutilisables lors d'une consultation pour accélérer la saisie.</p>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div>
          {list.length === 0 && <div className="card muted">Aucun modèle.</div>}
          {list.map((t) => (
            <div className="card" key={t.id}>
              <div className="row between">
                <h2 style={{ margin: 0 }}>{t.nom}</h2>
                {isMedecin && <button className="btn-sm btn-danger" onClick={() => del(t)}>Supprimer</button>}
              </div>
              {t.motif && <p className="pill-info">Motif : {t.motif}</p>}
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, color: 'var(--muted)', fontSize: '.9rem' }}>{t.contenu}</pre>
            </div>
          ))}
        </div>

        {isMedecin && (
          <form onSubmit={add} className="card">
            <h2>Nouveau modèle</h2>
            <div className="field"><label>Nom *</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
            <div className="field"><label>Motif associé</label><input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="ex: Contrôle tension" /></div>
            <div className="field"><label>Contenu (note pré-remplie)</label><textarea style={{ minHeight: 140 }} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} /></div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn-primary">Ajouter</button>
          </form>
        )}
      </div>
    </div>
  );
}
