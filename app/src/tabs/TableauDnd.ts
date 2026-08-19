/**
 * Le transport du glisser-déposer du tableau.
 *
 * Deux gestes partagent la même surface — les cartes et les colonnes — et se
 * distinguent au type MIME, pas à la devinette. Pendant un `dragover` le
 * navigateur interdit de lire les données transportées (seuls les *types* sont
 * visibles) : c'est aussi la seule façon de savoir quoi surligner avant le
 * dépôt.
 *
 * Dans un module à part parce que la carte et le tableau s'en servent tous les
 * deux, et que les faire s'importer l'un l'autre créerait un cycle.
 */
export const TYPE_CARTE = 'text/plain'
export const TYPE_COLONNE = 'application/x-ovrsee-colonne'

export const estColonne = (transfert: DataTransfer) => transfert.types.includes(TYPE_COLONNE)
