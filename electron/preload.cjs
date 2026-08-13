/**
 * La seule surface par laquelle le rendu atteint le système.
 *
 * Volontairement minuscule : ouvrir une session dans un projet, écrire dedans,
 * la redimensionner, la fermer, écouter sa sortie — et ouvrir le sélecteur de
 * dossier du système. Aucune fonction n'accepte de nom de programme, de
 * commande ou de chemin de fichier — le programme lancé est décidé dans
 * `pty.js`, et c'est un shell de connexion ; le sélecteur, lui, ne prend aucun
 * argument et rend le seul chemin que l'utilisateur a cliqué.
 *
 * `open` prend un *genre* de session (`claude`, `shell`), pas une commande :
 * ce que ce mot déclenche est décidé dans `pty.js`, et un mot inconnu retombe
 * sur `claude`.
 *
 * Tout le reste — enregistrer, retirer, initialiser un projet — passe par
 * `/api`, partagé avec le dev server : deux chemins d'écriture divergeraient.
 * Seconde exception à `/api`, pour la même raison que le terminal : les
 * secrets d'intégration (`integrations`, plus bas) — un token ne doit jamais
 * transiter par le dev server HTTP local, non-authentifié.
 *
 * Ce qui est tapé ensuite dans le terminal s'exécute, évidemment : c'est un
 * terminal. L'isolation par IPC ne sert pas à brider l'utilisateur, elle sert à
 * ce qu'aucun autre processus de la machine ne puisse se brancher sur ce pty —
 * ce qu'un socket local aurait offert à tout le monde.
 *
 * Sa présence sert aussi de test de capacité : dans un navigateur, ce fichier
 * n'existe pas, `window.ovrsee` est absent, et l'interface le dit franchement
 * au lieu d'afficher un terminal qui ne marcherait pas.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ovrsee', {
  projects: {
    /**
     * Ouvre le sélecteur de dossier du système.
     * @returns {Promise<string|null>} le chemin choisi, ou null si annulé
     */
    pick: () => ipcRenderer.invoke('projects:pick'),

    /**
     * Révèle le `ovrsee/` d'un projet dans le Finder.
     *
     * Le chemin est vérifié contre le registre côté principal : ce qui n'y est
     * pas n'est pas révélé.
     *
     * @param {string} projectPath dossier du projet
     * @returns {Promise<boolean>}
     */
    reveal: projectPath => ipcRenderer.invoke('projects:reveal', projectPath),

    /**
     * Ouvre un projet dans un éditeur, par son schéma d'URL.
     *
     * Le nom de l'éditeur est vérifié contre une liste blanche côté principal,
     * et le chemin contre le registre. Rend `false` si l'un des deux est refusé
     * — pas si l'éditeur n'est pas installé, ce que le système ne dit pas.
     *
     * @param {string} projectPath dossier du projet
     * @param {'vscode'|'cursor'|'zed'|'windsurf'} editor
     * @returns {Promise<boolean>}
     */
    edit: (projectPath, editor) => ipcRenderer.invoke('projects:edit', projectPath, editor),
  },

  menu: {
    /**
     * Écoute les commandes du menu natif.
     *
     * Un mot, jamais une fonction : le menu dit ce qu'on a choisi, le rendu
     * décide de ce que ça fait — c'est lui qui tient déjà ces gestes.
     *
     * @param {(command: string) => void} handler
     * @returns {() => void} désabonnement
     */
    on(handler) {
      const listener = (_event, command) => handler(command)
      ipcRenderer.on('menu:command', listener)
      return () => ipcRenderer.off('menu:command', listener)
    },
  },

  app: {
    /**
     * Ramène la fenêtre au premier plan.
     *
     * Sans argument, et c'est ce qui la rend sûre : le processus principal vise
     * la fenêtre émettrice, le rendu n'en désigne aucune.
     */
    focus: () => ipcRenderer.invoke('app:focus'),
  },

  preview: {
    /**
     * Ouvre les DevTools de l'aperçu dans la fenêtre, et les place.
     *
     * Appelée à chaque changement de taille de l'emplacement réservé : le
     * panneau est une vue native posée sur le DOM, elle ne suit pas la mise en
     * page toute seule. Une taille nulle l'escamote.
     *
     * @param {number} targetId contenu inspecté ; doit être un invité de cette fenêtre
     * @param {{x: number, y: number, width: number, height: number}} bounds place réservée
     * @param {'dark'|'light'} theme thème de l'interface ; tout le reste vaut `dark`
     * @returns {Promise<boolean>}
     */
    devtools: (targetId, bounds, theme) =>
      ipcRenderer.invoke('preview:devtools', targetId, bounds, theme),

    /** Referme le panneau et rend la place. */
    devtoolsClose: () => ipcRenderer.invoke('preview:devtools-close'),
  },

  terminal: {
    /**
     * @param {string} projectPath dossier du projet
     * @param {'claude'|'shell'} [kind] `claude` lance Claude, `shell` un shell nu
     */
    open: (projectPath, kind) => ipcRenderer.invoke('pty:open', projectPath, kind),
    write: (id, data) => ipcRenderer.invoke('pty:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('pty:resize', id, cols, rows),
    close: id => ipcRenderer.invoke('pty:close', id),

    /**
     * @param {(id: string, data: string) => void} onData
     * @param {(id: string, code: number) => void} onExit
     * @returns {() => void} désabonnement
     */
    listen(onData, onExit) {
      const data = (_event, id, chunk) => onData(id, chunk)
      const exit = (_event, id, code) => onExit(id, code)

      ipcRenderer.on('pty:data', data)
      ipcRenderer.on('pty:exit', exit)

      return () => {
        ipcRenderer.off('pty:data', data)
        ipcRenderer.off('pty:exit', exit)
      }
    },
  },

  integrations: {
    /**
     * Crée ou met à jour une intégration. `token` est write-only : omis, il
     * laisse le jeton déjà enregistré intact ; fourni, il le remplace.
     *
     * @param {string} projectPath
     * @param {{id?: string, provider: string, label: string, url?: string, token?: string}} entry
     * @returns {Promise<Array<object> | {error: string}>}
     */
    save: (projectPath, entry) => ipcRenderer.invoke('integrations:save', projectPath, entry),

    /**
     * @param {string} projectPath
     * @param {string} id
     * @returns {Promise<Array<object>>}
     */
    remove: (projectPath, id) => ipcRenderer.invoke('integrations:remove', projectPath, id),

    /**
     * Déchiffre le jeton côté principal, interroge le fournisseur, rend un
     * statut déjà résolu — jamais le jeton.
     *
     * @param {string} projectPath
     * @param {string} id
     * @returns {Promise<{state: 'ok'|'error'|'building'|'unknown', detail: string, checkedAt: string}>}
     */
    checkStatus: (projectPath, id) => ipcRenderer.invoke('integrations:checkStatus', projectPath, id),

    /**
     * Introspection lecture-seule du schéma public, Supabase uniquement.
     *
     * @param {string} projectPath
     * @param {string} id
     * @returns {Promise<{tables: Array<{name: string, columns: string[]}>} | {error: string}>}
     */
    fetchSchema: (projectPath, id) => ipcRenderer.invoke('integrations:fetchSchema', projectPath, id),
  },
})
