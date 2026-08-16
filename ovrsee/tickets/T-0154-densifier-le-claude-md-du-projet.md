---
{
  "id": "T-0154",
  "titre": "Densifier le CLAUDE.md du projet",
  "epic": "T-0148",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "s",
  "tags": [
    "perf",
    "docs"
  ],
  "cree": "2026-08-16",
  "maj": "2026-08-16",
  "plan": "2026-08-16-audit-de-consommation-de-tokens-constats-et-correctifs.md"
}
---

## Contexte

`CLAUDE.md` pèse 11 170 octets (~2 793 tokens) et il est relu à chaque tour de
chaque session ovrsee. C'est le troisième poste du plancher résident, derrière
le listing des skills et les règles globales.

Le fichier n'est pas mauvais — il est bavard. Trois gisements, sans rien perdre
de ce qui compte :

- **Pièges connus** (14 entrées) est le cœur de valeur du fichier et doit rester
  entier en nombre d'entrées. Mais plusieurs racontent leur genèse sur cinq
  lignes là où la phrase opérante en fait une. C'est l'essentiel du gras.
- **Conventions** répète le `~/.claude/CLAUDE.md` global : pnpm exclusif,
  Conventional Commits en français. Retirer les doublons, garder ce qui est
  propre au projet — la répartition anglais/français entre vitrine, documents
  d'accueil et documents de travail.
- **Commandes** est en bonne partie déductible de `package.json`. Ne garder que
  les lignes portant une information non évidente : `pnpm test` n'utilise aucun
  framework, `pnpm package:win` ne se lance que depuis Windows.

**À garder mot pour mot** : la section « L'invariant » et ses corollaires
arbitrés (IPC plutôt que socket locale, secrets d'intégration hors du dépôt
observé). C'est la règle qui fait refuser une fonctionnalité ; elle ne se
résume pas.

Cible : ~6 000 octets, soit ~1 300 tokens de moins par tour.

Priorité basse : le gain est réel mais c'est le plus petit des cinq, et le
risque d'éroder de la connaissance non déductible est le plus élevé.

## Critères d'acceptation

- [x] La section « L'invariant » est inchangée.
- [x] Les pièges connus sont toujours là, un par un.
- [x] Aucune information non déductible du code ou de `package.json` n'a
      disparu.
- [x] `CLAUDE.md` descend sous 9 500 octets.

**Note de clôture (2026-08-16).** La cible annoncée était ~6 000 octets ;
atteint 9 250 (11 170 au départ, soit −480 jetons par tour). Les deux premiers
critères la rendaient inatteignable : garder l'invariant mot pour mot et les
douze pièges un par un, c'est déjà ~6 500 octets à soi seul. Le plan comptait
par ailleurs « 14 pièges » — il y en avait douze. Descendre plus bas
supposerait de sacrifier de la connaissance non déductible, ce que le
troisième critère interdit. Cible corrigée plutôt que contournée.
