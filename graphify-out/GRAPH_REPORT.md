# Graph Report - /Users/sam/code/cockpit  (2026-08-08)

## Corpus Check
- 43 files · ~385,873 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 267 nodes · 401 edges · 32 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `run()` - 14 edges
2. `main()` - 10 edges
3. `projectAction()` - 8 edges
4. `log()` - 8 edges
5. `snapshot()` - 8 edges
6. `walkChildren()` - 7 edges
7. `walk()` - 7 edges
8. `walkXImport()` - 7 edges
9. `walkElement()` - 7 edges
10. `createRuntime()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `resolve()` --calls--> `shotPath()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.js → /Users/sam/code/cockpit/hooks/snapshot.js
- `boot()` --calls--> `render()`  [INFERRED]
  /Users/sam/code/cockpit/support.js → /Users/sam/code/cockpit/scripts/make-icon.js
- `planWhy()` --calls--> `s()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/data.ts → /Users/sam/code/cockpit/app/src/tabs/Backlog.tsx
- `url()` --calls--> `visitAll()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/crawl/index.js
- `post()` --calls--> `resolve()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/server/api.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (17): reload(), s(), fetchProjects(), fetchSnapshot(), firstParagraph(), history(), json(), lastScan() (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (21): cockpitWith(), main(), planFrom(), readOrNull(), readStdin(), repoRoot(), titleOf(), attachCommit() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (23): assertIgnored(), main(), assertPortFree(), isIgnored(), loadConfig(), log(), orphanShots(), pathOf() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (17): fetchHandler(), parseBody(), projectAction(), resolve(), usableDirectory(), commandFor(), install(), installClaudeHooks() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.39
Nodes (8): age(), buildBrief(), closedPlans(), frDate(), intention(), openPlans(), readCockpit(), readJson()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (7): commits(), readJson(), scans(), shotPath(), shotsByPage(), snapshot(), timeline()

### Community 7 - "Community 7"
Cohesion: 0.36
Nodes (5): closeAll(), closeSession(), loginShell(), openSession(), sessionEnv()

### Community 8 - "Community 8"
Cohesion: 0.43
Nodes (5): applyProjects(), onPop(), projectFromUrl(), pushUrl(), tabForPath()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (2): backlog(), s()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (2): post(), url()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (2): onKey(), step()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): terminalBridge(), useTerminal()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
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

## Knowledge Gaps
- **Thin community `Community 19`** (2 nodes): `vite.config.js`, `cockpitData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `confStyle()`, `Donnees.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `findHelpers()`, `fix-pty-permissions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `Stack.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `cockpit-session-start.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log()` connect `Community 3` to `Community 2`, `Community 4`?**
  _High betweenness centrality (0.237) - this node is a cross-community bridge._
- **Why does `render()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `boot()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `main()` (e.g. with `closeOpenPlans()` and `planFileName()`) actually correct?**
  _`main()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `projectAction()` (e.g. with `registerProject()` and `touchProject()`) actually correct?**
  _`projectAction()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `log()` (e.g. with `main()` and `closeOpenPlans()`) actually correct?**
  _`log()` has 4 INFERRED edges - model-reasoned connections that need verification._