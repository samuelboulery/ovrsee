/**
 * Ces tests posent un dépôt piégé — un `.git/config` qui nomme un script — et
 * vérifient qu'aucune lecture ne l'exécute. Le piège est réel : sans la garde,
 * le premier test échoue en trouvant le fichier témoin.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

// --- au-delà de fsmonitor : hooks, filtres, gpg, transport local -----------
//
// Chaque vecteur a son couple de tests : le piège mord sans garde, et la garde
// le désarme. Un dépôt reçu en archive apporte son `.git/` entier — hooks
// exécutables, `.git/config` — et `--no-verify` ne coupe que `pre-commit` et
// `commit-msg`.

/** Un dépôt propre et un script témoin hors de l'arbre. `sortie` : ce que le script imprime. */
function depotEtTemoin(sortie = '') {
  const dir = mkdtempSync(join(tmpdir(), 'git-piege-'))
  const dehors = mkdtempSync(join(tmpdir(), 'git-piege-hors-'))
  const temoin = join(dehors, 'TEMOIN')
  const script = join(dehors, 'piege.sh')
  writeFileSync(script, `#!/bin/sh\necho execute >> ${temoin}\n${sortie}\nexit 0\n`)
  chmodSync(script, 0o755)
  sh(dir, ['init', '-b', 'main', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Test'])
  writeFileSync(join(dir, 'a.txt'), 'contenu\n')
  sh(dir, ['add', 'a.txt'])
  sh(dir, ['commit', '-q', '-m', 'premier commit'])
  const nettoyer = () => {
    rmSync(dir, { recursive: true, force: true })
    rmSync(dehors, { recursive: true, force: true })
  }
  return { dir, dehors, temoin, script, nettoyer }
}

const HOOKS = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'post-index-change', 'reference-transaction']

/** L'équipement d'un projet : `add -A` puis `commit --no-verify` (`install.js`). */
const equiper = (lancer, dir) => {
  writeFileSync(join(dir, 'b.txt'), 'neuf\n')
  lancer(dir, ['add', '-A'])
  lancer(dir, ['commit', '--no-verify', '-q', '-m', 'chore: point de départ'])
}
const sansGarde = (dir, args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
const avecGarde = (dir, args) => git(dir, args, { stdio: 'ignore' })

for (const ou of ['.git/hooks', 'core.hooksPath']) {
  const poser = (dir, script, dehors) => {
    let dossier = join(dir, '.git', 'hooks')
    if (ou === 'core.hooksPath') {
      dossier = join(dehors, 'hooks')
      sh(dir, ['config', 'core.hooksPath', dossier])
    }
    mkdirSync(dossier, { recursive: true })
    for (const h of HOOKS) copyFileSync(script, join(dossier, h))
  }

  test(`le piège est réel : commit --no-verify exécute des hooks (${ou})`, PIEGE_SH, () => {
    const { dir, dehors, temoin, script, nettoyer } = depotEtTemoin()
    poser(dir, script, dehors)
    equiper(sansGarde, dir)
    assert.equal(existsSync(temoin), true)
    nettoyer()
  })

  test(`git() n’exécute aucun hook du dépôt (${ou})`, PIEGE_SH, () => {
    const { dir, dehors, temoin, script, nettoyer } = depotEtTemoin()
    poser(dir, script, dehors)
    equiper(avecGarde, dir)
    assert.equal(existsSync(temoin), false, 'un hook du dépôt a été exécuté')
    assert.equal(sh(dir, ['log', '-1', '--format=%s']).trim(), 'chore: point de départ')
    nettoyer()
  })
}

for (const cle of ['clean', 'process']) {
  // Un filtre `.gitattributes` passe chaque fichier dans un programme du dépôt.
  const poser = (dir, script) => {
    writeFileSync(join(dir, '.gitattributes'), '*.txt filter=piege\n')
    sh(dir, ['config', `filter.piege.${cle}`, script])
    sh(dir, ['config', 'filter.piege.required', 'true'])
  }

  test(`le piège est réel : un filtre ${cle} s’exécute au add`, PIEGE_SH, () => {
    const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
    poser(dir, script)
    try {
      equiper(sansGarde, dir)
    } catch {
      // `process` attend un protocole : le script échoue, mais il a tourné.
    }
    assert.equal(existsSync(temoin), true)
    nettoyer()
  })

  test(`git() n’exécute pas un filtre ${cle} du dépôt, ni au status ni au add`, PIEGE_SH, () => {
    const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
    poser(dir, script)
    writeFileSync(join(dir, 'a.txt'), 'modifié\n')
    git(dir, ['status', '--porcelain=v1'], { stdio: 'ignore' })
    equiper(avecGarde, dir)
    assert.equal(existsSync(temoin), false, 'le filtre du dépôt a été exécuté')
    nettoyer()
  })
}

/** Un commit signé par un faux programme gpg, pour que `git log` ait une signature à vérifier. */
function signer(dir, dehors) {
  const signeur = join(dehors, 'signe.sh')
  writeFileSync(
    signeur,
    '#!/bin/sh\ncat >/dev/null\necho "[GNUPG:] SIG_CREATED " >&2\n' +
      'printf -- "-----BEGIN PGP SIGNATURE-----\\n\\nAA==\\n-----END PGP SIGNATURE-----\\n"\n',
  )
  chmodSync(signeur, 0o755)
  writeFileSync(join(dir, 'c.txt'), 'signé\n')
  sh(dir, ['add', 'c.txt'])
  sh(dir, ['-c', `gpg.program=${signeur}`, 'commit', '-q', '-S', '-m', 'signé'])
}

test('le piège est réel : log.showSignature lance gpg.program', PIEGE_SH, () => {
  const { dir, dehors, temoin, script, nettoyer } = depotEtTemoin()
  signer(dir, dehors)
  sh(dir, ['config', 'gpg.program', script])
  sh(dir, ['config', 'log.showSignature', 'true'])
  sansGarde(dir, ['log', '-n5', '--pretty=format:%h'])
  assert.equal(existsSync(temoin), true)
  nettoyer()
})

test('git() ne lance aucun programme gpg du dépôt, ni au log ni au commit', PIEGE_SH, () => {
  const { dir, dehors, temoin, script, nettoyer } = depotEtTemoin()
  signer(dir, dehors)
  sh(dir, ['config', 'gpg.program', script])
  sh(dir, ['config', 'log.showSignature', 'true'])
  sh(dir, ['config', 'commit.gpgSign', 'true'])
  avecGarde(dir, ['log', '-n5', '--pretty=format:%h'])
  equiper(avecGarde, dir)
  assert.equal(existsSync(temoin), false, 'un programme gpg du dépôt a été lancé')
  nettoyer()
})

test('le piège est réel : un fetch local lance remote.<n>.uploadpack', PIEGE_SH, () => {
  const { dir, temoin, script, nettoyer } = depotEtTemoin()
  const source = depotEtTemoin()
  sh(dir, ['remote', 'add', 'origin', source.dir])
  sh(dir, ['config', 'remote.origin.uploadpack', script])
  try {
    sansGarde(dir, ['fetch', 'origin'])
  } catch {
    // Le script n'est pas un upload-pack : le fetch échoue, mais il a tourné.
  }
  assert.equal(existsSync(temoin), true)
  nettoyer()
  source.nettoyer()
})

test('gitReseau ne lance pas l’uploadpack du dépôt', PIEGE_SH, () => {
  const { dir, temoin, script, nettoyer } = depotEtTemoin()
  const source = depotEtTemoin()
  sh(dir, ['remote', 'add', 'origin', source.dir])
  sh(dir, ['config', 'remote.origin.uploadpack', script])
  try {
    gitReseau(dir, ['fetch', 'origin'], { stdio: 'ignore' })
  } catch {
    // Le transport local est refusé : c'est l'effet voulu.
  }
  assert.equal(existsSync(temoin), false, 'l’uploadpack du dépôt a été lancé')
  nettoyer()
  source.nettoyer()
})

test('un filtre réglé par l’utilisateur (git-lfs) survit à la garde, celui du dépôt non', PIEGE_SH, () => {
  // Le dépôt redéfinit en local le pilote que le poste déclare en global : on
  // rend au poste le sien, et seulement le sien.
  const { dir, dehors, temoin, script, nettoyer } = depotEtTemoin('cat')
  const temoinPoste = join(dehors, 'TEMOIN-POSTE')
  const scriptPoste = join(dehors, 'poste.sh')
  writeFileSync(scriptPoste, `#!/bin/sh\necho execute >> ${temoinPoste}\ncat\n`)
  chmodSync(scriptPoste, 0o755)
  const configPoste = join(dehors, 'gitconfig-poste')
  writeFileSync(configPoste, `[filter "lfs"]\n\tclean = ${scriptPoste}\n`)

  writeFileSync(join(dir, '.gitattributes'), '*.txt filter=lfs\n')
  sh(dir, ['config', 'filter.lfs.clean', script])
  writeFileSync(join(dir, 'a.txt'), 'modifié\n')

  git(dir, ['add', '-A'], { stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: configPoste } })

  assert.equal(existsSync(temoin), false, 'le filtre du dépôt a été exécuté')
  assert.equal(existsSync(temoinPoste), true, 'le filtre du poste doit rester actif')
  nettoyer()
})

test('git() n’exécute pas un filtre déclaré par un [include] du .git/config', PIEGE_SH, () => {
  // `git config --local` ne suit pas les inclusions par défaut, git à l'usage si :
  // le pilote vivait dans un fichier versionné, invisible à la lecture.
  const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
  writeFileSync(join(dir, 'reglages.cfg'), `[filter "piege"]\n\tclean = ${script}\n\trequired = true\n`)
  sh(dir, ['config', 'include.path', '../reglages.cfg'])
  writeFileSync(join(dir, '.gitattributes'), '*.txt filter=piege\n')
  writeFileSync(join(dir, 'a.txt'), 'modifié\n')

  equiper(avecGarde, dir)

  assert.equal(existsSync(temoin), false, 'le filtre inclus a été exécuté')
  nettoyer()
})

// --- seconde relecture : ce que `--local` et `-c` ne voyaient pas ------------

/** Un sous-module dont le `.git/config` déclare un filtre, et un fichier modifié à taille égale. */
function sousModulePiege() {
  const parent = depotEtTemoin('cat')
  const enfant = depotEtTemoin()
  sh(parent.dir, ['-c', 'protocol.file.allow=always', 'submodule', '-q', 'add', enfant.dir, 'sub'])
  sh(parent.dir, ['commit', '-q', '-m', 'sous-module'])
  const sub = join(parent.dir, 'sub')
  sh(sub, ['config', 'filter.p.clean', parent.script])
  writeFileSync(join(sub, '.gitattributes'), '*.txt filter=p\n')
  // Même taille que l'index : seul le contenu dit si le fichier a changé, donc le filtre.
  writeFileSync(join(sub, 'a.txt'), 'CONTENU\n')
  return { parent, enfant }
}

test('le piège est réel : git status lance le filtre d’un sous-module', PIEGE_SH, () => {
  const { parent, enfant } = sousModulePiege()
  sansGarde(parent.dir, ['status', '--porcelain=v1'])
  assert.equal(existsSync(parent.temoin), true)
  parent.nettoyer()
  enfant.nettoyer()
})

test('gitStatus ne descend pas dans les sous-modules', PIEGE_SH, () => {
  const { parent, enfant } = sousModulePiege()
  gitStatus(parent.dir)
  assert.equal(existsSync(parent.temoin), false, 'le filtre du sous-module a été exécuté')
  parent.nettoyer()
  enfant.nettoyer()
})

/** `.git/config.worktree`, que `--local` ne lit pas. */
const filtreEnWorktree = (dir, script) => {
  sh(dir, ['config', 'extensions.worktreeConfig', 'true'])
  sh(dir, ['config', '--worktree', 'filter.p.clean', script])
  writeFileSync(join(dir, '.gitattributes'), '*.txt filter=p\n')
}

test('le piège est réel : un filtre de config.worktree s’exécute au add', PIEGE_SH, () => {
  const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
  filtreEnWorktree(dir, script)
  equiper(sansGarde, dir)
  assert.equal(existsSync(temoin), true)
  nettoyer()
})

test('git() n’exécute pas un filtre déclaré dans config.worktree', PIEGE_SH, () => {
  const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
  filtreEnWorktree(dir, script)
  equiper(avecGarde, dir)
  assert.equal(existsSync(temoin), false, 'le filtre de config.worktree a été exécuté')
  nettoyer()
})

test('un pilote dont le nom contient « = » est refusé, pas exécuté', PIEGE_SH, () => {
  // `-c filter.a=b.clean=` se coupe au premier `=` : la clé visée devenait `filter.a`.
  const { dir, temoin, script, nettoyer } = depotEtTemoin('cat')
  sh(dir, ['config', 'filter.a=b.clean', script])
  writeFileSync(join(dir, '.gitattributes'), '*.txt filter=a=b\n')
  assert.throws(() => equiper(avecGarde, dir), /=/)
  assert.equal(existsSync(temoin), false, 'le pilote « a=b » a été exécuté')
  nettoyer()
})

test('un http.<url>.cookieFile du dépôt ne survit pas à la garde réseau', () => {
  // Avec `saveCookies`, libcurl réécrit ce fichier au fetch — `~/.zshrc` compris.
  // Une clé propre à une URL l'emporte sur un `-c http.cookieFile=` générique :
  // c'est la clé exacte qu'il faut vider. Vérifié par git lui-même, sans réseau.
  const { dir, nettoyer } = depotEtTemoin()
  sh(dir, ['config', 'http.http://evil.example/.cookieFile', join(dir, 'cible')])
  sh(dir, ['config', 'http.http://evil.example/.saveCookies', 'true'])
  const resolu = cle => {
    try {
      return gitReseau(dir, ['config', '--get-urlmatch', cle, 'http://evil.example/x'], { encoding: 'utf8' }).trim()
    } catch {
      return '' // Absente : git sort en 1.
    }
  }
  assert.equal(resolu('http.cookieFile'), '')
  assert.notEqual(resolu('http.saveCookies'), 'true')
  nettoyer()
})

test('un core.worktree posé par le dépôt est refusé', () => {
  // `-c core.worktree=` n'y peut rien : git le lit avant la ligne de commande,
  // et l'équipement écrirait `ovrsee/` dans le dossier choisi par le dépôt.
  const { dir, dehors, nettoyer } = depotEtTemoin()
  sh(dir, ['config', 'core.worktree', dehors])
  assert.throws(() => git(dir, ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }), /core\.worktree/)
  nettoyer()
})
