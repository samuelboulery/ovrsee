---
{
  "id": "T-0219",
  "titre": "Images dans les tickets",
  "colonne": "en-cours",
  "priorite": "moyenne",
  "tags": [
    "tickets",
    "issue-54"
  ],
  "cree": "2026-08-31",
  "maj": "2026-09-01",
  "plan": "2026-08-31-tour-du-depot-ovrsee-backlog-priorise-et-lot-d-intendance.md",
  "charge": "m"
}
---

## Contexte

Issue #54. Signaler un bug à la main est plus rapide avec une capture qu'avec un
paragraphe. Ça marche déjà quand Claude écrit le ticket et qu'on lui donne
l'image ; passer directement par le ticket, non.

**Le rendu était prêt, le stockage ne l'était pas.**

- Le markdown maison rend déjà `![](...)` — `media()`, `app/src/markdown.tsx` —
  et sert les images locales par `mediaUrl()` (`app/src/pages.ts`) →
  `/api/media` → `mediaPath()` (`hooks/snapshot.js`), avec allowlist
  d'extensions et contrôle `inside()`.
- Il **refuse les data-URI et les URL distantes**, et c'est volontaire : ne pas
  déclencher de requête vers un tiers depuis un markdown qu'on n'a pas écrit.
  Ce refus n'a pas été levé — l'image passe par le disque, pas par le corps.

## La décision (2026-09-01)

**Une image de ticket est une donnée du dépôt.** Elle vit dans
`ovrsee/tickets/images/`, donc sous `ovrsee/tickets/` : elle suit
automatiquement le réglage `gitignorePlans` — versionnée par défaut, gitignorée
pour qui a décoché « Versionner les plans et tickets ». **Aucun réglage
nouveau, aucun bloc `.gitignore` nouveau.**

Les trois questions ouvertes s'en déduisent :

1. **Où ?** `ovrsee/tickets/images/<T-XXXX>-<8 hex>.webp`. Nom généré par le
   serveur, jamais fourni par l'appelant.
2. **Versionné ?** Oui, par héritage de `ovrsee/tickets/`.
3. **Rétention ?** **Aucune.** L'issue proposait d'effacer l'image quand le
   ticket passe « fait » : sur une donnée versionnée ça n'allège rien — git
   garde le blob dans l'historique — et ça casse la relecture d'un ticket
   soldé, qui est ce à quoi sert un ticket soldé. La seule suppression qui a un
   sens est celle de `deleteTicket` : supprimer le ticket supprime ses images.

**Le ré-encodage côté client est ce qui rend le versionnement tenable.** Avant
l'envoi, un `<canvas>` redimensionne à 1600 px de côté au maximum et ré-encode
en WebP q0.85. Mesuré à la vérification : un PNG de 8 680 o est devenu un WebP
de 2 934 o. Il résout trois choses d'un coup : ça tient sous `CORPS_MAX` (1 Mo,
`server/api.js`), qui n'a pas eu à bouger ; ça garde l'historique git léger,
seule vraie objection au versionnement ; et ça décode/ré-encode les pixels,
donc ni EXIF, ni SVG scripté, ni fichier malformé n'atteint le disque.

Ce que ça ne couvre pas, et qui reste un risque assumé : une capture d'écran
peut porter un secret **à l'image**, que `redige()` ne sait pas masquer. Le
filet est humain, comme pour un plan approuvé.

## Critères d'acceptation

- [x] Coller (⌘V) ou déposer une image dans le `textarea` du corps d'un ticket
      l'écrit sur disque et insère `![](ovrsee/tickets/images/…webp)` au
      curseur — vérifié dans l'app, image affichée dans le ticket.
- [x] Le chemin inséré est relatif à la racine du dépôt : ni `markdown.tsx` ni
      la route de lecture n'ont changé.
- [x] L'image est redimensionnée à 1600 px max et ré-encodée en WebP avant
      l'envoi ; `CORPS_MAX` n'est pas relevé.
- [x] Le serveur ne fait pas confiance au client : préfixe `data:image/webp`,
      octets magiques `RIFF….WEBP`, taille bornée **avant** le décodage
      (`fetchHandler` d'Electron n'a pas le plafond de corps du dev server), et
      nom de fichier généré côté serveur.
- [x] `deleteTicket` efface les images de son ticket, et aucune autre. Le lien
      se fait par le **nom du fichier**, pas par les `![](…)` du corps : une
      image collée puis retirée du texte resterait sinon orpheline, et un corps
      qui cite l'image d'un autre ticket ne doit pas pouvoir la faire supprimer.
- [x] Le refus des data-URI et des images distantes de `markdown.tsx` n'est pas
      levé.
- [x] Le chemin d'écriture reste contraint par l'allowlist de `MEDIA_TYPES` et
      passe par `writeFileNoFollow`.
- [x] Tests `node:test` : non-WebP refusé, octets menteurs refusés, dépassement
      de taille refusé (avant et après décodage), identifiant de ticket qui
      tente la traversée refusé, aller-retour d'octets identique,
      `deleteTicket` n'emporte que ses propres images.
