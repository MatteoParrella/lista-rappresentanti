// Riassunto in 3 righe di una circolare, usato dall'area membri prima di pubblicarla.
// Funziona solo con una sessione membri valida, così nessun altro può usare l'AI a nostre spese.
const { rispondi, leggiJson, backend } = require("./_comune");
const { chiediAClaude, attivo } = require("./_claude");

const ISTRUZIONI = `Riassumi la circolare scolastica che ti viene data in esattamente 3 righe brevi, per studenti delle superiori.
- Ogni riga è una frase semplice e completa, al massimo 20 parole, senza elenchi puntati o numeri iniziali.
- Metti prima quello che interessa agli studenti: cosa succede, quando, cosa devono fare.
- Riporta date, orari e luoghi esattamente come nel testo. Non aggiungere nulla che non ci sia.
- Testo semplice, niente markdown. Rispondi solo con le 3 righe.`;

module.exports = async (req, res) => {
  const dati = await leggiJson(req, res, 60000);
  if (!dati) return;
  if (!attivo) return rispondi(res, 200, { ok: false, errore: "Manca la chiave ANTHROPIC_API_KEY su Vercel: scrivi il riassunto a mano." });
  const testo = String(dati.testo || "").trim().slice(0, 40000);
  if (testo.length < 40) return rispondi(res, 400, { ok: false, errore: "Incolla prima il testo della circolare." });
  try {
    const sessione = await backend({ azione: "sessione", token: dati.token });
    if (!sessione.ok) return rispondi(res, 200, sessione);
    const riassunto = await chiediAClaude({
      system: ISTRUZIONI,
      messages: [{ role: "user", content: "<circolare>\n" + testo + "\n</circolare>" }],
      maxTokens: 1500
    });
    if (!riassunto) return rispondi(res, 200, { ok: false, errore: "L'AI non ha riassunto questa circolare: scrivi il riassunto a mano." });
    return rispondi(res, 200, { ok: true, riassunto: riassunto.split("\n").filter((r) => r.trim()).slice(0, 3).join("\n") });
  } catch (e) {
    console.error("Errore riassunto:", e && e.status, e && e.message);
    return rispondi(res, 502, { ok: false, errore: "L'AI non risponde in questo momento. Riprova tra poco." });
  }
};
