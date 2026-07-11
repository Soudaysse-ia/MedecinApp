import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 style={{ fontSize: '1.3rem' }}>🩺 Toibibou</h1>
        <p className="muted" style={{ marginTop: 0 }}>Connexion</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Vous êtes médecin ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
