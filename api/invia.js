// Passaggio intermedio per le richieste anonime degli studenti: aggiunge l'impronta dell'IP
// per i limiti anti-spam (vedi _comune.js). L'IP non viene mai salvato.
const { SEGRETO, rispondi, leggiJson, backend } = require("./_comune");

module.exports = async (req, res) => {
  if (!SEGRETO) return rispondi(res, 500, { ok: false, errore: "Server non configurato (PROXY_SECRET)." });
  const dati = await leggiJson(req, res, 20000);
  if (!dati) return;
  try {
    return rispondi(res, 200, await backend({
      azione: "invia",
      categoria: dati.categoria,
      titolo: dati.titolo,
      messaggio: dati.messaggio,
      sito: dati.sito
    }, req));
  } catch (e) {
    return rispondi(res, 502, { ok: false, errore: "Errore del server. Riprova tra poco." });
  }
};
