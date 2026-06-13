import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDate } from '../utils.js';

// mode 'staff' -> /vaccinations (ajout/suppression) ; 'patient' -> /portal/vaccinations (lecture)
export default function VaccinationsSection({ patientId, mode = 'staff', canDelete = false }) {
  const isStaff = mode === 'staff';
  const fetchPath = isStaff ? `/vaccinations?patient_id=${patientId}` : '/portal/vaccinations';
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const blank = { vaccin: '', date: '', rappel_prevu: '', notes: '' };
  const [form, setForm] = useState(blank);

  function load() { api.get(fetchPath).then(setList).catch(() => setList([])); }
  useEffect(() => { load(); }, [patientId]);

  const today = new Date().toISOString().slice(0, 10);

  async function add(e) {
    e.preventDefault();
    await api.post('/vaccinations', { patient_id: patientId, ...form });
    setForm(blank); setOpen(false); load();
  }
  async function del(id) {
    if (!confirm('Supprimer cette vaccination ?')) return;
    await api.del(`/vaccinations/${id}`); load();
  }

  return (
    <div className="card">
      <div className="row between">
        <h2>Vaccinations</h2>
        {isStaff && <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Vaccin'}</button>}
      </div>

      {open && (
        <form onSubmit={add} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          <div className="grid cols-2">
            <div className="field"><label>Vaccin *</label><input value={form.vaccin} onChange={(e) => setForm({ ...form, vaccin: e.target.value })} required /></div>
            <div className="field"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>Rappel prévu</label><input type="date" value={form.rappel_prevu} onChange={(e) => setForm({ ...form, rappel_prevu: e.target.value })} /></div>
            <div className="field"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <button className="btn-primary">Enregistrer</button>
        </form>
      )}

      {list.length === 0 ? <p className="muted">Aucune vaccination enregistrée.</p> : (
        <table>
          <thead><tr><th>Vaccin</th><th>Date</th><th>Rappel prévu</th>{isStaff && <th>Notes</th>}{canDelete && <th></th>}</tr></thead>
          <tbody>
            {list.map((v, i) => {
              const overdue = v.rappel_prevu && v.rappel_prevu <= today;
              return (
                <tr key={v.id ?? i}>
                  <td><strong>{v.vaccin}</strong></td>
                  <td>{formatDate(v.date)}</td>
                  <td>{v.rappel_prevu ? <span className={overdue ? 'badge' : ''} style={overdue ? { background: '#fef2f2', color: '#dc2626' } : {}}>{formatDate(v.rappel_prevu)}{overdue ? ' ⚠' : ''}</span> : '—'}</td>
                  {isStaff && <td className="muted">{v.notes || '—'}</td>}
                  {canDelete && <td><button className="btn-sm btn-danger" onClick={() => del(v.id)}>×</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
