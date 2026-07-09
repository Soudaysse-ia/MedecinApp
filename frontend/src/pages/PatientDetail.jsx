import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { calcAge, formatDate, lines } from '../utils.js';
import VitalsSection from '../components/VitalsSection.jsx';
import VaccinationsSection from '../components/VaccinationsSection.jsx';
import DocumentsSection from '../components/DocumentsSection.jsx';
import Icon from '../components/Icons.jsx';
import Avatar from '../components/Avatar.jsx';

export default function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMedecin = user.role === 'medecin';

  const [p, setP] = useState(null);
  const [meds, setMeds] = useState([]);

  function reload() { api.get(`/patients/${id}`).then(setP); }
  useEffect(() => { reload(); api.get('/medications').then(setMeds); }, [id]);

  if (!p) return <p className="muted">Chargement…</p>;

  const allergies = lines(p.allergies);
  const chroniques = lines(p.maladies_chroniques);

  async function remove() {
    if (!confirm(`Supprimer définitivement le dossier de ${p.nom} ${p.prenom} ?`)) return;
    await api.del(`/patients/${id}`);
    navigate('/patients');
  }

  return (
    <div>
      <div className="row between">
        <Link to="/patients" className="muted">← Tous les patients</Link>
        <div className="row">
          <button className="btn btn-sm" onClick={() => api.download(`/patients/${id}/dossier.pdf`, `dossier-${p.nom}.pdf`).catch((e) => alert(e.message))}>📄 Exporter le dossier</button>
          <Link to={`/patients/${id}/modifier`} className="btn btn-sm">Modifier</Link>
          {isMedecin && <button className="btn btn-sm btn-danger" onClick={remove}>Supprimer</button>}
        </div>
      </div>

      {/* En-tete heros du patient */}
      <div className="card patient-hero">
        <Avatar nom={p.nom} prenom={p.prenom} size={64} />
        <div className="hero-main">
          <h1>{p.prenom} {p.nom}</h1>
          <div className="chip-row">
            {calcAge(p.date_naissance) != null && <span className="chip">{calcAge(p.date_naissance)} ans</span>}
            {p.sexe && <span className="chip">{p.sexe === 'M' ? 'Homme' : p.sexe === 'F' ? 'Femme' : p.sexe}</span>}
            {p.date_naissance && <span className="chip">Né(e) le {formatDate(p.date_naissance)}</span>}
            {p.numero_identite && <span className="chip">{p.numero_identite}</span>}
          </div>
          <div className="hero-contacts">
            {p.telephone && <span>📞 {p.telephone}</span>}
            {p.email && <span>✉️ {p.email}</span>}
            {p.adresse && <span>📍 {p.adresse}</span>}
            {p.contact_urgence && <span title="Contact d'urgence">🆘 {p.contact_urgence}</span>}
          </div>
        </div>
        <div className="hero-side">
          <div className="field" style={{ marginBottom: '.5rem' }}>
            <label>Maladies chroniques</label>
            {chroniques.length ? chroniques.map((m, i) => <span key={i} className="tag-chip">{m}</span>) : <span className="muted">Aucune</span>}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Dernière consultation</label>
            {p.derniere_consultation
              ? <span><strong>{formatDate(p.derniere_consultation.date)}</strong> — {p.derniere_consultation.motif || 'motif non précisé'}</span>
              : <span className="muted">Aucune</span>}
          </div>
        </div>
      </div>

      {/* Bandeau d'alerte allergies */}
      {allergies.length > 0 && (
        <div className="alert-banner">
          <span className="label">⚠ Allergies connues</span>
          <ul>{allergies.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}

      <Consultations patient={p} isMedecin={isMedecin} onChange={reload} />
      <Prescriptions patient={p} meds={meds} onChange={reload} />
      <VitalsSection patientId={p.id} mode="staff" />
      <VaccinationsSection patientId={p.id} mode="staff" canDelete={isMedecin} />
      <DocumentsSection patientId={p.id} mode="staff" canDelete={isMedecin} />
    </div>
  );
}

function Consultations({ patient, isMedecin, onChange }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), motif: '', diagnostic: '', notes: '' });

  useEffect(() => { if (open && templates.length === 0) api.get('/templates').then(setTemplates).catch(() => {}); }, [open]);

  function applyTemplate(id) {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return;
    setForm((f) => ({ ...f, motif: t.motif || f.motif, notes: t.contenu || f.notes }));
  }

  async function add(e) {
    e.preventDefault();
    await api.post('/consultations', { patient_id: patient.id, ...form });
    setForm({ date: new Date().toISOString().slice(0, 10), motif: '', diagnostic: '', notes: '' });
    setOpen(false); onChange();
  }

  return (
    <div className="card">
      <div className="row between">
        <h2>Consultations ({patient.consultations.length})</h2>
        <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Consultation'}</button>
      </div>

      {open && (
        <form onSubmit={add} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          {isMedecin && templates.length > 0 && (
            <div className="field"><label>Appliquer un modèle</label>
              <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">— Aucun —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </div>
          )}
          <div className="grid cols-2">
            <div className="field"><label>Date *</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="field"><label>Motif</label><input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          </div>
          <div className="field"><label>Diagnostic</label><input value={form.diagnostic} onChange={(e) => setForm({ ...form, diagnostic: e.target.value })} /></div>
          <div className="field"><label>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="btn-primary">Enregistrer</button>
        </form>
      )}

      {patient.consultations.length === 0 ? <p className="muted">Aucune consultation.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Motif</th><th>Diagnostic</th><th>Notes</th></tr></thead>
          <tbody>
            {patient.consultations.map((c) => (
              <tr key={c.id}><td>{formatDate(c.date)}</td><td>{c.motif || '—'}</td><td>{c.diagnostic || '—'}</td><td className="muted">{c.notes || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Prescriptions({ patient, meds, onChange }) {
  const [open, setOpen] = useState(false);
  const blank = { medication_id: '', medication_nom: '', posologie_specifique: '', duree: '', instructions: '', date: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(blank);
  const [alerts, setAlerts] = useState([]);

  // Verifie les alertes des qu'un medicament est choisi
  useEffect(() => {
    if (!open || (!form.medication_id && !form.medication_nom)) { setAlerts([]); return; }
    const params = new URLSearchParams({ patient_id: patient.id });
    if (form.medication_id) params.set('medication_id', form.medication_id);
    else params.set('medication_nom', form.medication_nom);
    api.get(`/prescriptions/alerts?${params}`).then((d) => setAlerts(d.alerts || [])).catch(() => setAlerts([]));
  }, [form.medication_id, form.medication_nom, open]);

  function pickMed(idStr) {
    const med = meds.find((m) => String(m.id) === idStr);
    setForm((f) => ({
      ...f,
      medication_id: idStr,
      medication_nom: med ? med.nom : '',
      posologie_specifique: med && med.posologie_standard ? med.posologie_standard : f.posologie_specifique,
    }));
  }

  async function add(e) {
    e.preventDefault();
    const payload = {
      patient_id: patient.id,
      medication_id: form.medication_id ? Number(form.medication_id) : null,
      medication_nom: form.medication_nom || undefined,
      posologie_specifique: form.posologie_specifique, duree: form.duree, instructions: form.instructions, date: form.date,
    };
    if (alerts.length && !confirm(`⚠ ${alerts.length} alerte(s) détectée(s). Prescrire malgré tout ?`)) return;
    await api.post('/prescriptions', payload);
    setForm(blank); setAlerts([]); setOpen(false); onChange();
  }

  async function toggle(presc) {
    await api.patch(`/prescriptions/${presc.id}`, { statut: presc.statut === 'en_cours' ? 'terminee' : 'en_cours' });
    onChange();
  }

  return (
    <div className="card">
      <div className="row between">
        <h2>Prescriptions ({patient.prescriptions.length})</h2>
        <div className="row" style={{ gap: '.4rem' }}>
          {patient.prescriptions.some((pr) => pr.statut === 'en_cours') && (
            <button className="btn-sm" onClick={() => api.download(`/prescriptions/patient/${patient.id}/ordonnance.pdf`, `ordonnance-${patient.nom}.pdf`).catch((e) => alert(e.message))}>
              📄 Ordonnance PDF
            </button>
          )}
          <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Prescription'}</button>
        </div>
      </div>

      {open && (
        <form onSubmit={add} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          <div className="grid cols-2">
            <div className="field"><label>Médicament (catalogue)</label>
              <select value={form.medication_id} onChange={(e) => pickMed(e.target.value)}>
                <option value="">— Choisir / saisir manuellement —</option>
                {meds.map((m) => <option key={m.id} value={m.id}>{m.nom} {m.dosage || ''}</option>)}
              </select>
            </div>
            <div className="field"><label>Ou nom libre</label>
              <input value={form.medication_id ? '' : form.medication_nom} disabled={!!form.medication_id}
                onChange={(e) => setForm({ ...form, medication_nom: e.target.value })} placeholder="Nom du médicament" />
            </div>
          </div>

          {alerts.length > 0 && (
            <div className={`alert-banner ${alerts.some((a) => a.type === 'allergie') ? '' : 'alert-warn'}`}>
              <span className="label">⚠ Alerte{alerts.length > 1 ? 's' : ''}</span>
              <ul>{alerts.map((a, i) => <li key={i}>{a.message}</li>)}</ul>
            </div>
          )}

          <div className="grid cols-2">
            <div className="field"><label>Posologie</label><input value={form.posologie_specifique} onChange={(e) => setForm({ ...form, posologie_specifique: e.target.value })} /></div>
            <div className="field"><label>Durée</label><input value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} placeholder="ex: 7 jours" /></div>
          </div>
          <div className="field"><label>Instructions</label><input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="field" style={{ maxWidth: 200 }}><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <button className="btn-primary">Prescrire</button>
        </form>
      )}

      {patient.prescriptions.length === 0 ? <p className="muted">Aucune prescription.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Médicament</th><th>Posologie</th><th>Durée</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {patient.prescriptions.map((pr) => (
              <tr key={pr.id}>
                <td>{formatDate(pr.date)}</td>
                <td><strong>{pr.medication_nom}</strong><br /><span className="pill-info">{pr.instructions || ''}</span></td>
                <td>{pr.posologie_specifique || '—'}</td>
                <td>{pr.duree || '—'}</td>
                <td><span className={`badge ${pr.statut === 'en_cours' ? 'ok' : 'muted'}`}>{pr.statut === 'en_cours' ? 'En cours' : 'Terminée'}</span></td>
                <td>
                  <button className="btn-sm" onClick={() => api.download(`/prescriptions/${pr.id}/pdf`, `ordonnance-${pr.id}.pdf`).catch((e) => alert(e.message))} title="Télécharger en PDF">📄</button>{' '}
                  <button className="btn-sm" onClick={() => toggle(pr)}>{pr.statut === 'en_cours' ? 'Terminer' : 'Réactiver'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
