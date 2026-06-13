import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const blank = { nom: '', dosage: '', forme: '', posologie_standard: '', contre_indications: '' };

export default function Medications() {
  const { user } = useAuth();
  const isMedecin = user.role === 'medecin';
  const [meds, setMeds] = useState([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/medications').then(setMeds); }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      if (editId) await api.put(`/medications/${editId}`, form);
      else await api.post('/medications', form);
      setForm(blank); setEditId(null); load();
    } catch (err) { setError(err.message); }
  }

  function edit(m) { setEditId(m.id); setForm({ nom: m.nom, dosage: m.dosage || '', forme: m.forme || '', posologie_standard: m.posologie_standard || '', contre_indications: m.contre_indications || '' }); }

  async function remove(m) {
    if (!confirm(`Supprimer "${m.nom}" du catalogue ?`)) return;
    await api.del(`/medications/${m.id}`); load();
  }

  return (
    <div>
      <h1>Catalogue de médicaments</h1>
      <p className="muted">Liste des médicaments du cabinet, utilisée lors de la rédaction des prescriptions.</p>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Nom</th><th>Forme</th><th>Posologie standard</th><th>Contre-indications</th>{isMedecin && <th></th>}</tr></thead>
            <tbody>
              {meds.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: '1rem' }}>Aucun médicament.</td></tr>}
              {meds.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.nom}</strong><br /><span className="pill-info">{m.dosage}</span></td>
                  <td>{m.forme || '—'}</td>
                  <td className="muted">{m.posologie_standard || '—'}</td>
                  <td className="muted">{m.contre_indications || '—'}</td>
                  {isMedecin && <td>
                    <button className="btn-sm" onClick={() => edit(m)}>Éditer</button>{' '}
                    <button className="btn-sm btn-danger" onClick={() => remove(m)}>×</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isMedecin && (
          <form onSubmit={submit} className="card">
            <h2>{editId ? 'Modifier' : 'Ajouter'} un médicament</h2>
            <div className="field"><label>Nom *</label><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
            <div className="grid cols-2">
              <div className="field"><label>Dosage</label><input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500 mg" /></div>
              <div className="field"><label>Forme</label><input value={form.forme} onChange={(e) => setForm({ ...form, forme: e.target.value })} placeholder="Comprimé" /></div>
            </div>
            <div className="field"><label>Posologie standard</label><input value={form.posologie_standard} onChange={(e) => setForm({ ...form, posologie_standard: e.target.value })} /></div>
            <div className="field"><label>Contre-indications connues</label><textarea value={form.contre_indications} onChange={(e) => setForm({ ...form, contre_indications: e.target.value })} placeholder="ex: Allergie aux pénicillines" /></div>
            {error && <p className="error-text">{error}</p>}
            <div className="row">
              <button className="btn-primary">{editId ? 'Mettre à jour' : 'Ajouter'}</button>
              {editId && <button type="button" onClick={() => { setEditId(null); setForm(blank); }}>Annuler</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
