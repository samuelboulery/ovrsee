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
 * Tout le reste — enregistrer, retirer, initialiser un projet — passe par
 * `/api`, partagé avec le dev server : deux chemins d'écriture divergeraient.
 *
 * Ce qui est tapé ensuite dans le terminal s'exécute, évidemment : c'est un
 * terminal. L'isolation par IPC ne sert pas à brider l'utilisateur, elle sert à
 * ce qu'aucun autre processus de la machine ne puisse se brancher sur ce pty —
 * ce qu'un socket local aurait offert à tout le monde.
 *
 * Sa présence sert aussi de test de capacité : dans un navigateur, ce fichier
 * n'existe pas, `window.cockpit` est absent, et l'interface le dit franchement
 * au lieu d'afficher un terminal qui ne marcherait pas.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cockpit', {
  projects: {
    /**
     * Ouvre le sélecteur de dossier du système.
     * @returns {Promise<string|null>} le chemin choisi, ou null si annulé
     */
    pick: () => ipcRenderer.invoke('projects:pick'),
  },

  terminal: {
    open: projectPath => ipcRenderer.invoke('pty:open', projectPath),
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
})
