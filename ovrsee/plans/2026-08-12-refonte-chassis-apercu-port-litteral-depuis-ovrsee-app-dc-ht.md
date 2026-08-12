---
{
  "status": "closed",
  "title": "Refonte châssis + Aperçu — port littéral depuis `Ovrsee App.dc.html`",
  "opened": "2026-08-12",
  "closed": "2026-08-12",
  "commits": [
    {
      "sha": "bc6a8ac",
      "date": "2026-08-12",
      "files": [
        "app/src/App.tsx",
        "app/src/Terminal.tsx",
        "app/src/tabs/Apercu.tsx",
        "app/src/tabs/Branches.tsx",
        "app/src/tabs/Deploiements.tsx",
        "app/src/tabs/Sante.tsx",
        "app/src/theme.test.ts",
        "app/src/theme.ts",
        "hooks/couleurs.test.js"
      ]
    },
    {
      "sha": "2aac372",
      "date": "2026-08-12",
      "files": []
    },
    {
      "sha": "e09f624",
      "date": "2026-08-12",
      "files": []
    }
  ]
}
---

# Refonte châssis + Aperçu — port littéral depuis `Ovrsee App.dc.html`

## Contexte

L'audit précédent (artifact publié, ticket T-0073) a marqué plusieurs écrans « conformes »
alors qu'ils ne le sont pas — il comparait des noms de variables CSS (`var(--color-accent)`)
sans vérifier leurs valeurs réellement rendues. L'utilisateur a fourni 8 captures qui
montrent le vrai problème : un traitement violet/indigo saturé et « qui brille » sur des
endroits très différents — la ligne de projet sélectionnée dans la sidebar, les badges de
statut SANTÉ (« modifié », « non poussé », « aucun audit » — tous rendus dans la même
couleur bleu foncé alors que la maquette les différencie par sémantique : vert/ambre/rouge/
violet), les chiffres de stats de l'Aperçu (encadrés d'une boîte violette alors que la
maquette les affiche en texte gras nu), les boutons du dock terminal, l'item « Préférences »
de la sidebar, et les barres de densité d'activité (deux nuances de violet incohérentes).

**Cause racine trouvée** (agent de recherche, lecture seule) : la rampe de couleur accent
sombre dans `_ds/ovrsee/styles.css` va de `--color-accent-100` (#eeedfd, presque blanc) à
`--color-accent-900` (#0e0a57, indigo quasi noir) — cohérente en soi. Mais plusieurs
composants (`Terminal.tsx` lignes 181/195-196/257-258, `Illisibles.tsx:23`,
`Onboarding.tsx`, `Produit.tsx:126`, `Historique.tsx:131,233`) utilisent
`--color-accent-800`/`--color-accent-900` comme **fond** de badges/boutons/pastilles en
supposant une valeur claire — alors qu'en sombre c'est un indigo quasi noir sur lequel du
texte clair (`--color-accent-200`) « brille » par contraste dur. `Terminal.tsx:181` ajoute
en plus un vrai flou : `box-shadow: 0 0 8px var(--color-accent);`. C'est un bug d'usage des
jetons, répété dans plusieurs fichiers indépendants — pas un simple écart ponctuel.

**Décision de l'utilisateur, actée** : plutôt que corriger jeton par jeton (le bug peut
resurgir ailleurs sous la même forme), **porter littéralement** la structure et les valeurs
hex/px de la maquette dans le code, comme la maquette elle-même le fait — elle n'utilise
aucune variable CSS, que des valeurs inline. Ça élimine la classe de bug à la racine pour
tout ce qui est reporté. Périmètre de ce chantier : **châssis (barre de titre, sidebar,
badges SANTÉ, dock terminal) + Aperçu**. Les 6 autres onglets + Préférences + Onboarding
seront un chantier séparé, même traitement.

Le thème clair n'existe pas dans `Ovrsee App.dc.html` (maquette sombre uniquement).
Décision actée : **retirer le thème clair pour l'instant** plutôt que le maintenir sur
l'ancien mécanisme à côté d'un châssis porté en dur — jusqu'à ce qu'une maquette claire
existe.

## Approche

### Port littéral, écran par écran

Pour chaque zone du périmètre, relire la section maquette correspondante
(`Ovrsee App.dc.html`, sections `#2a` châssis/système et `#2b` Aperçu) et transcrire
directement dans le composant React, via `s()`, les valeurs `style="..."` de la maquette —
hex, px, `border-radius`, `box-shadow` — plutôt que de passer par `var(--color-*)`. Seul le
contenu change (nom du projet réel, compteurs réels, dates réelles) ; la mise en forme est
copiée telle quelle.

**Périmètre concret** :

- **`app/src/App.tsx`** — barre de titre, sidebar (liste PROJETS avec état sélectionné,
  liste VUES, lien Préférences), structure générale du châssis.
- **`app/src/tabs/Apercu.tsx`** — carte d'en-tête (nom, chemin, 5 stats en texte nu, pas de
  boîte), badges SANTÉ différenciés par sémantique (poussé=vert, modifié=ambre, aucun
  audit=neutre — pas de bleu uniforme), liste des plans ouverts, branches, environnements,
  déploiements, README.
- **`app/src/Terminal.tsx`** — dock terminal : onglets de session, boutons de disposition,
  panneau « Commandes », pastille d'indicateur — sans le glow (`box-shadow: 0 0 8px`) ni les
  fonds `--color-accent-800/900`.
- **`app/src/theme.ts`** — retirer la branche thème clair (`lightTheme`, la bascule
  système/clair dans `applyTheme()`/`getCSSVariables()`). Le contrôle « Thème » dans
  Préférences (hors périmètre de ce chantier, sera reporté au chantier 2) devra n'exposer
  que sombre — laisser une note plutôt que le modifier maintenant, `PreferencesControls.tsx`
  n'est pas dans ce chantier.

**Composants non touchés dans ce chantier mais qui partagent les mêmes jetons cassés**
(`Illisibles.tsx`, `Onboarding.tsx`, `Historique.tsx`, `Produit.tsx`) : laissés tels quels
pour l'instant — ils font partie du chantier 2. `_ds/ovrsee/styles.css` n'est pas supprimé
dans cette passe (encore utilisé par l'app non portée) ; seul l'usage cassé dans le
périmètre ci-dessus est éliminé en cessant de dépendre du fichier pour ces composants.

### Vérification visuelle

Après le port, capture Chrome (`localhost:5180`) de la sidebar, de l'Aperçu et du dock
terminal, comparée directement aux captures fournies par l'utilisateur et à la maquette —
pas de nouvelle passe d'audit à distance, comparaison directe pendant l'implémentation.

## Fichiers critiques

- `/Users/sam/Downloads/Redesign UI Ovrsee 2/Ovrsee App.dc.html` — sections `#2a`
  (système/châssis) et `#2b` (Aperçu), source des valeurs littérales.
- `app/src/App.tsx`, `app/src/tabs/Apercu.tsx`, `app/src/Terminal.tsx`, `app/src/theme.ts`.
- `app/src/style.ts` (`s()`) reste l'utilitaire d'application des styles inline — inchangé.

## Vérification end-to-end

1. `pnpm dev` (déjà lancé sur :5180), comparaison Chrome directe sidebar/Aperçu/terminal
   contre les captures fournies par l'utilisateur et contre `Ovrsee App.dc.html#2a`/`#2b`.
2. `pnpm typecheck && pnpm test`.
3. Confirmer qu'aucun badge/pastille/bouton du périmètre ne montre plus de fond
   `--color-accent-800/900` ni de `box-shadow` de type glow — grep de contrôle sur les
   fichiers touchés.
