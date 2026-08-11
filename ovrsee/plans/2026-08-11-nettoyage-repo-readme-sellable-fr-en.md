---
{
  "status": "open",
  "title": "Nettoyage repo + README sellable (FR/EN)",
  "opened": "2026-08-11",
  "closed": null,
  "commits": []
}
---

# Nettoyage repo + README sellable (FR/EN)

## Contexte

Le repo `ovrsee` (privé, `samuelboulery/ovrsee`) a un README existant (FR + EN)
correct mais plat : pas de hero visuel, une seule capture embarquée — et cette
capture est **cassée** pour quiconque clone frais le repo, car son chemin
(`ovrsee/pages/shots/...`) est gitignoré (régénéré/purgé automatiquement, jamais
versionné). Objectif : repo plus propre à la racine, README FR/EN vendeur avec
vraies captures versionnées, section téléchargement, table de dépendances
complète — sans rien casser côté build/app.

Contraintes actées avec l'utilisateur :
- Déplacer ce qui est déplaçable sans casser l'app dans un sous-dossier
  (`legacy/`) ; ne pas toucher `CLAUDE.md`.
- Section téléchargement : oui, avec mention explicite "dépôt privé, accès
  collaborateurs invités uniquement".
- Pas de LICENSE (repo privé perso).
- Exécution en mode auto : plus de questions intermédiaires, appliquer le
  plan tel quel.

**Captures fournies** — 5 PNG dans `/Users/sam/Desktop/Screenshots/`,
identifiées par lecture visuelle (noms génériques `Screenshot ...png`,
renommer en copiant) :
| Fichier source | Onglet | Nouveau nom |
|---|---|---|
| `Screenshot 2026-08-11 at 15.31.04.png` | Aperçu | `apercu.png` |
| `Screenshot 2026-08-11 at 15.31.19.png` | Historique | `historique.png` |
| `Screenshot 2026-08-11 at 15.31.23.png` | Produit | `produit.png` |
| `Screenshot 2026-08-11 at 15.31.30.png` | Tableau | `tableau.png` |
| `Screenshot 2026-08-11 at 15.32.13.png` | Navigateur | `navigateur.png` |

Manquants : **Données** et **Stack** (pas capturés) — la galerie README
n'aura que 5 images ; les 2 onglets restants sont listés en texte sans
capture, à compléter plus tard si besoin. Ne pas bloquer dessus.

## Phase 1 — Nettoyage racine (`legacy/`)

Créer `legacy/` et déplacer en groupe (pour préserver leurs références
croisées) :
- `Ovrsee-A-Nocturne.dc.html` → `legacy/Ovrsee-A-Nocturne.dc.html`
- `support.js` → `legacy/support.js`
- `AUDIT-2026-08-09.md` → `legacy/AUDIT-2026-08-09.md`

**Édition nécessaire dans `legacy/Ovrsee-A-Nocturne.dc.html`** (vérifié par
grep — seules références en dur) :
- Ligne 6 `<script src="./support.js">` : **inchangé**, `support.js` déménage
  avec lui dans le même dossier.
- Lignes 11-12, les deux chemins `_ds/nocturne-16d90168-.../` (un `<link>`
  et un `<script>`) : préfixer d'un niveau → `../_ds/nocturne-16d90168-.../`,
  car `_ds/` **reste à la racine**.

**Ne pas toucher `_ds/`** : ce n'est pas juste du décor de maquette — c'est
la source réelle des jetons de style de l'app, importée en dur par
`app/src/main.tsx:10` (`import '../../_ds/nocturne-.../styles.css'`). Le
déplacer casserait `pnpm dev`/`pnpm electron`/le build pour un gain
cosmétique. Le laisser exactement où il est.

Tout le reste de la racine (`app/`, `build/`, `crawl/`, `electron/`, `hooks/`,
`mcp/`, `ovrsee/`, `scripts/`, `server/`, `skills/`, `graphify-out/`,
fichiers de config) reste en place — ce n'est pas du désordre, c'est la
structure du projet.

**Vérification après déplacement :**
```bash
pnpm build       # tsc + vite build doivent réussir
pnpm dev         # démarre bien sur le port 5180
pnpm test        # suite node --test inchangée
grep -rn "support.js\|Ovrsee-A-Nocturne\|AUDIT-2026" app/ electron/ server/ crawl/ hooks/ mcp/ scripts/
  # doit ne rien remonter (confirme qu'aucun code de prod ne pointait dessus)
```
Ouvrir `legacy/Ovrsee-A-Nocturne.dc.html` dans un navigateur pour confirmer
visuellement que `support.js` et `_ds/` se chargent toujours (chemins
relatifs corrects).

## Phase 2 — Dossier captures versionné

Créer `docs/screenshots/` (racine, **pas** gitignoré — à la différence de
`ovrsee/obsidian/` et `ovrsee/pages/shots/`). Copier les 5 PNG depuis
`/Users/sam/Desktop/Screenshots/` en les renommant selon la table ci-dessus
(`apercu.png`, `historique.png`, `produit.png`, `tableau.png`,
`navigateur.png`). Pas de génération automatique — fichiers fournis tels
quels.

## Phase 3 — Réécriture README.md (FR) et README.en.md (EN)

Deux fichiers séparés (convention existante conservée — pas de fusion en un
seul fichier à onglets repliables, ça casserait les liens existants venant
d'autres docs vers `README.en.md`). Chacun commence par un **bandeau de
badges style shields.io** faisant office de sélecteur de langue (🇫🇷/🇬🇧,
langue courante en gras/non-lien, l'autre en lien vers le fichier jumeau) —
c'est la convention GitHub standard, pas de vrais onglets interactifs
possibles en markdown pur.

**Nouvel ordre de sections (les deux fichiers, contenu traduit) :**

1. Bandeau langue (badges)
2. Hero : logo (`build/icon.svg`, non gitignoré, safe à référencer), titre,
   accroche 1 phrase, invariant "lit, n'exécute que le terminal demandé"
3. Badges secondaires optionnels (version `0.9.0-beta`, stack)
4. Pitch condensé (2-3 puces) + lien `cadrage-ovrsee.md`
5. **Galerie de captures** — 5 sous-sections avec image (Aperçu, Navigateur,
   Produit, Historique, Tableau), légende 1 ligne reprenant la description
   déjà correcte du tableau "Arborescence" actuel du README (ne pas
   réinventer ces descriptions) ; Données et Stack mentionnés en texte
   seul, sans image (pas capturés)
6. Fonctionnalités clés — reformulation vendeuse des 7 onglets
7. Premier lancement (section existante, contenu inchangé)
8. Mise en route — 3 commandes (inchangé)
9. Skills Claude Code (tableau existant, inchangé)
10. Multi-projets et `ovrsee.config.json` (inchangé)
11. Coffre Obsidian (inchangé, dédupliqué si besoin)
12. Arborescence / architecture (tableau dossiers existant, inchangé)
13. **Téléchargement** (nouvelle section) — lien
    `https://github.com/samuelboulery/ovrsee/releases`, mention visible
    "dépôt privé — accès réservé aux collaborateurs invités", DMG mac +
    installeur NSIS Windows, construits par `.github/workflows/release.yml`
    sur tag
14. **Dépendances** (nouvelle section, table complète) — versions exactes
    lues dans `package.json` :
    - Prod (3, sobriété délibérée à mentionner comme argument) :
      `@xterm/xterm` 6.0.0, `@xterm/addon-fit` ^0.11.0, `node-pty` 1.1.0
    - Dev (10) : `react` ^19.2.8, `react-dom` ^19.2.8, `typescript` ^7.0.2,
      `vite` ^8.2.1, `electron` 43.3.0, `electron-builder` ^26.15.3,
      `playwright-core` ^1.62.1, `@vitejs/plugin-react` ^6.0.5,
      `@types/react` ^19.2.18, `@types/react-dom` ^19.2.4
    - `packageManager: pnpm@10.12.1`
15. Pièges connus (inchangé, contenu technique à préserver intégralement)
16. Serveur MCP (inchangé)
17. Données produites (inchangé)
18. Note importante — secrets (inchangé, ne pas raccourcir : c'est un
    avertissement sécurité)
19. Tests (`pnpm test`, `pnpm typecheck`)
20. Voir aussi — liens CLAUDE.md, cadrage-ovrsee.md

**À corriger dans le contenu existant :** remplacer l'image cassée
`./ovrsee/pages/shots/accueil/2026-08-09-24c3123.png` par les nouvelles
références `./docs/screenshots/*.png`.

**Fichiers critiques :**
- `/Users/sam/code/ovrsee/package.json` — source des versions exactes
- `/Users/sam/code/ovrsee/README.md` / `README.en.md` — à réécrire
- `/Users/sam/code/ovrsee/Ovrsee-A-Nocturne.dc.html` → `legacy/` + 2 chemins
  à corriger

## Vérification finale

- [ ] `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm typecheck` passent après
      le déplacement `legacy/`
- [ ] `grep -rn "support.js\|Ovrsee-A-Nocturne\|AUDIT-2026"` sur le code de
      prod ne remonte rien
- [ ] `legacy/Ovrsee-A-Nocturne.dc.html` ouvert dans un navigateur charge
      bien `support.js` et les styles `_ds/`
- [ ] Liens croisés README.md ↔ README.en.md ↔ CLAUDE.md ↔ cadrage-ovrsee.md
      résolvent tous
- [ ] Plus aucune référence à l'ancien chemin de capture cassé
- [ ] `docs/screenshots/` existe, committé, contient les 5 PNG renommés et
      s'affiche correctement dans les deux README
