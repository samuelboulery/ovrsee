---
{
  "status": "closed",
  "title": "Dashboard pour l'onglet Aperçu",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "7ae9fcc",
      "date": "2026-08-10",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Environnements.tsx",
        "app/src/tabs/Sante.tsx",
        "hooks/git-status.js",
        "hooks/git-status.test.js",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/ovrsee-capture-audit.js",
        "hooks/snapshot.js",
        "hooks/snapshot.test.js",
        "server/api.js",
        "server/api.test.js"
      ]
    }
  ]
}
---

# Dashboard pour l'onglet Aperçu

## Contexte

L'onglet Aperçu (`app/src/tabs/Apercu.tsx`) affiche aujourd'hui le README en
permanence, entouré d'un bandeau de 6 chiffres. Le besoin : en faire un vrai
tableau de bord de santé — README consultable à la demande plutôt que toujours
visible, et remontée de signaux concrets (git, audits, environnements) qui
n'apparaissent nulle part ailleurs dans l'app.

Trois lacunes de données ont été identifiées et tranchées avec l'utilisateur :
- **Environnements (prod/pré-prod)** : rien n'est tracké → champ déclaratif
  ajouté à `ovrsee.config.json`.
- **Audits** : le hook `ovrsee-capture-audit.js` ne persiste rien après une
  revue → il écrira désormais dans un journal `ovrsee/audits.jsonl`.
- **Santé globale** : le projet a un principe fort de ne jamais résumer/
  interpréter (voir les commentaires de `data.ts` sur les faux résumés) → pas
  de score composite, une rangée d'indicateurs factuels à la place.
- **État git distant** : pas de fetch automatique (coût réseau silencieux) →
  bouton "Rafraîchir" explicite qui lance `git fetch` avant de recalculer.

## Backend

### 1. `hooks/git-status.js` (nouveau module Node pur)

Même contrat que `hooks/timeline.js`/`hooks/snapshot.js` : aucun import
Vite/Electron, testable sous `pnpm test`.

`gitStatus(root)` exécute (via `execFileSync`, jamais de shell) :
- `git rev-parse --abbrev-ref HEAD` → branche courante (`null` hors dépôt git)
- `git status --porcelain=v1` → compte fichiers modifiés/indexés/non suivis
- `git for-each-ref --format='%(refname:short)\x1f%(upstream:short)\x1f%(upstream:track)' refs/heads/`
  → une entrée par branche locale : nom, branche distante suivie, avance/retard
  (parsés depuis `[ahead N, behind M]`)
- mtime de `.git/FETCH_HEAD` → date du dernier fetch connu, pour dater
  honnêtement la fraîcheur des infos distantes affichées

Retour :
```js
{
  branch: string | null,
  dirty: { staged: number, unstaged: number, untracked: number },
  branches: [{ name, upstream: string | null, ahead: number, behind: number }],
  lastFetch: string | null, // ISO
}
```
Toute commande git qui échoue (dossier hors dépôt) rend un objet vide plutôt
que de lever — même contrat que `commits()` dans `snapshot.js`.

### 2. Journal des audits

- `hooks/ovrsee-capture-audit.js` : après la détection d'un skill d'audit et
  la résolution de `repoRoot`, ajoute (`appendFileSync`) une ligne JSON
  `{date, skill}` à `<repoRoot>/ovrsee/audits.jsonl` — seulement si
  `ovrsee/` existe déjà (projet équipé). Toujours dans le `try/catch` global
  du hook : un échec d'écriture ne bloque jamais l'outil.
- `hooks/snapshot.js` : nouvelle fonction `audits(root, illisibles)`, calquée
  sur `scans()` (lignes JSON tolérantes, lignes cassées comptées dans
  `illisibles`).

### 3. `hooks/snapshot.js`

Dans `snapshot()`, ajoute deux champs à l'objet retourné :
- `gitStatus: gitStatus(root)`
- `audits: audits(root, illisibles)`

### 4. `ovrsee.config.json` — champ `environments`

Nouveau champ optionnel, purement déclaratif :
```json
"environments": [
  { "nom": "production", "url": "https://…", "branche": "main" },
  { "nom": "pré-prod", "url": "https://staging…", "branche": "develop" }
]
```
Déjà lu tel quel via `readJson(join(root, 'ovrsee.config.json'))` dans
`snapshot.js` — aucun changement de lecture nécessaire, seulement le type.

### 5. `server/api.js`

Étend le dispatcher existant de `/api/projects` (`case 'export-obsidian'` etc.,
ligne ~191) avec `case 'git-fetch'` : exécute `git fetch` dans `root`, puis
renvoie `{ gitStatus: gitStatus(root) }`. Suit le même schéma que
`export-obsidian` : une action déclenchée par bouton, jamais automatique.

## Frontend

### `app/src/data.ts`

- `GitStatus`, `GitBranch`, `Audit` (interfaces, forme ci-dessus)
- `Snapshot.gitStatus: GitStatus`, `Snapshot.audits: Audit[]`
- `OvrseeConfig.environments?: Array<{ nom: string; url?: string; branche?: string }>`
- `lastAudit(audits: Audit[]): Audit | null` — même forme que `lastScan()`
- `ProjectAction` gagne `'git-fetch'` ; `projectAction()` existant le
  transporte déjà (payload générique), pas de nouvelle fonction HTTP requise

### Nouveaux composants (`app/src/tabs/`)

Suivent le découpage déjà en place (`Illisibles.tsx`, `Lightbox.tsx` :
composants top-level partagés par les onglets) :

- **`Sante.tsx`** — rangée de badges factuels, un par ligne de statut :
  - scan : ok / échec / aucun (réutilise `lastScan` existant)
  - arbre git : propre / N fichier(s) modifié(s)
  - commits non poussés sur la branche courante (`ahead` de `gitStatus`)
  - dernier audit : `humanAge(lastAudit(audits)?.date)` + type de skill
  - plans ouverts, listés par ancienneté (`humanAge`) — pas de verdict
    "en retard", juste le fait et sa date, comme le reste de l'app
- **`Branches.tsx`** — liste des branches locales (`gitStatus.branches`) :
  nom, remote suivie ou "aucune", avance/retard. Bouton "Rafraîchir"
  (`projectAction('git-fetch', root)`) qui remplace `gitStatus` en local
  après réponse. Affiche la fraîcheur : "distant connu depuis {humanAge(lastFetch)}".
- **`Environnements.tsx`** — rendu seulement si `config?.environments` est
  non vide. Une carte par environnement : nom, lien `url` (si présent),
  branche déclarée, badge "= branche courante" si `branche === gitStatus.branch`
  (comparaison factuelle, pas une détection de déploiement réel).

### `app/src/tabs/Apercu.tsx`

- Le bandeau de `Chiffre` (pages/plans/tickets/deps/activité/scan) reste,
  inchangé dans sa forme.
- Sous le bandeau, insère `<Sante>`, `<Branches>`, `<Environnements>` avant le
  contenu README.
- Le README passe de "toujours visible" à replié par défaut : état
  `readmeOpen` (`useState(false)`), bouton `Voir le README` / `Masquer` qui
  bascule l'état. Le `<Markdown>` n'est monté que si `readmeOpen` est vrai
  (évite de payer son coût de rendu quand il est fermé).
- Le `Sommaire` (ToC) reste toujours visible dès que le README a 3+ titres —
  cliquer un lien y ouvre le README (`setReadmeOpen(true)`) puis défile vers
  l'ancre au rendu suivant (`useEffect` sur un id d'ancre en attente, plutôt
  que d'appeler `aller()` avant que le nœud existe).

## Vérification

- `pnpm test` : couvre `hooks/git-status.js` (nouveau, tests unitaires sur un
  dépôt de test — cas branche sans remote, ahead/behind, dossier hors git) et
  le parsing de `ovrsee/audits.jsonl` dans `snapshot.js` (ligne cassée →
  `illisibles`, comme `scans.test.js` le fait déjà pour `scans.jsonl`).
- `pnpm dev` puis ouvrir l'app sur ce dépôt (`ovrsee` lui-même est équipé) :
  vérifier que Sante/Branches/Environnements s'affichent avec les vraies
  données de ce repo, que le bouton Rafraîchir met à jour `ahead/behind`
  après un `git fetch` réel, et que le README bascule bien caché/visible sans
  perdre le Sommaire.
- Déclarer un `environments` de test dans `ovrsee.config.json` pour vérifier
  le rendu des cartes et le badge de branche active.
