---
{
  "status": "closed",
  "title": "Tracer aussi les tâches hors plan / hors audit sous forme de ticket",
  "opened": "2026-08-11",
  "closed": "2026-08-11",
  "commits": [
    {
      "sha": "f5acc08",
      "date": "2026-08-11",
      "files": [
        "CLAUDE.md",
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-tool-edit-gate.js",
        "hooks/ovrsee-tool-edit-gate.test.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js",
        "skills/ovrsee-tickets/SKILL.md"
      ]
    },
    {
      "sha": "4114754",
      "date": "2026-08-11",
      "files": []
    },
    {
      "sha": "4b3fcc3",
      "date": "2026-08-11",
      "files": []
    },
    {
      "sha": "53755ac",
      "date": "2026-08-11",
      "files": []
    }
  ]
}
---

# Tracer aussi les tâches hors plan / hors audit sous forme de ticket

## Contexte

Le gate `ovrsee-tool-edit-gate.js` (livré via T-0030, commit `af718fa`) bloque déjà
la première édition de code **sous un plan actif** tant qu'aucun ticket ne cite ce
plan (`meta.plan === planFile`). Mais dès qu'il n'y a **pas** de plan actif — fix
rapide, réponse ad hoc, correction d'un constat d'audit déjà capturé — plus aucune
obligation ne s'applique : zéro détection, zéro trace. `ovrsee-capture-audit.js`
se contente d'un nudge (`additionalContext`) après un audit, jamais bloquant.

L'utilisateur veut que ces tâches « hors plan ou audit » laissent elles aussi un
ticket. Décision déjà validée : étendre le gate de façon symétrique à
`.active-plan`, avec un nouveau marqueur **`ovrsee/.active-ticket`** qui pointe le
ticket « en cours » quand aucun plan ne pilote le travail.

## Conception

### `ovrsee/.active-ticket`

Fichier texte à la racine d'`ovrsee/`, contenu = un id de ticket (`T-0032\n`).
Mêmes garanties que `.active-plan` : seule valeur relue du disque puis recollée à
une comparaison, donc validée par une garde dédiée avant usage.

### `hooks/tickets.js` — 3 fonctions ajoutées

```js
// Import à ajouter : existsSync (déjà : mkdirSync, readdirSync, readFileSync, unlinkSync)

/** Un id de ticket est-il sûr à recoller à une comparaison ? Même regex que la
 *  validation d'`epic` déjà présente dans updateTicket/createTicket. */
export function isSafeTicketId(id) {
  return typeof id === 'string' && /^T-\d+$/.test(id)
}

/** Le ticket actif, ou null. Illisible / absent / mal formé → null, jamais d'exception. */
export function readActiveTicket(ovrseeDir) {
  try {
    const id = readFileSync(join(ovrseeDir, '.active-ticket'), 'utf8').trim()
    return isSafeTicketId(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Retire `.active-ticket`.
 * - `ticketId` fourni : n'efface que s'il désigne bien ce ticket (mirroring
 *   `clearActivePlan` dans plans.js).
 * - `ticketId` omis (null) : efface inconditionnellement — cas « un plan reprend
 *   la main, toute activation ad hoc devient hors-sujet ».
 * Absence de pointeur = pas une erreur : silencieux, comme son homologue plan.
 */
export function clearActiveTicket(ovrseeDir, ticketId = null) {
  const pointer = join(ovrseeDir, '.active-ticket')
  try {
    if (ticketId !== null && readFileSync(pointer, 'utf8').trim() !== ticketId) return false
    unlinkSync(pointer)
    return true
  } catch {
    return false
  }
}
```

Pas de `setActiveTicket` exporté séparément : l'écriture se fait avec
`writeFileNoFollow` déjà importé, directement aux deux points d'activation
ci-dessous — un seul appelant chacun, un wrapper n'ajouterait rien.

### `hooks/tickets.js` — `createTicket()` active le ticket à la création

Après le `writeFileNoFollow` existant (l.396) :

```js
// Un ticket créé sans plan, alors qu'aucun plan n'est actif, devient le ticket
// actif : c'est la seule façon hors-plan de satisfaire le gate sans étape
// manuelle supplémentaire.
if (meta.plan === null && meta.colonne !== colonneFinale(colonnes) && !existsSync(join(ovrseeDir, '.active-plan'))) {
  writeFileNoFollow(join(ovrseeDir, '.active-ticket'), meta.id + '\n')
}
```

Écrase silencieusement un `.active-ticket` déjà posé — même logique que
`ovrsee-capture-plan.js` qui réécrit toujours `.active-plan` sans regarder l'état
précédent.

### `hooks/tickets.js` — `moveTicket()` devient le point de bascule unique

`moveTicket()` est LE seul chemin d'écriture d'une colonne, quel que soit
l'appelant (route UI `server/api.js`, MCP `mcp/dispatch.js`, hooks). C'est donc le
bon endroit pour activer/désactiver `.active-ticket` — pas `ovrsee-post-commit.js`,
qui ne voit jamais un ticket hors-plan (`attachCommit` s'arrête déjà si
`.active-plan` est absent, l.67 de `ovrsee-post-commit.js` : aucun appel à
`avancerTicketsDuPlan` n'a lieu pour ces tickets-là).

```js
const idFromFile = file => /^(T-\d+)-/.exec(file)?.[1] ?? null
const EN_COURS = 'en-cours' // même magic string que ovrsee-tool-edit.js

export function moveTicket(ovrseeDir, file, colonne, now = new Date()) {
  requireFile(file)
  const colonnes = readBoard(ovrseeDir)
  requireColonne(colonnes, colonne)

  let planDuTicket
  const ok = rewrite(
    ovrseeDir,
    file,
    ticket => {
      planDuTicket = ticket.meta.plan
      return { meta: { ...ticket.meta, colonne }, body: ticket.body }
    },
    now,
  )
  if (!ok) return false

  const id = idFromFile(file)
  const finale = colonneFinale(colonnes)
  if (id && colonne === finale) {
    clearActiveTicket(ovrseeDir, id)
  } else if (
    id &&
    colonne === EN_COURS &&
    (planDuTicket === null || planDuTicket === undefined) &&
    !existsSync(join(ovrseeDir, '.active-plan'))
  ) {
    writeFileNoFollow(join(ovrseeDir, '.active-ticket'), id + '\n')
  }

  return true
}
```

Deux effets, symétriques :
- Déplacer le ticket actif vers la colonne finale l'efface (travail terminé,
  peu importe si c'est un commit, un drag kanban, ou un appel MCP).
- Déplacer un ticket hors-plan existant (ex. un des N tickets issus d'un audit,
  encore en backlog) vers `en-cours` l'active — sans repasser par
  `createTicket()`. C'est ce qui évite de devoir recréer un ticket à chaque
  reprise d'un constat d'audit déjà ticketé.

### `hooks/ovrsee-tool-edit-gate.js` — la nouvelle branche

```js
import { readBoard, readTickets, readActiveTicket, colonneFinale } from './tickets.js'
// isSafePlanFileName, estUneEditionSource : imports inchangés

/** Le ticket actif existe-t-il encore et est-il ouvert ? */
export function ticketActifManquant(ovrseeDir) {
  const id = readActiveTicket(ovrseeDir)
  if (!id) return true

  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  const ticket = readTickets(ovrseeDir, colonnes).find(t => t.meta.id === id)
  return !ticket || ticket.meta.colonne === finale
}

function main() {
  // ... inchangé jusqu'à estUneEditionSource

  const planPointer = join(ovrseeDir, '.active-plan')
  if (existsSync(planPointer)) {
    const planFile = readFileSync(planPointer, 'utf8').trim()
    if (!isSafePlanFileName(planFile)) return

    if (ticketManquant(ovrseeDir, planFile)) {
      process.stderr.write(/* message existant, inchangé */)
      process.exit(2)
    }
    return // plan actif + ticket lié : rien à bloquer
  }

  if (ticketActifManquant(ovrseeDir)) {
    process.stderr.write(
      `Bloqué : ni plan actif ni ticket actif.\n` +
        `Crée un ticket — skill ovrsee-tickets, ou MCP createTicket — avant d'éditer du code.\n`,
    )
    process.exit(2)
  }
}
```

Un seul message pour « pas de ticket actif » et « ticket actif terminé/introuvable » :
dans les deux cas la sortie est la même (en créer un), pas besoin de distinguer.

### `hooks/ovrsee-capture-plan.js` — le plan reprend la main

Un plan qui démarre éclipse tout ticket ad hoc en cours : ajouter, juste après
`writeFileNoFollow(join(ovrseeDir, '.active-plan'), file + '\n')` (l.190) :

```js
clearActiveTicket(ovrseeDir) // efface sans condition : un plan qui démarre prime
```

Import à ajouter : `clearActiveTicket` depuis `./tickets.js`.

Sans ce nettoyage, un plan qui se ferme plus tard réactiverait implicitement un
vieux ticket ad hoc sans rapport (le gate le retrouverait encore « ouvert » et
l'accepterait) — mieux vaut forcer une nouvelle intention explicite.

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `hooks/tickets.js` | +`isSafeTicketId`, +`readActiveTicket`, +`clearActiveTicket` ; `createTicket()` et `moveTicket()` modifiés ; import `existsSync` ajouté |
| `hooks/ovrsee-tool-edit-gate.js` | Nouvelle branche « pas de plan → ticket actif » + `ticketActifManquant()` exportée ; imports étendus |
| `hooks/ovrsee-capture-plan.js` | Appel `clearActiveTicket(ovrseeDir)` après écriture de `.active-plan` |
| `skills/ovrsee-tickets/SKILL.md` + `~/.claude/skills/ovrsee-tickets/SKILL.md` | Section documentant le cycle de vie de `.active-ticket` |
| `CLAUDE.md` (racine du repo) | Un piège connu de plus |

Pas de changement nécessaire dans `ovrsee-tool-edit.js` (avance déjà seulement les
tickets liés à un plan — hors sujet ici) ni dans `ovrsee-post-commit.js` (ne voit
jamais les tickets hors-plan, cf. plus haut).

## Tests (étendre les fichiers existants, pas de nouveau fichier)

- **`hooks/tickets.test.js`** :
  - `isSafeTicketId` : accepte `T-0001`, `T-12345` ; refuse `''`, `'../T-0001'`, `'T-abc'`.
  - `readActiveTicket` : absent → `null` ; contenu corrompu → `null` ; valide → l'id.
  - `clearActiveTicket` : sans argument efface toujours ; avec un id qui ne
    correspond pas, laisse le fichier intact.
  - `createTicket` sans `plan`, sans `.active-plan` → pose `.active-ticket` ;
    avec `.active-plan` présent → ne le pose pas ; avec `colonne` déjà finale
    → ne le pose pas.
  - `moveTicket` vers la colonne finale d'un ticket actif → efface
    `.active-ticket` ; vers `en-cours` d'un ticket `plan: null` sans plan actif
    → le pose ; vers `en-cours` d'un ticket lié à un plan → ne le pose pas.

- **`hooks/ovrsee-tool-edit-gate.test.js`** :
  - `ticketActifManquant` : vrai si `.active-ticket` absent ; vrai si le ticket
    pointé est en colonne finale ou n'existe plus ; faux sinon.
  - Le gate laisse passer une édition hors-plan avec ticket actif ouvert, et
    bloque (exit 2) sans plan ni ticket actif — vérifier que le cas « plan actif
    sans ticket » (comportement déjà couvert) n'est pas régressé.

- **`hooks/ovrsee-capture-plan.test.js`** : capturer un plan alors que
  `.active-ticket` existe déjà → il disparaît.

## Piège à documenter dans CLAUDE.md

```markdown
- **Un plan actif éclipse un ticket actif, jamais l'inverse.** `.active-ticket`
  (hors-plan) et `.active-plan` ne coexistent jamais en pratique : capturer un
  plan efface le ticket actif ; tant qu'un plan est actif, le gate ignore
  `.active-ticket`. Un ticket ad hoc resté ouvert après la fermeture du plan ne
  redevient pas actif tout seul — il faut le rouvrir explicitement (`moveTicket`
  vers `en-cours`) ou en créer un nouveau.
```

## Vérification

1. `pnpm test` — couvre `hooks/` en `node:test`, doit rester vert avec les cas
   ajoutés.
2. Scénario manuel : sans `.active-plan`, tenter une édition de code → bloqué ;
   créer un ticket `plan: null` via le skill `ovrsee-tickets` → `.active-ticket`
   apparaît ; réessayer l'édition → passe ; déplacer le ticket vers la colonne
   finale (UI ou MCP `moveTicket`) → `.active-ticket` disparaît ; réessayer une
   nouvelle édition → bloqué de nouveau.
3. Vérifier le cas plan : capturer un plan pendant qu'un `.active-ticket` existe
   → il disparaît ; le gate redemande bien un ticket lié au plan, pas l'ancien
   ticket ad hoc.
