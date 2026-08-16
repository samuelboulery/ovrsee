---
{
  "id": "T-0151",
  "titre": "Dégraisser les règles globales",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
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

`~/.claude/rules/common/` (10 fichiers, 14 084 octets) et
`~/.claude/rules/README.md` (4 345 octets) sont injectés intégralement dans le
contexte de chaque session, tous projets confondus. Ensemble : ~4 600 tokens
relus à chaque tour.

Le `README.md` est le cas le plus net : il explique **comment installer les
règles**, avec son script `install.sh` et sa procédure de copie de répertoires.
C'est de la documentation de maintenance du dépôt de config. En session, il ne
sert jamais et pèse 1 086 tokens à chaque tour.

Les fichiers de `common/` répètent en bonne partie ce que le modèle fait déjà
par défaut. Trois sont à traiter à part :

- `package-manager.md` (3 329 o, le plus gros) : la règle opérante tient en
  quelques lignes — pnpm exclusif, table de correspondance, scripts de cycle de
  vie bloqués par défaut. Le récit de l'incident ChainDrop et la checklist
  d'ajout de dépendance sont de la culture, pas de l'instruction : à basculer
  dans un skill invocable, où ils restent consultables sans être résidents.
- `performance.md` (1 599 o) : sa table de choix de modèles cite Sonnet 4.6 et
  Opus 4.7. Périmée, et le harnais choisit déjà. À supprimer.
- `agents.md` (1 544 o) : liste les agents disponibles, ce que le listing
  automatique injecte déjà juste à côté. Doublon. À supprimer.

Les sept restants (`hooks`, `patterns`, `coding-style`, `testing`, `security`,
`git-workflow`, `development-workflow`) sont à condenser en un ou deux fichiers,
cible ~5 000 octets pour l'ensemble de `common/`.

Gain attendu : ~3 300 tokens de moins sur chaque tour.

**Ne pas perdre au passage** : pnpm exclusif, demander avant d'installer une
dépendance, demander avant toute action destructive, Conventional Commits en
français. Ce sont des règles non déductibles — c'est précisément ce qui justifie
qu'elles restent résidentes.

## Critères d'acceptation

- [ ] `~/.claude/rules/README.md` n'est plus injecté (déplacé hors de
      `~/.claude/rules/`, conservé dans `claude-config`).
- [ ] `~/.claude/rules/common/` pèse ~5 000 octets ou moins.
- [ ] Les quatre règles non déductibles listées ci-dessus sont encore présentes
      et lisibles dans ce qui reste.
- [ ] Le contenu retiré de `package-manager.md` est accessible via un skill
      invocable, pas perdu.
- [ ] Les changements sont répercutés dans `/Users/sam/code/claude-config/claude/`.
