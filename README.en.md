# Ovrsee — English

A read-only view of a vibecoded project: what was built, why, what remains open,
and what the app looked like at each commit. Full docs: [`README.md`](./README.md)

**Ovrsee reads; it only runs a terminal if you ask.** The truth lives in `<repo>/ovrsee/`,
in markdown and images, versioned by git. The app is just a view — if it disappears, nothing is lost.

Complete context: [`cadrage-ovrsee.md`](./cadrage-ovrsee.md) (French)

![Ovrsee overview](./ovrsee/pages/shots/accueil/2026-08-09-24c3123.png)

## First launch

A freshly cloned — or downloaded — ovrsee opens **empty**: no project is watched
until you point at one. A three-screen modal then explains what the app does, tunes
the interface to how you use Claude Code, and leads to picking a first repository.
It is skippable in one click — or with Escape — and replayable from *Preferences →
General → Replay the walkthrough*.

The answers are not decorative: they pick which tabs show, where the terminal sits,
and which command is offered when a fresh project opens. Everything stays editable
in Preferences afterwards.

## Quick start

```bash
# Install once per project
pnpm ovrsee:install /path/to/project

# Map the application (requires ovrsee.config.json at project root)
pnpm ovrsee:crawl /path/to/project

# Read
pnpm electron          # app with integrated terminal
pnpm dev               # or browser, no terminal
pnpm ovrsee:brief     # or text from CLI
```

When a plan is approved in Claude Code, it is captured automatically in `ovrsee/plans/`.
The post-commit hook then attaches each commit to the active plan. Close the plan when work is done:

```bash
pnpm ovrsee:close     # removes .active-plan
```

While a plan is active, every commit gets attached to it — even unrelated fixes.
Closing is not optional: it lets you switch tasks without polluting the history.

## Claude Code Skills

Two skills, installed from the init screen or with `--skills`:

| Skill | What it teaches |
|---|---|
| `ovrsee` | Read `ovrsee/`: plans, pages, screenshots, pitfalls |
| `ovrsee-tickets` | Write board tickets, format, gestures |

**Graphify** (feeds the Data tab) is detected but not installed — the app shows the command.

## Architecture Overview

The app consists of 7 tabs, read-only:

- **Overview** — entry point, active plan status, Obsidian export
- **Navigator** — crawl logs, page map
- **Product** — dependency graph
- **History** — approved plans, timeline
- **Board** — kanban of tickets
- **Data** — tables (from Graphify or Obsidian vault)
- **Stack** — code audit (README, missing tests, etc.)

For developers:

| Directory | Role |
|---|---|
| `hooks/` | Plan capture, ticket I/O, git hooks, CLI |
| `crawl/` | Playwright traversal, dated screenshots |
| `server/` | HTTP routes (`/api/*`) |
| `mcp/` | MCP server (JSON-RPC 2.0), read/write tickets |
| `app/src/` | React interface, TypeScript strict |
| `electron/` | Main process, preload, PTY (terminal) |
| `scripts/` | Build and test utilities |

The **terminal is integrated in Electron only** — it runs over IPC, not a socket.
This is intentional: a socket would be open to any process on the same user.

## Known Traps

**An active plan captures every commit.**
While `ovrsee/.active-plan` exists, the post-commit hook attaches all commits to it — including unrelated fixes. Run `pnpm ovrsee:close` before switching tasks.

**The crawler refuses to start if `baseUrl` already responds.**
This is intentional. There is no way to distinguish your own server from another's in an HTTP response, and crawling the wrong app would produce backdated screenshots.

**`node-pty` is a native binary.**
It is unpacked from the asar (`asarUnpack` in `electron-builder.yml`) and
`spawn-helper` must retain its execute bit — hence `scripts/fix-pty-permissions.js` in postinstall.
This is the classic packaging breaking point and only shows up when running the DMG, never in dev.

**A secret pasted into an approved plan goes into git history in plain text.**
The fix is upstream — don't paste it. Credentials live in a password manager and in an unversioned `ACCESS.md`.

## Running Tests

```bash
pnpm test       # Node tests (hooks, crawl, server, mcp) + UI tests (app/src)
pnpm typecheck  # TypeScript check (app/src only)
```

The project uses Node's built-in `test` module only — no test frameworks.

## See also

- [`CLAUDE.md`](./CLAUDE.md) — technical reference (French)
- [`cadrage-ovrsee.md`](./cadrage-ovrsee.md) — design rationale (French)
