/**
 * Le seul point d'où part une commande `git` visant un dépôt observé.
 *
 * Un dépôt n'est pas qu'un arbre de fichiers : son `.git/config` est du code
 * que git exécute pour son compte. `core.fsmonitor` nomme un programme lancé
 * au premier `git status` ; `core.pager`, `diff.external`, `core.sshCommand`
 * et `credential.helper` en nomment d'autres. Un dépôt reçu d'ailleurs — un
 * zip, une clé, un clone hostile — les apporte avec lui.
 *
 * L'ovrsee lit un dépôt **avant** que quiconque ait accordé quoi que ce soit :
 * l'inscrire au registre suffit à déclencher `snapshot()`, donc `git status`.
 * L'accord gardé dans `trust.json` (T-0190) ne couvre que la ligne `dev` du
 * crawl, et il arrive bien plus tard. Sans la garde ci-dessous, « inscrire un
 * projet » exécutait donc du code de ce projet — exactement ce que l'invariant
 * du cadrage interdit.
 *
 * `GIT_CONFIG_NOSYSTEM` ne sert à rien ici : il neutralise la configuration du
 * système, pas celle du dépôt, qui est justement la seule à venir du dehors.
 * Ce qui marche est de neutraliser nommément chaque réglage qui lance un
 * programme, par des `-c` posés avant la sous-commande — ils gagnent sur le
 * `.git/config`.
 *
 * Ce module n'est pas une commodité : c'est la garde. Appeler `execFileSync`
 * sur `git` ailleurs la contourne en silence.
 */

import { execFileSync } from 'node:child_process'

/**
 * Réglages qui font exécuter un programme nommé par le dépôt, neutralisés.
 *
 * `core.fsmonitor=false` (et non `''`) : la valeur booléenne est celle que git
 * documente pour couper le démon, et elle couvre aussi la forme `true` qui
 * lancerait `fsmonitor--daemon`. Les autres se vident : une chaîne vide veut
 * dire « aucun programme », là où `false` ne serait pas une valeur valide.
 */
export const SANS_PROGRAMME = [
  '-c', 'core.fsmonitor=false',
  '-c', 'core.pager=cat',
  '-c', 'core.sshCommand=ssh',
  '-c', 'diff.external=',
  '-c', 'credential.helper=',
  '-c', 'core.askPass=',
  '-c', 'protocol.ext.allow=never',
]

/**
 * Lance `git` sur un dépôt dont on ne contrôle pas la configuration.
 *
 * Mêmes options qu'`execFileSync`, dont l'appelant garde la main : seule la
 * liste d'arguments est préfixée. Ne capture aucune erreur — c'est à
 * l'appelant de décider si un dépôt muet est une panne ou un cas normal.
 *
 * @param {string} root racine du dépôt observé
 * @param {string[]} args arguments de git, sous-commande comprise
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 * @returns {string} la sortie standard, décodée selon `options.encoding`
 */
export const git = (root, args, options = {}) =>
  execFileSync('git', [...SANS_PROGRAMME, ...args], { cwd: root, ...options })
