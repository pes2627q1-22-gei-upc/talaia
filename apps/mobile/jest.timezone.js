/**
 * Tots els tests corren amb l'hora de Catalunya, sigui quina sigui la zona de la màquina (la CI és
 * UTC): l'app passa les hores que tria l'usuari a UTC amb la zona del mòbil (`localToIso`), i
 * l'estiu i l'hivern només es poden provar amb una zona fixa. S'ha de fixar abans que arrenquin
 * els workers: dins d'un test, `process.env.TZ` ja no canvia res.
 */
module.exports = () => {
  process.env.TZ = 'Europe/Madrid';
};
