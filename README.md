# Cockpit

Une vue en lecture seule sur un projet développé en vibecoding : ce qui a été fait,
pourquoi, ce qui reste ouvert, et à quoi l'application ressemblait à chaque commit.

**Le cockpit lit, il n'exécute jamais.** La vérité vit dans `<repo>/cockpit/`, en
markdown et en images, versionnée par git. L'application n'est qu'une vue : si elle
disparaît, rien n'est perdu.

- Cadrage complet : [`cadrage-cockpit.md`](./cadrage-cockpit.md)
- Référence visuelle de l'interface : [`Cockpit-A-Nocturne.dc.html`](./Cockpit-A-Nocturne.dc.html)

## Arborescence

| Dossier | Rôle |
|---|---|
| `hooks/` | Capture des plans approuvés et clôture au commit (v0.1) |
| `crawl/` | Parcours Playwright de l'app, captures datées (v0.2) |
| `app/` | Interface Vite + React, cinq onglets en lecture seule (v0.3) |
| `_ds/` | Design systems. Nocturne est celui retenu. |

## Données produites, dans le repo observé

```
<repo>/cockpit/
  plans/<date>-<slug>.md    1 fichier = 1 plan approuvé
  pages/pages.json          pages, liens, résumés
  pages/scans.jsonl         1 ligne par scan — les échecs aussi
  pages/shots/<page>/…png   captures datées, rattachées à un commit
```

Backlog, historique et densité d'activité ne sont pas stockés : ils se calculent
à partir des plans.
