# Déploiement sur Render — Carnet Médical

Déploiement **mono-service** : un seul service web Render fait tourner l'API Express
et sert le frontend React compilé, avec la base SQLite sur un **disque persistant**.

> ⚠️ **Prototype à données fictives.** Ce guide déploie la démo. Il ne rend PAS
> l'application conforme pour de vraies données de santé (voir « Avant d'y mettre
> de vraies données » plus bas).

## Ce qui a été préparé

| Fichier | Rôle |
|---|---|
| `render.yaml` | Blueprint Render : service web, disque persistant, build/start, variables d'env |
| `.nvmrc` | Épingle Node 22 (requis par `node:sqlite`) |
| `backend/src/index.js` | Sert `frontend/dist` + repli SPA pour les routes React (hors `/api/*`) |
| `backend/src/seed-if-empty.js` | Seed **uniquement si la base est vide** (les redéploiements ne l'écrasent pas) |
| `backend/package.json` | Ajout du script `seed:if-empty` |

## Prérequis

1. Un compte **Render** (render.com).
2. Le code poussé sur **GitHub/GitLab** (Render déploie depuis un dépôt). Le dépôt
   n'a pas encore de remote.

## Étape 1 — Pousser sur GitHub

Créez un dépôt vide sur GitHub, puis, à la racine du projet :

```bash
git add -A
git commit -m "Préparation déploiement Render (mono-service)"
git branch -M main
git remote add origin https://github.com/<vous>/medecin-app.git
git push -u origin main
```

Le `.gitignore` exclut déjà `node_modules/`, `dist/`, `*.sqlite*` et `.env` — c'est
voulu : la base de démo sera régénérée au premier démarrage sur le disque Render.

## Étape 2 — Créer le service via le Blueprint

1. Sur Render : **New +** → **Blueprint**.
2. Sélectionnez le dépôt. Render détecte `render.yaml` et propose le service
   `carnet-medical`.
3. **Apply**. Render va :
   - installer + compiler le frontend, installer le backend (`buildCommand`) ;
   - monter un disque persistant de 1 Go sur `/var/data` ;
   - générer automatiquement un `JWT_SECRET` sécurisé ;
   - au premier démarrage, semer les données de démo (base vide), puis lancer l'API.

Première mise en ligne : ~2–4 min. L'URL publique ressemble à
`https://carnet-medical.onrender.com`.

## Étape 3 — Vérifier

- `https://<votre-url>/api/health` → `{"ok":true,"demo":true}`
- Ouvrez l'URL racine → écran de connexion.
- Connectez-vous (mot de passe commun **`demo1234`**) :
  - Admin → `admin@demo.test`
  - Médecin → `medecin@demo.test`
  - Patient → `patient@demo.test`

## Mises à jour

`git push` sur `main` → Render redéploie. Grâce à `seed:if-empty`, **les données
saisies sont conservées** (le seed ne s'exécute qu'une fois, sur base vide).

## Notes sur le plan

Le disque persistant impose un **plan payant** (`starter`, ~7 $/mois dans
`render.yaml`). Sans disque, la base SQLite serait remise à zéro à chaque
redéploiement — acceptable pour une pure démo jetable : dans ce cas, retirez le
bloc `disk:` et la variable `DB_PATH` du `render.yaml` pour rester sur le plan
gratuit (données éphémères).

## Réinitialiser les données de démo

Depuis le **Shell** du service dans Render :

```bash
cd backend && npm run seed   # ⚠️ destructif : vide et recharge la démo
```

---

## Avant d'y mettre de vraies données (PHI)

Ce déploiement convient à une **démonstration**. Pour de vraies données de santé,
plusieurs points deviennent bloquants :

- **Hébergement conforme** : en France/UE, un hébergeur certifié **HDS** (Hébergeur
  de Données de Santé) et un DPA/contrat adapté ; aux US, un **BAA** HIPAA. Render
  standard ne couvre pas cela.
- **Secrets** : `JWT_SECRET` unique et secret (déjà généré par Render — ne jamais
  committer de `.env`).
- **Base de données** : migrer SQLite → **PostgreSQL** (le code isole l'accès dans
  `backend/src/db.js` ; voir la section migration du `README`).
- **Chiffrement au repos** des documents (aujourd'hui stockés en base64 en base) et
  stockage objet type S3.
- **TLS** partout (Render fournit HTTPS), **journaux d'audit** (déjà présents),
  **sauvegardes** chiffrées et **politique de rétention**.

Dites-le-moi si vous voulez que je prépare l'étape PostgreSQL + le durcissement.
