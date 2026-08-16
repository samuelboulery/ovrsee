<p align="center">
  <a href="./CHANGELOG.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-4c3f91?style=for-the-badge"></a>
  <a href="./CHANGELOG.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-3a3d4d?style=for-the-badge"></a>
</p>

# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

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
