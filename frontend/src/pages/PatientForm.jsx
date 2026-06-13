import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

const empty = {
  nom: '', prenom: '', date_naissance: '', sexe: '', numero_identite: '',
  telephone: '', email: '', adresse: '', contact_urgence: '',
  allergies: '', maladies_chroniques: '',
};

export default function PatientForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (editing) {
      api.get(`/patients/${id}`).then((p) => {
        const f = { ...empty };
        for (const k of Object.keys(empty)) f[k] = p[k] ?? '';
        setForm(f);
      });
    }
  }, [id]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const payload = { ...form, sexe: form.sexe || null };
    try {
      const saved = editing
        ? await api.put(`/patients/${id}`, payload)
        : await api.post('/patients', payload);
      navigate(`/patients/${saved.id}`);
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Link to={editing ? `/patients/${id}` : '/patients'} className="muted">← Retour</Link>
      <h1>{editing ? 'Modifier le patient' : 'Nouveau patient'}</h1>

      <form onSubmit={submit} className="card" style={{ maxWidth: 720 }}>
        <div className="grid cols-2">
          <div className="field"><label>Nom *</label><input value={form.nom} onChange={(e) => set('nom', e.target.value)} required /></div>
          <div className="field"><label>Prénom *</label><input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} required /></div>
          <div className="field"><label>Date de naissance</label><input type="date" value={form.date_naissance} onChange={(e) => set('date_naissance', e.target.value)} /></div>
          <div className="field"><label>Sexe</label>
            <select value={form.sexe} onChange={(e) => set('sexe', e.target.value)}>
              <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="Autre">Autre</option>
            </select>
          </div>
          <div className="field"><label>N° d'identité</label><input value={form.numero_identite} onChange={(e) => set('numero_identite', e.target.value)} /></div>
          <div className="field"><label>Téléphone</label><input value={form.telephone} onChange={(e) => set('telephone', e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field"><label>Contact d'urgence</label><input value={form.contact_urgence} onChange={(e) => set('contact_urgence', e.target.value)} /></div>
        </div>
        <div className="field"><label>Adresse</label><input value={form.adresse} onChange={(e) => set('adresse', e.target.value)} /></div>
        <div className="field"><label>Allergies (une par ligne — affichées en alerte)</label>
          <textarea value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Pénicilline&#10;Arachides" /></div>
        <div className="field"><label>Maladies chroniques</label>
          <textarea value={form.maladies_chroniques} onChange={(e) => set('maladies_chroniques', e.target.value)} placeholder="Hypertension artérielle" /></div>

        {error && <p className="error-text">{error}</p>}
        <div className="row">
          <button className="btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" onClick={() => navigate(-1)}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
