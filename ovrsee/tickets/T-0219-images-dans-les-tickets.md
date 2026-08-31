---
{
  "id": "T-0219",
  "titre": "Images dans les tickets",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "tickets",
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
  `app/src/markdown.tsx:84-131` — et sert les images locales par `mediaUrl()`
  (`app/src/pages.ts:66`) → `/api/media` → `mediaPath()`
  (`hooks/snapshot.js:506`), avec allowlist d'extensions et contrôle `inside()`.
- Il **refuse les data-URI et les URL distantes** (`markdown.tsx:90-91`), et
  c'est volontaire : ne pas déclencher de requête vers un tiers depuis un
  markdown qu'on n'a pas écrit. La CSP d'Electron (`electron/main.js:123-137`)
  autorise pourtant `img-src 'self' data:` — le refus est applicatif, à garder.

## La question de cadrage, tranchée le 31 août 2026

**Une image suit le régime de son ticket.** Versionnées, les images le sont
aussi — mais compressées. Gitignorés, elles ne partent pas dans git non plus.

Ce n'est pas un réglage de plus à écrire : c'est **déjà le mécanisme**. Le
`BLOC_PLANS` de `hooks/gitignore-sync.js:23-27` ignore `ovrsee/plans/` **et**
`ovrsee/tickets/` d'un seul bloc, piloté par `gitignorePlans` (préférences,
« Versionner les plans et tickets »). Une image rangée **sous
`ovrsee/tickets/`** hérite donc de la décision toute seule, sans ligne de
gitignore supplémentaire ni champ de réglage.

D'où le rangement : `ovrsee/tickets/images/`, et rien d'autre à câbler.

Conséquence à ne pas perdre de vue : `gitignorePlans` vaut `false` par défaut
(`hooks/settings.js:62`), donc **le cas courant est versionné**. C'est ce qui
rend la compression obligatoire et non cosmétique — une capture d'écran de
rétine non compressée pèse plusieurs mégaoctets, et git ne les oublie jamais.

## La compression, sans dépendance

Les cinq dépendances de production sont un choix (`CLAUDE.md`). Le canevas du
navigateur sait déjà tout faire : dessiner l'image, la réduire, et
`canvas.toBlob('image/webp', qualité)` la ré-encode. Chromium est là de toute
façon. Rien à installer.

## Ce qui reste ouvert, et qu'on assume

Une capture d'écran peut montrer un secret **en pixels**. `redige()`
(`hooks/redaction.js`) masque du texte, pas une image — et le filet ne peut pas
exister ici. Le ticket ne prétend pas le résoudre : il le nomme, et l'interface
doit le dire au moment où on colle, pas dans une documentation que personne ne
relit.

La rétention proposée par l'issue — supprimer l'image quand le ticket passe
« fait » — est **écartée** : un ticket soldé se relit, et une image effacée y
laisserait un lien mort. Le poids est traité par la compression, à l'entrée.

## Critères d'acceptation

- [ ] Coller ou déposer une image dans le corps d'un ticket l'enregistre sous
      `ovrsee/tickets/images/` et insère le markdown qui la référence.
- [ ] L'image est réduite et ré-encodée avant écriture, **sans nouvelle
      dépendance** — canevas et `toBlob()`.
- [ ] Une capture d'écran courante retombe sous quelques centaines de kilooctets ;
      un test le vérifie sur la fonction de compression, qui est pure.
- [ ] Le régime git de l'image est celui du ticket, **sans réglage ni bloc
      `.gitignore` de plus** : rangée sous `ovrsee/tickets/`, elle suit
      `gitignorePlans`.
- [ ] L'interface avertit qu'une image versionnée part dans git telle quelle,
      secrets à l'écran compris — au moment du collage.
- [ ] Le refus des data-URI et des images distantes de `markdown.tsx:90-91`
      n'est pas levé : l'image insérée est un chemin local.
- [ ] Le chemin d'écriture reste contraint par `inside()` et l'allowlist
      d'extensions de `MEDIA_TYPES` (`hooks/snapshot.js:487`).
- [ ] Supprimer un ticket ne laisse pas ses images orphelines.
