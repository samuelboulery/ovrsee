---
{
  "id": "T-0219",
  "titre": "Images dans les tickets",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "tags": [
    "tickets",
    "cadrage",
    "issue-54"
  ],
  "cree": "2026-08-31",
  "maj": "2026-08-31",
  "plan": "2026-08-31-tour-du-depot-ovrsee-backlog-priorise-et-lot-d-intendance.md",
  "charge": "m"
}
---

## Contexte

Issue #54. Signaler un bug à la main est plus rapide avec une capture qu'avec un
paragraphe. Ça marche déjà quand Claude écrit le ticket et qu'on lui donne
l'image ; passer directement par le ticket, non.

**Le rendu est prêt, le stockage ne l'est pas.**

- Le markdown maison rend déjà `![](...)` — `media()`,
  `app/src/markdown.tsx:84-131` — et sert les images locales par
  `mediaUrl()` (`app/src/pages.ts:66`) → `/api/media` → `mediaPath()`
  (`hooks/snapshot.js:506`), avec allowlist d'extensions et contrôle `inside()`.
- Il **refuse les data-URI et les URL distantes** (`markdown.tsx:90-91`), et
  c'est volontaire : ne pas déclencher de requête vers un tiers depuis un
  markdown qu'on n'a pas écrit. La CSP d'Electron (`electron/main.js:123-137`)
  autorise pourtant `img-src 'self' data:` — le refus est applicatif, à garder.

## Pourquoi ce ticket est « à spécifier »

Il touche une frontière du cadrage, et ce n'est pas à l'implémentation de la
trancher.

`CLAUDE.md` limite ce que l'application écrit à `ovrsee/tickets/*.md` et
`ovrsee/board.json`. Une image demande un répertoire écrivable de plus sous
`ovrsee/`. C'est peu, mais c'est un élargissement de l'invariant, et il
entraîne trois questions ouvertes :

1. **Où ?** `ovrsee/tickets/images/` ? Sous le dossier versionné, ou gitignoré
   comme `ovrsee/pages/shots/` peut l'être (`gitignoreShots`) ?
2. **Versionné ou non ?** Une capture dans git suit le dépôt et survit au clone
   — mais alourdit l'historique, et une capture d'écran peut porter un secret à
   l'image, que `redige()` ne sait pas masquer.
3. **Quelle rétention ?** L'issue propose la suppression quand le ticket passe
   « fait », ou après un délai. Supprimer une image encore citée par le corps
   d'un ticket laisse un lien mort — et un ticket soldé se relit.

## Question à trancher avant de passer en « prêt »

Une image de ticket est-elle une donnée du dépôt (versionnée, elle voyage) ou
un artefact local (gitignorée, elle disparaît au clone) ? La réponse commande
les trois autres points, et notamment le risque de secret capturé à l'écran.

## Critères d'acceptation

*À compléter une fois la question ci-dessus tranchée.* Acquis d'avance :

- [ ] Le refus des data-URI et des images distantes de `markdown.tsx:90-91`
      n'est pas levé.
- [ ] Le chemin d'écriture reste contraint par `inside()` et l'allowlist
      d'extensions de `MEDIA_TYPES` (`hooks/snapshot.js:487`).
