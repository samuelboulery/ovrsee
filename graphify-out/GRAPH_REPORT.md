# Graph Report - /Users/sam/code/cockpit  (2026-08-08)

## Corpus Check
- 33 files · ~95,504 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 204 nodes · 307 edges · 31 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
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
10. `visitAll()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `planWhy()` --calls--> `s()`  [INFERRED]
  /Users/sam/code/cockpit/app/src/data.ts → /Users/sam/code/cockpit/app/src/tabs/Backlog.tsx
- `visitAll()` --calls--> `url()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/server/api.test.js
- `main()` --calls--> `log()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/auth.js → /Users/sam/code/cockpit/crawl/index.js
- `run()` --calls--> `pageSlug()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/crawl/routes.js
- `run()` --calls--> `writeFileNoFollow()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/hooks/plans.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (15): s(), fetchProjects(), fetchSnapshot(), firstParagraph(), history(), json(), lastScan(), pageName() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (21): url(), assertPortFree(), isIgnored(), loadConfig(), log(), orphanShots(), pathOf(), pruneShots() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (19): cockpitWith(), closePreviousPlans(), main(), readStdin(), registerProject(), repoRoot(), titleOf(), attachCommit() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (5): cssToObj(), hostPositionStyle(), isElementClass(), isRenderableType(), kebabToCamel()

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
Cohesion: 0.25
Nodes (8): boot(), dcNameFromPath(), getReactDOM(), parseDataProps(), parseDcDocument(), parseDcText(), rootNameForDocument(), safeDecode()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): createExternalModules(), createHelmetManager(), createPseudoSheet(), createRegistry(), createRuntime(), createStreamTracker(), init()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): cdnScriptFor(), findTopLevelEquality(), loadReactUmd(), loadScript(), parensWrapWhole(), resolve(), resolvePath()

### Community 10 - "Community 10"
Cohesion: 0.47
Nodes (3): onPop(), projectFromUrl(), tabForPath()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (2): backlog(), s()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): createComponentFactory(), evalDcLogic(), getReact()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (3): compileTemplate(), encodeCamelAttrs(), encodeCase()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (3): importantify(), scanUnquotedUrl(), stripComments()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (2): assertIgnored(), main()

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

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 17`** (2 nodes): `vite.config.js`, `cockpitData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `confStyle()`, `Donnees.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `shq()`, `install.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `Historique.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `Stack.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `cockpit-session-start.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `writeFileNoFollow()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `readPlans()` connect `Community 2` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `main()` (e.g. with `planFileName()` and `writeFileNoFollow()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._