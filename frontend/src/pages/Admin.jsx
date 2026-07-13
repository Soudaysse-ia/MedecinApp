import { useEffect, useState, Fragment } from 'react';
import { api } from '../api.js';
import { formatDate, calcAge, lines } from '../utils.js';

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
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function Admin() {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);
  const [panel, setPanel] = useState({ id: null, type: null }); // type: 'invoices' | 'patients'

  function load() {
    api.get('/admin/doctors').then(setDoctors);
    api.get('/admin/stats').then(setStats);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  function toggle(id, type) {
    setPanel((p) => (p.id === id && p.type === type ? { id: null, type: null } : { id, type }));
  }
  async function setAccess(d, active) { await api.patch(`/admin/doctors/${d.doctor_id}`, { active }); load(); }
  async function setStatut(d, statut) {
    if (statut === 'refuse' && !confirm(`Refuser l'inscription de ${d.nom} ?`)) return;
    await api.patch(`/admin/doctors/${d.doctor_id}`, { statut });
    load();
  }

  const pending = doctors.filter((d) => d.statut === 'en_attente');
  const visibleDoctors = doctors.filter((d) => d.statut !== 'en_attente');

  return (
    <div>
      <div className="row between">
        <h1>Administration</h1>
        <button className="btn-sm" onClick={load}>↻ Rafraîchir</button>
      </div>
      <p className="muted">Vue d'ensemble de la plateforme : médecins, patients, activité et facturation.</p>

      {stats && (
        <div className="stat-row">
          <Stat label="Médecins" value={stats.totalDoctors} />
          <Stat label="En ligne" value={stats.enLigne} accent="ok" />
          <Stat label="En attente" value={stats.enAttente ?? 0} accent={stats.enAttente ? 'warn' : undefined} />
          <Stat label="Patients (total)" value={stats.totalPatients} />
          <Stat label="Consultations" value={stats.totalConsultations} />
          <Stat label="RDV à venir" value={stats.rdvAVenir} />
          <Stat label="Revenu encaissé" value={money(stats.revenuEncaisse)} accent="ok" />
          <Stat label="En attente de paiement" value={money(stats.revenuEnAttente)} accent={stats.revenuEnAttente ? 'warn' : undefined} />
        </div>
      )}

      {pending.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: '1.4rem' }}>
          <div className="row between" style={{ marginBottom: '.6rem' }}>
            <strong>🕓 Demandes d'inscription à valider ({pending.length})</strong>
          </div>
          <table style={{ margin: 0 }}>
            <thead><tr><th>Médecin</th><th>Spécialité</th><th>Cabinet</th><th>Inscrit le</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.doctor_id}>
                  <td><strong>{d.nom}</strong><br /><span className="pill-info">{d.email}</span></td>
                  <td>{d.specialite || <span className="muted">—</span>}</td>
                  <td>{d.cabinet_nom || <span className="muted">—</span>}</td>
                  <td>{d.created_at ? formatDate(d.created_at) : <span className="muted">—</span>}</td>
                  <td>
                    <div className="row" style={{ gap: '.35rem' }}>
                      <button className="btn-sm btn-primary" onClick={() => setStatut(d, 'valide')}>✓ Valider</button>
                      <button className="btn-sm btn-danger" onClick={() => setStatut(d, 'refuse')}>✕ Refuser</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Médecin</th><th>Patients</th><th>Consult.</th><th>RDV à venir</th><th>Revenu</th>
              <th>Abonnement</th><th>Prochaine facture</th><th>Activité</th><th>Accès</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleDoctors.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: '1rem' }}>Aucun médecin validé.</td></tr>}
            {visibleDoctors.map((d) => {
              const seen = lastSeenLabel(d.last_seen);
              const paye = d.abonnement_statut === 'paye';
              const refuse = d.statut === 'refuse';
              const isOpen = panel.id === d.doctor_id;
              return (
                <Fragment key={d.doctor_id}>
                  <tr>
                    <td><strong>{d.nom}</strong><br /><span className="pill-info">{d.specialite || d.email}</span></td>
                    <td>
                      <strong>{d.patients}</strong>
                      {d.patients_avec_acces > 0 && <><br /><span className="pill-info">{d.patients_avec_acces} en ligne</span></>}
                    </td>
                    <td>{d.consultations}</td>
                    <td>{d.rdv_a_venir || <span className="muted">0</span>}</td>
                    <td><strong>{money(d.revenu)}</strong></td>
                    <td>
                      <span className={`badge ${paye ? 'ok' : ''}`} style={paye ? {} : { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                        {paye ? 'Payé' : 'Impayé'}
                      </span>
                      {d.echeance && <><br /><span className="pill-info">échéance {formatDate(d.echeance)}</span></>}
                    </td>
                    <td>
                      {d.prochaine_facture
                        ? <span>{formatDate(d.prochaine_facture.date_emission)}<br /><span className="pill-info">{money(d.prochaine_facture.montant, d.prochaine_facture.devise)}</span></span>
                        : <span className="muted">À jour</span>}
                    </td>
                    <td>{seen.online ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>● {seen.txt}</span> : <span className="muted">{seen.txt}</span>}</td>
                    <td>
                      {refuse
                        ? <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>Refusé</span>
                        : <span className={`badge ${d.active ? 'ok' : 'muted'}`}>{d.active ? 'Actif' : 'Désactivé'}</span>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: '.35rem' }}>
                        <button className={`btn-sm ${isOpen && panel.type === 'overview' ? 'btn-primary' : ''}`} onClick={() => toggle(d.doctor_id, 'overview')}>Détails</button>
                        <button className={`btn-sm ${isOpen && panel.type === 'patients' ? 'btn-primary' : ''}`} onClick={() => toggle(d.doctor_id, 'patients')}>Patients</button>
                        <button className={`btn-sm ${isOpen && panel.type === 'invoices' ? 'btn-primary' : ''}`} onClick={() => toggle(d.doctor_id, 'invoices')}>Factures</button>
                        {refuse
                          ? <button className="btn-sm btn-primary" onClick={() => setStatut(d, 'valide')}>Valider</button>
                          : d.active
                            ? <button className="btn-sm btn-danger" onClick={() => setAccess(d, false)}>Désactiver</button>
                            : <button className="btn-sm btn-primary" onClick={() => setAccess(d, true)}>Réactiver</button>}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={10} style={{ background: 'var(--surface-2)' }}>
                        {panel.type === 'overview'
                          ? <DoctorOverview doctorId={d.doctor_id} />
                          : panel.type === 'patients'
                            ? <PatientsPanel doctor={d} />
                            : <Invoices doctorId={d.doctor_id} onChange={load} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ActivityFeed />

      <p className="muted" style={{ fontSize: '.82rem' }}>
        Un médecin désactivé ne peut plus se connecter ni accéder à ses données tant que son accès n'est pas rétabli.
      </p>
    </div>
  );
}

// Fiche detaillee d'un medecin
function DoctorOverview({ doctorId }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/admin/doctors/${doctorId}/overview`).then(setData).catch(() => setData(false)); }, [doctorId]);

  if (data === false) return <p className="muted">Impossible de charger la fiche.</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  const { doctor: d, kpis, consultations_par_mois, activite } = data;

  return (
    <div style={{ padding: '.4rem 0' }}>
      <div className="ov-grid">
        {/* Identite + abonnement */}
        <div className="ov-id">
          <strong style={{ fontSize: '.95rem' }}>{d.nom}</strong>
          <div className="pill-info">{d.specialite || 'Spécialité non renseignée'}</div>
          <dl className="ov-dl">
            <div><dt>Cabinet</dt><dd>{d.cabinet_nom || '—'}</dd></div>
            <div><dt>Adresse</dt><dd>{d.cabinet_adresse || '—'}</dd></div>
            <div><dt>Téléphone</dt><dd>{d.cabinet_tel || '—'}</dd></div>
            <div><dt>Email</dt><dd>{d.email}</dd></div>
            <div><dt>Inscrit le</dt><dd>{d.created_at ? formatDate(d.created_at) : '—'}</dd></div>
            <div><dt>Abonnement</dt><dd>depuis {d.abonnement_debut ? formatDate(d.abonnement_debut) : '—'}, échéance {d.echeance ? formatDate(d.echeance) : '—'}</dd></div>
          </dl>
        </div>

        {/* Indicateurs cles */}
        <div className="ov-kpis">
          <Kpi value={kpis.patients} label="Patients" sub={`${kpis.patients_avec_acces} avec accès`} />
          <Kpi value={kpis.consultations} label="Consultations" sub={`${kpis.consultations_30j} sur 30 j`} />
          <Kpi value={kpis.prescriptions} label="Prescriptions" sub={`${kpis.prescriptions_en_cours} en cours`} />
          <Kpi value={kpis.rdv_a_venir} label="RDV à venir" sub={kpis.demandes_rdv ? `${kpis.demandes_rdv} demande(s)` : 'aucune demande'} />
          <Kpi value={kpis.documents} label="Documents" />
          <Kpi value={money(kpis.revenu)} label="Revenu encaissé" accent="ok" sub={`${kpis.factures_impayees} impayée(s)`} />
        </div>
      </div>

      {/* Tendance : consultations par mois */}
      <div style={{ marginTop: '1rem' }}>
        <strong style={{ fontSize: '.82rem' }}>Consultations par mois</strong>
        <MiniBars data={consultations_par_mois} />
      </div>

      {/* Activite recente du cabinet */}
      <div style={{ marginTop: '1rem' }}>
        <strong style={{ fontSize: '.82rem' }}>Dernières actions</strong>
        {activite.length === 0 ? <p className="muted" style={{ fontSize: '.85rem' }}>Aucune action enregistrée.</p> : (
          <ul className="timeline" style={{ marginTop: '.3rem' }}>
            {activite.map((r, i) => (
              <li key={i} style={{ cursor: 'default', padding: '.35rem .5rem' }}>
                <span className="tl-body">
                  <span style={{ fontSize: '.86rem' }}>{ACTION_LABEL[r.action] || r.action} <span className="muted">— {r.cible || ''}</span></span>
                  <span className="muted" style={{ fontSize: '.74rem' }}>{activityWhen(r.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ value, label, sub, accent }) {
  return (
    <div className="ov-kpi">
      <div className="ov-kpi-val" style={{ color: accent === 'ok' ? 'var(--ok)' : 'var(--accent)' }}>{value}</div>
      <div className="ov-kpi-lbl">{label}</div>
      {sub && <div className="pill-info">{sub}</div>}
    </div>
  );
}

// Petit histogramme (consultations par mois), sans dependance
function MiniBars({ data }) {
  if (!data || data.length === 0) return <p className="muted" style={{ fontSize: '.85rem' }}>Aucune consultation.</p>;
  const max = Math.max(...data.map((d) => d.c), 1);
  const moisLabel = (m) => {
    const [y, mm] = m.split('-');
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
  };
  return (
    <div className="minibars">
      {data.map((d) => (
        <div className="minibar" key={d.mois}>
          <span className="minibar-val">{d.c}</span>
          <div className="minibar-track"><div className="minibar-fill" style={{ height: `${(d.c / max) * 100}%` }} /></div>
          <span className="minibar-lbl">{moisLabel(d.mois)}</span>
        </div>
      ))}
    </div>
  );
}

// Liste des patients (clients) d'un medecin
function PatientsPanel({ doctor }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.get(`/admin/doctors/${doctor.doctor_id}/patients`).then(setList); }, [doctor.doctor_id]);

  return (
    <div style={{ padding: '.25rem 0' }}>
      <strong style={{ fontSize: '.85rem' }}>Patients de {doctor.nom} ({doctor.patients})</strong>
      {!list ? <p className="muted">Chargement…</p> : list.length === 0 ? <p className="muted">Aucun patient.</p> : (
        <table style={{ margin: '.4rem 0 0' }}>
          <thead><tr><th>Patient</th><th>Âge</th><th>Consult.</th><th>Dernière consult.</th><th>Allergies</th><th>Espace patient</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.prenom} {p.nom}</strong></td>
                <td>{calcAge(p.date_naissance) != null ? `${calcAge(p.date_naissance)} ans` : '—'}</td>
                <td>{p.nb_consultations}</td>
                <td>{p.derniere_consultation ? formatDate(p.derniere_consultation) : <span className="muted">Jamais</span>}</td>
                <td>{p.allergies ? <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>⚠ {lines(p.allergies).length}</span> : <span className="muted">—</span>}</td>
                <td>{p.a_un_acces ? <span className="badge ok">Actif</span> : <span className="badge muted">Aucun</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const ACTION_LABEL = {
  consultation_fiche: 'a consulté une fiche', creation_patient: 'a créé un patient',
  modif_patient: 'a modifié un patient', suppression_patient: 'a supprimé un patient',
  creation_prescription: 'a prescrit', creation_rdv: 'a créé un RDV', modif_rdv: 'a modifié un RDV',
  ajout_document: 'a ajouté un document', consultation_document: 'a consulté un document',
  export_dossier: 'a exporté un dossier', creation_acces_patient: 'a donné un accès patient',
  reset_mdp_patient: 'a réinitialisé un mot de passe', revocation_acces_patient: 'a révoqué un accès',
};
function activityWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return isNaN(d) ? iso : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Flux d'activite recente de toute la plateforme
function ActivityFeed() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const load = () => api.get('/admin/activity?limit=25').then(setRows);
    load(); const t = setInterval(load, 20000); return () => clearInterval(t);
  }, []);
  return (
    <div className="card">
      <h2>Activité récente de la plateforme</h2>
      {!rows ? <p className="muted">Chargement…</p> : rows.length === 0 ? <p className="muted">Aucune activité enregistrée.</p> : (
        <ul className="timeline">
          {rows.map((r, i) => (
            <li key={i} style={{ cursor: 'default' }}>
              <span className="tl-body">
                <span><strong>{r.user_nom || 'Utilisateur'}</strong> {ACTION_LABEL[r.action] || r.action} <span className="muted">— {r.cible || ''}</span></span>
                <span className="muted" style={{ fontSize: '.76rem' }}>{r.cabinet ? `${r.cabinet} · ` : ''}{activityWhen(r.date)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Invoices({ doctorId, onChange }) {
  const [list, setList] = useState(null);
  const [creating, setCreating] = useState(false);
  const [payDates, setPayDates] = useState({});
  const blank = { date_emission: todayISO(), periode_debut: '', periode_fin: '', montant: '30', devise: 'EUR' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  function load() { api.get(`/admin/doctors/${doctorId}/invoices`).then(setList); }
  useEffect(() => { load(); }, [doctorId]);
  function refresh() { load(); onChange && onChange(); }

  async function create(e) {
    e.preventDefault(); setError('');
    try {
      await api.post(`/admin/doctors/${doctorId}/invoices`, {
        date_emission: form.date_emission,
        periode_debut: form.periode_debut || null,
        periode_fin: form.periode_fin || null,
        montant: Number(form.montant),
        devise: form.devise || 'EUR',
      });
      setForm(blank); setCreating(false); refresh();
    } catch (err) { setError(err.message); }
  }
  async function markPaid(inv) {
    await api.patch(`/admin/invoices/${inv.id}`, { statut: 'payee', date_paiement: payDates[inv.id] || todayISO() });
    refresh();
  }
  async function markUnpaid(inv) { await api.patch(`/admin/invoices/${inv.id}`, { statut: 'impayee' }); refresh(); }
  async function del(inv) { if (confirm(`Supprimer la facture ${inv.numero} ?`)) { await api.del(`/admin/invoices/${inv.id}`); refresh(); } }

  return (
    <div style={{ padding: '.25rem 0' }}>
      <div className="row between" style={{ marginBottom: '.5rem' }}>
        <strong style={{ fontSize: '.85rem' }}>Factures</strong>
        <button className="btn-sm btn-primary" onClick={() => setCreating((c) => !c)}>{creating ? 'Annuler' : '+ Émettre une facture'}</button>
      </div>

      {creating && (
        <form onSubmit={create} className="card" style={{ margin: '0 0 .75rem', background: 'var(--surface)' }}>
          <div className="grid cols-4">
            <div className="field"><label>Date d'émission *</label><input type="date" value={form.date_emission} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} required /></div>
            <div className="field"><label>Période début</label><input type="date" value={form.periode_debut} onChange={(e) => setForm({ ...form, periode_debut: e.target.value })} /></div>
            <div className="field"><label>Période fin</label><input type="date" value={form.periode_fin} onChange={(e) => setForm({ ...form, periode_fin: e.target.value })} /></div>
            <div className="field"><label>Montant ({form.devise})</label><input type="number" step="0.01" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required /></div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary btn-sm">Émettre la facture</button>
        </form>
      )}

      {!list ? <p className="muted">Chargement des factures…</p> : list.length === 0 ? <p className="muted">Aucune facture.</p> : (
        <table style={{ margin: 0 }}>
          <thead><tr><th>N°</th><th>Émise le</th><th>Période</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
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
                        ? <button className="btn-sm" onClick={() => markUnpaid(inv)}>Annuler paiement</button>
                        : <>
                            <input type="date" value={payDates[inv.id] || todayISO()} onChange={(e) => setPayDates({ ...payDates, [inv.id]: e.target.value })} style={{ width: 'auto', padding: '.25rem .4rem' }} title="Date de paiement" />
                            <button className="btn-sm btn-primary" onClick={() => markPaid(inv)}>Marquer payée</button>
                          </>}
                      <button className="btn-sm btn-danger" onClick={() => del(inv)}>×</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  const color = accent === 'ok' ? 'var(--ok)' : accent === 'warn' ? 'var(--danger)' : 'var(--accent)';
  return (
    <div className="card" style={{ margin: 0, padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.15 }}>{value}</div>
      <div className="muted" style={{ fontSize: '.78rem' }}>{label}</div>
    </div>
  );
}
