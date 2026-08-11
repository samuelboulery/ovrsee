---
{
  "status": "open",
  "title": "Ticket obligatoire avant intégration (pas après)",
  "opened": "2026-08-11",
  "closed": null,
  "commits": []
}
---

# Ticket obligatoire avant intégration (pas après)

## Contexte

Invariant du projet (CLAUDE.md) : la vérité vit dans `ovrsee/`. Aujourd'hui, la
création de ticket n'est **jamais imposée** :

- `hooks/ovrsee-capture-plan.js` (PostToolUse sur `ExitPlanMode`) capture le plan
  approuvé et pousse via `additionalContext` un simple conseil : « décompose-le
  maintenant en tickets via le skill ovrsee-tickets ». C'est une suggestion, jamais
  un blocage (`exit 0` toujours, par contrat).
- `hooks/ovrsee-tool-edit.js` (PostToolUse sur `Edit|Write`) fait avancer en
  `en-cours` les tickets déjà liés au plan actif — mais si aucun ticket n'existe
  encore, il ne se passe rien, silencieusement. Rien n'empêche Claude de commencer
  à éditer du code sous un plan actif sans avoir créé de ticket.
- Aucun hook `PreToolUse` propre à ovrsee n'existe (vérifié dans
  `~/.claude/settings.json` : seuls `DetachIsland` sur `*` et `pnpm-guard.js` sur
  `Bash` sont enregistrés en `PreToolUse`).

Résultat observé : le ticket se crée après coup (souvent au moment du commit ou
sur demande explicite), jamais avant que l'édition de code ne commence — symétrique
inversé de ce que veut l'utilisateur. Le dépôt courant en est un exemple : plusieurs
fichiers source déjà modifiés (`App.tsx`, `PreferencesIntegrations.tsx`, etc.) alors
que les tickets/plans correspondants (`T-0028`, `T-0029`) viennent juste d'être créés.

**Décision prise avec l'utilisateur** : passer d'un nudge non bloquant à une gate
stricte, sur le modèle de `~/.claude/hooks/pnpm-guard.js` (`exit 2` + message sur
stderr = blocage de l'appel d'outil, message renvoyé au modèle).

## Approche

Ajouter un nouveau hook `PreToolUse` sur `Edit|Write`, spécifique à ovrsee, qui
bloque la toute première édition de code sous un plan actif tant qu'aucun ticket
n'est lié à ce plan.

### Nouveau fichier : `hooks/ovrsee-tool-edit-gate.js`

Même contrat stdin que `ovrsee-tool-edit.js` (`tool_input.file_path`, `cwd`), mais
`PreToolUse` donc bloquant sur violation :

1. `root = repoRoot(cwd)` → si absent, `exit 0` (rien à faire, hors dépôt git).
2. `ovrseeDir = join(root, 'ovrsee')` → si absent, `exit 0` (projet non équipé).
3. Réutiliser `estUneEditionSource(root, file_path)` (exporté par
   `ovrsee-tool-edit.js`, à importer) → si `false` (édition dans `ovrsee/` ou
   `graphify-out/`, ex. le skill `ovrsee-tickets` qui écrit un ticket), `exit 0`.
4. Lire `ovrsee/.active-plan` → si absent, `exit 0` (pas de plan actif : rien à
   imposer, portée identique à `ovrsee-tool-edit.js`).
5. `planFile = ...` (valider avec `isSafePlanFileName`, déjà importé ailleurs).
6. `readBoard` + `readTickets` (déjà exportés par `hooks/tickets.js`) → filtrer les
   tickets dont `meta.plan === planFile`.
7. Si **au moins un ticket lié** existe → `exit 0` (déjà fait, jamais bloquant une
   deuxième fois pour ce plan).
8. Sinon → écrire sur stderr un message clair (plan concerné, rappel d'utiliser le
   skill `ovrsee-tickets` ou l'outil MCP `createTicket` avec `plan: "<planFile>"`)
   et `exit 2`.

Toujours envelopper `main()` dans un try/catch qui ne bloque **que** sur la
violation détectée — jamais sur une erreur interne du hook (même filet que les
autres hooks ovrsee : `readBoard`/`readTickets` qui échouent ne doivent pas
paralyser toutes les éditions).

### Enregistrement dans `~/.claude/settings.json`

Ajouter une entrée dans la section `PreToolUse` (actuellement seulement `*` et
`Bash`), à côté de la section `PostToolUse` → `Edit|Write` existante :

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "'/Users/sam/.nvm/versions/node/v22.14.0/bin/node' '/Users/sam/code/ovrsee/hooks/ovrsee-tool-edit-gate.js'"
    }
  ]
}
```

### Tests : `hooks/ovrsee-tool-edit-gate.test.js`

Suivre le style `node:test` déjà utilisé (`ovrsee-tool-edit.test.js` si présent,
sinon calquer sur `ovrsee-post-commit.test.js`) :

- plan actif + zéro ticket lié + édition source → bloque (code de sortie 2 /
  fonction exportée retourne violation).
- plan actif + ticket lié (même `meta.plan`) → passe.
- pas de plan actif → passe.
- édition dans `ovrsee/` (ex. écriture d'un ticket) → passe, même sans ticket
  préexistant.
- dépôt non équipé (pas de dossier `ovrsee/`) → passe.

Exporter la logique de décision (ex. `ticketManquant(ovrseeDir, planFile)`)
séparément de `main()`, comme le fait déjà `avancerTicketsEnCours` — permet de
tester sans passer par stdin/exit.

## Fichiers touchés

- `hooks/ovrsee-tool-edit-gate.js` (nouveau)
- `hooks/ovrsee-tool-edit-gate.test.js` (nouveau)
- `~/.claude/settings.json` (ajout section `PreToolUse` → `Edit|Write`)
- Éventuellement un export supplémentaire dans `hooks/ovrsee-tool-edit.js` si
  `estUneEditionSource` doit être exposé plus proprement (déjà `export`é —
  vérifier qu'il n'y a pas de cycle d'import entre les deux fichiers hooks).

## Vérification

1. `pnpm test` — la nouvelle suite doit passer, et aucune régression sur
   `ovrsee-tool-edit.test.js` / `ovrsee-capture-plan.test.js` existants.
2. Test manuel en conditions réelles :
   - Créer un plan factice, l'activer (`ovrsee/.active-plan` pointant dessus,
     zéro ticket avec ce `plan`).
   - Tenter un `Edit` sur un fichier source du dépôt ovrsee → doit être bloqué,
     message stderr lisible expliquant quoi faire.
   - Créer le ticket (skill `ovrsee-tickets` ou MCP `createTicket`) avec
     `plan: "<planFile>"`.
   - Refaire le même `Edit` → doit passer, et `ovrsee-tool-edit.js` (PostToolUse)
     fait ensuite avancer le ticket en `en-cours` comme avant.
3. Vérifier qu'écrire un ticket lui-même (`ovrsee/tickets/*.md`) ne se bloque
   jamais (chemin exclu par `estUneEditionSource`).
