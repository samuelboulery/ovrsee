---
{
  "status": "closed",
  "title": "Mouvement automatique des tickets (en cours → revue → fini) + colonnes adaptatives",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "aec2324",
      "date": "2026-08-10",
      "files": [
        ".gitignore"
      ]
    },
    {
      "sha": "4c94bb7",
      "date": "2026-08-10",
      "files": [
        "\"ovrsee/tickets/T-0024-panneau-preferences-int\\303\\251grations.md\""
      ]
    }
  ]
}
---

# Mouvement automatique des tickets (en cours → revue → fini) + colonnes adaptatives

## Contexte

Aujourd'hui deux hooks bougent déjà des tickets tout seuls :

- `ovrsee-capture-plan.js` (ExitPlanMode) : à la clôture d'un plan, pousse ses
  tickets en colonne finale (`avancerTicketsClos`).
- `ovrsee-post-commit.js` (hook git natif) : à chaque commit, pousse les
  tickets du plan actif en `en-cours` (`avancerTicketsDuPlan`).

Le trou : rien ne bouge un ticket **au moment où le travail commence**
(aujourd'hui il faut attendre le premier commit), et il n'existe aucune
colonne intermédiaire « fini côté code, en attente de ta relecture avant
commit ». Le SKILL.md `ovrsee-tickets` documente encore ce vieux contrat
(« quand il est commité → colonne finale », sans étape « revue »). Résultat :
tout repose sur que je pense à appeler le skill au bon moment — ce que tu
signales comme pas fiable.

Objectif : trois signaux objectifs, indépendants de ma mémoire, qui bougent
les tickets liés au plan actif :

1. **Premier `Edit`/`Write` de la session** (hors `ovrsee/`) sous un plan
   actif → ticket en `en-cours`.
2. **Fin de tour (`Stop`) avec du code non commité** sous ce plan → ticket en
   `revue`.
3. **Commit git** → ticket en colonne finale.

## Principe d'adaptivité aux colonnes

Le board est déjà pensé pour ça : `id` de colonne stable, `titre` éditable,
`colonneFinale()` calcule « la dernière colonne » par position plutôt qu'un
nom câblé (`hooks/tickets.js:512`). `avancerTicketsDuPlan` fait déjà la même
chose pour `en-cours` : cherche l'id, **ne fait rien si absent**
(`hooks/ovrsee-post-commit.js:99-115`).

Je réutilise exactement ce principe pour la nouvelle transition `revue` :
convention d'id (`en-cours`, `revue`), recherche par id, skip silencieux si la
colonne a été renommée d'id (supprimée/recréée) ou retirée. Pas de nouveau
champ de config (« rôle » de colonne) — ce serait une fonctionnalité en plus
non demandée, alors que le mécanisme existant couvre déjà le cas « colonnes
modifiables par l'utilisateur » pour `en-cours`/finale. Une renommage de
`titre` seul (le cas courant) ne casse jamais rien, `id` ne bouge pas.

Dégradations couvertes :
- pas de colonne `revue` → le ticket reste en `en-cours` jusqu'au commit, qui
  le pousse direct en colonne finale (comportement identique à aujourd'hui).
- pas de colonne `en-cours` → rien ne bouge à l'édition, seul le commit pousse
  vers la finale.
- une seule colonne → rien ne bouge jamais (`colonneFinale` rend déjà `null`).

## Changements

### 1. `hooks/ovrsee-tool-edit.js` (nouveau)

Hook `PostToolUse`, matcher `Edit|Write`. Sur chaque édition :
- résout la racine git et `ovrsee/` depuis `cwd` (comme les hooks existants) ;
- ignore si le fichier édité est sous `ovrsee/` (même filtre `DERIVED` que
  `ovrsee-post-commit.js`, pour ne pas réagir à nos propres écritures) ;
- lit `ovrsee/.active-plan` ; rien à faire si absent ;
- `avancerTicketsEnCours(ovrseeDir, planFile)` : pour chaque ticket dont
  `meta.plan === planFile`, si sa colonne est avant `en-cours` **ou** égale à
  `revue` (reprise d'édition après une relecture demandée), le passe en
  `en-cours`. Ne touche jamais un ticket déjà en `en-cours` ou en colonne
  finale/au-delà. Silencieux si `en-cours` n'existe pas dans le board.

Même forme que `avancerTicketsDuPlan` (idempotent, `try/catch` par ticket,
exit 0 toujours).

### 2. `hooks/ovrsee-tool-stop.js` (nouveau)

Hook `Stop`, entrée séparée de `ovrsee-capture-audit.js` (ne pas mélanger les
deux responsabilités — celui-ci reste dédié à la trace d'audit). Sur chaque
fin de tour :
- racine + `ovrsee/` + `.active-plan`, mêmes gardes que ci-dessus ;
- `git status --porcelain -- . ':!ovrsee' ':!graphify-out'` à la racine —
  même exclusion que `DERIVED` dans `ovrsee-post-commit.js`, indispensable :
  sans elle, les captures d'écran et `pages.json` régénérés en continu
  rendraient l'arbre "sale" en permanence et déclencheraient `revue` à tort ;
- si non vide → `avancerTicketsEnRevue(ovrseeDir, planFile)` : tickets du plan
  actif en `en-cours` → `revue`. Silencieux si `revue` absent du board.

### 3. `hooks/ovrsee-post-commit.js` (modifié)

`avancerTicketsDuPlan` ciblait `en-cours` — devient inutile pour ce rôle
puisque l'édition s'en charge désormais plus tôt. Le commit doit maintenant
pousser vers la **colonne finale**, pas `en-cours` :

```javascript
export function avancerTicketsDuPlan(ovrseeDir, planFile) {
  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  if (!finale) return
  // même boucle qu'aujourd'hui, cible `finale` au lieu de `EN_COURS`,
  // garde "jamais reculer" conservée (rang courant >= rang cible → skip)
}
```

Effet : que le ticket vienne de `revue` (cas nominal) ou soit resté en
`en-cours` (pas de colonne `revue`), le commit le pousse en une fois vers la
finale — cohérent avec la demande explicite « après commit → fini ».
`avancerTicketsClos` dans `ovrsee-capture-plan.js` reste inchangée : elle
devient un filet de sécurité redondant dans le cas courant (ticket déjà en
finale, elle no-op), utile seulement si un plan se ferme sans être jamais
passé par un commit suivi.

### 4. `~/.claude/skills/ovrsee-tickets/SKILL.md` (modifié)

Section « Suivre le travail » (lignes 101-103) décrit aujourd'hui un geste
manuel qui devient automatique. Remplacer par : les trois transitions
(en-cours à l'édition, revue à la pause avec diff non commité, finale au
commit) sont gérées par les hooks `ovrsee-tool-edit.js` / `ovrsee-tool-stop.js`
/ `ovrsee-post-commit.js` — le skill garde `moveTicket`/`updateTicket` pour
les corrections manuelles et les cas hors plan actif (ticket sans `plan`
renseigné, déplacement volontaire en dehors du flux), mais n'a plus à
« suivre le travail » lui-même.

### 5. Correctif connexe : références obsolètes « cockpit-tickets »

`ovrsee-capture-plan.js:200` et le `NUDGE_TEXT` de `ovrsee-capture-audit.js`
pointent Claude vers le skill `cockpit-tickets` — qui se déclenche sur un
dossier `cockpit/`, absent ici. Le skill installé pour ce projet est
`ovrsee-tickets` (dossier `ovrsee/`). Corriger les deux chaînes pour ne plus
égarer le nudge post-plan et post-audit.

### 6. `~/.claude/settings.json`

Ajouter deux entrées :
- `PostToolUse`, matcher `Edit|Write` → `ovrsee-tool-edit.js`
- `Stop`, matcher `*` → `ovrsee-tool-stop.js` (nouvelle entrée dans le
  tableau existant, à côté de celle qui pointe déjà vers
  `ovrsee-capture-audit.js`)

Même forme que les entrées déjà présentes (chemin `node` absolu, chemin
script absolu, JSON sur stdin, exit 0 toujours).

## Tests (`hooks/*.test.js`, `node:test`, pas de framework)

- `avancerTicketsEnCours` : ticket en `pret`/`a-specifier` → `en-cours` ;
  ticket en `revue` → `en-cours` (reprise) ; ticket déjà `en-cours` ou en
  finale → inchangé ; board sans `en-cours` → inchangé.
- `avancerTicketsEnRevue` : `en-cours` → `revue` ; board sans `revue` →
  inchangé ; ticket pas lié au plan actif → inchangé.
- `avancerTicketsDuPlan` (post-commit, cible modifiée) : `revue` → finale ;
  `en-cours` → finale (board sans `revue`) ; déjà en finale → no-op ; board à
  une colonne → no-op (`colonneFinale` rend `null`).
- Filtrage git status : vérifier que des chemins sous `ovrsee/`/
  `graphify-out/` seuls ne déclenchent pas `avancerTicketsEnRevue`.

## Vérification

- `pnpm test` (couvre `hooks/`).
- Test manuel en conditions réelles dans ce dépôt (il est lui-même équipé
  `ovrsee/`) : ouvrir un plan, éditer un fichier hors `ovrsee/`, vérifier le
  ticket lié passe en `en-cours` ; laisser un `Stop` survenir avec le diff en
  place, vérifier passage en `revue` ; commiter, vérifier passage en colonne
  finale. Vérifier aussi la dégradation en renommant temporairement (test,
  pas en prod) la colonne `revue` dans un `board.json` de test.

## Réponse à la question MCP (pas d'action requise)

Le serveur MCP (`mcp/dispatch.js`) expose les mêmes fonctions que `/api/*`
(`getBoard`, `listTickets`, `moveTicket`, etc.) en JSON-RPC stdio, pour que
*moi*, agent Claude Code, puisse interroger ou modifier l'état ovrsee pendant
une conversation sans lire/écrire les fichiers à la main. Il sert donc pour
le chemin **agentique** (le skill `ovrsee-tickets` ou une question directe de
ta part). Il ne sert à rien pour cette automatisation : les hooks tournent
comme scripts Node autonomes, hors session Claude, et appellent directement
`hooks/tickets.js` — un aller-retour MCP n'aurait aucun rôle ici. Les deux
mécanismes cohabitent, chacun sur son terrain : hooks pour le déterministe
harness-déclenché, MCP pour l'agentique à la demande.
