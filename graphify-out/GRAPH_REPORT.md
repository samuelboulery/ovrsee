# Graph Report - /Users/sam/code/cockpit  (2026-08-08)

## Corpus Check
- 14 files · ~35,849 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 122 nodes · 207 edges · 20 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `run()` - 12 edges
2. `main()` - 9 edges
3. `walkChildren()` - 7 edges
4. `walk()` - 7 edges
5. `walkXImport()` - 7 edges
6. `walkElement()` - 7 edges
7. `createRuntime()` - 7 edges
8. `compileAttr()` - 6 edges
9. `collectProps()` - 6 edges
10. `updatePlanMeta()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `pageSlug()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/crawl/routes.js
- `run()` --calls--> `normalizeRoutes()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/crawl/routes.js
- `run()` --calls--> `writeFileNoFollow()`  [INFERRED]
  /Users/sam/code/cockpit/crawl/index.js → /Users/sam/code/cockpit/hooks/plans.js
- `attachCommit()` --calls--> `isSafePlanFileName()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-post-commit.js → /Users/sam/code/cockpit/hooks/plans.js
- `attachCommit()` --calls--> `updatePlanMeta()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-post-commit.js → /Users/sam/code/cockpit/hooks/plans.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (14): closePreviousPlans(), main(), readStdin(), registerProject(), repoRoot(), titleOf(), parsePlan(), planFileName() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (2): isElementClass(), isRenderableType()

### Community 2 - "Community 2"
Cohesion: 0.26
Nodes (15): assertPortFree(), isIgnored(), loadConfig(), log(), pathOf(), pruneShots(), recordScan(), retainable() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (13): collectProps(), compileAttr(), contentKey(), isDeckMountTag(), walk(), walkChildren(), walkComponent(), walkDeckChildren() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (8): boot(), dcNameFromPath(), getReactDOM(), parseDataProps(), parseDcDocument(), parseDcText(), rootNameForDocument(), safeDecode()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): createExternalModules(), createHelmetManager(), createPseudoSheet(), createRegistry(), createRuntime(), createStreamTracker(), init()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): cdnScriptFor(), findTopLevelEquality(), loadReactUmd(), loadScript(), parensWrapWhole(), resolve(), resolvePath()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (3): normalizeRoutes(), pageSlug(), segmentsOf()

### Community 8 - "Community 8"
Cohesion: 0.53
Nodes (4): attachCommit(), changedFiles(), git(), isSafePlanFileName()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (3): importantify(), scanUnquotedUrl(), stripComments()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (3): cssToObj(), hostPositionStyle(), kebabToCamel()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): createComponentFactory(), evalDcLogic(), getReact()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): compileTemplate(), encodeCamelAttrs(), encodeCase()

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

## Knowledge Gaps
- **Thin community `Community 13`** (2 nodes): `shot()`, `retention.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `shq()`, `install.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `routes.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `Community 2` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `writeFileNoFollow()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `updatePlanMeta()` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `run()` (e.g. with `normalizeRoutes()` and `pageSlug()`) actually correct?**
  _`run()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `main()` (e.g. with `planFileName()` and `writeFileNoFollow()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._