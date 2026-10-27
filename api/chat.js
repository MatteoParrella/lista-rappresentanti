// Chat AI su regolamento e circolari. La domanda va solo a Claude per la risposta:
// non viene salvata, e nemmeno l'IP (al backend arriva solo l'impronta per i limiti anti-spam).
const fs = require("fs");
const path = require("path");
const { SEGRETO, rispondi, leggiJson, backend } = require("./_comune");
const { chiediAClaude, attivo } = require("./_claude");

const MAX_DOMANDA = 500;
const MAX_STORIA = 6; // ultimi messaggi della conversazione che l'AI ricorda

function leggiRegolamento() {
  try {
    const testo = fs.readFileSync(path.join(process.cwd(), "dati", "regolamento.md"), "utf8");
    // Finché c'è il testo di esempio, l'AI non lo usa per non dare risposte inventate.
    return testo.includes("<!-- ESEMPIO -->") ? "" : testo;
  } catch (e) {
    return "";
  }
}
const REGOLAMENTO = leggiRegolamento();

const ISTRUZIONI = `Sei l'assistente della lista Capolista (rappresentanti d'istituto di Villa Greppi) sul sito per gli studenti.
Rispondi alle domande sul regolamento d'istituto e sulle circolari usando SOLO i documenti qui sotto.
- Rispondi in italiano, in modo breve e chiaro, come a un compagno di scuola. Al massimo 6 righe.
- Scrivi testo semplice: niente markdown, niente asterischi, niente titoli. Puoi usare elenchi con "- ".
- Quando puoi, indica da dove viene l'informazione (es. "Regolamento, art. 12" o "Circolare n. 45 del 10/10/2026").
- Se la risposta non è nei documenti, dillo chiaramente e consiglia di chiedere ai rappresentanti (scheda Richieste) o alla segreteria. Non inventare regole, date o numeri.
- Non chiedere mai nome, classe o altri dati personali.
- Se la domanda non c'entra con la scuola, rispondi gentilmente che puoi aiutare solo su regolamento e circolari.`;

function blocchiSistema(circolari) {
  const regolamento = REGOLAMENTO
    ? "<regolamento>\n" + REGOLAMENTO + "\n</regolamento>"
    : "<regolamento>Il regolamento d'istituto non è ancora stato caricato sul sito.</regolamento>";
  const elenco = circolari.length
    ? circolari.map((c) =>
        `<circolare numero="${c.numero}" data="${c.data}">\nTitolo: ${c.titolo}\nRiassunto: ${c.riassunto}\n${c.testo ? "Testo: " + c.testo : ""}\n</circolare>`
      ).join("\n")
    : "Nessuna circolare pubblicata.";
  // Prima la parte che cambia di rado (istruzioni + regolamento), poi le circolari:
  // così Anthropic può riusare la parte iniziale dalla cache e le domande costano meno.
  return [
    { type: "text", text: ISTRUZIONI + "\n\n" + regolamento },
    { type: "text", text: "<circolari>\n" + elenco + "\n</circolari>", cache_control: { type: "ephemeral" } }
  ];
}

function testo(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (!SEGRETO) return rispondi(res, 500, { ok: false, errore: "Server non configurato (PROXY_SECRET)." });
  const dati = await leggiJson(req, res, 20000);
  if (!dati) return;
  if (!attivo) return rispondi(res, 200, { ok: false, errore: "La chat AI non è ancora attiva. Torna presto!" });
  const domanda = testo(dati.domanda, MAX_DOMANDA);
  if (!domanda) return rispondi(res, 400, { ok: false, errore: "Scrivi una domanda." });

  // La conversazione deve alternare studente e AI e iniziare con lo studente.
  const storia = (Array.isArray(dati.storia) ? dati.storia : []).slice(-MAX_STORIA)
    .map((m) => ({ role: m && m.ruolo === "ai" ? "assistant" : "user", content: testo(m && m.testo, 1500) }))
    .filter((m) => m.content);
  const messages = [];
  storia.forEach((m) => {
    if (!messages.length && m.role !== "user") return;
    if (messages.length && messages[messages.length - 1].role === m.role) return;
    messages.push(m);
  });
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  messages.push({ role: "user", content: domanda });

  let contesto;
  try {
    contesto = await backend({ azione: "contestoChat" }, req);
  } catch (e) {
    return rispondi(res, 502, { ok: false, errore: "Errore del server. Riprova tra poco." });
  }
  if (!contesto.ok) return rispondi(res, 200, contesto);

  try {
    const risposta = await chiediAClaude({ system: blocchiSistema(contesto.circolari || []), messages });
    return rispondi(res, 200, {
      ok: true,
      risposta: risposta || "Su questa domanda non posso aiutarti. Prova a chiedere ai rappresentanti nella scheda Richieste."
    });
  } catch (e) {
    console.error("Errore Claude:", e && e.status, e && e.message);
    return rispondi(res, 502, { ok: false, errore: "L'AI non risponde in questo momento. Riprova tra poco." });
  }
};
