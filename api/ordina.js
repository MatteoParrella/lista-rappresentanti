// Passaggio intermedio per gli ordini del panino: aggiunge l'impronta dell'IP per i limiti
// anti-spam (vedi _comune.js). L'IP non viene mai salvato.
const { SEGRETO, rispondi, leggiJson, backend } = require("./_comune");

module.exports = async (req, res) => {
  if (!SEGRETO) return rispondi(res, 500, { ok: false, errore: "Server non configurato (PROXY_SECRET)." });
  const dati = await leggiJson(req, res, 5000);
  if (!dati) return;
  try {
    return rispondi(res, 200, await backend({
      azione: "ordina",
      classe: dati.classe,
      nome: dati.nome,
      prodotti: dati.prodotti,
      sito: dati.sito
    }, req));
  } catch (e) {
    return rispondi(res, 502, { ok: false, errore: "Errore del server. Riprova tra poco." });
  }
};
