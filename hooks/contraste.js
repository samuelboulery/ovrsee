/**
 * Le contraste WCAG, partagé par les tests de couleur.
 *
 * Il vivait dans `accents.test.js` ; `theme-clair.test.js` en a besoin des
 * mêmes formules, et deux copies auraient divergé au premier ajustement.
 * Module pur, sans I/O : il ne lit ni fichier ni environnement.
 */

/** Luminance relative WCAG d'un `#rrggbb`. */
export const luminance = hex => {
  const canaux = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2]
}

/** Le rapport de contraste entre deux `#rrggbb`, de 1 à 21. */
export const contraste = (a, b) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (clair + 0.05) / (sombre + 0.05)
}
