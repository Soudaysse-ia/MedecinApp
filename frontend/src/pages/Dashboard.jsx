import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../utils.js';
import Icon from '../components/Icons.jsx';
import Avatar from '../components/Avatar.jsx';

function heure(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  function load() { api.get('/dashboard').then(setData).catch(() => setData(false)); }
  useEffect(() => { load(); }, []);

  async function confirmer(a) { await api.patch(`/appointments/${a.id}`, { statut: 'confirme' }); load(); }
  async function refuser(a) { await api.patch(`/appointments/${a.id}`, { statut: 'annule' }); load(); }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (data === false) return <p className="muted">Impossible de charger le tableau de bord.</p>;

  return (
    <div className="dashboard">
      <div className="hello">
        <div>
          <h1>Bonjour, {user.nom} 👋</h1>
          <p className="muted" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
        <Link to="/patients/nouveau" className="btn btn-primary btn-lg">
          <Icon name="plus" size={16} /> Nouveau patient
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard icon="patients" tint="blue" label="Patients suivis" value={data?.counts.patients} to="/patients" />
        <StatCard icon="agenda" tint="green" label="RDV aujourd'hui" value={data?.counts.rdv_aujourdhui} to="/agenda" />
        <StatCard icon="clock" tint="amber" label="Demandes en attente" value={data?.counts.demandes_en_attente} to="/agenda" highlight={data?.counts.demandes_en_attente > 0} />
        <StatCard icon="pill" tint="violet" label="Prescriptions en cours" value={data?.counts.prescriptions_en_cours} />
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between">
            <h2><Icon name="agenda" size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Aujourd'hui</h2>
            <Link to="/agenda" className="see-all">Agenda complet <Icon name="arrow" size={13} /></Link>
          </div>
          {!data ? <p className="muted">Chargement…</p> : data.rdv_du_jour.length === 0 ? (
            <div className="empty-state">
              <Icon name="agenda" size={28} />
              <p>Aucun rendez-vous aujourd'hui.</p>
            </div>
          ) : (
            <ul className="timeline">
              {data.rdv_du_jour.map((a) => (
                <li key={a.id} onClick={() => navigate(`/patients/${a.patient_id}`)}>
                  <span className="time">{heure(a.date)}</span>
                  <Avatar nom={a.patient?.nom} prenom={a.patient?.prenom} size={34} />
                  <span className="tl-body">
                    <strong>{a.patient?.prenom} {a.patient?.nom}</strong>
                    <span className="muted">{a.motif || 'Motif non précisé'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {data?.prochains_rdv.length > 0 && <>
            <h3 style={{ marginTop: '1.2rem' }}>À venir</h3>
            <ul className="timeline">
              {data.prochains_rdv.map((a) => (
                <li key={a.id} onClick={() => navigate(`/patients/${a.patient_id}`)}>
                  <span className="time">{formatDate(a.date)}</span>
                  <Avatar nom={a.patient?.nom} prenom={a.patient?.prenom} size={34} />
                  <span className="tl-body">
                    <strong>{a.patient?.prenom} {a.patient?.nom}</strong>
                    <span className="muted">{a.motif || '—'} · {heure(a.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>}
        </div>

        <div>
          {data?.demandes.length > 0 && (
            <div className="card card-attention">
              <h2><Icon name="clock" size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Demandes de rendez-vous</h2>
              <ul className="timeline">
                {data.demandes.map((a) => (
                  <li key={a.id} style={{ cursor: 'default' }}>
                    <Avatar nom={a.patient?.nom} prenom={a.patient?.prenom} size={34} />
                    <span className="tl-body">
                      <strong>{a.patient?.prenom} {a.patient?.nom}</strong>
                      <span className="muted">{a.motif || '—'} · souhaité le {formatDate(a.date)} à {heure(a.date)}</span>
                    </span>
                    <span className="row" style={{ gap: '.3rem' }}>
                      <button className="btn-sm btn-primary" onClick={() => confirmer(a)} title="Confirmer"><Icon name="check" size={14} /></button>
                      <button className="btn-sm btn-danger" onClick={() => refuser(a)} title="Refuser">×</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="row between">
              <h2><Icon name="stetho" size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Derniers patients vus</h2>
              <Link to="/patients" className="see-all">Tous les patients <Icon name="arrow" size={13} /></Link>
            </div>
            {!data ? <p className="muted">Chargement…</p> : data.patients_recents.length === 0 ? (
              <div className="empty-state"><Icon name="patients" size={28} /><p>Aucune consultation enregistrée.</p></div>
            ) : (
              <ul className="timeline">
                {data.patients_recents.map((p) => (
                  <li key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                    <Avatar nom={p.nom} prenom={p.prenom} size={34} />
                    <span className="tl-body">
                      <strong>{p.prenom} {p.nom} {p.allergies && <span title="Allergies connues" style={{ color: 'var(--danger)' }}>⚠</span>}</strong>
                      <span className="muted">Vu le {formatDate(p.derniere_consultation)}</span>
                    </span>
                    <Icon name="arrow" size={14} style={{ color: 'var(--text-muted)' }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, tint, label, value, to, highlight }) {
  const navigate = useNavigate();
  return (
    <div
      className={`stat-card tint-${tint} ${highlight ? 'stat-highlight' : ''}`}
      onClick={to ? () => navigate(to) : undefined}
      style={to ? { cursor: 'pointer' } : undefined}
    >
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <div>
        <div className="stat-value">{value ?? '…'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
