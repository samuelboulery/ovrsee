import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Markdown, headings, slug } from './markdown'

const rendu = (text: string, root?: string) =>
  renderToStaticMarkup(<Markdown text={text} root={root} />)

const ROOT = '/tmp/projet'

test('markdown : une image du dépôt passe par /api/media', () => {
  const html = rendu('![démo](docs/demo.png)', ROOT)
  assert.match(html, /<img/)
  assert.match(html, /\/api\/media\?path=%2Ftmp%2Fprojet&amp;file=docs%2Fdemo\.png/)
  assert.match(html, /alt="démo"/)
})

test('markdown : une vidéo du dépôt devient une balise video', () => {
  const html = rendu('![tour](docs/tour.mp4)', ROOT)
  assert.match(html, /<video/)
  assert.match(html, /controls/)
})

test('markdown : une image distante ne part pas chercher sur le réseau', () => {
  const html = rendu('![badge](https://img.shields.io/badge/ci-ok.svg)', ROOT)
  assert.ok(!/<img/.test(html))
  assert.ok(!/<video/.test(html))
  // L'URL reste lisible : on doit voir ce que le README voulait montrer.
  assert.match(html, /img\.shields\.io/)
})

test('markdown : sans racine, une image locale reste du texte', () => {
  const html = rendu('![démo](docs/demo.png)')
  assert.ok(!/<img/.test(html))
  assert.match(html, /docs\/demo\.png/)
})

test('markdown : une extension hors liste ne devient pas une vidéo', () => {
  // La liste blanche vit côté serveur ; ici on vérifie seulement que `.mkv`
  // n'est pas pris pour une vidéo lisible.
  const html = rendu('![x](docs/a.mkv)', ROOT)
  assert.ok(!/<video/.test(html))
})

test('markdown : les cases à cocher sont rendues, et en lecture seule', () => {
  const html = rendu('- [x] fait\n- [ ] à faire', ROOT)
  assert.match(html, /type="checkbox"/)
  assert.match(html, /checked/)
  assert.match(html, /disabled/)
  assert.match(html, /fait/)
  assert.ok(!/\[x\]/.test(html))
})

test('markdown : un bloc details se plie, avec son résumé', () => {
  const html = rendu('<details><summary>Plus</summary>\n\ndu texte\n\n</details>', ROOT)
  assert.match(html, /<details/)
  assert.match(html, /<summary[^>]*>Plus<\/summary>/)
  assert.match(html, /du texte/)
})

test('markdown : une balise img HTML isolée est servie comme une image locale', () => {
  const html = rendu('<img src="docs/logo.png" width="80">', ROOT)
  assert.match(html, /<img/)
  assert.match(html, /file=docs%2Flogo\.png/)
})

test('markdown : les titres portent une ancre, et le sommaire les retrouve', () => {
  const text = '# Préférences\n\ntexte\n\n## Deux mots\n'
  assert.match(rendu(text), new RegExp(`id="${slug('Préférences')}"`))

  const plan = headings(text)
  assert.deepEqual(
    plan.map(h => [h.level, h.texte]),
    [
      [1, 'Préférences'],
      [2, 'Deux mots'],
    ],
  )
  // Préfixé : une ancre ne doit jamais pouvoir se nommer comme un global du
  // navigateur — un `# Ovrsee` posait `window.ovrsee` sur son propre titre.
  assert.equal(plan[0].id, 'md-preferences')
})

test('markdown : un # dans un bloc de code n’est pas un titre', () => {
  const plan = headings('```bash\n# installation\npnpm i\n```\n\n## Vrai titre\n')
  assert.deepEqual(
    plan.map(h => h.texte),
    ['Vrai titre'],
  )
})

test('markdown : un bloc de code est coloré et porte un bouton copier', () => {
  const html = rendu('```ts\nconst x = 1\n```', ROOT)
  assert.match(html, /const/)
  assert.match(html, /<button/)
  // L'étiquette de langage est hors du <pre> : ce qu'on copie est le code seul.
  assert.ok(!/<pre[^>]*>[^<]*ts/.test(html))
})

test('markdown : une ancre ne peut pas se nommer comme un global', () => {
  // `# Ovrsee` posait `id="ovrsee"`, et `window.ovrsee` désignait alors ce
  // titre au lieu du pont Electron : le navigateur affichait des boutons morts.
  const html = rendu('# Ovrsee\n')
  assert.match(html, /id="md-ovrsee"/)
  assert.ok(!/id="ovrsee"/.test(html))
})

test('markdown : le texte non reconnu n’est jamais avalé', () => {
  const html = rendu('<section>bizarre</section>', ROOT)
  assert.match(html, /bizarre/)
})
