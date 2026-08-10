---
{
  "status": "closed",
  "title": "Ticketing automatique après plan ou audit validé",
  "opened": "2026-08-10",
  "closed": "2026-08-10",
  "commits": [
    {
      "sha": "76327a2",
      "date": "2026-08-10",
      "files": [
        "app/src/data.ts",
        "app/src/tabs/Tableau.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js",
        "hooks/ovrsee-capture-audit.js",
        "hooks/ovrsee-capture-plan.js",
        "hooks/ovrsee-capture-plan.test.js",
        "hooks/ovrsee-post-commit.js",
        "hooks/ovrsee-post-commit.test.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js",
        "mcp/server.js"
      ]
    }
  ]
}
---

# Ticketing automatique après plan ou audit validé

## Contexte

Aujourd'hui, le tableau kanban d'ovrsee (`ovrsee/board.json` + `ovrsee/tickets/*.md`, onglet `Tableau` dans l'app) existe et fonctionne, mais son alimentation reste manuelle : le skill `cockpit-tickets` explique *comment* écrire un ticket, mais rien ne déclenche cette écriture automatiquement. `importOpenPlans()` (`hooks/tickets.js`) reprend bien les plans ouverts, mais un plan → un seul ticket, sans décomposition ni estimation. Le hook `ovrsee-capture-plan.js` (déjà en place, `PostToolUse` sur `ExitPlanMode`) capture le texte du plan mais s'arrête là. Rien n'existe côté audits. Aucun champ de charge/complexité n'existe dans le schéma ticket. Et l'avancement des colonnes est un geste manuel de Claude pendant la conversation — la visualisation est à jour en temps réel (elle relit le disque), mais rien ne fait bouger les cartes toute seule.

Objectif : qu'une fois le repo équipé, un plan validé ou un audit validé se traduisent automatiquement en tickets priorisés et estimés, et que le tableau avance de lui-même à mesure que le travail est commité — sans étape manuelle demandée par l'utilisateur.

En cours de route, l'utilisateur a signalé un trou apparenté : le modèle epic existe côté données (`type: 'epic'`, `epic: 'T-XXXX'` dans `hooks/tickets.js`) et s'affiche dans `Tableau.tsx` (badge, barre de progression, filtre par enfants), mais **rien dans l'interface ne permet de créer un epic ni d'y rattacher un ticket** — seul un lien de détachement existe, via un cast TypeScript qui contourne le typage plutôt que de l'exposer proprement. Comme la décomposition automatique (sections B/C) va produire des epics avec enfants plus souvent qu'aujourd'hui, ce trou devient plus visible : d'où son ajout ici (section E).

Décisions actées avec l'utilisateur :
- Décomposition en tickets **automatique, sans confirmation**, aussi bien après un plan que **après tout skill d'audit** (`code-review`, `security-review`, `ponytail-audit`, `ponytail-review`).
- Charge estimée en **T-shirt sizing** (`xs`/`s`/`m`/`l`/`xl`), même style que `priorite`.
- Le board **avance automatiquement via les commits** : ticket lié au plan actif → colonne « en cours » au premier commit, colonne finale à la clôture du plan.

Le mécanisme technique retenu pour piloter Claude depuis un hook non bloquant est confirmé : `PostToolUse` peut renvoyer `{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "..."}}` sur stdout, exit 0 — le texte s'injecte dans le tour de Claude sans jamais simuler un échec d'outil. C'est cohérent avec la philosophie actuelle des hooks du repo (« on signale, on ne bloque jamais »).

## A. Champ `charge` sur les tickets (T-shirt XS–XL)

- **`hooks/tickets.js`** : ajouter `export const CHARGES = ['xs', 's', 'm', 'l', 'xl']` à côté de `PRIORITES`, et un `requireCharge()` miroir de `requirePriorite()`. Champ **optionnel** (comme `type`/`epic`) : un ticket sans charge reste valide — une estimation qui n'existe pas ne doit pas bloquer la création. Brancher dans `createTicket()` et `updateTicket()` sur le même modèle que `type`/`epic` (valider si présent, absent sinon, supprimable via `patch.charge === null`).
- **`hooks/tickets.test.js`** : tests de création avec charge valide, rejet d'une charge hors énum, mise à jour et suppression du champ.
- **`mcp/dispatch.js`** : vérifier comment `createTicket`/`updateTicket` transmettent les champs à `hooks/tickets.js` — ajouter `charge` si les champs sont énumérés explicitement plutôt que transmis tels quels.
- **Skill `~/.claude/skills/cockpit-tickets/SKILL.md`** : ajouter `charge` au tableau des champs (`xs`, `s`, `m`, `l`, `xl`, optionnel), avec une ligne rappelant que c'est un ordre de grandeur, pas un engagement.
- **Skill `~/.claude/skills/cockpit/SKILL.md`** : mentionner le champ côté lecture (section Tickets), même sobriété que pour `priorite`.
- **`app/src/data.ts`** : type `Charge`, `CHARGES`, `charge?: Charge` sur `interface Ticket`.
- **`app/src/tabs/Tableau.tsx`** : badge de charge à côté du point de couleur `priorite` sur chaque carte (même registre visuel : petit, discret) ; sélecteur `charge` dans le formulaire d'édition de ticket, à côté du sélecteur `priorite` existant (~ligne 851).

## B. Décomposition automatique d'un plan validé

- **`hooks/ovrsee-capture-plan.js`** : ne change rien à ce qui existe déjà (écriture du plan, `.active-plan`, registre). Remplacer la sortie `process.stdout.write('[ovrsee] plan capturé...')` par une sortie JSON :
  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": "[ovrsee] Plan capturé : ovrsee/plans/<file>. Décompose-le maintenant en tickets via le skill cockpit-tickets — priorité et charge (xs–xl) pour chacun, champ plan renseigné. Un plan simple peut ne produire qu'un seul ticket : ne pas forcer le découpage."
    }
  }
  ```
  Toujours exit 0, jamais de blocage — cohérent avec le contrat existant du fichier.
- **Skill `cockpit-tickets/SKILL.md`**, section « La retenue » : préciser que le geste de proposer/écrire des tickets après un plan approuvé est désormais **automatique et immédiat** (déclenché par le hook) ; la retenue porte sur le *nombre* de tickets créés, pas sur le fait d'en créer.

## C. Décomposition automatique après un audit validé

- **Nouveau `hooks/ovrsee-capture-audit.js`**, `PostToolUse` sur le matcher `Skill`. Sur stdin, lit `tool_input.skill` (nom du skill invoqué). Si ce nom appartient à une liste fermée `AUDIT_SKILLS = ['code-review', 'security-review', 'ponytail-audit', 'ponytail-review']`, écrit sur stdout la même forme de `hookSpecificOutput.additionalContext`, adaptée : nudge Claude à décomposer les constats de la revue en tickets (priorité dérivée de la gravité du finding, charge estimée), un ticket par constat réel — pas un par ligne de rapport. Sinon, sortie silencieuse. Exit 0 toujours, même contrat de robustesse que `ovrsee-capture-plan.js` (try/catch enveloppant, jamais d'exception qui remonte).
- **`~/.claude/settings.json`** : enregistrer ce hook à côté de l'entrée existante `PostToolUse` / `ExitPlanMode` → `ovrsee-capture-plan.js`, avec `"matcher": "Skill"`.

## D. Avancement automatique du board via les commits

- **`hooks/ovrsee-post-commit.js`** : après avoir rattaché le commit au plan actif (comportement existant, inchangé), chercher les tickets dont `meta.plan` égale le plan actif. Si un ticket est encore dans une colonne de préparation (pas déjà « en cours » ni au-delà) et que c'est le premier commit du plan, le déplacer vers la colonne d'id `en-cours` si le board en a une (`readBoard`/`moveTicket` de `hooks/tickets.js`) ; sinon, ne rien faire et le signaler sur stderr (même tolérance que le reste du hook — un board sans cette colonne ne doit jamais faire planter le hook).
- **`hooks/ovrsee-capture-plan.js`** : au moment où `closeOpenPlans()` clôt un plan portant des commits (juste avant la capture du nouveau plan), pour chaque plan qui vient de passer à `closed`, déplacer les tickets liés (`meta.plan` = ce plan) vers `colonneFinale(readBoard(ovrseeDir))` (helper déjà présent dans `hooks/tickets.js`) — sans effet si le board n'a qu'une seule colonne (`colonneFinale` renvoie déjà `null` dans ce cas). Vérifier d'abord si `closeOpenPlans()` retourne la liste des plans fermés ; sinon l'étendre a minima pour l'exposer (petit changement de retour, pas de changement de signature d'appel côté appelants existants qui ignorent déjà la valeur de retour).
- **Skill `cockpit-tickets/SKILL.md`**, section « Suivre le travail » : documenter que ce déplacement est désormais automatique quand le ticket est lié à un plan (`plan` renseigné) ; le geste manuel décrit reste la référence pour les tickets non liés à un plan (créés à la main, sans plan associé).

## E. Gestion des epics dans l'interface

Tout le nécessaire est déjà en place côté données et API — `createTicket`/`updateTicket` (`hooks/tickets.js`) acceptent déjà `type`/`epic`, et la route `POST /api/tickets` (`server/api.js`, cases `create`/`update`) transmet le corps de la requête tel quel, sans liste blanche de champs. Le travail est donc limité à `app/src/tabs/Tableau.tsx` (+ typage dans `data.ts`) :

- **Panneau `Detail`** (édition d'un ticket, ~ligne 796) : élargir le type de `onModifier` de la signature explicite actuelle (`{ titre?; priorite?; tags?; corps? }`) à `Partial<Ticket> & { corps?: string }` — ce que le code fait déjà de facto via un cast à la ligne 785, donc pas de nouveau comportement, juste un typage honnête.
- Dans ce même panneau, à côté du sélecteur `priorite` (~ligne 849-860) :
  - Une case à cocher « Epic » : `onModifier({ type: coché ? 'epic' : null })`. Désactivée si `ticket.epic` est renseigné (un enfant ne peut pas devenir epic sans se détacher d'abord — profondeur maximale 1, déjà la règle documentée dans le skill `cockpit-tickets`).
  - Un sélecteur « Epic parent », visible seulement si `ticket.type !== 'epic'` : liste `allTickets.filter(t => t.type === 'epic')`, valeur `ticket.epic ?? ''`, option vide = aucun. `onChange` → `onModifier({ epic: valeur || null })`. Remplace le lien de détachement actuel (ligne ~778-785) : un seul contrôle pour attacher et détacher, plutôt que deux mécanismes séparés.
- **`Detail` doit recevoir `allTickets`** : le composant `Tableau` a déjà `tickets` en portée à l'endroit où `<Detail ... />` est instancié (~ligne 288) — ajouter `allTickets={tickets}` à l'appel, comme c'est déjà fait pour `Carte` (ligne 268).
- Pas de changement à la création rapide (`creer(titre, colonne)`, ligne 109) : elle reste volontairement minimale (un champ, une touche Entrée). Promouvoir un ticket en epic ou l'attacher à un epic se fait après création, dans le panneau de détail — cohérent avec la manière dont `priorite` se règle déjà aujourd'hui.

## Vérification

- `pnpm test` dans `/Users/sam/code/ovrsee` (couvre `hooks/tickets.test.js`, `mcp/mcp.test.js`).
- Simuler un cycle complet : proposer un plan factice → `ExitPlanMode` → vérifier que `ovrsee/plans/<file>.md` est écrit et que des tickets avec `priorite` + `charge` apparaissent dans `ovrsee/tickets/`, avec `plan` renseigné.
- `git commit` sur une branche avec plan actif lié à un ticket → vérifier que le ticket bascule en colonne « en cours ».
- Approuver un nouveau plan (déclenchant `closeOpenPlans()`) → vérifier que les tickets liés au plan qui vient de se fermer atterrissent en colonne finale.
- Lancer `/code-review` ou `security-review` sur un diff → vérifier le message additionalContext, puis que les tickets créés portent bien `priorite` cohérente avec la gravité.
- Ouvrir l'onglet Tableau dans l'app (`pnpm dev` ou équivalent existant) → confirmer que le badge de charge s'affiche sur les cartes et que le sélecteur fonctionne en édition.
- Dans ce même onglet : cocher « Epic » sur un ticket, vérifier le badge et la barre de progression ; ouvrir un autre ticket et l'attacher via le sélecteur « Epic parent », vérifier qu'il apparaît groupé sous son epic ; le détacher via le même sélecteur (valeur vide).
- Reconstruire l'app Electron en fin de travail (`pnpm package`), par préférence connue.
