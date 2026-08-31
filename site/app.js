/**
 * Le peu de logique dont la page a besoin.
 *
 * La landing venait d'un export Claude Design, piloté par `support.js` — 69 ko
 * de runtime tiers, sans licence claire, pour un gabarit à quatre besoins :
 * répéter une liste, montrer une section selon l'onglet choisi, mettre à
 * l'échelle la fenêtre de démo, et basculer la langue. C'est ce fichier.
 *
 * Aucune dépendance, et aucune requête sortante hors un appel facultatif à l'API
 * GitHub pour rafraîchir le numéro de version affiché.
 */

const REPO = 'samuelboulery/ovrsee'
const ACCENT = '#7d76f0'

/* ------------------------------------------------------------------ état -- */

// La langue vient du document, pas d'une valeur en dur : `/fr/` est une page déjà
// traduite (`scripts/build-site-fr.js`), et `traduire()` y appliquerait sinon la table
// inverse — la page française repasserait en anglais au premier rendu.
const état = { view: 'apercu', scale: 1, lang: document.documentElement.lang === 'fr' ? 'fr' : 'en' }

/* --------------------------------------------------------------- données -- */

// Registre des sept vues, dans l'ordre de `app/src/views.ts`, mêmes pictos. Les
// libellés sont en anglais, la langue source de la page ; `traduire()` les passe en
// français sur `/fr/`, via les mêmes clés que le reste du texte.
const VUES = [
  { id: 'apercu', label: 'Overview', icon: 'squares-four', key: '1' },
  { id: 'navigateur', label: 'Browser', icon: 'browser', key: '2' },
  { id: 'produit', label: 'Product', icon: 'tree-structure', key: '3' },
  { id: 'historique', label: 'History', icon: 'clock-counter-clockwise', key: '4' },
  { id: 'tableau', label: 'Board', icon: 'kanban', key: '5', count: 12 },
  { id: 'donnees', label: 'Data', icon: 'database', key: '6' },
  { id: 'stack', label: 'Stack', icon: 'stack', key: '7' },
]

// Le panneau Activité de l'onglet Historique, en comptes bruts par jour — commits,
// tickets, plans, du plus ancien au plus récent. Ce ne sont pas des pixels :
// `valeurs()` les normalise comme le fait `ActivityPanel` dans l'application, pour
// que la journée la plus chargée touche le haut de la boîte. Un jour à zéro rend un
// trait résiduel, jamais une colonne vide.
const HAUTEUR_ACTIVITE = 88

const ACTIVITE = [
  [5, 6, 8], [7, 9, 14], [10, 4, 6], [6, 12, 20], [9, 8, 11], [6, 3, 4], [0, 0, 0],
  [8, 10, 16], [7, 14, 24], [11, 7, 9], [5, 9, 13], [8, 5, 7], [6, 11, 18], [9, 13, 22],
]

const MÉTA = {
  fr: {
    apercu: { title: 'Aperçu', meta: '', left: 'main · 0ca659f · 3 fichiers modifiés', right: 'plan actif : Barre de vue et barre d’état sur les six onglets' },
    produit: { title: 'Graphe de navigation', meta: '7 pages · 42 liens · reconstruit au commit 0ca659f', left: 'graphe reconstruit il y a 3 h · 7 pages · 42 liens', right: 'glisser · ⌥ molette pour zoomer' },
    historique: { title: 'Chronologie du projet', meta: '43 plans · 128 commits', left: '43 plans · 9 ouverts · dernier commit il y a 3 h', right: '' },
    tableau: { title: 'Tableau', meta: '43 tickets · ovrsee/tickets/', left: '', right: '' },
    navigateur: { title: 'Navigateur', meta: '', left: 'localhost:5173 répond · chargé en 412 ms', right: 'sélecteur : ⇧⌘E' },
    donnees: { title: 'Tables', meta: '', left: '', right: '' },
    stack: { title: 'Stack', meta: '', left: '', right: '' },
  },
  en: {
    apercu: { title: 'Overview', meta: '', left: 'main · 0ca659f · 3 modified files', right: 'active plan: View bar and status bar on all six tabs' },
    produit: { title: 'Navigation graph', meta: '7 pages · 42 links · rebuilt at commit 0ca659f', left: 'graph rebuilt 3 h ago · 7 pages · 42 links', right: 'drag · ⌥ scroll to zoom' },
    historique: { title: 'Project timeline', meta: '43 plans · 128 commits', left: '43 plans · 9 open · last commit 3 h ago', right: '' },
    tableau: { title: 'Board', meta: '43 tickets · ovrsee/tickets/', left: '', right: '' },
    navigateur: { title: 'Browser', meta: '', left: 'localhost:5173 responds · loaded in 412 ms', right: 'selector: ⇧⌘E' },
    donnees: { title: 'Tables', meta: '', left: '', right: '' },
    stack: { title: 'Stack', meta: '', left: '', right: '' },
  },
}

/* -------------------------------------------------------------- liaisons -- */

const styleOnglet = actif =>
  'padding: 3px 7px; border-radius: 4px; font-family: \'IBM Plex Mono\', monospace; font-size: 10.5px; cursor: pointer; ' +
  (actif ? 'background: #2a2d38; color: #f2f3f5;' : 'color: #7f858f;')

function valeurs() {
  const v = état.view
  const m = MÉTA[état.lang][v] || MÉTA[état.lang].apercu

  const views = VUES.map(d => {
    const actif = d.id === v
    return {
      label: d.label,
      key: d.key,
      count: d.count ?? '',
      icon: (actif ? 'ph-fill ph-' : 'ph ph-') + d.icon,
      pick: () => rendre({ view: d.id }),
      rowClass: actif ? 'view-row view-row-active' : 'view-row',
      iconStyle: `font-size: 16px; flex: none; color: ${actif ? ACCENT : '#7f858f'};`,
      labelStyle: `flex: 1; font-size: 12.5px; color: ${actif ? '#f2f3f5' : '#b6bac1'}; font-weight: ${actif ? 500 : 400}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
      badgeStyle: d.count
        ? 'display: inline-flex; align-items: center; justify-content: center; height: 17px; min-width: 17px; padding: 0 5px; border-radius: 4px; background: #33363f; font-family: \'IBM Plex Mono\', monospace; font-size: 10px; color: #a2a8b2; flex: none;'
        : 'display: none;',
      rowStyle: `height: 31px; padding: 0 8px; gap: 10px; border-radius: 6px; display: flex; align-items: center; font-size: 12.5px; cursor: pointer; ${actif ? 'background: #2a2d38;' : ''}`,
    }
  })

  // Un segment absent n'est pas une barre de zéro pixel : il n'existe pas, sans quoi
  // le `gap` du conteneur en garderait la trace.
  const segment = (couleur, n, k) =>
    n > 0 ? `background: ${couleur}; height: ${Math.max(2, n * k).toFixed(1)}px; border-radius: 1px;` : 'display: none;'

  const chargeMax = Math.max(...ACTIVITE.map(j => j[0] + j[1] + j[2]))

  const bars = ACTIVITE.map(j => {
    const total = j[0] + j[1] + j[2]
    const k = total === 0 ? 0 : (HAUTEUR_ACTIVITE * (total / chargeMax)) / total
    return {
      commits: segment('#3a3c47', j[0], k),
      tickets: segment('#4c46b4', j[1], k),
      plans: segment(ACCENT, j[2], k),
      vide: total === 0 ? 'background: #2b2d35; height: 3px; border-radius: 1px;' : 'display: none;',
    }
  })

  return {
    views, bars,
    frStyle: styleOnglet(état.lang === 'fr'),
    enStyle: styleOnglet(état.lang === 'en'),
    stageWrapStyle: `width: 100%; overflow: hidden; height: ${Math.round(820 * état.scale)}px;`,
    stageStyle: `width: 1400px; height: 820px; flex: none; transform: scale(${état.scale}); transform-origin: top left; border-radius: 14px; border: 1px solid #2b2d35; background: #08090a; overflow: hidden; box-shadow: 0 40px 120px rgba(0,0,0,.7);`,
    viewTitle: m.title,
    viewMeta: m.meta,
    statusLeft: m.left,
    statusRight: m.right,
    isApercu: v === 'apercu',
    isProduit: v === 'produit',
    isHistorique: v === 'historique',
    isTableau: v === 'tableau',
    isNavigateur: v === 'navigateur',
    isDonnees: v === 'donnees',
    isStack: v === 'stack',
    // Le navigateur est le seul onglet sans barre de vue : sa barre d'outils en
    // tient lieu, comme dans l'application.
    showViewBar: v !== 'navigateur',
    // Le `|` ne sépare rien quand la vue ne met rien à droite : `⌘K` reste seul,
    // comme `StatusBar` le fait dans l'application.
    showStatusSep: !!m.right,
  }
}

/* ---------------------------------------------------------------- moteur -- */

/** `{{ a.b }}` → la valeur, dans le contexte donné. */
const résoudre = (expr, ctx) =>
  expr.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx)

const interpoler = (texte, ctx) =>
  texte.replace(/\{\{ ([^}]+) \}\}/g, (_, e) => {
    const val = résoudre(e, ctx)
    return val == null ? '' : String(val)
  })

/**
 * Applique les liaisons d'un sous-arbre. `patrons` retient le HTML d'origine
 * des nœuds répétés : sans lui, le second rendu interpolerait un texte déjà
 * interpolé, et les `{{ }}` auraient disparu.
 */
const patrons = new WeakMap()

function appliquer(racine, ctx) {
  // Répétitions d'abord : elles créent les nœuds que le reste va lier.
  for (const patron of racine.querySelectorAll('[data-for]')) {
    if (!patrons.has(patron)) patrons.set(patron, patron.outerHTML)
    const liste = résoudre(patron.dataset.for, ctx) || []
    const alias = patron.dataset.as
    const parent = patron.parentNode

    // Les clones précédents sont retirés ; le patron reste, masqué, pour que
    // les rendus suivants aient encore leur source.
    for (const vieux of parent.querySelectorAll('[data-clone]')) vieux.remove()

    patron.style.display = 'none'
    const modèle = document.createElement('div')
    for (const item of liste) {
      modèle.innerHTML = patrons.get(patron)
      const clone = modèle.firstElementChild
      clone.removeAttribute('data-for')
      clone.removeAttribute('data-as')
      clone.setAttribute('data-clone', '')
      // Le `display` du clone ne se réassigne pas ici : le patron est capturé avant
      // d'être masqué, donc le clone porte déjà celui d'origine. L'effacer faisait
      // retomber en `block` un `display: flex` inline — les colonnes du graphique
      // d'activité s'empilaient alors depuis le haut, `justify-content` devenu
      // inerte, sans que rien n'échoue.
      lier(clone, { ...ctx, [alias]: item })
      parent.insertBefore(clone, patron)
    }
  }

  lier(racine, ctx, true)
}

/**
 * Interpole attributs et textes, et applique `data-if`.
 *
 * `horsClones` protège d'un bug qui ne lève rien : la passe globale repasse sur
 * les clones déjà liés, où `{{ v.label }}` se résout dans un contexte sans `v`
 * — et vide chaque libellé au lieu d'échouer bruyamment.
 */
function lier(racine, ctx, horsClones = false) {
  const dansUnClone = el =>
    horsClones && el !== racine && el.closest?.('[data-clone],[data-for]')

  const noeuds = [racine, ...racine.querySelectorAll('*')]
  for (const el of noeuds) {
    if (el.hasAttribute?.('data-for') && el !== racine) continue
    if (dansUnClone(el)) continue

    if (el.dataset?.if) {
      // Mémoriser le `display` d'origine, et non le remettre à vide : ces
      // éléments portent `display: flex` en attribut `style`, et l'effacer
      // suffisait à faire retomber la barre d'outils en pile.
      if (el.__display === undefined) el.__display = el.style.display || ''
      el.style.display = résoudre(el.dataset.if, ctx) ? el.__display : 'none'
    }

    for (const attr of ['style', 'class']) {
      const brut = el.getAttribute?.('data-' + attr + '-src') ?? el.getAttribute?.(attr)
      if (brut == null || !brut.includes('{{')) continue
      el.setAttribute('data-' + attr + '-src', brut)
      el.setAttribute(attr, interpoler(brut, ctx))
    }

    // `<svg data-icon="{{ v.icon }}">` : la classe Phosphor devient un symbole.
    if (el.dataset?.icon) {
      const cls = interpoler(el.dataset.icon, ctx)
      const nom = (cls.match(/ph-([a-z-]+)$/) || [])[1]
      const plein = cls.startsWith('ph-fill')
      if (nom) el.querySelector('use')?.setAttribute('href', '#i-' + nom + (plein ? '-fill' : ''))
    }

    const clic = el.getAttribute?.('onClick') ?? el.getAttribute?.('data-click-src')
    if (clic?.includes('{{')) {
      el.removeAttribute('onClick')
      el.setAttribute('data-click-src', clic)
      const fn = résoudre(clic.replace(/[{}]/g, ''), ctx)
      el.onclick = typeof fn === 'function' ? fn : null
    }
  }

  // Textes : parcourus à part, sinon `innerHTML` réécrirait les enfants.
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT)
  const textes = []
  while (marcheur.nextNode()) textes.push(marcheur.currentNode)
  for (const n of textes) {
    if (dansUnClone(n.parentElement)) continue
    const src = n.__src ?? n.nodeValue
    if (!src.includes('{{')) continue
    n.__src = src
    n.nodeValue = interpoler(src, ctx)
  }
}

/* ------------------------------------------------------------ traduction -- */

// Posée sur le DOM et non dans le gabarit : l'anglais est le texte source, il
// s'affiche dès le premier octet et reste éditable ; le français s'applique nœud
// de texte par nœud de texte après le rendu.
//
// Sur `/fr/` la page est déjà française et seuls les libellés injectés par le
// gabarit restent anglais : la table s'y applique dans le même sens, et les nœuds
// déjà traduits n'y trouvent simplement pas de clé.
let DICT = {}

function traduire() {
  const table = {}
  if (état.lang === 'fr') for (const k in DICT) table[k] = DICT[k]
  else for (const k in DICT) table[DICT[k]] = k

  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const noeuds = []
  while (marcheur.nextNode()) noeuds.push(marcheur.currentNode)
  for (const n of noeuds) {
    const brut = n.nodeValue
    const texte = brut.trim()
    if (!texte) continue
    const cible = table[texte]
    if (cible && cible !== texte) n.nodeValue = brut.replace(texte, cible)
  }
  document.documentElement.lang = état.lang
}

/* ---------------------------------------------------------------- rendus -- */

function rendre(patch) {
  Object.assign(état, patch)
  appliquer(document.body, valeurs())
  traduire()
}

// La fenêtre de démo est dessinée à sa taille réelle (1400×820, comme l'app)
// puis réduite pour tenir dans la colonne — sinon un écran de 13" en coupe le
// quart droit.
// Plancher : en dessous de 0.42 le texte de l'interface devient illisible et
// la démo ne démontre plus rien. Le cadre défile alors latéralement — la
// feuille de style pose `overflow-x: auto` sous 900 px pour ça.
const ÉCHELLE_MINI = 0.42

function mesurer() {
  const el = document.querySelector('[data-stage-wrap]')
  if (!el) return
  const scale = Math.max(ÉCHELLE_MINI, Math.min(1, el.clientWidth / 1400))
  if (Math.abs(scale - état.scale) > 0.001) rendre({ scale })
}

// Révélation au défilement, posée en JS : sans script la page reste entièrement
// visible — rien n'est masqué en dur dans le gabarit.
function révéler() {
  if (typeof IntersectionObserver === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const cibles = [...document.querySelectorAll('[data-reveal]')]
  for (const el of cibles) {
    el.style.opacity = '0'
    el.style.transform = 'translateY(16px)'
    el.style.transition = 'opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1)'
  }
  const io = new IntersectionObserver(entrées => {
    for (const e of entrées) {
      if (!e.isIntersecting) continue
      e.target.style.opacity = '1'
      e.target.style.transform = 'none'
      io.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 })
  cibles.forEach(el => io.observe(el))
}

/**
 * Le numéro de version affiché suit la dernière release publiée.
 *
 * Il est écrit en dur dans la page pour s'afficher sans attendre le réseau —
 * cet appel ne fait que le rafraîchir. L'API anonyme est limitée à 60 requêtes
 * par heure et par IP, et le quota est atteignable : l'échec est donc le cas
 * normal, pas l'exception, et la page doit rester juste sans lui.
 *
 * Les téléchargements eux-mêmes passent par le lien Releases : il ne périme
 * jamais et ne demande aucune requête.
 */
async function versionAffichée() {
  const cibles = document.querySelectorAll('[data-version]')
  if (!cibles.length) return
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!r.ok) return
    const { tag_name } = await r.json()
    if (tag_name) for (const el of cibles) el.textContent = tag_name
  } catch {
    // Hors ligne ou quota atteint : la valeur écrite dans la page fait foi.
  }
}

/* --------------------------------------------------------------- amorçage -- */

fetch('/dict.json')
  .then(r => (r.ok ? r.json() : {}))
  .catch(() => ({}))
  .then(d => { DICT = d; rendre({}) })

document.addEventListener('DOMContentLoaded', () => {
  rendre({})
  mesurer()
  révéler()
  versionAffichée()
  window.addEventListener('resize', mesurer)
  if (typeof ResizeObserver !== 'undefined') {
    const el = document.querySelector('[data-stage-wrap]')
    if (el) new ResizeObserver(mesurer).observe(el)
  }
})
