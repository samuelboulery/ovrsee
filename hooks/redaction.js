/**
 * Masque ce qui ressemble à un secret.
 *
 * Partagé par deux écritures qui sortent du processus : la trace d'un scan en
 * échec (`crawl/index.js`, versionnée dans `scans.jsonl`) et la configuration
 * rendue par `/api/config-claude` (`hooks/config-claude.js`).
 *
 * `scans.jsonl` est tracké par git, et l'échec d'un scan y emporte ce qu'a dit
 * la commande `dev` du projet observé. Une commande qui meurt sur une variable
 * d'environnement manquante l'imprime parfois avec sa valeur : sans ce filtre,
 * le secret part dans l'historique git sans qu'aucun humain n'ait relu la ligne.
 *
 * Défense en profondeur, pas garantie : ce filtre attrape les formes connues.
 * Un `scans.jsonl` en échec se relit avant d'être poussé.
 *
 * Ce qui reste lisible est délibéré — l'hôte d'une URL, le nom de la variable,
 * `pnpm: command not found`. C'est ce qui sert au diagnostic, et c'est la raison
 * d'être de cette trace.
 *
 * @param {string} texte
 * @returns {string}
 */
export function redige(texte) {
  return String(texte ?? '')
    // Le guillemet optionnel autour du nom couvre le JSON stringifié
    // (`"apiKey":"..."`), où il s'intercale entre le nom et le séparateur ;
    // la valeur consomme une chaîne entière, espaces compris.
    //
    // Un nom d'en-tête d'authentification emporte toute la fin de ligne :
    // `\S+` ne prenait qu'un mot, donc `Authorization: Digest username="x",
    // response=<hash>` ne masquait que le premier champ, et tout schéma hors
    // liste (AWS4-HMAC-SHA256, Negotiate) laissait sa signature en clair à
    // côté d'un `***` qui donnait le change (#36).
    .replace(
      /(["']?)([\w.-]*(?:AUTH|CREDENTIALS?)[\w.-]*)\1(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\r\n]+)/gi,
      '$1$2$1$3***',
    )
    // Une affectation ordinaire, elle, ne porte qu'un jeton : le masquage
    // s'arrête à l'espace ou au séparateur suivant. Aller jusqu'à la fin de
    // ligne effaçait l'hôte ou le code retour qui la partagent — y compris sur
    // un faux positif comme `TOKEN_REFRESH_INTERVAL=300` (#39).
    .replace(
      /(["']?)([\w.-]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[\w.-]*)\1(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2$1$3***',
    )
    .replace(/\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{8,}/g, '***')
    // Identifiants de clé AWS : le message d'erreur du SDK les cite en clair.
    .replace(/\b(?:AKIA|ASIA|AIDA|AROA|AGPA|ANPA|APKA|ABIA|ACCA)[A-Z0-9]{16}\b/g, '***')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}/g, '***')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{16,}/g, '***')
    .replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, '***')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@]+@/gi, '$1***@')
}
