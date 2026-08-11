---
{
  "id": "T-0053",
  "titre": "DevTools → Réseau dans Navigateur",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "navigateur",
    "phase-2"
  ],
  "cree": "2026-08-11",
  "maj": "2026-08-12",
  "plan": "2026-08-11-refonte-ui-ovrsee-mise-en-uvre-des-maquettes.md",
  "epic": "T-0052"
}
---

## Contexte

Le panneau DevTools de l'onglet Navigateur a déjà Console et sélecteur
d'élément (`Navigateur.tsx`). La maquette 2c ajoute un onglet Réseau :
liste des requêtes de la webview observée, méthode/statut/durée/taille,
lecture seule — respecte l'invariant « l'ovrsee lit ». Capture via
`webContents.debugger` (CDP `Network.*`) côté `electron/main.js`, exposé en
IPC, consommé par un nouvel onglet dans le panneau déjà ouvert par
`preview:devtools`.

**Clos sans code neuf (2026-08-12).** Le bouton « DevTools » de
`Navigateur.tsx` (`electron/main.js:410-456`, `preview:devtools`) n'ouvre
pas un panneau custom limité à Console + Éléments : il ouvre les vraies
DevTools Chromium natives (`target.openDevTools()` +
`setDevToolsWebContents`), intégrées dans une `WebContentsView` dockée. Ce
panneau a donc déjà un onglet Réseau complet — waterfall, en-têtes, timing,
tout ce que Chromium fait — strictement lecture seule par nature. Construire
une capture CDP custom aurait dupliqué, en moins bien, ce que le navigateur
fournit déjà. Le picker d'élément et le flux de console simplifié de
`Navigateur.tsx` restent des ajouts custom à part, pour un usage inline sans
ouvrir le panneau complet — ils ne sont pas concernés par ce ticket.

## Critères d'acceptation

- [x] Un onglet Réseau est atteignable depuis le panneau DevTools de
      Navigateur.tsx — via le panneau natif déjà ouvert par le bouton
      « DevTools », pas par un onglet custom.
- [x] Liste des requêtes de la page observée, mise à jour en direct —
      fournie nativement par Chromium.
- [x] Fonctionne uniquement dans Electron, comme le reste de l'onglet.
- [x] Aucune requête n'est modifiée ni rejouée — DevTools Réseau est
      lecture seule par défaut, et rien ici ne l'exécute autrement.
