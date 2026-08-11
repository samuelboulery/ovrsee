---
{
  "status": "open",
  "title": "Profils d'interface : la sélection pilote aussi `terminal.disabled`",
  "opened": "2026-08-11",
  "closed": null,
  "commits": [
    {
      "sha": "28b8211",
      "date": "2026-08-11",
      "files": [
        "app/src/PreferencesProfils.tsx",
        "app/src/prefs.test.tsx",
        "hooks/ovrsee-capture-plan.js",
        "hooks/tickets.js",
        "hooks/tickets.test.js"
      ]
    },
    {
      "sha": "fdb221f",
      "date": "2026-08-11",
      "files": []
    }
  ]
}
---

# Profils d'interface : la sélection pilote aussi `terminal.disabled`

## Contexte

Le panneau Préférences a deux façons de toucher au terminal :
- un template (`PROFILS` dans `app/src/PreferencesProfils.tsx`) qui pose `visible` et
  `disposition`,
- un interrupteur indépendant dans `SectionInterface` (`app/src/PreferencesPanel.tsx`)
  qui pose `terminal.disabled` (couper complètement le terminal, y compris la pastille
  de réouverture).

Aujourd'hui `Profil.terminal` ne connaît que `{visible, disposition}` : choisir un
template ne touche jamais `disabled`. Résultat, un template pensé « sans terminal »
(sobre, revue) peut laisser `disabled: false` traîner d'un réglage précédent — la
pastille de réouverture reste là alors que le template dit « pas de terminal ».

Objectif : la sélection d'un profil pose aussi `disabled`, automatiquement, tout en
laissant l'utilisateur le retoucher ensuite indépendamment (l'interrupteur de
`SectionInterface` reste inchangé).

## Ce qui existe déjà (investigation faite)

- `Profil` (type, `PreferencesProfils.tsx:22-28`) : `terminal: {visible, disposition}`.
- Les 4 templates (`PreferencesProfils.tsx:37-66`) :
  - `complet` : visible **true**
  - `sobre` : visible **false**
  - `revue` : visible **false**
  - `dev` : visible **true**
  → la corrélation `disabled = !visible` est déjà celle qu'on veut : un template qui
  masque le terminal veut aussi le désactiver, un template qui l'affiche le laisse
  actif.
- `appliquerProfil` (`PreferencesProfils.tsx:84-93`) écrit déjà
  `terminal: { ...settings.terminal, ...profil.terminal }` — dès que `profil.terminal`
  contient `disabled`, cette ligne le propage sans modification.
- `profilCourant` (`PreferencesProfils.tsx:104-117`) compare `visible` et
  `disposition` (celle-ci seulement si `visible`) pour retrouver le template actif —
  ne compare pas `disabled` aujourd'hui.
- `SettingsType['terminal']` (`app/src/data.ts:329`) : `disabled?: boolean`, optionnel.
- Tests concernés : `app/src/prefs.test.tsx` (`appliquerProfil : ne touche que...`
  l.210-228, `profilCourant : terminal masqué...` l.236-242, tests
  `SectionInterface` l.137-150), `app/src/onboarding.test.tsx` (la partie
  `terminalPourUsage`/`appliquerReponses` reste hors périmètre — elle écrase déjà
  `disabled` par-dessus le profil selon l'usage, ce comportement ne change pas).

## Changements

### 1. `app/src/PreferencesProfils.tsx`

- Type `Profil` : `terminal: { visible: boolean; disposition: string; disabled: boolean }`.
- Les 4 entrées de `PROFILS` gagnent `disabled` dans leur `terminal` :
  - `complet` → `disabled: false`
  - `sobre` → `disabled: true`
  - `revue` → `disabled: true`
  - `dev` → `disabled: false`
- `appliquerProfil` : aucun changement de code, le spread existant suffit.
- `profilCourant` : ajouter la comparaison de `disabled`, normalisée à `false` par
  défaut (le champ est optionnel dans `SettingsType`) :
  ```ts
  (terminal?.disabled ?? false) === profil.terminal.disabled
  ```
  ajoutée aux conditions du `.find`, sans le traitement spécial réservé à
  `disposition` (celui-ci reste conditionné à `visible`, `disabled` se compare
  toujours).

### 2. `app/src/prefs.test.tsx`

- Mettre à jour le(s) test(s) qui construisent un `Profil` de test (`profil(...)` /
  fixture locale) pour inclure `disabled` en cohérence avec les 4 valeurs ci-dessus.
- `appliquerProfil : ne touche que les onglets et le terminal` : ajouter une
  assertion `apres.terminal.disabled === true` (le profil de test utilisé est
  `sobre`).
- `profilCourant : terminal masqué, la disposition ne départage pas` : vérifier que
  le cas reste correct (il ne touche pas `disabled`, donc pas d'impact), et ajouter
  un test symétrique : un `settings` qui matche `sobre` sur `visible`/`disposition`
  mais dont `terminal.disabled` a été remis à `false` par l'interrupteur indépendant
  ne doit plus être reconnu comme `sobre` par `profilCourant`.
- Ajouter un test direct sur le nouveau comportement demandé : appliquer le profil
  `sobre` à un `settings` où `terminal.disabled` était `false` (terminal activé à la
  main) doit produire `terminal.disabled === true` après `appliquerProfil`.

### 3. Pas de changement dans `PreferencesPanel.tsx` / `SectionInterface`

L'interrupteur indépendant (`onChange`/bouton « Enable terminal ») continue de
n'écrire que ce qu'il écrit déjà (`disabled`, `visible`). Il reste la façon de
diverger du template après coup — ce que l'utilisateur a explicitement demandé de
garder.

### 4. `profilage.ts` (onboarding) — inchangé

`appliquerReponses` applique déjà `terminalPourUsage(reponses.usage)` **après**
`appliquerProfil`, donc `disabled` issu de l'usage écrase celui du template. C'est le
comportement voulu (l'usage réel prime sur le template) et n'a pas besoin de bouger.

## Vérification

- `pnpm test` (couvre `hooks/`, `crawl/`, `server/`, `mcp/`, puis `app/src` compilé) —
  doit rester vert, avec les nouvelles assertions ci-dessus qui échoueraient sans le
  changement.
- `pnpm typecheck` — le champ `disabled` devenant non optionnel sur `Profil.terminal`,
  vérifier qu'aucun autre point du code ne construit un `Profil` sans lui (recherche
  `PROFILS` / `Profil` dans `app/src`).
