---
{
  "id": "T-0074",
  "titre": "Port littéral châssis + Aperçu depuis Ovrsee App.dc.html",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": [
    "ui",
    "design-system"
  ],
  "cree": "2026-08-12",
  "maj": "2026-08-12",
  "plan": "2026-08-12-refonte-chassis-apercu-port-litteral-depuis-ovrsee-app-dc-ht.md",
  "charge": "l"
}
---

## Contexte

L'audit précédent a marqué des écrans « conformes » en comparant des noms de variables
CSS sans vérifier leur rendu réel. L'utilisateur a fourni des captures montrant le vrai
problème : traitement violet/indigo saturé et « qui brille » à plusieurs endroits sans
rapport — ligne de projet sélectionnée, badges SANTÉ tous dans la même couleur bleu foncé
(au lieu d'être différenciés par sémantique), chiffres de stats encadrés d'une boîte
(la maquette les affiche en texte gras nu), boutons du dock terminal, item Préférences,
barres de densité d'activité.

Cause racine : `--color-accent-800`/`--color-accent-900` (rampe sombre, quasi noir) utilisés
comme fond de badges/boutons par plusieurs composants qui supposent une valeur claire, plus
un vrai `box-shadow: 0 0 8px` (glow) dans `Terminal.tsx:181`. Bug d'usage des jetons répété
dans plusieurs fichiers indépendants.

Décision actée avec l'utilisateur : porter littéralement la structure et les valeurs
hex/px de `Ovrsee App.dc.html` (sections `#2a` châssis et `#2b` Aperçu) dans le code, comme
la maquette elle-même le fait — plutôt que de corriger jeton par jeton (le bug peut
resurgir sous la même forme ailleurs).

## Critères d'acceptation

- [ ] `App.tsx` : barre de titre, sidebar (liste PROJETS avec état sélectionné sans glow,
      liste VUES, lien Préférences) portés littéralement depuis `#2a`.
- [ ] `Apercu.tsx` : carte d'en-tête (stats en texte gras nu, pas de boîte), badges SANTÉ
      différenciés par sémantique (vert/ambre/rouge/violet, pas un bleu uniforme), plans
      ouverts, branches, environnements, déploiements, README — portés depuis `#2b`.
- [ ] `Terminal.tsx` : dock, onglets de session, boutons de disposition, panneau
      Commandes, pastille d'indicateur — sans `box-shadow` glow ni fond
      `--color-accent-800/900`.
- [ ] Aucun fond `--color-accent-800`/`--color-accent-900` ni `box-shadow` de type glow
      restant dans les trois fichiers ci-dessus (grep de contrôle).
- [ ] `pnpm typecheck` et `pnpm test` passent.
- [ ] Comparaison visuelle Chrome (sidebar, Aperçu, dock terminal) confirmée contre les
      captures fournies par l'utilisateur et `Ovrsee App.dc.html#2a`/`#2b`.
