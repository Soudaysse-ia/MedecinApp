import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import PatientList from './pages/PatientList.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import PatientForm from './pages/PatientForm.jsx';
import Medications from './pages/Medications.jsx';
import Search from './pages/Search.jsx';
import Agenda from './pages/Agenda.jsx';
import Templates from './pages/Templates.jsx';
import Audit from './pages/Audit.jsx';
import PatientPortal from './pages/PatientPortal.jsx';

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isStaff = user.role === 'medecin';
  return (
    <nav className="sidebar">
      <div className="brand">🩺 Carnet Médical<small>Prototype — données fictives</small></div>
      {isStaff && <>
        <NavLink to="/patients">Patients</NavLink>
        <NavLink to="/agenda">Agenda</NavLink>
        <NavLink to="/recherche">Recherche & filtres</NavLink>
        <NavLink to="/medicaments">Médicaments</NavLink>
        <NavLink to="/modeles">Modèles</NavLink>
        {user.role === 'medecin' && <NavLink to="/journal">Journal d'audit</NavLink>}
      </>}
      {user.role === 'patient' && <NavLink to="/mon-dossier">Mon dossier</NavLink>}
      <div className="spacer" />
      <div className="who">{user.nom}<br /><span className="badge muted">{user.role}</span></div>
      <button className="btn-sm" style={{ marginTop: '.5rem' }} onClick={() => { logout(); navigate('/login'); }}>
        Se déconnecter
      </button>
    </nav>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <div className="demo-banner">
          ⚠️ Projet de démonstration — toutes les données sont <strong>fictives</strong>. Ne contient aucune donnée de santé réelle.
        </div>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem' }}>Chargement…</div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;

  const isStaff = user.role === 'medecin';
  const home = isStaff ? '/patients' : '/mon-dossier';

  return (
    <Shell>
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        {isStaff && <>
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/nouveau" element={<PatientForm />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/patients/:id/modifier" element={<PatientForm />} />
          <Route path="/recherche" element={<Search />} />
          <Route path="/medicaments" element={<Medications />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/modeles" element={<Templates />} />
          {user.role === 'medecin' && <Route path="/journal" element={<Audit />} />}
        </>}
        {user.role === 'patient' && <Route path="/mon-dossier" element={<PatientPortal />} />}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Shell>
  );
}
