// Passaggio intermedio per gli invii degli studenti: Apps Script non vede l'IP di chi scrive,
// Vercel sì. Qui l'IP viene trasformato in un'impronta (hash con segreto) e solo quella va al
// backend, che la tiene in cache per 10 minuti per contare gli invii. L'IP non viene mai salvato.
const crypto = require("crypto");

const API_URL = process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbxCW5yX7HlWZYd3QdTyYFYJku5YnoOoIPetWp85gRt70eq7OjqvwLEyGlpGLIc0eQXvmQ/exec";
const SEGRETO = process.env.PROXY_SECRET || "";
const MAX_CORPO = 20000;

function ipDi(req) {
  // Su Vercel questi header li imposta la piattaforma: chi invia non può falsificarli.
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return String(req.headers["x-real-ip"] || xff || "sconosciuto");
}

function rispondi(res, stato, dati) {
  res.statusCode = stato;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(dati));
}

async function leggiCorpo(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return JSON.stringify(req.body);
  let s = "";
  for await (const pezzo of req) {
    s += pezzo;
    if (s.length > MAX_CORPO) break;
  }
  return s;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return rispondi(res, 405, { ok: false, errore: "Metodo non consentito." });
  if (!SEGRETO) return rispondi(res, 500, { ok: false, errore: "Server non configurato (PROXY_SECRET)." });
  let dati;
  try {
    const corpo = await leggiCorpo(req);
    if (corpo.length > MAX_CORPO) throw new Error();
    dati = JSON.parse(corpo);
    if (!dati || typeof dati !== "object") throw new Error();
  } catch (e) {
    return rispondi(res, 400, { ok: false, errore: "Richiesta non valida." });
  }

  const impronta = crypto.createHmac("sha256", SEGRETO).update(ipDi(req)).digest("hex").slice(0, 32);
  const inoltro = {
    azione: "invia",
    categoria: dati.categoria,
    titolo: dati.titolo,
    messaggio: dati.messaggio,
    sito: dati.sito,
    impronta: impronta,
    segreto: SEGRETO
  };
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(inoltro)
    });
    if (!r.ok) throw new Error();
    return rispondi(res, 200, await r.json());
  } catch (e) {
    return rispondi(res, 502, { ok: false, errore: "Errore del server. Riprova tra poco." });
  }
};
