---
{
  "status": "closed",
  "title": "Rendre le serveur MCP de Cockpit réellement fonctionnel dans Claude Code",
  "opened": "2026-08-10",
  "closed": "2026-08-13",
  "commits": []
}
---

# Rendre le serveur MCP de Cockpit réellement fonctionnel dans Claude Code

## Contexte

Question posée : le MCP de Cockpit marche-t-il depuis Claude, et les skills
s'installent-ils facilement ? Diagnostic mené sur le code et par un test stdio réel.

**Skills : oui, ça marche déjà.** `hooks/skills.js` écrit `cockpit` et
`cockpit-tickets` dans `~/.claude/skills/<nom>/SKILL.md`, depuis l'écran
d'équipement (`app/src/EquipmentPanel.tsx`), l'écran Préférences
(`app/src/ClaudeConfigPanel.tsx` → `app/src/SkillsPanel.tsx`), ou
`node hooks/install.js <chemin> --skills cockpit,cockpit-tickets`. Les deux sont
installés sur cette machine et visibles dans cette session. Rien à faire.

Une nuance à connaître : `~/.claude/skills/` est lu par **Claude Code** — CLI et
sessions Claude Code lancées depuis l'app desktop. Le **chat** Claude Desktop
classique lit son propre dossier (`local-agent-mode-sessions/skills-plugin/…`,
géré par Anthropic) et n'y verra jamais les skills du cockpit.

**MCP : non, pas en l'état.** Le serveur démarre et répond, mais aucun client MCP
réel ne pourra appeler ses outils. Vérifié par un aller-retour stdio :

```
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{},…}}
{"jsonrpc":"2.0","id":3,"result":[{"path":"/Users/sam/code/cockpit",…}]}
```

- `capabilities: {}` — le serveur ne déclare pas `tools`, donc un client conforme
  n'appelle même pas `tools/list` (`mcp/server.js:74`).
- `tools/call` renvoie la donnée brute en `result`. La spec exige
  `{ content: [{ type: "text", text: … }], isError? }`. Chaque appel d'outil
  échouera à la validation côté client (`mcp/server.js:39`, `218-221`).
- `pnpm cockpit:mcp` est documenté (`CLAUDE.md:56`) mais **absent** de
  `package.json`.
- Le serveur n'est enregistré nulle part : `claude mcp list` ne le montre pas, et
  `claude_desktop_config.json` n'a aucune clé `mcpServers`.
- Les tests (`mcp/mcp.test.js`) n'appellent que `dispatch()`, jamais le fil. D'où
  un `pnpm test` vert sur un protocole cassé.

Bugs de fond trouvés au passage :

- `getGraph` lit `<repo>/cockpit/graphify-out/graph.json` — le fichier est à
  `<repo>/graphify-out/graph.json`. Renvoie toujours `null` (`mcp/dispatch.js:201`).
- `getTimeline` ignore `weeks` et passe `[]` comme commits, alors qu'il se décrit
  « chronologie des commits » (`mcp/dispatch.js:186-189`).
- `archiveTicket` déplace vers la colonne `'terminé'`, qui n'existe pas — les
  colonnes par défaut finissent par `fait` (`mcp/dispatch.js:292`, `cockpit/board.json`).
  Son test passe parce que sa fixture invente cette colonne.
- `mcp/dispatch.js` réimplémente la validation et la lecture au lieu d'appeler
  `resolve()` de `server/api.js` — exactement la faute que `CLAUDE.md:44-49`
  interdit, et que le même fichier affirme déjà évitée.

## Décision

Surface visée : **Claude Code** (CLI + sessions dans l'app desktop).
Périmètre : conformité MCP + bugs + factorisation sur `resolve()` + un test de
bout en bout par stdio.

## Préalable — branche isolée

L'arbre est sale : travail en cours sur l'onglet Aperçu (`app/src/highlight.ts`,
`markdown.tsx`, `electron/`, `hooks/i18n.js`…), et `cockpit/.active-plan` pointe
sur le plan « onglet Aperçu ». Sans précaution, les commits MCP se rattacheraient
à ce plan (piège décrit dans `CLAUDE.md`).

```bash
pnpm cockpit:close          # retire cockpit/.active-plan
git stash -u                # met de côté le travail Aperçu
git switch -c fix/mcp-conformite main
```

Base : **`main`**, pas `feat/refonte-preferences`. `resolve()` y expose déjà
`/api/projects`, `/api/project` et `/api/tickets` — les trois routes dont le MCP
a besoin (vérifié sur `main:server/api.js`). Le correctif ne touche ni `app/src`
ni `electron/`, donc aucun conflit avec la branche préférences, et la PR est
mergeable seule.

Au retour sur l'Aperçu : `git switch feat/refonte-preferences && git stash pop`,
puis rouvrir le plan Aperçu.

## Changements

### 1. `mcp/dispatch.js` — passer par `resolve()`

`snapshot(root)` (`hooks/snapshot.js:370-402`) contient déjà **tout** ce que les
outils de lecture reconstruisent séparément : `board`, `tickets`, `plans`,
`timeline`, le graphe (`readGraph`), `pages`, `scans`, `config`, `readme`.
`resolve()` l'expose via `GET /api/project?path=`.

Remplacer le `switch` par une table `outil → { url, method, body, extrait }` :

| Outil | Route `resolve()` | Extrait |
|---|---|---|
| `listProjects` | `GET /api/projects` | tel quel |
| `getProjectSummary` | `GET /api/project?path=` | compteurs depuis le snapshot |
| `getBoard` | `GET /api/project?path=` | `.board` |
| `listTickets` | `GET /api/project?path=` | `.tickets`, triés, `slice(0, limit)` |
| `getPlans` | `GET /api/project?path=` | `.plans`, triés, `slice(0, limit)` |
| `getTimeline` | `GET /api/project?path=` | `.timeline` (corrige les commits vides) |
| `getGraph` | `GET /api/project?path=` | le graphe du snapshot (corrige le chemin) |
| `createTicket` | `POST /api/tickets` | `{ action: 'create', … }` |
| `updateTicket` | `POST /api/tickets` | `{ action: 'update', … }` |
| `moveTicket` | `POST /api/tickets` | `{ action: 'move', … }` |

Points d'attention :

- Appeler `resolve(url, '', { method, headers: { 'x-cockpit': '1' }, body })`.
  Le `cwd` vide est délibéré : en stdio il n'y a pas de dépôt courant, seul le
  registre fait liste blanche (`projects()` — `hooks/snapshot.js:68-79`).
  L'en-tête `x-cockpit` est la parade CORS du dev server ; en stdio il n'y a pas
  de navigateur, on le fournit.
- **Garder** le refus des symlinks avant l'appel (`lstatSync().isSymbolicLink()`,
  aujourd'hui `mcp/dispatch.js:41-43`). `resolve()` ne l'a pas ; le perdre serait
  une régression de défense en profondeur.
- Traduire `{ status, json: { error } }` de `resolve()` en erreur d'outil.
- **Supprimer `archiveTicket`** : `moveTicket` fait déjà le travail, et sa
  colonne codée en dur est fausse. Retirer aussi son entrée de `tools/list` et
  son test.
- **Retirer `weeks`** du schéma de `getTimeline` : un paramètre déclaré et ignoré
  est un mensonge d'interface. `limit` sur `listTickets`/`getPlans` reste, lui
  est appliqué.

### 2. `mcp/server.js` — conformité protocole

- `initialize` → `capabilities: { tools: {} }`.
- `tools/call` → envelopper : `{ content: [{ type: 'text', text: JSON.stringify(data) }] }`,
  et pour une erreur d'outil `{ content: [{ type: 'text', text: message }], isError: true }`
  **dans `result`**, pas en erreur JSON-RPC. Les erreurs JSON-RPC (`-32601`,
  `-32600`, `-32700`) restent pour les fautes de protocole seulement.
- Le reste est déjà correct : les notifications sans `id` sont ignorées
  (`mcp/server.js:67`), et aucun `console.log` ne pollue stdout dans les hooks
  importés (vérifié).

### 3. `package.json`

Ajouter le script que `CLAUDE.md:56` promet déjà :

```json
"cockpit:mcp": "node mcp/server.js"
```

### 4. `mcp/mcp.test.js` — un test du fil, pas seulement du dispatcher

Ajouter un test qui `spawn`e `node mcp/server.js`, écrit
`initialize` / `tools/list` / `tools/call listProjects` sur stdin et assert sur
stdout, avec `COCKPIT_REGISTRY` pointant sur un registre temporaire (même
technique que les tests existants). C'est le test qui aurait attrapé les deux
bugs de conformité. Style `node:test` / `node:assert`, sans framework.

### 5. Doc

- `README.md:156-186` : remplacer l'exemple `claude_desktop_config.json` par
  l'enregistrement Claude Code, garder l'exemple Desktop en second.
- `CLAUDE.md:44-49` : la phrase « les trois appellent la même fonction pure
  `resolve()` » redevient vraie une fois le §1 fait — rien à corriger si le §1
  est fait, à corriger sinon.

### 6. Enregistrement (une fois, hors dépôt)

```bash
claude mcp add -s user cockpit -- node /Users/sam/code/cockpit/mcp/server.js
```

Portée `user` parce que le MCP est multi-projet par construction : il lit le
registre `~/.claude/cockpit/projects.json`, pas le dépôt courant.

## Vérification

1. `pnpm test` — vert, y compris le nouveau test stdio.
2. Aller-retour manuel, la réponse à `tools/call` doit contenir `content` :
   ```bash
   printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"getProjectSummary","arguments":{"path":"/Users/sam/code/cockpit"}}}' \
    '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"getGraph","arguments":{"path":"/Users/sam/code/cockpit"}}}' \
    | pnpm -s cockpit:mcp
   ```
   `getGraph` ne doit plus renvoyer `null`.
3. `claude mcp list` → `cockpit … ✔ Connected`.
4. Dans une session Claude Code neuve, appeler `listProjects` puis
   `createTicket` sur un projet enregistré, et vérifier le fichier écrit dans
   `cockpit/tickets/`.
5. Écriture hors périmètre refusée : `getProjectSummary` sur un chemin absent du
   registre → erreur d'outil, pas de lecture disque.
6. `pnpm typecheck` (ne couvre que `app/src`, non touché ici — sanity check).
7. `git diff main --stat` : ne doit lister que `mcp/`, `package.json`, `README.md`,
   `CLAUDE.md`. Rien d'`app/src` ni d'`electron/` — sinon le stash a fui.
