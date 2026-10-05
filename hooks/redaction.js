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
    // Le nom commence en début de mot et tient en 64 caractères de part et
    // d'autre du mot-clé : `[\w.-]*` non ancré rebalayait tout un mot depuis
    // chacune de ses positions, et le texte d'une page crawlée passe ici — 8 s
    // pour 50 000 « a » (ReDoS, T-0274).
    //
    // Un nom d'en-tête d'authentification emporte toute la fin de ligne :
    // `\S+` ne prenait qu'un mot, donc `Authorization: Digest username="x",
    // response=<hash>` ne masquait que le premier champ, et tout schéma hors
    // liste (AWS4-HMAC-SHA256, Negotiate) laissait sa signature en clair à
    // côté d'un `***` qui donnait le change (#36).
    .replace(
      /(["']?)(?<![\w.-])([\w.-]{0,64}?(?:AUTH|CREDENTIALS?)[\w.-]{0,64})\1(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\r\n]+)/gi,
      '$1$2$1$3***',
    )
    // Une affectation ordinaire, elle, ne porte qu'un jeton : le masquage
    // s'arrête à l'espace ou au séparateur suivant. Aller jusqu'à la fin de
    // ligne effaçait l'hôte ou le code retour qui la partagent — y compris sur
    // un faux positif comme `TOKEN_REFRESH_INTERVAL=300` (#39).
    .replace(
      /(["']?)(?<![\w.-])([\w.-]{0,64}?(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[\w.-]{0,64})\1(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2$1$3***',
    )
    // Un bloc PEM part en entier, pas ligne à ligne : le corps est du base64
    // sans séparateur, donc aucune des règles ci-dessus ne l'accroche, et une
    // commande `dev` qui meurt en imprimant une clé privée l'écrirait tel quel
    // dans `scans.jsonl`, versionné.
    .replace(
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
      '***',
    )
    .replace(/\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{8,}/g, '***')
    .replace(/\bnpm_[A-Za-z0-9]{16,}/g, '***')
    .replace(/\bglpat-[A-Za-z0-9_-]{16,}/g, '***')
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '***')
    // Identifiants de clé AWS : le message d'erreur du SDK les cite en clair.
    .replace(/\b(?:AKIA|ASIA|AIDA|AROA|AGPA|ANPA|APKA|ABIA|ACCA)[A-Z0-9]{16}\b/g, '***')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}/g, '***')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{16,}/g, '***')
    .replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, '***')
    // Schéma ancré et borné, comme les noms ci-dessus : `\b` se trouve entre
    // chaque lettre et chaque point de `a.a.a.…`, et `[a-z0-9+.-]*` repartait
    // jusqu'au bout depuis chacun.
    .replace(/((?<![a-z0-9+.-])[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]{1,256}:)[^\s@]{1,256}@/gi, '$1***@')
}
