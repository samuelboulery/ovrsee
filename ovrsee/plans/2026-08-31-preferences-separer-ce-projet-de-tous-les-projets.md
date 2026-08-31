---
{
  "status": "closed",
  "title": "Préférences : séparer « ce projet » de « tous les projets »",
  "opened": "2026-08-31",
  "closed": "2026-08-31",
  "commits": [
    {
      "sha": "8cc0368",
      "date": "2026-08-31",
      "files": []
    }
  ]
}
---

# Préférences : séparer « ce projet » de « tous les projets »

## Contexte

Le travail sur l'issue #79 est fait et en place dans l'arbre (branche
`feat/t-0216-commandes-terminal`, non commité) : `projectActions` indexé par
chemin, liste unique dans le panneau, bande rétractable, bouton « Créer une
commande… ». À l'essai, un défaut de rangement saute aux yeux : le bloc
**« Mes commandes — Partout »** se saisit depuis la section **Projet**. On
édite un réglage global depuis l'écran d'un projet.

Le défaut ne date pas de cette PR, il était juste invisible tant qu'il n'y
avait qu'une liste : la section « Projet » contient déjà trois blocs qui ne
sont pas du projet — le **démarrage** (`bootstrap`, global et délibérément non
surchargeable, issue #70), le **gestionnaire de paquets** et la **source du
graphe**.

**Le partage retenu** : la section porte le nom de ce qu'on y règle.
« Ce projet » ne garde que ce qui vaut pour le projet ouvert ; tout ce qui vaut
partout rejoint « Général », sans ouvrir une cinquième entrée de navigation.

```
Interface      inchangé
Général        s'agrandit  → thème, langue, densité
                             + Mes commandes (partout)
                             + Démarrage
                             + Avancé (gestionnaire, source du graphe)
                             + Revoir la présentation
Claude         inchangé
Ce projet      ex-« Projet » → couleur d'accent
                             + Mes commandes (ce projet seulement)
                             + Fichiers ignorés par git
                             + Intégrations
```

`gitignoreShots` / `gitignorePlans` restent dans « Ce projet » : ils écrivent
dans le `.gitignore` du dépôt ouvert (`hooks/gitignore-sync.js`) et
`ovrsee.config.json` peut les surcharger — ils portent bien sur un projet, même
si leur valeur par défaut est globale. L'aide du bloc « Avancé » doit dire la
même chose du gestionnaire et de la source du graphe : des défauts qu'un dépôt
peut surcharger.

## Le travail

### 1. `app/src/PreferencesProjet.tsx` — la section maigrit

- `SectionProjet` ne monte plus que : `BlocApparence`, `BlocActions` sur
  `settings.projectActions?.[root]`, `BlocGitignore`, `BlocIntegrations`.
- `BlocDemarrage` et `BlocAvance` deviennent `export` (ils restent dans ce
  fichier, c'est leur maison ; `BlocGitignore` est déjà exporté).
- Le second montage de `BlocActions` (le global) et la constante `SOUS_TITRE`
  disparaissent : chaque liste est désormais seule dans sa section, un
  `GroupLabel` suffit. `basename()` reste, l'aide du bloc projet nomme le
  dossier.
- La garde `root ? … : t('pref.actions_project_none')` disparaît avec la clé :
  la navigation ne propose plus la section sans projet (point 3).

### 2. `app/src/PreferencesPanel.tsx` — `SectionGeneral` accueille le global

Après la densité et **avant** le bouton « Revoir la présentation » (qui doit
rester en bas) :

```
<GroupLabel>{t('pref.actions_title')}</GroupLabel>
<BlocActions actions={settings.customActions ?? []}
             onActions={customActions => onSettings({ ...settings, customActions })}
             aide={t('pref.actions_global_desc')} />
<GroupLabel>{t('pref.bootstrap_title')}</GroupLabel>
<BlocDemarrage … />
<GroupLabel>{t('pref.advanced')}</GroupLabel>
<BlocAvance … />
```

`BlocActions` doit être exporté par `PreferencesProjet.tsx` pour ça — même
composant, deux montages, comme aujourd'hui.

### 3. La navigation cache « Ce projet » sans projet

- `SECTIONS` (`PreferencesPanel.tsx:52`) filtré par `root` : l'entrée `projet`
  ne paraît que si un projet est ouvert.
- Garde-fou : si `section === 'projet'` alors qu'elle est cachée (projet fermé
  pendant que la modale est ouverte, `initialSection` mal passé), retomber sur
  `'interface'` — l'état `section` (`:502`) doit être corrigé, pas seulement le
  rendu, sinon la barre n'a plus d'entrée `aria-current`.
- Le CTA du panneau terminal et celui de l'Aperçu passent tous deux
  `section: 'projet'` : ils ne s'affichent qu'avec un projet ouvert, rien à y
  changer.

### 4. `hooks/i18n.js` — les libellés suivent le partage

- `pref.project` : « Projet » → **« Ce projet »** / « Project » → **« This project »**.
- Retirer `pref.actions_global_title`, `pref.actions_project_title`,
  `pref.actions_project_none` — devenues inutiles.
- `pref.actions_global_desc` / `pref.actions_project_desc` restent, ce sont les
  deux aides. Ajouter au besoin une ligne d'aide au bloc « Avancé » disant que
  ces défauts sont surchargeables par `ovrsee.config.json`.
- Les deux tables restent alignées : `hooks/i18n.test.js` le vérifie.

### 5. Doc-comments

`PreferencesProjet.tsx` en tête : le fichier ne décrit plus « les réglages du
projet » au sens large mais **ce qui est indexé par projet** — accent (registre),
`projectActions` (chemin), intégrations (`~/.claude/ovrsee/integrations.json`),
gitignore (écrit dans le dépôt). Dire aussi où sont partis le démarrage et
l'avancé, et pourquoi.

## Tests

Aucun test ne monte les préférences aujourd'hui (`render.test.tsx` rend les
onglets, pas la modale). Le partage est du rangement, pas de la logique : rien
de neuf à tester côté `node:test`. Vérifier seulement que la suite existante
reste verte — `prefs.test.tsx` touche les préférences, il faut relire ce qu'il
couvre avant de déplacer les blocs.

## Vérification

1. `pnpm lint && pnpm typecheck && pnpm test` — vert.
2. `pnpm electron` :
   - « Général » porte thème/langue/densité, puis Mes commandes (partout),
     Démarrage, Avancé, puis Revoir la présentation ;
   - « Ce projet » porte accent, Mes commandes (ce projet), Gitignore,
     Intégrations — et rien de global ;
   - une commande créée dans « Ce projet » n'apparaît que là, une commande de
     « Général » partout ;
   - « Créer une commande… » depuis le panneau terminal ouvre bien « Ce projet » ;
   - sans projet ouvert (écran de premier lancement), l'entrée « Ce projet »
     n'est pas dans la barre et la modale s'ouvre sur « Interface ».
