# Graph Report - /Users/sam/code/cockpit  (2026-08-09)

## Corpus Check
- 48 files · ~524,777 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 330 nodes · 541 edges · 37 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]

## God Nodes (most connected - your core abstractions)
1. `run()` - 14 edges
2. `createTicket()` - 13 edges
3. `ticketAction()` - 11 edges
4. `resolve()` - 11 edges
5. `ecrire()` - 10 edges
6. `readBoard()` - 10 edges
7. `main()` - 10 edges
8. `snapshot()` - 10 edges
9. `writeFileNoFollow()` - 9 edges
10. `projectAction()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `boot()` --calls--> `render()`  [INFERRED]
  /Users/sam/code/cockpit/support.js → /Users/sam/code/cockpit/scripts/make-icon.js
- `ecrire()` --calls--> `ticketAction()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/tabs/Tableau.tsx → /Users/sam/code/cockpit/server/api.js
- `url()` --calls--> `visitAll()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/crawl/index.js
- `post()` --calls--> `resolve()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/server/api.js
- `postTicket()` --calls--> `resolve()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/server/api.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (19): reload(), colonneFinale(), fetchProjects(), fetchSnapshot(), firstParagraph(), history(), json(), lastScan() (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (26): cockpitWith(), main(), planFrom(), readOrNull(), readStdin(), repoRoot(), titleOf(), attachCommit() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (23): assertIgnored(), main(), assertPortFree(), isIgnored(), loadConfig(), log(), orphanShots(), pathOf() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (28): ticketAction(), readCockpit(), parsePlan(), readPlans(), writeFileNoFollow(), addColumn(), createTicket(), deleteTicket() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (20): fetchHandler(), parseBody(), projectAction(), resolve(), usableDirectory(), commandFor(), install(), installClaudeHooks() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.23
Nodes (9): ajouter(), creer(), deplacer(), ecrire(), modifier(), renommer(), reordonner(), retirer() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.36
Nodes (8): age(), buildBrief(), closedPlans(), frDate(), intention(), openPlans(), readJson(), colonneFinale()

### Community 8 - "Community 8"
Cohesion: 0.36
Nodes (5): applyProjects(), onPop(), projectFromUrl(), pushUrl(), tabForPath()

### Community 9 - "Community 9"
Cohesion: 0.36
Nodes (5): closeAll(), closeSession(), loginShell(), openSession(), sessionEnv()

### Community 10 - "Community 10"
Cohesion: 0.52
Nodes (6): post(), postTicket(), projectWithShot(), projetEnregistre(), url(), withRegistry()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (2): inline(), inlinePattern()

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (2): onKey(), step()

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (2): terminalBridge(), useTerminal()

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 22`** (2 nodes): `vite.config.js`, `cockpitData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `confStyle()`, `Donnees.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `pluriel()`, `Apercu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `project()`, `snapshot.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `findHelpers()`, `fix-pty-permissions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Stack.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `cockpit-session-start.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 3` to `Community 2`, `Community 5`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `render()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `boot()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `createTicket()` (e.g. with `ticketAction()` and `writeFileNoFollow()`) actually correct?**
  _`createTicket()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `ticketAction()` (e.g. with `ecrire()` and `createTicket()`) actually correct?**
  _`ticketAction()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `resolve()` (e.g. with `post()` and `postTicket()`) actually correct?**
  _`resolve()` has 7 INFERRED edges - model-reasoned connections that need verification._