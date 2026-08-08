# Graph Report - /Users/sam/code/cockpit  (2026-08-08)

## Corpus Check
- 37 files · ~167,511 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 220 nodes · 324 edges · 28 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `run()` - 14 edges
2. `main()` - 9 edges
3. `walkChildren()` - 7 edges
4. `walk()` - 7 edges
5. `walkXImport()` - 7 edges
6. `walkElement()` - 7 edges
7. `createRuntime()` - 7 edges
8. `compileAttr()` - 6 edges
9. `collectProps()` - 6 edges
10. `log()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `planWhy()` --calls--> `s()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/data.ts → /Users/sam/code/cockpit/app/src/tabs/Backlog.tsx
- `url()` --calls--> `visitAll()`  [INFERRED]
  /Users/sam/code/cockpit/server/api.test.js → /Users/sam/code/cockpit/crawl/index.js
- `log()` --calls--> `closeOpenPlans()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/hooks/plans.js
- `run()` --calls--> `pageSlug()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/crawl/routes.js
- `run()` --calls--> `writeFileNoFollow()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/hooks/plans.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (36): boot(), cdnScriptFor(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet(), createRegistry() (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (15): s(), fetchProjects(), fetchSnapshot(), firstParagraph(), history(), json(), lastScan(), pageName() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (23): url(), assertIgnored(), main(), assertPortFree(), isIgnored(), loadConfig(), log(), orphanShots() (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (18): cockpitWith(), main(), readStdin(), repoRoot(), titleOf(), backlog(), closeOpenPlans(), parsePlan() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.31
Nodes (13): collectProps(), compileAttr(), contentKey(), isDeckMountTag(), walk(), walkChildren(), walkComponent(), walkDeckChildren() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (8): fetchHandler(), resolve(), projects(), readJson(), scans(), shotPath(), shotsByPage(), snapshot()

### Community 6 - "Community 6"
Cohesion: 0.39
Nodes (8): age(), buildBrief(), closedPlans(), frDate(), intention(), openPlans(), readCockpit(), readJson()

### Community 7 - "Community 7"
Cohesion: 0.38
Nodes (4): closeAll(), closeSession(), findProgram(), openSession()

### Community 8 - "Community 8"
Cohesion: 0.47
Nodes (3): onPop(), projectFromUrl(), tabForPath()

### Community 9 - "Community 9"
Cohesion: 0.53
Nodes (4): attachCommit(), changedFiles(), git(), isSafePlanFileName()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): terminalBridge(), useTerminal()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
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

## Knowledge Gaps
- **Thin community `Community 13`** (2 nodes): `vite.config.js`, `cockpitData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `confStyle()`, `Donnees.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `shq()`, `install.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `findHelpers()`, `fix-pty-permissions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `Historique.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `Stack.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `cockpit-session-start.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `readPlans()` connect `Community 3` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `closeOpenPlans()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `main()` (e.g. with `closeOpenPlans()` and `planFileName()`) actually correct?**
  _`main()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._