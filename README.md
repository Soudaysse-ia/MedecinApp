# 🩺 Carnet Médical — application de démonstration

Application web full-stack pour la gestion de dossiers médicaux, destinée aux **médecins**, à leur **secrétaire** et à leurs **patients**.

> ⚠️ **Prototype de démonstration.** Toutes les données sont **fictives**. Ce projet ne contient et ne doit contenir **aucune donnée de santé réelle**.

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + React Router |
| Backend | Node.js + Express (API REST) |
| Base de données | SQLite via le module intégré `node:sqlite` (aucune compilation native) |
| Authentification | JWT + bcrypt, gestion multi-rôles |
| Validation | Zod |

Le schéma SQL est écrit de façon portable pour faciliter une migration ultérieure vers **PostgreSQL** (voir plus bas).

## Périmètre couvert (V1)

- **Authentification multi-rôles** : médecin, secrétaire, patient (mots de passe hashés, sessions JWT).
- **Contrôle d'accès strict** : un médecin/secrétaire ne voit que les patients de son cabinet ; un patient ne voit que son propre dossier.
- **Gestion des patients** (CRUD) : identité, coordonnées, contact d'urgence, allergies, maladies chroniques.
- **Dossier médical** : allergies en **bandeau d'alerte rouge**, maladies chroniques, historique des consultations, dernière consultation mise en évidence, historique des prescriptions.
- **Catalogue de médicaments** géré par le médecin (nom, dosage, forme, posologie standard, contre-indications).
- **Prescriptions** avec **alertes automatiques** : allergie connue du patient ou contre-indication vis-à-vis d'une maladie chronique.
- **Recherche & filtres avancés** : par nom/prénom/n° d'identité, par maladie chronique, par médicament prescrit, par ancienneté de la dernière consultation.
- **Espace patient** (lecture seule) : ses informations, prescriptions et consultations.

### Ajouts V2

- **Génération PDF des ordonnances** (`pdf-lib`) : en-tête cabinet, patient, allergies en évidence, posologies, ligne de signature. Téléchargeable par le médecin (par prescription ou ordonnance complète) **et** par le patient.
- **Suivi des constantes** : poids, taille, **IMC calculé**, tension, température, glycémie, avec **graphique d'évolution** (SVG, sans dépendance) et sélection du paramètre tracé.
- **Saisie à domicile par le patient** : le patient peut renseigner son poids et sa glycémie, consultables par le médecin (la source de chaque mesure est tracée).
- **Alertes d'interactions** : en plus des allergies et contre-indications, alerte si le médicament prescrit interagit avec un **traitement en cours**.

### Permissions par rôle

| Action | Médecin | Secrétaire | Patient |
|---|:---:|:---:|:---:|
| Voir / créer / modifier un patient | ✅ | ✅ | — |
| Supprimer un patient | ✅ | — | — |
| Saisir diagnostic & notes | ✅ | — | — |
| Gérer le catalogue de médicaments | ✅ | lecture | — |
| Créer une prescription | ✅ | ✅ | — |
| Voir son propre dossier | — | — | ✅ |

## Démarrage

Prérequis : **Node.js ≥ 22.5** (pour le module `node:sqlite`). Testé sur Node 26.

### 1. Backend
```bash
cd backend
cp .env.example .env      # ajustez le JWT_SECRET si besoin
npm install
npm run seed              # insère les données fictives de démo
npm start                 # API sur http://localhost:4000
```

### 2. Frontend (dans un second terminal)
```bash
cd frontend
npm install
npm run dev               # interface sur http://localhost:5173
```

Ouvrez http://localhost:5173.

## Comptes de démonstration

Mot de passe commun : **`demo1234`**

| Rôle | Email |
|---|---|
| Médecin | `medecin@demo.test` |
| Secrétaire | `secretaire@demo.test` |
| Patient | `patient@demo.test` |

## Structure du projet

```
medecin-app/
├── backend/
│   └── src/
│       ├── index.js          # app Express + montage des routes
│       ├── db.js             # connexion node:sqlite + schéma
│       ├── seed.js           # données fictives
│       ├── lib/              # auth (JWT), contexte (résolution de rôle)
│       └── routes/           # auth, patients, consultations, medications,
│                             # prescriptions, search, portal
└── frontend/
    └── src/
        ├── api.js            # client fetch + JWT
        ├── context/          # AuthContext
        ├── pages/            # Login, PatientList, PatientDetail, PatientForm,
        │                     # Medications, Search, PatientPortal
        └── utils.js          # calcul d'âge, formatage de dates
```

## Migration vers PostgreSQL (production)

Le code isole l'accès aux données dans `backend/src/db.js`. Pour passer à PostgreSQL :
1. Remplacer `node:sqlite` par un client `pg` (ou un ORM type Prisma/Knex).
2. Adapter le DDL : `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL`/`IDENTITY`, `datetime('now')` → `now()`.
3. Les requêtes utilisent des paramètres nommés (`@param`) / positionnels (`?`) — à convertir en `$1, $2…` pour `pg`.

## Pistes V2 / V3 (non incluses)

Suivi des constantes + graphiques, vaccinations, pièces jointes (PDF/imagerie), génération PDF des ordonnances, agenda & rendez-vous avec rappels, journal d'audit, export du dossier complet, modèles de consultation.
