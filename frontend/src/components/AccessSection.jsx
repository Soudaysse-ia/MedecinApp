import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icons.jsx';

function lastSeenTxt(iso) {
  if (!iso) return 'Jamais connecté';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return isNaN(d) ? iso : `Dernière connexion le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Gestion de l'acces du patient a son espace en ligne (cree par le medecin).
export default function AccessSection({ patient, onChange }) {
  const [email, setEmail] = useState(patient.email || '');
  const [creds, setCreds] = useState(null);   // { email, password } affiche une seule fois
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasAccess = !!patient.acces;

  async function run(fn) {
    setError(''); setBusy(true);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const create = () => run(async () => {
    const r = await api.post(`/patients/${patient.id}/access`, { email });
    setCreds(r); onChange();
  });
  const reset = () => run(async () => {
    const r = await api.post(`/patients/${patient.id}/access/reset`);
    setCreds(r); onChange();
  });
  const revoke = () => run(async () => {
    if (!confirm('Révoquer l\'accès de ce patient à son espace en ligne ? Son dossier médical est conservé.')) return;
    await api.del(`/patients/${patient.id}/access`);
    setCreds(null); onChange();
  });

  function copy() {
    navigator.clipboard?.writeText(`Espace patient Toibibou\nEmail : ${creds.email}\nMot de passe : ${creds.password}`);
  }

  return (
    <div className="card">
      <div className="row between">
        <h2><Icon name="shield" size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Accès à l'espace patient</h2>
        {hasAccess
          ? <span className="badge ok">Accès actif</span>
          : <span className="badge muted">Pas d'accès</span>}
      </div>

      {creds && (
        <div className="creds-box">
          <div>
            <strong>Identifiants à transmettre au patient</strong> — affichés une seule fois :
            <div className="creds-line">Email : <code>{creds.email}</code></div>
            <div className="creds-line">Mot de passe : <code>{creds.password}</code></div>
          </div>
          <button className="btn-sm" onClick={copy}>📋 Copier</button>
        </div>
      )}

      {hasAccess ? (
        <div className="row between" style={{ marginTop: '.5rem' }}>
          <span className="muted" style={{ fontSize: '.86rem' }}>
            {patient.acces.email} · {lastSeenTxt(patient.acces.last_seen)}
          </span>
          <span className="row" style={{ gap: '.4rem' }}>
            <button className="btn-sm" disabled={busy} onClick={reset}>Réinitialiser le mot de passe</button>
            <button className="btn-sm btn-danger" disabled={busy} onClick={revoke}>Révoquer l'accès</button>
          </span>
        </div>
      ) : (
        <div style={{ marginTop: '.5rem' }}>
          <p className="muted" style={{ margin: '0 0 .6rem', fontSize: '.86rem' }}>
            Créez un compte pour que ce patient consulte ses consultations, prescriptions, rendez-vous et documents.
          </p>
          <div className="row" style={{ gap: '.5rem' }}>
            <input
              type="email" placeholder="Email du patient" value={email}
              onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 300 }}
            />
            <button className="btn-primary" disabled={busy || !email} onClick={create}>
              {busy ? 'Création…' : 'Donner l\'accès'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
