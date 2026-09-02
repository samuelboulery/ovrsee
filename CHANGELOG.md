<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-4c3f91?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-3a3d4d?style=for-the-badge"></a>
</p>

# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [1.2.0] — 2026-09-02

### Added

- **A complete light theme, terminal included** (issue #64, epic T-0218). The
  xterm canvas does not read CSS, so its palette is reapplied on every live
  terminal when you switch.
- **Per-project accent colour** (#48, T-0215). A project carries a hue, kept in
  the registry — a workstation preference, not something the observed
  repository gets to choose.
- **Pasting an image straight into a ticket** (T-0219, #54).
- **Session status in the project picker, and a commands panel**
  (T-0217, T-0224, T-0225, #47).
- **Per-project prompts, one command list, and a collapsible band** (T-0216, #79).
- **Commenting on an area from the Browser tab** (#65, T-0214).
- The showcase site now shows the seven real tabs instead of a mockup (#91).
- The terminal tab bar moved to icons, and a page's chosen size is pinned (T-0220).
- A plan left open without a commit can be closed by hand:
  `ovrsee:close <plan.md> --commit <sha>`.

### Changed

- **A second slimming pass removed 1,311 lines** across the tree, and recovered
  three mislabeled strings on the way (T-0232).
- The 800-line ceiling is now measured by a test rather than written in a rule
  (T-0241). Its exemption list is the debt, and it is meant to shrink.
- The README version badge reads from `package.json` instead of a hardcoded
  number (#95).

### Fixed

- **The "system" theme setting stopped following the OS in Electron** (T-0242).
  Opening the Browser tab's DevTools re-forced `themeSource`, which froze the
  render's media query and silenced the system-theme listener.
- **A commit now attaches to every plan it completes, not just one** (T-0223).
  A plan under which work had actually been written could otherwise never be
  closed, since the closing date is taken from the last commit.
- `close <plan.md>` closed every open plan instead of the one named, whenever
  `--commit` was absent (T-0223).
- `reconcile` missed commits made on the same day (T-0222).
- **Seven broken thumbnails on the Product tab**, and a count printed twice
  ("14 14 plans") (T-0250). Also: "last audit ago today", "1 tickets", and a
  banner telling you to open Ovrsee while you are looking at it.

### Security

- **An observed repository could run code the moment you registered it**
  (T-0244). `git status` honours the repository's own `.git/config`, and
  `core.fsmonitor` there names a program. Registering a project reads its
  status — so a repository received as an archive ran its own code, long before
  the crawl's `dev` agreement (T-0190) had any say. Every git command aimed at
  an observed repository now goes through one guard.
- **Equipping a project ran its git hooks** (T-0245). The bootstrap commit now
  passes `--no-verify`.
- **A file served by the app could execute inside it** (T-0246). `/api/media`
  served the repository's `.svg` without a neutralising header, and a top-level
  navigation could promote it to a page in the interface's own origin — with
  `window.ovrsee`, and therefore the terminal. File responses now carry
  `Content-Security-Policy: sandbox` on both hosts, and the main window no
  longer navigates at all.
- **A single malformed line killed the MCP server** (T-0247), and the session
  lost every tool without a message.
- **Three writes could wipe settings and integration tokens** (T-0248). They
  now go through an atomic write that also refuses a symlink.


## [1.1.2-beta] — 2026-08-31

### Security

- **A repository could get its `dev` command run without anyone agreeing to
  it.** `ovrsee.config.json` is versioned, so its `dev` line is written by
  whoever authored the observed repository — and the crawl handed it to a shell.
  A commit touching sources was enough to start it. That command now requires an
  explicit agreement, kept in `~/.claude/ovrsee/trust.json`, outside the observed
  repository — a hostile clone must not ship its own approval. What is remembered
  is the exact string handed to `shellRun()`, so changing `dev` asks again. The
  guard sits at both execution sites rather than at the entry points, so adding a
  caller cannot forget it. With no human present (the `post-commit` hook, a
  non-TTY stdin) it refuses instead of asking, and the Product tab shows the
  failed scan.
- **The observed repository could override `bootstrap`.** That array is offered
  to the Claude terminal, and an entry starting with `!` or `/` runs immediately.
  A cloned repository no longer has any say in it: `bootstrap` is a workstation
  preference, not a property of the repository being watched.
- **`pages.json` leaked what the observed application printed on screen.**
  Redaction only covered `scans.jsonl`, yet the crawl also writes `pages.json` —
  versioned too — whose `excerpt` holds 400 characters of the observed app's
  `innerText`, and `title` its DOM title. An admin page showing a token, a debug
  page printing its configuration, an application error rendered on screen: the
  text went into git unfiltered.
- **Redaction cut off more than the secret.** A sensitive name followed by `=`
  or `:` swallowed the rest of the line, false positives included — the host and
  exit code sharing that line disappeared with it. An authentication header name
  still takes the whole line; an ordinary assignment now stops at the next space.
- A full cybersecurity audit hardened the webview boundary, secret handling and
  the supply chain. `readBody` never resolved after `req.destroy()` on an
  oversized body, and `/api/config-claude` returned hook commands that can carry
  a hardcoded token.

### Changed

- **The terminal no longer loads at startup.** xterm is a third of the bundle and
  now sits behind `lazy()`; `graph.json` (687 KB, read synchronously on every
  project change for a tab that is often closed) left the snapshot for a route
  served when the Data tab mounts. The main bundle went from 972 KB to 616 KB,
  252 KB to 164 KB gzipped. Screenshot retention was made cheaper at the same
  time.
- A repo-wide slimming pass removed wiring that promised settings nobody sets,
  exports announcing a public surface that did not exist, and code restating by
  hand what the machine can derive. No visible change in behavior.
- Dependency bumps: oxlint, Electron, Vite and the React group.

### Fixed

- The command shortcut wrote into the `claude` session whatever tab was being
  looked at, and switched to it. With several terminals open, a click from the
  second one wrote into the first.
- The collapsed sidebar rail diverged from the open one in three ways: search was
  missing entirely, a logo appeared that exists nowhere when open, and the whole
  thing was off by one pixel.
- The project dropdown counter totalled backlog, to-specify and ready tickets —
  inflating a number that claims to say what is left to do. It counts ready
  tickets only.
- Session status did not always update, and the dropdown shifted the layout as it
  opened.

## [1.1.1-beta] — 2026-08-20

### Security

- **A page served by localhost could write to the API.** The `X-Ovrsee` header
  relied on the CORS preflight to keep third-party pages out, but Vite's default
  policy allows *any* `localhost` origin, on any port — including the observed
  project's own pages, the ones the Browser tab displays and the crawl visits.
  From there, a `POST /api/projects {action:'init'}` was enough to write the
  `dev` command that the next crawl executes. Every `/api/` route now checks the
  request origin, reads included: `/api/config-claude` returned the hook commands
  from `~/.claude/` with no header at all. Requests carrying no `Origin` are
  accepted — that is every non-browser caller, Electron's `ovrsee://` protocol
  among them.
- **`redige()` masked only the first word of an `Authorization` header.** A
  multi-field Digest gave away `response`, the hash derived from the password,
  and any scheme outside the known three — AWS4-HMAC-SHA256, Negotiate — leaked
  its signature next to a `***` that made the line look redacted. An unquoted
  value is now consumed to the end of the line (#36).
- **Scalars inside an array escaped secret masking.** A token stored in a list in
  `settings.json` came out whole through `/api/config-claude`, while the same
  token set directly on the key was masked.
- The request body of the dev server is capped at 1 MB. An endless local POST
  used to grow its memory until the process died.

### Fixed

- `crawl/auth.js` had drifted from `crawl/index.js`: it ran the `dev` command
  without the login shell — so without pnpm's PATH outside a terminal — and threw
  away whatever the command said before failing.

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
- An `Authorization` header no longer leaks its credential. The unquoted value
  stopped at the first word, so `Authorization: Bearer <token>` was written as
  `Authorization: *** <token>` — a `***` that gave the change while the token
  went out in the clear. The scheme keyword is now part of the value (#34).
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

[Unreleased]: https://github.com/samuelboulery/ovrsee/compare/v1.1.2-beta...HEAD
[1.1.2-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.1.1-beta...v1.1.2-beta
[1.1.1-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.1.0-beta...v1.1.1-beta
[1.1.0-beta]: https://github.com/samuelboulery/ovrsee/compare/v1.0.0-beta...v1.1.0-beta
[1.0.0-beta]: https://github.com/samuelboulery/ovrsee/releases/tag/v1.0.0-beta
