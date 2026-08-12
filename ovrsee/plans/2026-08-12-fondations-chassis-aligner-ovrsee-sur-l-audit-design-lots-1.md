---
{
  "status": "closed",
  "title": "Fondations + Châssis — aligner ovrsee sur l'audit design (Lots 1-2)",
  "opened": "2026-08-12",
  "closed": "2026-08-12",
  "commits": [
    {
      "sha": "2d9baf2",
      "date": "2026-08-12",
      "files": [
        "_ds/ovrsee/styles.css"
      ]
    },
    {
      "sha": "f7635f1",
      "date": "2026-08-12",
      "files": [
        "app/src/ActivityPanel.tsx",
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "hooks/i18n.d.ts",
        "hooks/i18n.js"
      ]
    },
    {
      "sha": "c0295ae",
      "date": "2026-08-12",
      "files": [
        "app/src/StatusBar.tsx",
        "app/src/ViewBar.tsx",
        "app/src/data.ts",
        "app/src/render.test.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Donnees.tsx",
        "app/src/tabs/Historique.tsx",
        "app/src/tabs/Navigateur.tsx",
        "app/src/tabs/Produit.tsx",
        "app/src/tabs/Stack.tsx",
        "app/src/tabs/Tableau.tsx",
        "hooks/couleurs.test.js"
      ]
    },
    {
      "sha": "2905164",
      "date": "2026-08-12",
      "files": [
        "app/src/Onboarding.tsx",
        "app/src/PreferencesPanel.tsx"
      ]
    },
    {
      "sha": "88419a7",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "0862496",
      "date": "2026-08-12",
      "files": []
    }
  ]
}
---

# Fondations + Châssis — aligner ovrsee sur l'audit design (Lots 1-2)

## Contexte

Trois chantiers fermés aujourd'hui (port littéral châssis+Aperçu, intégration
structurelle chantier 3, refonte diverses) ont déjà réparé le bug de fond — jetons
`--color-accent-800/900` mal utilisés comme fonds, corrigés par un port littéral en
valeurs hex/px pour la barre de titre, la sidebar, l'Aperçu et le dock terminal.

L'utilisateur fournit maintenant un audit exhaustif frais
(`~/Downloads/AUDIT-DESIGN-Ovrsee-2026-08-12.md`, comparé à
`~/Downloads/Redesign UI Ovrsee 2/Ovrsee App.dc.html`) qui va plus loin : il documente
que **deux langages de style cohabitent** — les zones portées littéralement (barre de
titre, sidebar, Aperçu, dock) et le reste de l'app (`Tableau`, `Historique`, `Produit`,
`Navigateur`, `Données`, `Stack`, `Préférences`, `Onboarding`, `CommandPalette`) qui
dépend encore de `_ds/ovrsee/styles.css` — dont la rampe de gris est bleutée
(`--color-neutral-*`), les filets n'ont qu'un seul jeton pour quatre rôles, et
`.btn-primary`/`.btn-ghost`/`.seg-opt` portent encore l'ancienne identité (texte
violet, anneaux d'accent). Il documente aussi que **la barre de vue (46px) et la barre
d'état (26px)** de la maquette — présentes sur tous les écrans — n'existent pas du tout
dans le code : chaque onglet réinvente son propre `<h2>` `--font-heading` 19px hors
échelle.

L'audit liste 7 lots (fondations → finitions). Décidé avec l'utilisateur :
- **Section PROJETS de la sidebar** : ne PAS la rétablir — le chantier 3 l'a retirée
  exprès au profit du sélecteur en dropdown de la barre de titre, décision qui tient.
  Point 1 de l'audit §3.2 est écarté.
- **Thème clair** : retirer les options Clair/Système du segmenté `Apparence` des
  Préférences plutôt que les laisser promettre quelque chose d'inexistant — cohérent
  avec la décision déjà prise de rester dark-only.
- **Portée de ce chantier** : Lot 1 (Fondations) + Lot 2 (Châssis) seulement. Les 5
  lots suivants (Aperçu+terminal, Historique+Tableau, Navigateur/Produit/Données/Stack,
  Modales, Finitions) sont des chantiers séparés à venir, une fois les jetons/classes
  et le squelette ViewBar/StatusBar posés — ils en dépendent.

## Lot 1 — Fondations (`_ds/ovrsee/styles.css`)

Réécrire les jetons et classes pour qu'ils correspondent à la maquette 2a. Fichier
actuel : 327 lignes, rampe `--color-neutral-*` bleutée (`#8799ab`…`#323d48`),
`--color-divider` unique (`color-mix(#f2f3f5 16%)`), pas de jetons de statut
(`ok/warn/err/info/plan`), pas de `--ring-selected`, pas de `.kicker` générique (`.card-kicker`
existe mais est en accent — ne pas le réutiliser), pas de switch, pas de touche clavier.

1. **Rampes** — remplacer par les valeurs littérales de l'audit §2.1 : texte (7
   niveaux, `#f2f3f5` → `#3f424a`), filets à 4 rôles (`--color-border-chrome/card/control/selected`),
   surfaces manquantes (`--color-surface-panel`, `--color-surface-hover`,
   `--color-surface-segment`), statuts (`ok/warn/err/info/plan`, chacun teinte/filet/fond),
   `--ring-selected`. Ne pas dériver par `color-mix` — la maquette est froide, un mix
   de `#f2f3f5` donne des gris plus clairs que prévu.
2. **Retirer `--color-neutral-*` du chemin d'exécution** — migrer chaque usage
   (`grep -rn "color-neutral" app/src _ds`) vers le jeton de texte/filet correspondant.
   Usage confirmé à corriger : `CommandPalette.tsx` (groupes de résultats, `--color-neutral-600`).
3. **Réécrire les classes** : `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost` (12px,
   hauteur 27-28px, primaire = fond plein `#7d76f0` texte `#0a0a12`, ghost = texte
   `#9096a0` jamais violet), `.seg`/`.seg-opt` (pastille active `#24252c`, pas d'anneau
   accent), `.tag-accent`/`.tag-neutral` (étiquettes 10.5px), `.input` (12px, hauteur
   27-28px), `.card` (rayon 9-10px), `h1..h4` (échelle unique 21/600 · 15/500 · 13/500 ·
   12.5), `.radio` (anneau 14px + point 6px).
4. **Ajouter** : `.kicker` (mono 10-10.5px, letter-spacing .1em, uppercase, `#55585f`) —
   distinct de `.card-kicker` qui reste en accent ; composant switch (28×16, rayon 999,
   `#7d76f0`/`#24252c`) ; composant touche clavier (17px, police système, `#17181d`/`#9096a0`).

**Acceptation** : `grep -rn "color-neutral-" app/src` ne retourne rien ; aucun
`.btn-primary` en texte violet ; aucun filet à `color-mix(#f2f3f5 16%)` restant.

## Lot 2 — Châssis

### 2.1 Barre de titre (`App.tsx` : header, `ProjectSwitcher`, `ScanBadge`)

- Bouton de rétractation : remplacer le glyphe `⇤`/`⇥` (ligne ~490) par une icône
  Phosphor `SidebarSimple` 14px dans un bouton 24×24 rayon 6 (`#62666e` au repos,
  fond `#1c1d24` + `#b6bac1` sidebar fermée).
- Sélecteur de projet (`ProjectSwitcher`, lignes ~953-1050) : retirer le préfixe
  « Ovrsee — » (ligne ~1003, garder le nom seul), ajuster aux dimensions maquette
  (hauteur 24, padding `0 9px`, rayon 6, fond `#101114`, filet `#1c1d22`, carré accent
  5×5 rayon 2, nom 12/500, caret 10px `#55585f`). Le dropdown reste — décision actée,
  pas de retour à une section PROJETS en sidebar.
- Badge de scan : retirer le mot « commit » avant le sha.
- Bouton terminal (lignes ~506-517) : état ouvert = fond `#1c1d24` + picto `ph-fill`
  `#b6bac1` ; fermé = pas de fond, picto outline `#62666e`.

### 2.2 Sidebar (`App.tsx` : `Sidebar`, `RailLink`, `ProjectRow`)

- **Retirer l'activité de la sidebar** : supprimer `<ActivityPanel compact ...>`
  (ligne ~938) et son conteneur `border-top`. L'Historique porte déjà le panneau
  d'activité complet (300px, mode non-compact) depuis le chantier « panneau droit
  persistant » — ce doublon dans la sidebar est désormais redondant. Retirer le mode
  `compact` d'`ActivityPanel.tsx` s'il ne sert plus nulle part ailleurs (vérifier avant
  de couper).
- **Lignes de vue** (`RailLink`, lignes ~1065-1118) : ajouter à droite le numéro de
  raccourci (mono 10, `#4e5158`) et, quand un compte existe, une pastille (17px, fond
  `#24252c`, mono 10, `#9096a0`). Ajouter la dernière ligne « Réordonner, masquer… »
  (picto `DotsSixVertical` 15px `#3f424a`, libellé 12.5px `#4e5158`) qui ouvre
  Préférences → Interface. Corriger : hauteur 31px, gouttière picto 15px, survol fond
  `#131418` (au lieu de `color-mix(#f2f3f5 6%)`, trop clair).
- **Rail replié** : passer de 52px à **56px**, cases 36×31 → **34×32 rayon 8**, picto
  17px, et ajouter le **logo Ovrsee en haut** (grille 7×5, module 2.5px, gouttière 1px,
  iris accent) — réutiliser le composant `Logo` déjà écrit dans `OnboardingArt.tsx`
  (lignes 53-85) plutôt que d'en dessiner un nouveau. Engrenage en bas inchangé.

### 2.3 `ViewBar` — nouveau composant, 46px, à créer

Composant partagé : `[fil d'Ariane] [méta mono] … [zone contrôles contextuels]`.
Hauteur 46, `padding: 0 16px`, `border-bottom: 1px solid #17181d`, pas de fond propre.
Fil d'Ariane = `projet` (12.5px `#62666e`) · `/` (`#34353c`) · `Vue` (12.5px 500
`#f2f3f5`). Méta = mono 11px `#4e5158`, texte spécifique par vue (donné en toutes
lettres dans l'audit §3.3, ex. Historique : `43 plans · 128 commits`).

**Portée de ce lot** : créer le composant et le câbler avec breadcrumb + méta sur les
six vues (Navigateur, Produit, Historique, Tableau, Données, Stack) + Aperçu (actions
qui y migrent, cf. note ci-dessous). La **zone de contrôles contextuels** (segmenté de
sous-vue, chips, action primaire propres à chaque écran — ex. `Nouveau ticket` du
Tableau, `Crawler` de Produit) reste **vide ou minimale** dans ce lot : son contenu
détaillé appartient aux chantiers Lot 3-5 (écran par écran) qui suivent. Objectif ici :
le squelette structurel, pas le contenu fin de chaque écran.

Conséquence directe : **supprimer les `<h2>` de page** (`--font-heading` 500/19px, hors
échelle) et leur ligne d'aide dans `Historique.tsx` (~67), `Tableau.tsx` (~252),
`Produit.tsx` (~84, ~100), `Stack.tsx` (~81), `Donnees.tsx` (~266). Le seul titre
21/600 restant est le nom du projet dans l'en-tête de l'Aperçu (`Apercu.tsx` ~173),
qui garde son traitement actuel — l'audit le confirme conforme.

### 2.4 `StatusBar` — nouveau composant, 26px, à créer

Hauteur 26, `border-top: 1px solid #17181d`, fond `#0b0c0e`, mono 10.5px `#55585f`,
`gap: 14px`, `padding: 0 14px`. Deux zones : gauche (faits propres à la vue), droite
(raccourcis séparés par `|` en `#3f424a`, `⌘K` en dernier — touches en police système,
pas en mono). Contenu par vue donné littéralement dans l'audit §3.4 (tableau Aperçu /
Navigateur / Produit / Historique) — câbler ces quatre-là dans ce lot ; Tableau,
Données, Stack reçoivent le composant avec un contenu minimal (au moins le `⌘K` à
droite), le détail du contenu gauche suit avec leur chantier d'écran respectif.

### 2.5 Dock terminal (`Terminal.tsx`)

- En-tête : 34px → **36px**, `padding: 0 12px`.
- **Pastilles de session** (lignes ~206-252) : actuellement teintées accent
  (`#2a2660`/`#14132a`/`#a49dfa`). Cible : hauteur 24, rayon 6, mono 11.5px, puce 5px
  devant — active = fond `#1c1d24` texte `#f2f3f5` puce `#7d76f0` ; inactive = pas de
  fond, texte `#9096a0`, puce `#3f424a`. Bouton `+` : picto Phosphor 13px `#55585f`.
- **Disposition** (lignes ~262-278) : les trois boutons bordés indépendants
  deviennent **un seul `.seg`** (classe corrigée au Lot 1), précédé du libellé mono
  `DISPOSITION` (10.5px capitales `#4e5158`).
- **Réduire** (lignes ~279-286) : `.btn-ghost` (violet actuellement) → texte simple
  11.5px `#62666e`, plus de classe `btn-ghost`.
- **Colonne Commandes** (lignes ~346-394) : rangées 28px rayon 6 fond `#101114` filet
  `#22232a` texte 12px `#d5d8dd`, picto accent 14px à gauche — vérifier après le Lot 1
  que `.btn`/`.btn-ghost` réécrites ne colorent plus le libellé par erreur.
- Barre réduite (terminal fermé, lignes ~666-684) : aligner sur les jetons Lot 1
  (`#0b0c0e`, filet `#17181d`, texte 11px `#62666e`), retirer `.btn-ghost`.

### 2.6 Préférences — retirer thème clair (petit correctif isolé)

`PreferencesControls.tsx` : le segmenté `Apparence` (`Sombre/Clair/Système`) — retirer
les options `Clair` et `Système`, ne garder que `Sombre` (masquer le segmenté ou le
réduire à une mention statique, au choix le plus simple à l'implémentation). Aucune
maquette claire n'existe (confirmé dans `theme.ts`, commentaire ligne ~137-139) — ne
pas en construire une, juste arrêter de promettre l'option.

## Fichiers critiques

- `_ds/ovrsee/styles.css` (Lot 1, réécriture)
- `app/src/App.tsx` (barre de titre, sidebar, rail replié)
- Nouveau : `app/src/ViewBar.tsx`, `app/src/StatusBar.tsx` (ou emplacement équivalent
  aux autres composants partagés du châssis)
- `app/src/Terminal.tsx` (dock)
- `app/src/tabs/{Historique,Tableau,Produit,Stack,Donnees,Navigateur}.tsx` (retrait des
  `<h2>`, câblage ViewBar/StatusBar)
- `app/src/tabs/Apercu.tsx` (câblage ViewBar pour les actions qui y migrent — contenu
  détaillé de ces actions reste Lot 3, seule la structure ViewBar est posée ici)
- `app/src/ActivityPanel.tsx` (retrait mode compact si plus utilisé)
- `app/src/PreferencesControls.tsx` (retrait options thème clair)
- `app/src/OnboardingArt.tsx` (réutilisation du composant `Logo` pour le rail replié)
- Référence maquette : `/Users/sam/Downloads/Redesign UI Ovrsee 2/Ovrsee App.dc.html`
  (sections `#2a` châssis) et `/Users/sam/Downloads/AUDIT-DESIGN-Ovrsee-2026-08-12.md`

## Vérification end-to-end

1. `pnpm typecheck && pnpm test` après chaque étape (Lot 1 seul, puis chaque sous-partie
   du Lot 2), pas un seul commit final.
2. `pnpm dev` (:5180), comparaison Chrome directe de chaque zone contre
   `Ovrsee App.dc.html` — barre de titre, sidebar (ouverte et repliée), les six
   ViewBar/StatusBar, dock terminal.
3. `grep -rn "color-neutral-" app/src` → vide. `grep -rn "btn-ghost" app/src/Terminal.tsx`
   → confirmer plus aucun texte violet.
4. `pnpm electron` pour vérifier que le bouton terminal et le dock (route IPC, pas
   HTTP) rendent identiquement — le châssis touche le protocole `ovrsee://`, pas
   seulement le dev server Vite (piège connu du CLAUDE.md).
5. Créer un ticket (skill `ovrsee-tickets`) pour chaque écart net-nouveau trouvé en
   cours de route et non prévu par l'audit.
