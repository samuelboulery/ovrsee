---
{
  "status": "closed",
  "title": "Empêcher un ticket fini de rester bloqué en « en cours »",
  "opened": "2026-08-11",
  "closed": "2026-08-11",
  "commits": [
    {
      "sha": "175859f",
      "date": "2026-08-11",
      "files": [
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-capture-plan.test.js",
        "hooks/ovrsee-cli.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js"
      ]
    }
  ]
}
---

# Empêcher un ticket fini de rester bloqué en « en cours »

## Contexte

T-0030 est resté en colonne `en-cours` alors que le code qu'il décrit est
committé depuis le début de la session (`af718fa`). Deux causes distinctes,
trouvées en explorant `hooks/` :

1. **Bug confirmé.** `hooks/ovrsee-cli.js:close()` (l.89-96) appelle
   `closeOpenPlans()` mais **n'appelle jamais `avancerTicketsClos()`** —
   contrairement à `hooks/ovrsee-capture-plan.js:main()` (l.175-176) qui
   appelle les deux. Fermer un plan à la main (`pnpm ovrsee:close`, ce qu'on a
   fait plus tôt dans cette session) ne fait donc jamais avancer ses tickets
   vers la colonne finale.

2. **Cas T-0030 spécifiquement : signal perdu à la racine.** `af718fa` a créé
   *dans le même commit* le plan `2026-08-11-ticket-obligatoire-avant-integration-pas-apres.md`
   et le ticket T-0030 qui le cite. Mais `.active-plan` pointait au moment du
   commit vers le plan **parent** (`2026-08-10-choix-utilisateur-...`) — le
   nouveau plan n'a donc jamais reçu son commit
   (`hooks/plans.js:attachCommitToPlan`, appelé depuis
   `hooks/ovrsee-post-commit.js:attachCommit` l.65-85, ne rattache qu'au plan
   déjà pointé par `.active-plan`). Son `commits: []` reste vide, et
   `closeOpenPlans()` (`hooks/plans.js` l.343-348) refuse de clore un plan sans
   commit — donc rien ne ferme jamais ce plan, et rien n'avance jamais T-0030.
   C'est une dérive one-shot (plan et ticket écrits à la main pendant qu'un
   autre plan était actif), pas un bug reproductible à l'identique : rien ne
   peut la détecter après coup sans un signal qui n'a jamais existé.

## Ce qu'on corrige

**Le bug (1)** se corrige et se généralise en même temps : au lieu de
n'avancer que les tickets des plans qu'on vient tout juste de clore,
`avancerTicketsClos` rescanne systématiquement *tous* les plans déjà fermés.
Peu coûteux (quelques dizaines de plans/tickets au pire) et ça absorbe toute
dérive future — pas seulement celle du CLI. Utilisé par trois points d'entrée
au lieu d'un seul :

- `ovrsee-capture-plan.js:main()` (déjà là)
- `ovrsee-cli.js:close()` (corrige le bug)
- `ovrsee-post-commit.js:main()` (nouveau filet : re-vérifie à chaque commit)

**Le cas (2)** n'est pas rattrapable automatiquement — fermer un plan sans
commit serait mentir sur l'historique. On le rend juste **visible** plutôt que
silencieux : `ovrsee-cli.js status` signale les tickets liés à un plan encore
`open` sans aucun commit, pour qu'un humain ou l'agent le remarque au lieu de
le découvrir des semaines plus tard.

**T-0030 lui-même** se corrige à la main, une fois : plan marqué `closed`,
ticket déplacé en `fait` — la correction que l'automatisation ne peut pas
faire pour les raisons ci-dessus.

## Conception

### `hooks/tickets.js` — `avancerTicketsClos` déménage et se généralise

Actuellement dans `hooks/ovrsee-capture-plan.js` (l.138-155), signature
`avancerTicketsClos(ovrseeDir, plansClos)` où `plansClos` est la liste des
fichiers qu'on vient de fermer. Trois appelants voudraient calculer cette
liste eux-mêmes — autant que la fonction le fasse une fois, à sa place
naturelle à côté de `colonneFinale`/`readActiveTicket` :

```js
/**
 * Avance vers la colonne finale les tickets dont le plan lié est déjà fermé.
 *
 * Rescanne tous les plans `status: "closed"` à chaque appel plutôt que de se
 * limiter à ceux qu'on vient de clore : ça absorbe toute dérive, y compris un
 * plan fermé par un chemin qui aurait oublié d'avancer ses tickets. Idempotent
 * comme ses cousines (avancerTicketsDuPlan, avancerTicketsEnRevue) — un ticket
 * déjà en colonne finale n'est jamais retouché.
 *
 * @param {string} ovrseeDir
 * @returns {string[]} fichiers de tickets avancés
 */
export function avancerTicketsClos(ovrseeDir) {
  const colonnes = readBoard(ovrseeDir)
  const finale = colonneFinale(colonnes)
  if (!finale) return []

  const plansFermes = new Set(
    readPlans(ovrseeDir).filter(p => p.meta.status === 'closed').map(p => p.file),
  )
  if (plansFermes.size === 0) return []

  const avances = []
  for (const ticket of readTickets(ovrseeDir, colonnes)) {
    if (!plansFermes.has(ticket.meta.plan) || ticket.meta.colonne === finale) continue
    try {
      moveTicket(ovrseeDir, ticket.file, finale)
      avances.push(ticket.file)
    } catch {
      // Un ticket qui ne peut pas être déplacé ne doit jamais faire échouer l'appelant.
    }
  }
  return avances
}
```

`readPlans` est déjà importé dans `tickets.js` (utilisé par `importOpenPlans`).
Pas de nouvel import externe.

Retirer l'ancienne version de `hooks/ovrsee-capture-plan.js` (l.130-155).

### `hooks/ovrsee-capture-plan.js` — appel mis à jour

```js
import { readBoard, readTickets, moveTicket, colonneFinale, clearActiveTicket, avancerTicketsClos } from './tickets.js'
// closeOpenPlans reste importé de plans.js, juste plus avancerTicketsClos

// dans main(), remplace :
//   const plansClos = closeOpenPlans(...)
//   avancerTicketsClos(ovrseeDir, plansClos)
// par :
closeOpenPlans(ovrseeDir, message => process.stderr.write(`[ovrsee] ${message}\n`))
avancerTicketsClos(ovrseeDir)
```

(Le retour de `closeOpenPlans` ne sert plus qu'aux logs internes de la fonction
elle-même — rien d'autre n'en dépendait à part l'appel supprimé.)

### `hooks/ovrsee-cli.js` — `close()` corrigé

```js
close() {
  const closed = closeOpenPlans(ovrseeDir, console.error)
  avancerTicketsClos(ovrseeDir) // le bug corrigé : les tickets suivent la fermeture
  if (closed.length === 0) {
    console.log('aucun plan ouvert portant un commit — rien à clore')
    return
  }
  for (const file of closed) console.log(`clos : ${file}`)
},
```

Import `avancerTicketsClos` ajouté depuis `./tickets.js` (le fichier importe
déjà plusieurs symboles de `tickets.js`, l.36-44).

### `hooks/ovrsee-post-commit.js` — filet automatique à chaque commit

Après l'appel existant à `avancerTicketsDuPlan` (l.157), dans le bloc `if
(existsSync(ovrseeDir))` :

```js
avancerTicketsClos(ovrseeDir)
```

Import `avancerTicketsClos` ajouté à la ligne 19 (déjà `colonneFinale,
readBoard, readTickets, moveTicket` depuis `./tickets.js`).

Ce filet tourne à *chaque* commit, pas seulement quand un plan vient de se
fermer explicitement — c'est lui qui aurait rattrapé le bug du CLI sans le
corriger à sa source.

### `hooks/ovrsee-cli.js` — `status()` signale les plans sans commit

`status()` (l.53-87) a déjà `plans`, et plus loin `colonnes`/`tickets`
(l.73-74, triés). Ajouter le bloc juste après la déclaration de `tickets`,
avant l'affichage des épics :

```js
const finale = colonneFinale(colonnes)
const enRetard = tickets.filter(t => {
  if (!t.meta.plan || t.meta.colonne === finale) return false
  const plan = plans.find(p => p.file === t.meta.plan)
  return plan?.meta.status === 'open' && (plan.meta.commits ?? []).length === 0
})
if (enRetard.length > 0) {
  console.log(`\n⚠ ${enRetard.length} ticket(s) lié(s) à un plan sans aucun commit :`)
  for (const t of enRetard) console.log(`  ${t.meta.id}  ${t.meta.titre}  (plan: ${t.meta.plan})`)
}
```

`colonneFinale` n'est **pas encore importé** dans `ovrsee-cli.js` (import actuel
de `./tickets.js` : `createTicket, importOpenPlans, moveTicket, readBoard,
readTickets, sortTickets, updateTicket, childrenOf`) — l'ajouter à cet import,
avec `avancerTicketsClos`. C'est un signal, pas une correction automatique :
un plan tout juste ouvert et sans commit n'est pas forcément un problème, mais
un humain ou l'agent doit pouvoir le voir plutôt que de le découvrir par
hasard.

## Correction manuelle de T-0030 (une fois, à la main)

- `ovrsee/plans/2026-08-11-ticket-obligatoire-avant-integration-pas-apres.md` :
  `status: "closed"`, `closed: "<date du jour>"` — le travail a bien été
  committé (`af718fa`), seul le rattachement automatique a raté.
- `ovrsee/tickets/T-0030-...md` : `colonne: "fait"` via
  `node hooks/ovrsee-cli.js ticket move <fichier> fait` (une fois le fix de
  `close()` en place, `moveTicket` seul suffit — pas besoin d'attendre la
  fermeture du plan puisqu'elle est faite à la main ici).

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `hooks/tickets.js` | +`avancerTicketsClos(ovrseeDir)` (nouvelle signature, sans `plansClos`) |
| `hooks/ovrsee-capture-plan.js` | Retire l'ancienne `avancerTicketsClos` ; importe et appelle la nouvelle |
| `hooks/ovrsee-cli.js` | `close()` appelle `avancerTicketsClos` ; `status()` signale les tickets en retard |
| `hooks/ovrsee-post-commit.js` | Appelle `avancerTicketsClos` après `avancerTicketsDuPlan` |
| `ovrsee/plans/2026-08-11-ticket-obligatoire-avant-integration-pas-apres.md` | Correction manuelle : `status: closed` |
| `ovrsee/tickets/T-0030-...md` | Correction manuelle : `colonne: fait` |

## Tests

- **`hooks/tickets.test.js`** : déplacer les 4 cas de
  `ovrsee-capture-plan.test.js` (adaptés à la nouvelle signature — écrire un
  vrai plan `status: closed` via `writeFileNoFollow`/`serializePlan` plutôt que
  de passer une liste) :
  - ne fait rien si aucun plan n'est fermé ;
  - avance un ticket dont le plan est fermé, quel que soit le moment où il a
    été fermé (pas seulement « à l'instant ») ;
  - ignore les tickets d'un plan encore ouvert ou d'un autre plan ;
  - ne fait rien sur un board à une seule colonne.
- **`hooks/ovrsee-capture-plan.test.js`** : retirer les 4 tests déplacés
  (la fonction n'y vit plus).
- **`hooks/ovrsee-post-commit.test.js`** : un cas où un ticket lié à un plan
  déjà fermé (mais pas encore avancé) se retrouve en colonne finale après un
  commit qui ne le concerne pas directement.
- Pas de fichier de test pour `ovrsee-cli.js` (aucun n'existe aujourd'hui,
  cohérent avec son statut de filet de secours qui a le droit d'échouer
  bruyamment) — vérification manuelle à la place (voir Vérification).

## Vérification

1. `pnpm test` vert.
2. `node hooks/ovrsee-cli.js status` avant correction manuelle : doit lister
   T-0030 sous « ticket(s) lié(s) à un plan sans aucun commit ».
3. Appliquer la correction manuelle de T-0030, puis `node hooks/ovrsee-cli.js
   status` : la ligne d'alerte disparaît.
4. `node hooks/ovrsee-cli.js tickets` : T-0030 apparaît en colonne finale.
5. Scénario de non-régression : capturer un plan bidon, le clore via `pnpm
   ovrsee:close` sans passer par une nouvelle capture de plan → son ticket
   lié doit apparaître en colonne finale (c'était l'appel manquant).
