import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Icon from './components/Icons.jsx';
import Avatar from './components/Avatar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PatientList from './pages/PatientList.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import PatientForm from './pages/PatientForm.jsx';
import Medications from './pages/Medications.jsx';
import Search from './pages/Search.jsx';
import Agenda from './pages/Agenda.jsx';
import Templates from './pages/Templates.jsx';
import Audit from './pages/Audit.jsx';
import Admin from './pages/Admin.jsx';
import PatientPortal from './pages/PatientPortal.jsx';

const ROLE_LABEL = { medecin: 'Médecin', patient: 'Patient', admin: 'Propriétaire' };

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMedecin = user.role === 'medecin';
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Icon name="heart" size={17} strokeWidth={2} /></span>
        <span>Twabibu<small>Carnet médical</small></span>
      </div>

      <div className="nav-links">
        {isMedecin && <>
          <span className="nav-label">Mon cabinet</span>
          <NavLink to="/tableau-de-bord"><Icon name="dashboard" /><span className="nav-txt">Accueil</span></NavLink>
          <NavLink to="/patients"><Icon name="patients" /><span className="nav-txt">Patients</span></NavLink>
          <NavLink to="/agenda"><Icon name="agenda" /><span className="nav-txt">Agenda</span></NavLink>
          <span className="nav-label">Outils</span>
          <NavLink to="/recherche"><Icon name="search" /><span className="nav-txt">Recherche</span></NavLink>
          <NavLink to="/medicaments"><Icon name="pill" /><span className="nav-txt">Médicaments</span></NavLink>
          <NavLink to="/modeles"><Icon name="template" /><span className="nav-txt">Modèles</span></NavLink>
          <NavLink to="/journal"><Icon name="shield" /><span className="nav-txt">Audit</span></NavLink>
        </>}
        {user.role === 'patient' && <>
          <span className="nav-label">Mon espace</span>
          <NavLink to="/mon-dossier"><Icon name="folder" /><span className="nav-txt">Mon dossier</span></NavLink>
        </>}
        {user.role === 'admin' && <>
          <span className="nav-label">Plateforme</span>
          <NavLink to="/admin"><Icon name="shield" /><span className="nav-txt">Administration</span></NavLink>
        </>}
      </div>

      <div className="spacer" />
      <div className="who">
        <Avatar nom={user.nom.split(' ').pop()} prenom={user.nom.split(' ')[0].replace('Dr', '') || user.nom} size={32} />
        <span className="who-txt">{user.nom}<small>{ROLE_LABEL[user.role] || user.role}</small></span>
        <button className="icon-btn" title="Se déconnecter" onClick={() => { logout(); navigate('/login'); }}>
          <Icon name="logout" size={16} />
        </button>
      </div>
    </nav>
  );
}

function fmtFr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Rappel de paiement : affiche a chaque connexion du medecin a partir de J-4,
// tant que la facture n'est pas reglee (disparait des que l'admin la marque payee).
function PaymentReminder() {
  const { user, abonnement } = useAuth();
  if (user.role !== 'medecin' || !abonnement?.rappel) return null;
  const f = abonnement.facture;
  const jours = abonnement.jours_restants;
  return (
    <div className="demo-banner" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)', color: 'var(--warn)' }}>
      ⏰ <strong>Rappel de paiement</strong> — votre abonnement arrive à échéance le{' '}
      <strong>{fmtFr(abonnement.echeance)}</strong>{jours >= 0 ? ` (dans ${jours} jour${jours > 1 ? 's' : ''})` : ''}.
      {f && <> Merci de régler la facture <strong>{f.numero}</strong> ({Number(f.montant).toFixed(2).replace('.', ',')} €)</>}
      {' '}pour éviter la suspension de votre accès.
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <PaymentReminder />
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem' }}>Chargement…</div>;
  if (!user) return (
    <Routes>
      <Route path="/inscription" element={<Register />} />
      <Route path="*" element={<Login />} />
    </Routes>
  );

  const isMedecin = user.role === 'medecin';
  const home = user.role === 'admin' ? '/admin' : isMedecin ? '/tableau-de-bord' : '/mon-dossier';

  return (
    <Shell>
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        {isMedecin && <>
          <Route path="/tableau-de-bord" element={<Dashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/nouveau" element={<PatientForm />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/patients/:id/modifier" element={<PatientForm />} />
          <Route path="/recherche" element={<Search />} />
          <Route path="/medicaments" element={<Medications />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/modeles" element={<Templates />} />
          <Route path="/journal" element={<Audit />} />
        </>}
        {user.role === 'patient' && <Route path="/mon-dossier" element={<PatientPortal />} />}
        {user.role === 'admin' && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Shell>
  );
}
