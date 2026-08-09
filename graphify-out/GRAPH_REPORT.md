# Graph Report - /Users/sam/code/cockpit  (2026-08-09)

## Corpus Check
- 63 files · ~771,382 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 413 nodes · 675 edges · 47 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]

## God Nodes (most connected - your core abstractions)
1. `writeFileNoFollow()` - 15 edges
2. `resolve()` - 14 edges
3. `run()` - 14 edges
4. `createTicket()` - 13 edges
5. `snapshot()` - 12 edges
6. `ticketAction()` - 11 edges
7. `ecrire()` - 10 edges
8. `readBoard()` - 10 edges
9. `main()` - 10 edges
10. `liste()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `ecrirePages()` --calls--> `isSafeSlug()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/obsidian.js → /Users/sam/code/cockpit/hooks/plans.js
- `boot()` --calls--> `render()`  [INFERRED]
  /Users/sam/code/cockpit/support.js → /Users/sam/code/cockpit/scripts/make-icon.js
- `reload()` --calls--> `Navigateur()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/App.tsx → /Users/sam/code/cockpit/app/src/tabs/Navigateur.tsx
- `ecrire()` --calls--> `ticketAction()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/tabs/Tableau.tsx → /Users/sam/code/cockpit/server/api.js
- `normalize()` --calls--> `slugify()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/tabs/Navigateur.tsx → /Users/sam/code/cockpit/hooks/plans.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (27): reload(), briefLines(), buildInjections(), colonneFinale(), density(), fetchProjects(), fetchSkills(), fetchSnapshot() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (32): ticketAction(), readCockpit(), cockpitWith(), parsePlan(), readPlans(), serializePlan(), slugify(), cockpitWithPlans() (+24 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (24): projectAction(), main(), planFrom(), readOrNull(), readStdin(), repoRoot(), titleOf(), attachCommit() (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (23): assertIgnored(), main(), assertPortFree(), isIgnored(), loadConfig(), log(), orphanShots(), pathOf() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.19
Nodes (19): pageName(), commandFor(), install(), installClaudeHooks(), installPostCommit(), shq(), ecrireIndex(), ecrirePages() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (18): fetchHandler(), parseBody(), resolve(), post(), postSkills(), postTicket(), projectWithShot(), projetEnregistre() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (7): serveUi(), Navigateur(), normalize(), startUrl(), URL_KEY(), shotPath(), useResizable()

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (9): ajouter(), creer(), deplacer(), ecrire(), modifier(), renommer(), reordonner(), retirer() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (11): commits(), readJson(), readText(), scans(), shotsByPage(), snapshot(), tableau(), timeline() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.27
Nodes (5): applyProjects(), onPop(), projectFromUrl(), pushUrl(), tabForPath()

### Community 11 - "Community 11"
Cohesion: 0.36
Nodes (8): age(), buildBrief(), closedPlans(), frDate(), intention(), openPlans(), readJson(), colonneFinale()

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (4): fixture(), lire(), vault(), plan()

### Community 13 - "Community 13"
Cohesion: 0.36
Nodes (5): closeAll(), closeSession(), loginShell(), openSession(), sessionEnv()

### Community 14 - "Community 14"
Cohesion: 0.53
Nodes (4): injectToClaude(), pasteToClaude(), terminalBridge(), useTerminals()

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (1): Garde

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (2): inline(), inlinePattern()

### Community 17 - "Community 17"
Cohesion: 0.4
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (2): onKey(), step()

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 0.67
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

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 26`** (2 nodes): `vite.config.js`, `cockpitData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `Illisibles()`, `Illisibles.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `snapshot()`, `render.test.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `confStyle()`, `Donnees.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `pluriel()`, `Apercu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `project()`, `snapshot.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `fixture()`, `skills.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `whys.test.js`, `projet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `tempRepo()`, `install.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `findHelpers()`, `fix-pty-permissions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `node-test.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Stack.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `cockpit-session-start.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 4` to `Community 3`, `Community 5`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `render()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Why does `boot()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `writeFileNoFollow()` (e.g. with `run()` and `writeBoard()`) actually correct?**
  _`writeFileNoFollow()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `resolve()` (e.g. with `post()` and `postTicket()`) actually correct?**
  _`resolve()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `createTicket()` (e.g. with `ticketAction()` and `writeFileNoFollow()`) actually correct?**
  _`createTicket()` has 3 INFERRED edges - model-reasoned connections that need verification._