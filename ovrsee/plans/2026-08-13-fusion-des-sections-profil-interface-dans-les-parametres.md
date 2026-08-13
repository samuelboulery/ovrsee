---
{
  "status": "closed",
  "title": "Fusion des sections Profil + Interface dans les Paramètres",
  "opened": "2026-08-13",
  "closed": "2026-08-13",
  "commits": [
    {
      "sha": "6609d27",
      "date": "2026-08-13",
      "files": [
        "app/src/PreferencesPanel.tsx"
      ]
    },
    {
      "sha": "aadea61",
      "date": "2026-08-13",
      "files": []
    },
    {
      "sha": "dce1138",
      "date": "2026-08-13",
      "files": []
    }
  ]
}
---

# Fusion des sections Profil + Interface dans les Paramètres

## Contexte

L'écran Paramètres (`PreferencesPanel.tsx`) a 5 sections dans le rail gauche :
Profils, Général, Interface, Claude Code, Projet. « Profils » (galerie de 4
templates) et « Interface » (ordre des onglets + terminal) sont deux entrées
séparées alors qu'elles éditent le même état (`onglets`, `terminal`) — un
choix de rangement, pas une frontière fonctionnelle. Objectif : une seule
entrée de nav qui montre d'abord Profils puis Interface, et suppression de
la colonne d'aperçu à droite (300px, fixe, présente sur toutes les sections),
jugée redondante — chaque carte de template a déjà sa propre miniature
(`PreferencesPreview` dans `CarteProfil`).

## Ce qui ne bouge pas

- `SectionProfils` (`PreferencesProfils.tsx`) reste un composant exporté
  autonome — `Onboarding.tsx:262-270` l'utilise seul, avec ses propres
  `titreCle`/`descCle`. Aucun changement dans ce fichier.
- `SectionInterface` (`PreferencesPanel.tsx:271-467`) reste tel quel en
  interne — son contenu (drag-list onglets, dispositions terminal) ne change
  pas.
- Les tests `prefs.test.tsx` rendent `SectionProfils`/`SectionInterface`
  séparément (boucle `SECTIONS`, lignes 108-135, et tests dédiés 137-150) —
  ils continuent de passer sans modification, puisque ces composants restent
  exportés et rendables indépendamment.

## Changements — `app/src/PreferencesPanel.tsx`

1. **Type `SectionId` (ligne 50)** : retirer `'profils'`.
   `'profils' | 'general' | 'interface' | 'claude' | 'projet'` →
   `'general' | 'interface' | 'claude' | 'projet'`.

2. **`SECTIONS` (lignes 53-59)** : retirer l'entrée
   `{ id: 'profils', cle: 'pref.profiles' }`. L'entrée `interface` reste en
   tête (position qu'occupait Profils), label inchangé (`pref.interface`).

3. **Valeur par défaut (ligne 498)** :
   `useState<SectionId>(initialSection ?? 'profils')` →
   `useState<SectionId>(initialSection ?? 'interface')`.

4. **`corps()` (lignes 585-594)** : fusionner les deux branches — la section
   `interface` rend Profils au-dessus d'Interface :
   ```tsx
   if (section === 'interface')
     return (
       <>
         <SectionProfils {...props} />
         <div style={s('margin-top: 32px;')}>
           <SectionInterface {...props} />
         </div>
       </>
     )
   ```
   (32px : au-delà des 18px de `GroupLabel` entre sous-blocs, pour marquer
   la frontière entre les deux anciennes sections.)

5. **Suppression de la colonne aperçu (lignes 681-700)** : retirer tout le
   bloc `{settings && (<div style={s('flex: none; width: 300px; ...')}>...
   <PreferencesPreview settings={settings} /></div>)}`.
   Le conteneur parent (ligne 666, `flex: 1; display: flex; min-height: 0;`)
   n'a alors plus qu'un enfant — le corps scrollable — pas de changement de
   layout nécessaire au-delà de la suppression.

6. **Import (ligne 22)** : `PreferencesPreview` n'est plus utilisé dans ce
   fichier une fois la colonne retirée (seul `TAB_KEYS` reste nécessaire) →
   `import { TAB_KEYS } from './PreferencesPreview'`.

## Pas de changement ailleurs

- `App.tsx:589` (`setPreferencesInitial({ section: 'interface' })`) reste
  valide tel quel.
- Aucun code n'ouvre explicitement `section: 'profils'` (vérifié) — la seule
  référence était le défaut ligne 498, mis à jour ci-dessus.
- `PreferencesProfils.tsx`, `PreferencesPreview.tsx`, `Onboarding.tsx` :
  inchangés.

## Vérification

- `pnpm test` (couvre `app/src` compilé) — les tests existants sur
  `SectionProfils`/`SectionInterface` doivent continuer de passer tels quels.
- `pnpm typecheck` — confirme qu'aucun appelant ne référence plus
  `SectionId = 'profils'`.
- `pnpm electron` — ouvrir Paramètres, vérifier visuellement : une seule
  entrée de nav (ex-Interface) affiche Profils puis Interface l'un sous
  l'autre, plus de colonne aperçu à droite, les 4 autres onglets (Général,
  Claude Code, Projet) occupent maintenant toute la largeur sans la colonne.
