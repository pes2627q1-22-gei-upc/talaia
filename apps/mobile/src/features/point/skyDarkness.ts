/** Llindars de qualitat del cel nocturn de la Generalitat (campanya 2024, p. 4–5).
 * https://mediambient.gencat.cat/web/.content/home/ambits_dactuacio/atmosfera/contaminacio_luminica/Avaluacio_de_la_qualitat_del_cel_de_nit/campanya-2024.pdf
 * El valor de l'API té dues xifres decimals; com més alt, més fosc és el cel.
 */
export function skyDarknessBand(sqm: number) {
  if (sqm >= 21.4) return 'excellent';
  if (sqm >= 21) return 'veryGood';
  if (sqm >= 20) return 'good';
  if (sqm >= 19) return 'moderate';
  if (sqm >= 18) return 'low';
  if (sqm >= 17.5) return 'poor';
  return 'veryPoor';
}
