---
{
  "status": "closed",
  "title": "Rendre l'état « plan actif / ticket actif » propre à chaque session",
  "opened": "2026-08-16",
  "closed": "2026-08-16",
  "commits": [
    {
      "sha": "f7c3c17",
      "date": "2026-08-16",
      "files": [
        ".gitignore",
        "CLAUDE.md",
        "README.fr.md",
        "README.md",
        "app/src/App.tsx",
        "app/src/data.ts",
        "app/src/menubar.test.ts",
        "app/src/menubar.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Sante.tsx",
        "hooks/active.js",
        "hooks/active.test.js",
        "hooks/gitignore-sync.js",
        "hooks/gitignore-sync.test.js",
        "hooks/install.js",
        "hooks/install.test.js",
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-capture-plan.test.js",
        "hooks/ovrsee-cli.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/ovrsee-post-commit.test.js",
        "hooks/ovrsee-session-end.js",
        "hooks/ovrsee-tool-edit-gate.js",
        "hooks/ovrsee-tool-edit-gate.test.js",
        "hooks/ovrsee-tool-edit.js",
        "hooks/ovrsee-tool-stop.js",
        "hooks/plans.js",
        "hooks/plans.test.js",
        "hooks/snapshot.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js",
        "server/api.js",
        "skills/ovrsee-tickets/SKILL.md"
      ]
    },
    {
      "sha": "5628b2c",
      "date": "2026-08-16",
      "files": [
        ".gitignore"
      ]
    },
    {
      "sha": "2ef6224",
      "date": "2026-08-16",
      "files": []
    },
    {
      "sha": "edd8585",
      "date": "2026-08-16",
      "files": [
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-capture-plan.test.js"
      ]
    }
  ]
}
---

# Rendre l'état « plan actif / ticket actif » propre à chaque session

## Contexte

Plusieurs sessions Claude Code tournent en parallèle sur le même dépôt. L'ovrsee
stocke l'état de travail dans **deux fichiers uniques par dépôt** :

- `ovrsee/.active-plan` — le plan qui capte les prochains commits
- `ovrsee/.active-ticket` — le ticket ad hoc en cours, hors plan

Trois symptômes en découlent, tous constatés à l'usage :

1. **Les sessions se bloquent.** La session B approuve un plan : `ovrsee-capture-plan.js:164`
   écrase le pointeur de A, et `closeOpenPlans()` (`plans.js:343`) ferme au passage le plan
   de A s'il portait déjà un commit. La gate (`ovrsee-tool-edit-gate.js:108`) juge alors les
   éditions de A à l'aune du plan de B.
2. **Les tickets partent au mauvais plan.** Le hook git post-commit (`ovrsee-post-commit.js:66`)
   rattache au pointeur global, sans savoir quelle session a commité ; `avancerTicketsDuPlan()`
   (`ovrsee-post-commit.js:106`) pousse ensuite en colonne finale des tickets d'une autre session.
3. **Un plan reste ouvert et continue de capter.** Rien ne retire le pointeur à la fin d'une
   session : la clôture n'a lieu qu'à la capture du plan suivant.

Il existe pourtant de quoi distinguer les sessions : les hooks Claude reçoivent `session_id`
dans leur payload, et **`CLAUDE_CODE_SESSION_ID` est exporté dans l'environnement de l'outil
Bash** (vérifié sur cette machine) — le hook git `post-commit`, lancé par un `git commit` passé
par l'outil Bash, en hérite donc.

Bug annexe découvert : `ovrsee/.active-ticket` est **versionné**, ajouté par accident dans
`e4a6ce1`. Un état de travail local n'a rien à faire dans le dépôt — il produit des conflits
entre branches et entre machines.

Résultat attendu : deux sessions travaillent côte à côte sur le même dépôt sans se voler leur
plan, leur ticket ni leurs commits ; rien ne change pour qui n'ouvre qu'une session.

## Invariant respecté

Tout reste en lecture du dépôt observé et en écriture dans `ovrsee/` seulement. Aucune socket,
aucun démon, aucun secret. Le nouveau dossier `ovrsee/.active/` est un état local, gitignoré.

---

## 1. Un module de pointeurs par session — `hooks/active.js` (nouveau)

Remplace les deux fichiers plats par un dossier : `ovrsee/.active/<session>.json`, contenant
`{"plan": "2026-08-16-titre.md", "ticket": "T-0123"}` (chaque champ nullable).

```
sessionId(payload)        payload?.session_id ?? process.env.CLAUDE_CODE_SESSION_ID ?? null
readActive(dir, session)  l'entrée de la session ; à défaut celle du seau partagé
writeActive(dir, session, patch)   fusion + écriture atomique
clearActive(dir, session, champ?)  retire un champ, ou toute l'entrée
allActive(dir)            [{session, plan, ticket, mtime}]
activePlans(dir)          les noms de plan distincts, tous seaux confondus
```

Règles :

- **Session inconnue → seau partagé `unknown.json`.** C'est le comportement d'aujourd'hui,
  conservé pour le CLI, un commit fait depuis un terminal externe, et tout appelant qui
  n'aurait pas l'identifiant.
- **Repli de lecture : session → seau partagé, jamais vers une autre session.** C'est ce qui
  garantit qu'aucune session ne récupère l'état d'une autre.
- Le nom de session est **assaini** avant de servir de nom de fichier (même barrière que
  `slugify` dans `plans.js:170` : tout hors `[a-z0-9-]` devient un tiret), et l'écriture passe
  par `writeFileNoFollow` (`plans.js:200`) — tmp + rename, refus des liens symboliques.
- **Migration one-shot** : à la première lecture, si `.active-plan` / `.active-ticket` existent,
  leur contenu part dans `unknown.json` et les anciens fichiers sont supprimés. Un dépôt déjà
  équipé ne perd donc pas son état en cours.
- Validation conservée à l'entrée : `isSafePlanFileName` (`plans.js:443`), `isSafeTicketId`
  (`tickets.js:578`).

`readActiveTicket` / `clearActiveTicket` (`tickets.js:589` et `:607`) et le pointeur de plan de
`plans.js:410` deviennent de fines enveloppes sur ce module, avec un paramètre `session`
optionnel — les appelants qui ne le passent pas retombent sur le seau partagé.

**Fichiers touchés** : `hooks/active.js` (nouveau), `hooks/plans.js`, `hooks/tickets.js`.

## 2. Chaque hook lit et écrit *sa* session

| Fichier | Changement |
|---|---|
| `ovrsee-capture-plan.js:164-166` | écrit `plan` et efface `ticket` **dans sa session** |
| `ovrsee-tool-edit-gate.js:108-132` | juge sur le plan/ticket de la session appelante |
| `ovrsee-tool-edit.js:131` | avance les tickets du plan de sa session |
| `ovrsee-tool-stop.js:117` | idem pour la mise en revue |
| `hooks/tickets.js:414, :485` | `createTicket` / `moveTicket` prennent une `session` optionnelle |
| `mcp/server.js` (`createTicket`, `moveTicket`) et `server/api.js` (`POST /api/tickets`) | passent `process.env.CLAUDE_CODE_SESSION_ID` quand il existe |

Le payload de hook porte `session_id` ; c'est la source primaire, l'environnement le repli.

## 3. Ne plus fermer le plan des autres

`closeOpenPlans(ovrseeDir)` (`plans.js:343`) prend un argument `session` et ne ferme plus que :

- le plan pointé par **cette** session, s'il porte au moins un commit ;
- les plans **orphelins** — ouverts, portant un commit, pointés par aucune entrée de `.active/`.

Un plan pointé par une autre session vivante n'est plus jamais fermé de l'extérieur. Sans
argument (CLI `pnpm ovrsee:close`, route `/api/plans/close-active`), le comportement reste
« tout ce qui peut être clos », geste explicite de l'utilisateur.

## 4. Attribution des commits — `ovrsee-post-commit.js:65-84`

`attachCommit()` choisit le plan dans cet ordre, premier trouvé gagne :

1. **Un `T-\d{4}` cité dans le message de commit** → `ticket.meta.plan`. C'est la convention déjà
   suivie par ce dépôt, la seule qui marche depuis un terminal externe.
2. **Le plan de `CLAUDE_CODE_SESSION_ID`**, si la variable est là.
3. **Le plan actif unique**, s'il n'en existe qu'un toutes sessions confondues.
4. **Rien**, plus une ligne sur stderr disant pourquoi. Mieux vaut un commit non rattaché qu'un
   commit rattaché à la mauvaise intention.

`avancerTicketsDuPlan()` (`:106`) garde sa règle mais la resserre : le repli « un seul ticket en
vol » ne s'applique qu'aux tickets du plan **retenu**, et jamais quand l'attribution vient de
l'étape 3 (plan deviné) — deviner le plan *et* le ticket enchaîne deux paris.

## 5. Fin de session — nouveau hook `SessionEnd`

`hooks/ovrsee-session-end.js` (nouveau) : `clearActive(dir, session)`. **Le plan reste ouvert**,
il cesse simplement de capter les commits. Il sera clos plus tard comme orphelin (§3).

Filet pour les sessions tuées sans `SessionEnd` : `allActive()` ignore, et `readActive()` purge,
toute entrée non touchée depuis **24 h** (`ponytail:` en commentaire, avec le seuil et l'issue —
un vrai signal de vie demanderait un démon, ce que le cadrage interdit).

Enregistrement dans `hooks/install.js` à côté des autres (SessionStart `:168`, PostToolUse
`:183`, Stop/Notification `:196`). **À corriger dans la foulée** : `ovrsee-tool-edit.js`,
`ovrsee-tool-edit-gate.js`, `ovrsee-tool-stop.js` et `ovrsee-capture-audit.js` ne sont pas
enregistrés par `install.js` alors qu'ils le sont à la main dans `~/.claude/settings.json` — une
machine fraîchement installée n'a ni gate ni avancée de tickets, et rien ne le laisse voir.

## 6. L'interface montre tous les plans actifs

`snapshot()` (`hooks/snapshot.js:393-411`) : `activePlan: string | null` devient
`activePlans: string[]`. Le serveur n'a pas de session — il ne peut pas honnêtement en désigner
un seul.

Répercussion, même motif partout (`plan.file === activePlan` → `activePlans.includes(plan.file)`) :
`app/src/data.ts:352`, `app/src/tabs/Apercu.tsx:114`, `app/src/tabs/Historique.tsx:51-199`,
`app/src/tabs/Sante.tsx:88,120`, `app/src/menubar.ts:151-154` (le popover prend `activePlans[0]`,
à défaut le premier plan ouvert), plus `app/src/menubar.test.ts:135,153`.

## 7. Sortir `.active*` du dépôt

- `.gitignore` : ajouter `ovrsee/.active*` (couvre l'ancien couple et le nouveau dossier).
- `git rm --cached ovrsee/.active-ticket` — **le fichier local est conservé**, seul l'index est
  nettoyé.
- `hooks/gitignore-sync.js` ne gère aujourd'hui que deux blocs optionnels (`BLOC_SHOTS`,
  `BLOC_PLANS`, lignes 15-24). Y ajouter un troisième bloc **inconditionnel** pour
  `ovrsee/.active/` : sans lui, chaque projet observé remettrait ses pointeurs sous suivi.

## 8. Deux courses que le multi-session révèle

Ces deux-là existent déjà ; elles ne se voyaient pas avec une seule session.

**Perte de mise à jour.** `updatePlanMeta` (`plans.js:122`) et `rewrite` (`tickets.js:428`) font
lire → transformer → écrire. L'écriture est atomique (`writeFileNoFollow`, tmp + rename) mais
l'intervalle ne l'est pas : deux commits simultanés sur le même plan, et un des deux disparaît de
`meta.commits`. Idem pour deux `moveTicket` sur le même ticket.

**Identifiants de tickets en double.** `nextTicketId` (`tickets.js:296`) rend `max + 1` d'une
lecture du dossier. Deux sessions qui créent un ticket dans la même seconde produisent deux
fichiers portant **le même `T-0156`** avec des slugs différents. Tout ce qui cite cet
identifiant — un commit, un plan, `avancerTicketsDuPlan` — devient ambigu, en silence.

**Parade unique** : un verrou de dépôt dans `active.js`, `withLock(ovrseeDir, fn)`, implémenté
par un `mkdirSync(join(ovrseeDir, '.active', '.lock'))` — atomique sur POSIX comme sur Windows —
avec quelques réessais courts, libération en `finally`, et verrou considéré périmé au-delà de
10 s. Trois appelants seulement : `updatePlanMeta`, `rewrite`, et l'allocation d'id de
`createTicket`.

```
// ponytail: un verrou pour tout le dépôt. Les sections critiques durent une
// lecture et une écriture de fichier ; si un jour ça serre, verrou par fichier.
```

---

## Ordre d'exécution

Chaque étape se termine par `pnpm test` vert, et livre quelque chose de cohérent seule.

1. `hooks/active.js` + `hooks/active.test.js` — pointeurs par session, migration, `withLock`.
2. Câbler `plans.js` et `tickets.js` dessus (§1, §8) ; adapter leurs tests.
3. Les cinq hooks Claude (§2) + la clôture sélective (§3) ; adapter les tests de la gate.
4. `ovrsee-post-commit.js` : attribution en quatre étages (§4).
5. `ovrsee-session-end.js` + `install.js` (§5).
6. `snapshot.js` puis `app/src` (§6) — `pnpm typecheck` et `pnpm build:ui`.
7. `.gitignore`, `gitignore-sync.js`, `git rm --cached` (§7).
8. `CLAUDE.md`, `README*.md`, `skills/ovrsee-tickets/SKILL.md`.

## Tests

Style existant, aucun framework : `node:test` + `node:assert`, dans `hooks/`.

- **`hooks/active.test.js` (nouveau)** — isolation entre deux sessions, repli sur le seau
  partagé, refus de lire le seau d'une autre session, migration depuis `.active-plan`, purge des
  entrées périmées, assainissement d'un identifiant de session hostile (`../../etc/passwd`), et
  `withLock` : deux allocations d'id enchaînées rendent deux identifiants distincts, un verrou
  périmé n'immobilise pas l'appelant.
- **`hooks/plans.test.js`** — les cas de `closeOpenPlans` autour de `.active-plan` : un plan
  pointé par une autre session survit ; un plan orphelin est clos.
- **`hooks/ovrsee-post-commit.test.js`** — les quatre étages d'attribution, dont le cas « deux
  plans actifs, message sans ticket → rien n'est rattaché ».
- **`hooks/tickets.test.js`** (bloc `.active-ticket`, ~lignes 673-839) et
  **`hooks/ovrsee-tool-edit-gate.test.js`** (~lignes 60-91) — les cas existants passent au
  nouveau chemin ; ajout d'un cas « la session A n'est pas bloquée par le plan de B ».
- **`hooks/install.test.js`** — les nouveaux enregistrements de hooks.
- **`app/src/`** — `menubar.test.ts` suit le renommage ; le test de rendu des onglets vérifie
  qu'aucun ne lève avec `activePlans: []`.

## Documentation

- `CLAUDE.md`, « Pièges connus » : les deux entrées **« Un plan actif capte tous les commits »**
  et **« Un plan actif éclipse un ticket actif »** deviennent fausses telles quelles — les
  réécrire en disant que la portée est désormais la session, et ajouter le nouveau piège : *un
  commit fait hors de Claude Code, sans `T-XXXX` dans son message, ne se rattache à rien quand
  plusieurs plans sont actifs.*
- `README.md` / `README.fr.md` : les mentions de `.active-plan` / `.active-ticket` pointent vers
  `ovrsee/.active/`.
- `skills/ovrsee-tickets/SKILL.md` : même mise à jour.

## Vérification

1. `pnpm test` puis `pnpm typecheck` puis `pnpm build:ui` — vert avant tout le reste.
2. **La session est-elle vraiment visible ?** Avant d'implémenter, confirmer par une trace sur
   stderr que `session_id` arrive bien dans le payload des hooks, et que
   `CLAUDE_CODE_SESSION_ID` est présent dans l'environnement du serveur MCP. Si le MCP ne l'a
   pas, ses écritures atterrissent dans le seau partagé — dégradation acceptable, mais à
   constater, pas à supposer.
3. **Deux sessions pour de vrai**, sur ce dépôt : ouvrir deux terminaux `claude`, approuver un
   plan dans chacun, vérifier deux fichiers dans `ovrsee/.active/`, deux plans `open`, et
   qu'aucune capture n'a fermé le plan de l'autre.
4. Éditer un fichier dans chaque session : la gate ne bloque ni l'une ni l'autre, et chaque
   ticket avance sous **son** plan.
5. Committer depuis chaque session avec le `T-XXXX` dans le message : chaque commit atterrit
   dans le bon plan. Puis un commit sans ticket cité, depuis un terminal hors Claude : rien
   n'est rattaché, stderr le dit.
6. `/clear` dans une session : son entrée `.active/` disparaît, le plan reste `open`, un commit
   de l'autre session ne lui est pas rattaché.
7. `pnpm electron` : l'Aperçu, l'Historique et la barre de menu marquent les deux plans actifs.
8. `git status` : `ovrsee/.active/` n'apparaît pas, `.active-ticket` n'est plus suivi.
