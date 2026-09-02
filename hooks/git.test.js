/**
 * Ces tests posent un dépôt piégé — un `.git/config` qui nomme un script — et
 * vérifient qu'aucune lecture ne l'exécute. Le piège est réel : sans la garde,
 * le premier test échoue en trouvant le fichier témoin.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { git, gitReseau } from './git.js'
import { gitStatus } from './git-status.js'
import { snapshot } from './snapshot.js'

const sh = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })

/**
 * Le piège est un script `#!/bin/sh` : Windows ne l'exécute pas, et le bit
 * d'exécution n'y veut rien dire. Ces tests y passeraient sans rien prouver —
 * ils vérifient l'ABSENCE d'un fichier témoin, ce qui est vrai d'office sur un
 * système qui n'aurait de toute façon rien lancé. Mieux vaut les sauter en le
 * disant que les laisser mentir en vert.
 *
 * La garde elle-même n'est pas propre à un système : les `-c` sont posés de la
 * même façon partout, et c'est git qui les honore.
 */
const PIEGE_SH = { skip: process.platform === 'win32' ? 'piège en /bin/sh, non portable' : false }

/**
 * Dépôt dont le `.git/config` nomme un script à exécuter, comme le ferait une
 * archive reçue d'ailleurs. Le script écrit `TEMOIN` puis échoue : git le
 * traite alors comme un moniteur indisponible et poursuit normalement, ce qui
 * fait du fichier témoin le seul signe visible de l'exécution.
 */
function depotPiege() {
  const dir = mkdtempSync(join(tmpdir(), 'git-piege-'))
  // Le script et son témoin vivent hors de l'arbre de travail : dedans, ils
  // apparaîtraient comme fichiers non suivis et brouilleraient l'état lu.
  const dehors = mkdtempSync(join(tmpdir(), 'git-piege-hors-'))
  const temoin = join(dehors, 'TEMOIN')
  const script = join(dehors, 'piege.sh')
  sh(dir, ['init', '-b', 'main', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Test'])
  writeFileSync(script, `#!/bin/sh\necho execute > ${temoin}\nexit 1\n`)
  chmodSync(script, 0o755)
  writeFileSync(join(dir, 'a.txt'), 'contenu\n')
  sh(dir, ['add', 'a.txt'])
  sh(dir, ['commit', '-q', '-m', 'premier commit'])
  sh(dir, ['config', 'core.fsmonitor', script])
  sh(dir, ['config', 'core.pager', script])
  return { dir, dehors, temoin, script }
}

// Le piège doit mordre : un test qui ne peut pas échouer ne prouve rien. Si
// une version de git cessait d'honorer `core.fsmonitor`, les tests suivants
// passeraient sans rien garantir — celui-ci le dirait.
test('le piège est réel : git sans garde exécute le script du dépôt', PIEGE_SH, () => {
  const { dir, dehors, temoin } = depotPiege()
  try {
    execFileSync('git', ['status', '--porcelain=v1'], { cwd: dir, stdio: 'ignore' })
  } catch {
    // Peu importe le code de sortie : seul le témoin compte.
  }
  assert.equal(existsSync(temoin), true, 'git devrait avoir exécuté le script, sans garde')
  rmSync(dir, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})

test('git() n’exécute pas le programme nommé par le dépôt', PIEGE_SH, () => {
  const { dir, dehors, temoin } = depotPiege()
  const sortie = git(dir, ['status', '--porcelain=v1'], { encoding: 'utf8', stdio: 'pipe' })
  assert.equal(existsSync(temoin), false, 'le script du dépôt a été exécuté')
  assert.equal(sortie, '', 'le dépôt est propre, la lecture doit rester juste')
  rmSync(dir, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})

test('gitStatus n’exécute pas le programme nommé par le dépôt', PIEGE_SH, () => {
  const { dir, dehors, temoin } = depotPiege()
  const etat = gitStatus(dir)
  assert.equal(existsSync(temoin), false, 'le script du dépôt a été exécuté')
  assert.equal(etat.branch, 'main', 'la lecture doit rester juste')
  rmSync(dir, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})

// C'est le chemin réel de l'attaque : inscrire un projet au registre suffit à
// déclencher `snapshot()`, qui lit l'historique et l'état de travail.
test('snapshot() n’exécute pas le programme nommé par le dépôt', PIEGE_SH, () => {
  const { dir, dehors, temoin } = depotPiege()
  const vue = snapshot(dir)
  assert.equal(existsSync(temoin), false, 'le script du dépôt a été exécuté')
  // La frise porte les commits ; le premier est celui posé par `depotPiege`.
  assert.equal(vue.timeline.length, 1, 'la lecture doit rester juste')
  assert.equal(vue.gitStatus.branch, 'main', 'l’état git doit rester juste')
  rmSync(dir, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})

/**
 * La garde réseau doit tenir les deux bouts : effacer ce que le dépôt a écrit,
 * et rendre à l'utilisateur ce qu'il a réglé pour lui-même. Effacer sans rendre
 * cassait `git fetch` sur tout dépôt privé en HTTPS — c'est-à-dire le cas
 * normal, pas le cas hostile.
 *
 * Le test passe par `git credential fill`, qui invoque réellement les helpers :
 * `git config --get-all` ne dirait rien de juste ici, il liste l'historique des
 * portées, valeur vide comprise, là où git, à l'usage, traite cette valeur vide
 * comme une remise à zéro de la liste.
 *
 * `GIT_CONFIG_GLOBAL` fournit une configuration « de poste » jetable : le test
 * ne touche pas à celle de la machine, et dit la même chose partout.
 */
test('la garde réseau efface le helper du dépôt et garde celui du poste', PIEGE_SH, () => {
  const { dir, dehors, temoin, script } = depotPiege()
  const temoinPoste = join(dehors, 'TEMOIN-POSTE')
  const scriptPoste = join(dehors, 'poste.sh')
  writeFileSync(scriptPoste, `#!/bin/sh\necho execute > ${temoinPoste}\nexit 0\n`)
  chmodSync(scriptPoste, 0o755)

  const configPoste = join(dehors, 'gitconfig-poste')
  writeFileSync(configPoste, `[credential]\n\thelper = !${scriptPoste}\n`)
  sh(dir, ['config', 'credential.helper', `!${script}`])

  const env = { ...process.env, GIT_CONFIG_GLOBAL: configPoste, GIT_TERMINAL_PROMPT: '0' }
  try {
    gitReseau(dir, ['credential', 'fill'], {
      input: 'protocol=https\nhost=exemple.invalid\n\n',
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
  } catch {
    // Sans identifiant à rendre, git sort en erreur : seuls les témoins comptent.
  }

  assert.equal(existsSync(temoin), false, 'le helper du dépôt ne doit pas s’exécuter')
  assert.equal(existsSync(temoinPoste), true, 'le helper du poste doit rester actif')

  rmSync(dir, { recursive: true, force: true })
  rmSync(dehors, { recursive: true, force: true })
})
