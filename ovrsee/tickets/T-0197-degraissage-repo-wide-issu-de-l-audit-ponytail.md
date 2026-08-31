---
{
  "id": "T-0197",
  "titre": "Dégraissage repo-wide issu de l'audit ponytail",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "dette",
    "audit"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-31",
  "plan": null
}
---

## Contexte

Un audit `ponytail` a balayé l'arbre entier le 22 août 2026, à la recherche de
sur-ingénierie : code mort, abstractions à une seule implémentation, config que
personne ne pose, réimplémentation de ce que la plateforme fournit déjà.

Le dépôt s'en tire bien — la plupart des raccourcis assumés portent déjà leur
commentaire `ponytail:` qui nomme le plafond accepté. Il reste une dizaine de
constats réels, dont trois gros : une déclaration TypeScript de 785 lignes qui
recopie un dictionnaire à la main, un test d'interface qui recopie le même
dictionnaire une troisième fois, et un basculement de thème dont il ne reste
qu'un seul thème.

Cet epic les regroupe. Aucun n'est urgent, aucun ne corrige un bug : ce sont
des lignes à rendre. Total estimé : environ 1 200 lignes, zéro dépendance.

## Critères d'acceptation

- [ ] Chacun des tickets enfants est soldé ou explicitement écarté avec sa raison.
- [ ] `pnpm test`, `pnpm lint` et `pnpm typecheck` restent verts après chaque enfant.
