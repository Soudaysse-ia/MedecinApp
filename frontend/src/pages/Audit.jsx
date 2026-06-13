import { useEffect, useState } from 'react';
import { api } from '../api.js';

function fmtDT(iso) {
  if (!iso) return '—';
  // les dates SQLite sont en UTC "YYYY-MM-DD HH:MM:SS"
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABEL = {
  consultation_fiche: 'Consultation fiche patient',
  creation_patient: 'Création patient',
  modif_patient: 'Modification patient',
  suppression_patient: 'Suppression patient',
  creation_prescription: 'Création prescription',
  creation_rdv: 'Création RDV',
  modif_rdv: 'Modification RDV',
  ajout_document: 'Ajout document',
  consultation_document: 'Consultation document',
  export_dossier: 'Export dossier PDF',
};

export default function Audit() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/audit').then(setRows); }, []);

  return (
    <div>
      <h1>Journal d'audit</h1>
      <p className="muted">Traçabilité des accès et modifications des données (qui, quoi, quand). Réservé au médecin responsable du cabinet.</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Rôle</th><th>Action</th><th>Cible</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: '1rem' }}>Aucune entrée.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(r.date)}</td>
                <td>{r.user_nom || `#${r.user_id}`}</td>
                <td><span className="badge muted">{r.role}</span></td>
                <td>{ACTION_LABEL[r.action] || r.action}</td>
                <td className="muted">{r.cible || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
