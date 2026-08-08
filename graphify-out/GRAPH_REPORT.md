# Graph Report - /Users/sam/code/cockpit  (2026-08-08)

## Corpus Check
- 10 files · ~22,581 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 97 nodes · 166 edges · 16 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `main()` - 9 edges
2. `walkChildren()` - 7 edges
3. `walk()` - 7 edges
4. `walkXImport()` - 7 edges
5. `walkElement()` - 7 edges
6. `createRuntime()` - 7 edges
7. `compileAttr()` - 6 edges
8. `collectProps()` - 6 edges
9. `updatePlanMeta()` - 6 edges
10. `boot()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `attachCommit()` --calls--> `isSafePlanFileName()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-post-commit.js → /Users/sam/code/cockpit/hooks/plans.js
- `attachCommit()` --calls--> `updatePlanMeta()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-post-commit.js → /Users/sam/code/cockpit/hooks/plans.js
- `P()` --calls--> `slugify()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/plans.test.js → /Users/sam/code/cockpit/hooks/plans.js
- `closePreviousPlans()` --calls--> `readPlans()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-capture-plan.js → /Users/sam/code/cockpit/hooks/plans.js
- `closePreviousPlans()` --calls--> `updatePlanMeta()`  [INFERRED]
  /Users/sam/code/cockpit/hooks/cockpit-capture-plan.js → /Users/sam/code/cockpit/hooks/plans.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (15): closePreviousPlans(), main(), readStdin(), registerProject(), repoRoot(), titleOf(), isSafePlanFileName(), parsePlan() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (2): isElementClass(), isRenderableType()

### Community 2 - "Community 2"
Cohesion: 0.31
Nodes (13): collectProps(), compileAttr(), contentKey(), isDeckMountTag(), walk(), walkChildren(), walkComponent(), walkDeckChildren() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (8): boot(), dcNameFromPath(), getReactDOM(), parseDataProps(), parseDcDocument(), parseDcText(), rootNameForDocument(), safeDecode()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (7): createExternalModules(), createHelmetManager(), createPseudoSheet(), createRegistry(), createRuntime(), createStreamTracker(), init()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): cdnScriptFor(), findTopLevelEquality(), loadReactUmd(), loadScript(), parensWrapWhole(), resolve(), resolvePath()

### Community 6 - "Community 6"
Cohesion: 0.7
Nodes (3): attachCommit(), changedFiles(), git()

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (3): createComponentFactory(), evalDcLogic(), getReact()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): cssToObj(), hostPositionStyle(), kebabToCamel()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): compileTemplate(), encodeCamelAttrs(), encodeCase()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (3): importantify(), scanUnquotedUrl(), stripComments()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
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

## Knowledge Gaps
- **Thin community `Community 11`** (2 nodes): `shq()`, `install.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `cockpit-cli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `_ds_bundle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `attachCommit()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `updatePlanMeta()` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `main()` (e.g. with `planFileName()` and `writeFileNoFollow()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._