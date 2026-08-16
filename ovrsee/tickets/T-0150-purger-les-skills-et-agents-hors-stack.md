---
{
  "id": "T-0150",
  "titre": "Purger les skills et agents hors-stack",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "perf",
    "config"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-de-consommation-de-tokens-constats-et-correctifs.md"
}
---

## Contexte

Le nom et la description de chaque skill et de chaque agent installés sont
injectés dans le contexte à chaque tour, qu'ils servent ou non. Mesuré :
8 761 octets pour le listing des 52 skills globaux, 5 618 octets pour celui des
28 agents.

L'essentiel concerne des langages absents de tous les projets actifs — Kotlin,
Java, Spring, Django, Laravel, C++, Perl, Rust, Go, PyTorch, Flutter. Sur un
projet Electron/TypeScript, c'est du poids mort relu à chaque tour.

Deux d'entre eux sont pires que du poids mort : les skills `cockpit` et
`cockpit-tickets` sont des copies périmées d'`ovrsee` et `ovrsee-tickets`,
restées après le renommage du projet. Deux skills quasi identiques dans le même
listing invitent à l'erreur d'invocation.

Décision prise : désinstaller plutôt que mettre en réserve. Tout est restaurable
depuis `/Users/sam/code/claude-config`, qui est la source versionnée.

Skills à retirer de `~/.claude/skills/` (34) : `android-clean-architecture`,
`compose-multiplatform-patterns`, `cpp-coding-standards`, `cpp-testing`,
`django-patterns`, `django-tdd`, `django-verification`, `golang-patterns`,
`golang-testing`, `java-coding-standards`, `kotlin-coroutines-flows`,
`kotlin-exposed-patterns`, `kotlin-ktor-patterns`, `kotlin-patterns`,
`kotlin-testing`, `laravel-patterns`, `laravel-tdd`, `laravel-verification`,
`perl-patterns`, `perl-testing`, `python-patterns`, `python-testing`,
`rust-patterns`, `rust-testing`, `springboot-patterns`, `springboot-tdd`,
`springboot-verification`, `configure-ecc`, `project-guidelines-example`,
`eval-harness`, `continuous-learning-v2`, `plankton-code-quality`, `cockpit`,
`cockpit-tickets`.

Agents à retirer de `~/.claude/agents/` (15) : `cpp-build-resolver.md`,
`cpp-reviewer.md`, `flutter-reviewer.md`, `go-build-resolver.md`,
`go-reviewer.md`, `java-build-resolver.md`, `java-reviewer.md`,
`kotlin-build-resolver.md`, `kotlin-reviewer.md`, `pytorch-build-resolver.md`,
`python-reviewer.md`, `rust-build-resolver.md`, `rust-reviewer.md`,
`chief-of-staff.md`, `database-reviewer.md`.

Gain attendu : ~2 200 tokens de moins sur chaque tour.

## Critères d'acceptation

- [ ] Les 34 skills et 15 agents listés ci-dessus ne sont plus dans
      `~/.claude/skills/` ni `~/.claude/agents/`.
- [ ] Aucun d'eux n'apparaît plus dans le listing injecté au démarrage d'une
      session neuve.
- [ ] `/ovrsee`, `/ovrsee-tickets`, `/graphify`, `superpowers:*` et
      `/commit-push-pr` restent invocables.
- [ ] `~/.claude/CLAUDE.md` ne décrit plus un inventaire qui n'existe plus : ses
      sections « Structure du setup » et « Chemins canoniques » citent les
      reviewers par langage et le skill `code-simplifier`.
