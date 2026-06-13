import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatDate } from '../utils.js';

const TYPES = ['analyse', 'imagerie', 'compte-rendu', 'autre'];

// mode 'staff' -> /documents (upload + suppression) ; 'patient' -> /portal/documents (lecture)
export default function DocumentsSection({ patientId, mode = 'staff', canDelete = false }) {
  const isStaff = mode === 'staff';
  const base = isStaff ? '/documents' : '/portal/documents';
  const fetchPath = isStaff ? `/documents?patient_id=${patientId}` : '/portal/documents';
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('analyse');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function load() { api.get(fetchPath).then(setList).catch(() => setList([])); }
  useEffect(() => { load(); }, [patientId]);

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]); // retire le prefixe data:...;base64,
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function upload(e) {
    e.preventDefault(); setError('');
    const file = fileRef.current?.files?.[0];
    if (!file) return setError('Sélectionnez un fichier.');
    if (file.size > 10 * 1024 * 1024) return setError('Fichier trop volumineux (max 10 Mo).');
    setBusy(true);
    try {
      const data = await readAsBase64(file);
      await api.post('/documents', { patient_id: patientId, type, filename: file.name, mime: file.type, data, date });
      setOpen(false); if (fileRef.current) fileRef.current.value = ''; load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function del(id) {
    if (!confirm('Supprimer ce document ?')) return;
    await api.del(`/documents/${id}`); load();
  }

  return (
    <div className="card">
      <div className="row between">
        <h2>Pièces jointes</h2>
        {isStaff && <button className="btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Annuler' : '+ Document'}</button>}
      </div>

      {open && (
        <form onSubmit={upload} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, margin: '.75rem 0' }}>
          <div className="grid cols-2">
            <div className="field"><label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="field"><label>Fichier (PDF ou image, max 10 Mo)</label>
            <input type="file" ref={fileRef} accept="application/pdf,image/*" /></div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Envoi…' : 'Téléverser'}</button>
        </form>
      )}

      {list.length === 0 ? <p className="muted">Aucun document.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th></th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>{formatDate(d.date)}</td>
                <td><span className="badge muted">{d.type || 'autre'}</span></td>
                <td>{d.filename}</td>
                <td>
                  <button className="btn-sm" onClick={() => api.download(`${base}/${d.id}/download`, d.filename).catch((e) => alert(e.message))}>⬇ Télécharger</button>
                  {canDelete && <> <button className="btn-sm btn-danger" onClick={() => del(d.id)}>×</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
