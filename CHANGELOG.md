<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-4c3f91?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-3a3d4d?style=for-the-badge"></a>
</p>

# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [1.1.0-beta] — 2026-08-20

### Added

- **Crawling from the app.** The `Crawl` button now runs the crawl itself, over
  Electron IPC, with progress and a stop button — no cloning the repository and
  no `pnpm ovrsee:crawl`. `crawl/`, `mcp/` and `playwright-core` travel in the
  package (#24).
- **A configuration form for a project that is already equipped**, which had no
  route left to `ovrsee.config.json` once `ovrsee/` existed (#24).
- **Commits no hook ever saw are caught up.** A squash-merge made on GitHub
  creates its commit on their servers: no `post-commit`, no plan attached.
  `hooks/reconcile.js`, wired to the git `post-merge` hook, re-attaches on
  `git pull` from the tickets the message cites — several plans for one commit,
  ranges included. `pnpm ovrsee:reconcile` catches up a repository equipped
  before it (#27).
- ⌘W closes the focused terminal tab instead of the window; ⌘D opens a new
  terminal (also in the View menu).
- **Terminal tabs name themselves.** A tab takes the first words of the request
  sent into it. A name typed by hand (double-click) is never overwritten.
- **A live state on each terminal tab.** Three pulsing dots while Claude works,
  a green check when it hands back, a question mark when it waits for an
  answer — the dots stay still under `prefers-reduced-motion`.
- **The ticket panel resizes**, and a button opens it as a full modal for a long
  read.
- **Session state on terminal tabs.** A tab's dot turns green when Claude hands
  back and accent when it is waiting for an answer, so several sessions can be
  followed without switching tabs (#18).
- **Renaming a terminal.** Double-click a tab label (#20).

### Changed

- **Epics leave the Kanban.** An epic no longer sits in a column: the Board tab
  has a `Kanban` / `Epics` toggle, and an epic's state is derived from its
  children — `no children`, `not started`, `in progress`, `done`. An epic can
  therefore never be done while a child is still open. Child tickets are now
  plain cards in their own column (#19, #21).
- A failed crawl now says what the observed project's `dev` command said. It ran
  under `stdio: 'ignore'`, so a `pnpm: command not found` vanished and only
  "the app did not answer in 60000 ms" was left (#24).
- Stopping a crawl kills the process group, not just the child: the crawl
  started the observed project's dev server, and `child.kill()` would leave it
  running on its port (#24).

### Fixed

- **A secret no longer leaks into `scans.jsonl`.** The crawl kept 2 kB of the
  `dev` command's output and wrote it into a versioned file; a command dying on
  a missing environment variable sometimes prints its value. `redige()` masks
  the known shapes — `*KEY=`, `*TOKEN=`, `sk-…`, `ghp_…`, JWT, URL password,
  AWS key ids (`AKIA…`, `ASIA…`), Stripe underscore keys (`sk_live_`,
  `pk_test_`) and JSON-serialised config objects — from `recordScan()`, the only
  write point. The variable name and the host stay readable: that is what serves
  diagnosis (#26, #31).
- `terminal.rename_aria` wrote `{label}` where `t()` only substitutes `${…}`: a
  screen-reader user heard "Rename session {label}" and could not tell which
  terminal they were renaming. The added test is an invariant over both
  dictionaries, so any future translation writing `{param}` breaks CI (#23).
- `reconcile()` now names on stderr, at `pull` time, the tickets it settled from
  a commit message written elsewhere (#29).
- The ticket panel header no longer reads as a darker, narrower band: it takes
  its container's background and spans it edge to edge.
- An epic state tag now carries its state's style whole — background, text and
  border together — instead of a green label in a purple outline.
- The `?` on a terminal tab now shows only for a real question — a session left
  idle no longer turns its green check into a question mark.
- `/clear` gives a terminal tab its original name back, unless it was renamed by
  hand.
- Removed the stray dot left of the terminal tabs, which read as an empty tab.
- The epic detach button moved from the card to the bottom of the ticket panel,
  and now says which epic it detaches from.

## [1.0.0-beta] — 2026-08-13

First published release. The binaries are neither signed nor notarised: macOS and
Windows warn about it on first launch.

### Added

- **Seven tabs**: Overview, Browser, Product, History, Board, Data, Stack.
- **Plan capture** for plans approved in Claude Code, versioned as markdown under
  `<repo>/ovrsee/plans/`.
- **Playwright crawl** of the observed project: every screen photographed, dated
  and tied to the commit that produced it.
- **Ticket board** as a kanban — one markdown file per ticket, columns set in
  `ovrsee/board.json`, epics and WIP limits.
- **Post-commit hook** attaching each commit to the active plan.
- **Built-in terminal** (a real pty), over Electron IPC and never a local socket.
- **MCP server** over stdio in JSON-RPC 2.0: Claude reads all of `ovrsee/`, writes
  only the tickets and `board.json`, and executes no code.
- **Two skills** included, `ovrsee` and `ovrsee-tickets`, installable from the
  setup screen.
- **Obsidian export** with wikilinks between plans and tickets, and frontmatter
  queryable in Dataview.
- **Overview tab**: repository health, branches, Vercel/Netlify deployments and
  Supabase status. Tokens live outside the repository, encrypted with
  `safeStorage`.
- **Bilingual interface**, English and French.
- **Builds** for macOS arm64 (DMG) and Windows x64 (NSIS), published on every tag.

### Known limitations

- No macOS Intel build, and no Windows ARM build.
- No automatic updates: releases are downloaded by hand.
- The `ovrsee/` format may still move before 1.0. Everything in it being markdown
  and images, a migration will be readable with the naked eye.

[Unreleased]: https://github.com/samuelboulery/ovrsee/compare/v1.0.0-beta...HEAD
[1.0.0-beta]: https://github.com/samuelboulery/ovrsee/releases/tag/v1.0.0-beta
