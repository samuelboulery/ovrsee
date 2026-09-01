/**
 * La passerelle pty et ce qui s'y colle — sans xterm.
 *
 * Extrait de `useTerminal.ts` (T-0133) : ce fichier-là importe xterm et sa
 * feuille de style, 488 ko, et trois composants du bundle principal
 * (`CommandPalette`, `EquipmentPanel`, `Navigateur`) n'en voulaient que
 * `pasteToClaude`. Les y laisser importer annulait le chargement paresseux du
 * panneau : le terminal partait en morceau séparé, xterm restait dans le
 * principal. Rien ici ne doit dépendre de xterm.
 */
import type { Integration, IntegrationProvider, IntegrationStatus, SchemaTable } from './data'
import type { MenuBarDecision, MenuBarEtat, MenuBarVue } from './menubar'

/** Genre de session. Le rendu ne nomme jamais de programme — voir `electron/pty.js`. */
export type SessionKind = 'claude' | 'shell'

/**
 * Passerelle exposée par `electron/preload.cjs`.
 *
 * Absente dans un navigateur : c'est le test de capacité de l'interface, et il
 * est franc — pas de terminal simulé, pas de bouton qui ment.
 */
export interface TerminalBridge {
  open: (projectPath: string, kind?: SessionKind) => Promise<{ id: string } | { error: string }>
  write: (id: string, data: string) => Promise<void>
  resize: (id: string, cols: number, rows: number) => Promise<void>
  close: (id: string) => Promise<void>
  listen: (
    onData: (id: string, data: string) => void,
    onExit: (id: string, code: number) => void,
  ) => () => void
}

/** Les éditeurs dont le processus principal connaît le schéma d'URL. */
export type Editeur = 'vscode' | 'cursor' | 'zed' | 'windsurf'

/**
 * Passerelle des secrets d'intégration — voir `electron/preload.cjs`.
 *
 * Un jeton entre par `save` et ne ressort jamais : `save`/`remove` ne
 * rendent que `hasToken`, `checkStatus` qu'un statut déjà résolu. La lecture
 * seule (sans jeton) vient de `snapshot.integrations`, servi sur les trois
 * hôtes — pas besoin d'un `list` ici.
 */
export interface IntegrationsBridge {
  save: (
    projectPath: string,
    entry: { id?: string; provider: IntegrationProvider; label: string; url?: string; token?: string },
  ) => Promise<Integration[] | { error: string }>
  remove: (projectPath: string, id: string) => Promise<Integration[]>
  checkStatus: (projectPath: string, id: string) => Promise<IntegrationStatus>
  /** Introspection lecture-seule du schéma public, Supabase uniquement. */
  fetchSchema: (
    projectPath: string,
    id: string,
  ) => Promise<{ tables: SchemaTable[] } | { error: string }>
}

declare global {
  interface Window {
    ovrsee?: {
      terminal: TerminalBridge
      integrations: IntegrationsBridge
      projects: {
        /** Sélecteur de dossier du système. Rend null si l'utilisateur annule. */
        pick: () => Promise<string | null>
        /** Révèle le `ovrsee/` du projet dans le Finder. */
        reveal: (projectPath: string) => Promise<boolean>
        /** Ouvre le projet dans un éditeur, par schéma d'URL. */
        edit: (projectPath: string, editor: Editeur) => Promise<boolean>
      }
      /** Commandes du menu natif — voir `electron/menu.js`. */
      menu: { on: (handler: (command: string) => void) => () => void }
      /**
       * Ramène la fenêtre au premier plan. La seule chose qu'un clic sur une
       * notification ne peut pas faire depuis le rendu.
       */
      app: {
        focus: () => Promise<void>
        close: () => Promise<void>
        /**
         * Accorde la chrome native au thème du rendu — menus, dialogues,
         * ascenseurs de l'OS, DevTools. Optionnel : une version antérieure du
         * preload ne l'expose pas, et le rendu ne doit pas s'y casser.
         */
        setTheme?: (pref: 'dark' | 'light' | 'system') => Promise<void>
      }
      /**
       * Barre de menu macOS — voir `electron/tray.js`.
       *
       * Absente dans un navigateur, comme le terminal : il n'y a pas de barre
       * de statut à alimenter.
       */
      menubar?: {
        /** Le rendu principal publie l'état complet ; le principal le retient. */
        report: (etat: MenuBarEtat) => Promise<void>
        /** Le popover s'abonne à cet état, augmenté de ce que seul le principal sait. */
        listen: (handler: (vue: MenuBarVue) => void) => () => void
        /**
         * Répond à une session. Le rendu n'envoie que la décision — la touche
         * correspondante est choisie dans le processus principal.
         */
        answer: (ptyId: string, decision: MenuBarDecision) => Promise<boolean>
        /** Ramène la fenêtre sur cette session, puis referme le popover. */
        reveal: (sessionKey: string) => Promise<void>
        /** Côté fenêtre principale : le popover demande cette session. */
        onReveal: (handler: (sessionKey: string) => void) => () => void
      }
      /** Onglet Navigateur — voir `electron/preload.cjs`. */
      preview: {
        devtools: (
          targetId: number,
          bounds: { x: number; y: number; width: number; height: number },
        ) => Promise<boolean>
        devtoolsClose: () => Promise<boolean>
      }
    }
  }
}

export const terminalBridge = (): TerminalBridge | null => window.ovrsee?.terminal ?? null

/**
 * Session Claude courante, à portée de module.
 *
 * L'onglet Navigateur écrit dedans sans être un enfant du panneau terminal.
 * Faire descendre `inject` par les props obligerait à remonter le cycle de vie
 * de xterm jusqu'à `App.tsx`, et démonter `<Terminal>` tuerait la session — le
 * panneau est repliable.
 *
 * Un objet mutable plutôt qu'un `let` exporté : `useTerminals` vit dans un
 * autre module depuis T-0133, et une liaison d'import ne se réaffecte pas.
 */
export const claude: { id: string | null } = { id: null }

/**
 * Écrit dans le pty désigné. Rend false quand il n'y en a pas — c'est le cas
 * dans un navigateur, et l'appelant se rabat alors sur le presse-papier.
 */
function injectTo(ptyId: string | null, text: string): boolean {
  const bridge = terminalBridge()
  if (!bridge || !ptyId) return false
  bridge.write(ptyId, text)
  return true
}

/**
 * Colle un bloc dans le pty désigné sans le valider.
 *
 * Le mode « bracketed paste » du terminal est indispensable pour un texte
 * multiligne : sans lui, le premier retour à la ligne validerait la saisie et
 * le reste du bloc partirait comme autant de messages séparés. Rien n'est
 * envoyé — l'utilisateur relit et appuie sur Entrée.
 */
export function pasteTo(ptyId: string | null, text: string): boolean {
  return injectTo(ptyId, `\x1b[200~${text}\x1b[201~`)
}

/** Colle un bloc dans la session Claude du projet courant — voir `pasteTo`. */
export function pasteToClaude(text: string): boolean {
  return pasteTo(claude.id, text)
}

/**
 * Colle un bloc dans le pty désigné **et le valide**.
 *
 * Une seule écriture, pas deux : le `\r` voyage dans le même morceau que la
 * fin de collage, donc rien ne peut s'intercaler entre les deux. Il est
 * **après** `\x1b[201~`, hors du collage — dedans, il serait du texte.
 *
 * `pasteTo` reste le défaut partout ailleurs : coller sans valider laisse
 * relire, et c'est ce qu'on veut quand on prépare une demande. Celui-ci est
 * réservé au geste qui dit explicitement « envoie ».
 */
export function submitTo(ptyId: string | null, text: string): boolean {
  return injectTo(ptyId, `\x1b[200~${text}\x1b[201~\r`)
}

/** Envoie un bloc à la session Claude du projet courant, et le valide. */
export function submitToClaude(text: string): boolean {
  return submitTo(claude.id, text)
}

/** Ce qu'un clic sur une commande a trouvé comme destination. */
export type CibleCommande = { cible: string } | { neuf: true }

/**
 * Où part une commande cliquée.
 *
 * La cible naturelle est l'onglet **sous les yeux** — un raccourci cliqué
 * depuis un shell nu partait chez `claude` et volait l'onglet au passage
 * (issue #49). La session Claude ne reste que le repli du tout premier rendu,
 * avant que `pty:open` ait répondu.
 *
 * Une commande qui part toute seule ne s'écrit pas par-dessus ce qui tourne :
 * elle ouvre son propre terminal. Ce qui se colle sans être validé, en
 * revanche, va toujours dans la cible — c'est du texte à relire, pas une
 * commande, et occupé ou non n'y change rien.
 *
 * `null` quand aucune session n'a de pty : l'appelant se rabat alors sur le
 * presse-papier, comme dans un navigateur.
 */
export function cibleDeCommande(entree: {
  mode: 'command' | 'context'
  /** Clé de l'onglet actif, ou null au tout premier rendu. */
  actif: string | null
  claudeKey: string | null
  ptyIds: Readonly<Record<string, string>>
  /** Sessions où une commande tourne — voir `occupees` dans `Terminal.tsx`. */
  occupees: ReadonlySet<string>
}): CibleCommande | null {
  const { mode, actif, claudeKey, ptyIds, occupees } = entree
  const cible = actif && ptyIds[actif] ? actif : claudeKey && ptyIds[claudeKey] ? claudeKey : null
  if (!cible) return null
  if (mode === 'command' && occupees.has(cible)) return { neuf: true }
  return { cible }
}
