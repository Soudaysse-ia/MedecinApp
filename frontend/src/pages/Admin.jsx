import { useEffect, useState } from 'react';
import { api } from '../api.js';

function lastSeenLabel(iso) {
  if (!iso) return { txt: 'Jamais connecté', online: false };
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return { txt: iso, online: false };
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 5) return { txt: 'En ligne', online: true };
  if (mins < 60) return { txt: `Il y a ${Math.round(mins)} min`, online: false };
  return { txt: d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), online: false };
}

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);

  function load() {
    api.get('/admin/doctors').then(setDoctors);
    api.get('/admin/stats').then(setStats);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // rafraîchit "actif maintenant" toutes les 20s
    return () => clearInterval(t);
  }, []);

  async function setAccess(d, active) {
    await api.patch(`/admin/doctors/${d.doctor_id}`, { active });
    load();
  }
  async function setPaiement(d, statut) {
    await api.patch(`/admin/doctors/${d.doctor_id}`, { abonnement_statut: statut });
    load();
  }

  return (
    <div>
      <div className="row between">
        <h1>Administration</h1>
        <button className="btn-sm" onClick={load}>↻ Rafraîchir</button>
      </div>
      <p className="muted">Suivi des médecins, abonnements et accès à la plateforme.</p>

      {stats && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.4rem' }}>
          <Stat label="Médecins" value={stats.totalDoctors} />
          <Stat label="En ligne" value={stats.enLigne} accent="ok" />
          <Stat label="Accès actifs" value={stats.actifs} />
          <Stat label="Abonnements payés" value={`${stats.payes}/${stats.totalDoctors}`} />
          <Stat label="Patients (total)" value={stats.totalPatients} />
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Médecin</th><th>Spécialité</th><th>Patients</th><th>Abonnement</th><th>Activité</th><th>Accès</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: '1rem' }}>Aucun médecin.</td></tr>}
            {doctors.map((d) => {
              const seen = lastSeenLabel(d.last_seen);
              const paye = d.abonnement_statut === 'paye';
              return (
                <tr key={d.doctor_id}>
                  <td><strong>{d.nom}</strong><br /><span className="pill-info">{d.email}</span></td>
                  <td>{d.specialite || '—'}</td>
                  <td><strong>{d.patients}</strong></td>
                  <td>
                    <span className={`badge ${paye ? 'ok' : ''}`} style={paye ? {} : { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                      {paye ? 'Payé' : 'Impayé'}
                    </span>
                  </td>
                  <td>
                    {seen.online
                      ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>● {seen.txt}</span>
                      : <span className="muted">{seen.txt}</span>}
                  </td>
                  <td>
                    <span className={`badge ${d.active ? 'ok' : 'muted'}`}>{d.active ? 'Actif' : 'Désactivé'}</span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: '.35rem' }}>
                      <button className="btn-sm" onClick={() => setPaiement(d, paye ? 'impaye' : 'paye')}>
                        {paye ? 'Marquer impayé' : 'Marquer payé'}
                      </button>
                      {d.active
                        ? <button className="btn-sm btn-danger" onClick={() => setAccess(d, false)}>Désactiver</button>
                        : <button className="btn-sm btn-primary" onClick={() => setAccess(d, true)}>Réactiver</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: '.82rem' }}>
        Un médecin désactivé ne peut plus se connecter ni accéder à ses données tant que son accès n'est pas rétabli.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card" style={{ margin: 0, padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: accent === 'ok' ? 'var(--ok)' : 'var(--accent)' }}>{value}</div>
      <div className="muted" style={{ fontSize: '.78rem' }}>{label}</div>
    </div>
  );
}
