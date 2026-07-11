import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Register() {
  const [form, setForm] = useState({
    nom: '', email: '', password: '', confirm: '',
    specialite: '', cabinet_nom: '', cabinet_tel: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/register', {
        nom: form.nom,
        email: form.email,
        password: form.password,
        specialite: form.specialite || undefined,
        cabinet_nom: form.cabinet_nom || undefined,
        cabinet_tel: form.cabinet_tel || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || "Inscription impossible");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h1 style={{ fontSize: '1.3rem' }}>🩺 Carnet Médical</h1>
          <div className="badge ok" style={{ marginBottom: '.75rem' }}>Compte créé</div>
          <p>
            Votre compte médecin a bien été créé. Il doit maintenant être <strong>validé par
            l'administrateur</strong> avant que vous puissiez vous connecter.
          </p>
          <p className="muted">Vous recevrez l'accès dès que votre inscription sera approuvée.</p>
          <Link className="btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }} to="/login">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 style={{ fontSize: '1.3rem' }}>🩺 Carnet Médical</h1>
        <p className="muted" style={{ marginTop: 0 }}>Inscription médecin</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nom complet *</label>
            <input value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Dr Prénom Nom" required autoFocus />
          </div>
          <div className="field">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe * <span className="muted">(8 caractères min.)</span></label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
          </div>
          <div className="field">
            <label>Confirmer le mot de passe *</label>
            <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} required />
          </div>
          <div className="field">
            <label>Spécialité</label>
            <input value={form.specialite} onChange={(e) => set('specialite', e.target.value)} placeholder="Médecine générale, cardiologie…" />
          </div>
          <div className="field">
            <label>Nom du cabinet</label>
            <input value={form.cabinet_nom} onChange={(e) => set('cabinet_nom', e.target.value)} />
          </div>
          <div className="field">
            <label>Téléphone du cabinet</label>
            <input value={form.cabinet_tel} onChange={(e) => set('cabinet_tel', e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
