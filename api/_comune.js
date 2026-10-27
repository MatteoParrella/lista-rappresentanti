// Pezzi in comune tra le funzioni di Vercel (i file che iniziano con _ non diventano indirizzi del sito).
// Apps Script non vede l'IP di chi scrive, Vercel sì. Qui l'IP viene trasformato in un'impronta
// (hash con segreto) e solo quella va al backend, che la tiene in cache per 10 minuti per contare
// gli invii. L'IP non viene mai salvato.
const crypto = require("crypto");

const API_URL = process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbxCW5yX7HlWZYd3QdTyYFYJku5YnoOoIPetWp85gRt70eq7OjqvwLEyGlpGLIc0eQXvmQ/exec";
const SEGRETO = process.env.PROXY_SECRET || "";

function ipDi(req) {
  // Su Vercel questi header li imposta la piattaforma: chi invia non può falsificarli.
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return String(req.headers["x-real-ip"] || xff || "sconosciuto");
}

function improntaDi(req) {
  return crypto.createHmac("sha256", SEGRETO).update(ipDi(req)).digest("hex").slice(0, 32);
}

function rispondi(res, stato, dati) {
  res.statusCode = stato;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(dati));
}

async function leggiCorpo(req, max) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return JSON.stringify(req.body);
  let s = "";
  for await (const pezzo of req) {
    s += pezzo;
    if (s.length > max) break;
  }
  return s;
}

// Legge il JSON inviato dal browser; risponde da solo 405/400 e restituisce null se non va bene.
async function leggiJson(req, res, max) {
  if (req.method !== "POST") {
    rispondi(res, 405, { ok: false, errore: "Metodo non consentito." });
    return null;
  }
  try {
    const corpo = await leggiCorpo(req, max);
    if (corpo.length > max) throw new Error();
    const dati = JSON.parse(corpo);
    if (!dati || typeof dati !== "object") throw new Error();
    return dati;
  } catch (e) {
    rispondi(res, 400, { ok: false, errore: "Richiesta non valida." });
    return null;
  }
}

// Chiama Apps Script. Se riceve req aggiunge segreto e impronta dell'IP (azioni degli studenti).
async function backend(dati, req) {
  if (req) dati = Object.assign({}, dati, { impronta: improntaDi(req), segreto: SEGRETO });
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dati)
  });
  if (!r.ok) throw new Error("Apps Script " + r.status);
  return r.json();
}

module.exports = { SEGRETO, rispondi, leggiJson, backend };
