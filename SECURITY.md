<p align="center">
  <a href="./SECURITY.md"><img alt="English" src="https://img.shields.io/badge/🇬🇧-English-4c3f91?style=for-the-badge"></a>
  <a href="./SECURITY.fr.md"><img alt="Français" src="https://img.shields.io/badge/🇫🇷-Fran%C3%A7ais-3a3d4d?style=for-the-badge"></a>
</p>

# Security

## Reporting a vulnerability

**Do not open a public issue.** Use
[Security Advisories](https://github.com/samuelboulery/ovrsee/security/advisories/new):
the report stays private until a fix exists.

Expect a few days for a first response. This project is maintained by one person,
on their own time — that is a realistic delay, not a contractual commitment.

## Supported versions

Only the latest published release receives fixes. There is no maintenance branch.

## What the application does, and does not do

The project's invariant bounds the attack surface, and it is worth knowing before
you go looking for a flaw:

> **Ovrsee reads; the only thing it runs is the terminal you ask it for.**

Concretely:

- **The MCP server executes no code** from the observed project. It reads all of
  `<repo>/ovrsee/` and writes only `ovrsee/tickets/*.md` and `ovrsee/board.json`.
- **Only projects in the registry are readable.** A path absent from the registry
  is refused, even if it exists on disk. That allowlist is the boundary: a way
  around it is a vulnerability.
- **The terminal goes through Electron IPC, never a local socket.** A socket would
  open it to any process running under the same account — an explicit decision of
  the framing document, not an oversight.
- **The crawl refuses to start if `baseUrl` already answers.** Nothing in an HTTP
  response distinguishes your own server from another project's.
- **The crawl is the one exception to the above, and it is deliberate.**
  `pnpm ovrsee:crawl` runs the `dev` command declared in the observed project's
  `ovrsee.config.json` — the application has to start before it can be
  photographed. That is code from the observed repository, running on your
  machine, exactly like a `pnpm dev` or an npm install script. **Only register
  repositories you would already trust with a `pnpm dev`.** The rest of the
  application never runs anything from the observed project.

## Secrets

No secret lives in the observed repository. Integration tokens (Vercel, Netlify,
Supabase) are stored in `~/.claude/ovrsee/integrations.json`, **outside the
repository**, encrypted with `safeStorage`. Writing them, decrypting them and the
network call to the provider all go through Electron IPC and never through
`/api/*` — that route is also served by the Vite dev server, over unauthenticated
local HTTP.

The crawl's session cookies (`.ovrsee-auth.json`) are ignored by git.

A secret pasted into an approved plan, on the other hand, goes into git in the
clear: the defence is upstream — do not paste one.

## Unsigned binaries

Published DMGs and installers are **neither signed nor notarised**. macOS and
Windows will warn you on first launch. If that bothers you, build from source:
`pnpm install && pnpm package:mac` (or `package:win`).

Check that the downloaded file matches the checksum published on the release page.

## Dependencies

The project has four production dependencies — `@phosphor-icons/react`,
`@xterm/xterm`, `@xterm/addon-fit` and `node-pty` — and that restraint is a
security choice as much as a maintenance one.

Two defences are in place against poisoned publishes: pnpm blocks dependency
install scripts by default (`onlyBuiltDependencies` allows only `node-pty`, which
has to compile), and `.npmrc` imposes a 24 h quarantine on freshly published
versions.
