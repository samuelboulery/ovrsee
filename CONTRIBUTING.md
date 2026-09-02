<p align="center">
  <a href="./CONTRIBUTING.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-4c3f91?style=for-the-badge"></a>
  <a href="./CONTRIBUTING.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-3a3d4d?style=for-the-badge"></a>
</p>

# Contributing

Thanks for looking at this project. It is maintained by one person: open an issue
before writing code for a feature — it saves you from working on something that
will not be merged.

## Getting started

```bash
pnpm install
pnpm dev        # interface only, port 5180, no terminal
pnpm electron   # the full application, terminal included
```

Node ≥ 22 and pnpm are required. The pnpm version is pinned by the
`packageManager` field: Corepack enforces it, do not work around it.

## Before opening a PR

```bash
pnpm test        # node --test on hooks/ crawl/ server/ mcp/ scripts/, then compiled app/src
pnpm typecheck   # tsc — covers app/src ONLY
pnpm lint
```

All three must pass. CI replays them on macOS and on Windows.

**Check against what git holds, not against your working copy.** Some files
present on your machine are ignored by git: a test that depends on one passes
locally and breaks in CI. It has happened.

```bash
mkdir /tmp/verif && git archive HEAD | tar -x -C /tmp/verif
cd /tmp/verif && pnpm install && pnpm test
```

## The rules that are not up for discussion

**`pnpm` only.** Not `npm`, not `yarn`, not `bun`. One lockfile,
`pnpm-lock.yaml`, always committed.

**No test framework.** Tests use `node:test` and `node:assert`, nothing else. Do
not bring in vitest, jest or mocha — write in the existing style. `app/src` is no
exception: `scripts/test-ui.js` compiles it into a throwaway folder and runs the
same `node --test` on it.

**Ask before adding a dependency.** The project has five in production, and that
is a choice — of security as much as of maintenance. Open an issue explaining why
the standard library or a dependency already present is not enough.

**No `.css` file in `app/src`.** Styles go through the `s()` helper in
`app/src/style.ts`, on the design system tokens.

## Language

English is the public language, French the working one.

In English: the showcase site, the repository's front-door documents (this file,
`README.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`). Each has its
`*.fr.md` counterpart.

In French: code comments, `CLAUDE.md`, `cadrage-ovrsee.md`, the plans and tickets
under `ovrsee/`, and commit messages. English for identifiers and code, as always.

Commit messages follow Conventional Commits, in French:

```
feat: ajoute le filtre par étiquette au tableau
fix: corrige le bit d'exécution de spawn-helper au postinstall
docs: précise la marche à suivre sous Windows
chore: monte electron-builder en 26.16
```

## What is not edited by hand

- **`ovrsee/`** is produced by hooks. Only `ovrsee/tickets/*.md` and
  `ovrsee/board.json` are written by hand. Plans, pages, scans and screenshots
  write themselves: fixing one manually produces a state the next commit will
  overwrite.
- **`_ds/ovrsee/styles.css`** is the design system. It is the only stylesheet the
  application loads.
- **`graphify-out/graph.json`** is generated. It is versioned deliberately, but it
  regenerates — do not edit it.
- **`site/fr/`** is the French page, generated at publish time by
  `scripts/build-site-fr.js` from `site/index.html` and `site/dict.json`. Fix
  French wording in `dict.json`, never in a generated page.

## Two traps that cost half a day

**A route tested in the browser is not a route tested in Electron.**
`server/api.js` has three hosts — the Vite middleware, the main process's
`ovrsee://` protocol, and the MCP server — all calling the same `resolve()`
function. The custom protocol has no CORS, no `Origin`, and not the same headers.
Check both.

**The MCP server's stdout is the transport, not a log.** A `console.log` added
anywhere under `hooks/` or `server/` lands in the middle of a JSON-RPC stream and
cuts the conversation short. Traces go to stderr.

## The rest

`CLAUDE.md` documents the architecture, the known traps and the decisions already
settled. The framing — problem, discarded alternatives, scope — is in
`cadrage-ovrsee.md`. Both are in French, and both are worth reading before
proposing a structural change.
