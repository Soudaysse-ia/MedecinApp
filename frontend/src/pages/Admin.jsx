import { useEffect, useState, Fragment } from 'react';
import { api } from '../api.js';
import { formatDate } from '../utils.js';

function lastSeenLabel(iso) {
  if (!iso) return { txt: 'Jamais connecté', online: false };
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return { txt: iso, online: false };
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 5) return { txt: 'En ligne', online: true };
  if (mins < 60) return { txt: `Il y a ${Math.round(mins)} min`, online: false };
  return { txt: d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), online: false };
}

function money(v, devise = 'EUR') {
  return (Number(v) || 0).toFixed(2).replace('.', ',') + (devise === 'EUR' ? ' €' : ' ' + devise);
}

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);
  const [openId, setOpenId] = useState(null);

  function load() {
    api.get('/admin/doctors').then(setDoctors);
    api.get('/admin/stats').then(setStats);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  async function setAccess(d, active) { await api.patch(`/admin/doctors/${d.doctor_id}`, { active }); load(); }
  async function setPaiement(d, statut) { await api.patch(`/admin/doctors/${d.doctor_id}`, { abonnement_statut: statut }); load(); }

  return (
    <div>
      <div className="row between">
        <h1>Administration</h1>
        <button className="btn-sm" onClick={load}>↻ Rafraîchir</button>
      </div>
      <p className="muted">Suivi des médecins, abonnements, facturation et accès à la plateforme.</p>

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
              <th>Médecin</th><th>Patients</th><th>Abonnement</th><th>Dernier paiement</th><th>Prochaine facture</th><th>Activité</th><th>Accès</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 && <tr><td colSpan={8} className="muted" style={{ padding: '1rem' }}>Aucun médecin.</td></tr>}
            {doctors.map((d) => {
              const seen = lastSeenLabel(d.last_seen);
              const paye = d.abonnement_statut === 'paye';
              const open = openId === d.doctor_id;
              return (
                <Fragment key={d.doctor_id}>
                  <tr>
                    <td><strong>{d.nom}</strong><br /><span className="pill-info">{d.email}</span></td>
                    <td><strong>{d.patients}</strong></td>
                    <td>
                      <span className={`badge ${paye ? 'ok' : ''}`} style={paye ? {} : { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                        {paye ? 'Payé' : 'Impayé'}
                      </span>
                    </td>
                    <td>{d.dernier_paiement ? formatDate(d.dernier_paiement) : <span className="muted">—</span>}</td>
                    <td>
                      {d.prochaine_facture
                        ? <span>{formatDate(d.prochaine_facture.date_emission)}<br /><span className="pill-info">{money(d.prochaine_facture.montant, d.prochaine_facture.devise)}</span></span>
                        : <span className="muted">À jour</span>}
                    </td>
                    <td>{seen.online ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>● {seen.txt}</span> : <span className="muted">{seen.txt}</span>}</td>
                    <td><span className={`badge ${d.active ? 'ok' : 'muted'}`}>{d.active ? 'Actif' : 'Désactivé'}</span></td>
                    <td>
                      <div className="row" style={{ gap: '.35rem' }}>
                        <button className="btn-sm" onClick={() => setOpenId(open ? null : d.doctor_id)}>{open ? 'Masquer' : 'Factures'}</button>
                        <button className="btn-sm" onClick={() => setPaiement(d, paye ? 'impaye' : 'paye')}>{paye ? 'Marquer impayé' : 'Marquer payé'}</button>
                        {d.active
                          ? <button className="btn-sm btn-danger" onClick={() => setAccess(d, false)}>Désactiver</button>
                          : <button className="btn-sm btn-primary" onClick={() => setAccess(d, true)}>Réactiver</button>}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                        <Invoices doctorId={d.doctor_id} onChange={load} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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

function Invoices({ doctorId, onChange }) {
  const [list, setList] = useState(null);
  function load() { api.get(`/admin/doctors/${doctorId}/invoices`).then(setList); }
  useEffect(() => { load(); }, [doctorId]);

  async function mark(inv, statut) {
    await api.patch(`/admin/invoices/${inv.id}`, { statut });
    load(); onChange && onChange();
  }

  if (!list) return <p className="muted" style={{ padding: '.5rem' }}>Chargement des factures…</p>;
  if (list.length === 0) return <p className="muted" style={{ padding: '.5rem' }}>Aucune facture.</p>;

  return (
    <table style={{ margin: '.25rem 0' }}>
      <thead><tr><th>N°</th><th>Émise le</th><th>Période</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
      <tbody>
        {list.map((inv) => {
          const payee = inv.statut === 'payee';
          return (
            <tr key={inv.id}>
              <td>{inv.numero}</td>
              <td>{formatDate(inv.date_emission)}</td>
              <td className="muted">{inv.periode_debut ? `${formatDate(inv.periode_debut)} → ${formatDate(inv.periode_fin)}` : '—'}</td>
              <td>{money(inv.montant, inv.devise)}</td>
              <td>{payee
                ? <span className="badge ok">Payée le {formatDate(inv.date_paiement)}</span>
                : <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>À régler</span>}</td>
              <td>
                <div className="row" style={{ gap: '.35rem' }}>
                  <button className="btn-sm" onClick={() => api.download(`/admin/invoices/${inv.id}/pdf`, `facture-${inv.numero}.pdf`).catch((e) => alert(e.message))}>⬇ PDF</button>
                  {payee
                    ? <button className="btn-sm" onClick={() => mark(inv, 'impayee')}>Annuler paiement</button>
                    : <button className="btn-sm btn-primary" onClick={() => mark(inv, 'payee')}>Marquer payée</button>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
