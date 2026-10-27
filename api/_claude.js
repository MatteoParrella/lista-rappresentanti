// Collegamento a Claude (Anthropic) per la chat e i riassunti delle circolari.
// La chiave va in Vercel → Settings → Environment Variables → ANTHROPIC_API_KEY.
// Il modello si può cambiare con la variabile CLAUDE_MODEL (es. claude-haiku-5-5 costa molto meno).
const Anthropic = require("@anthropic-ai/sdk");

const MODELLO = process.env.CLAUDE_MODEL || "claude-opus-5-5";
// Se il modello rifiuta per sicurezza, Anthropic riprova da sola con un altro modello adatto.
// Il parametro esiste solo su alcuni modelli: sugli altri non lo mandiamo.
const CON_RISERVA = /^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(MODELLO);

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

async function chiediAClaude({ system, messages, maxTokens }) {
  if (!client) throw new Error("NO_KEY");
  const richiesta = {
    model: MODELLO,
    max_tokens: maxTokens || 2000,
    output_config: { effort: "low" },
    system: system,
    messages: messages
  };
  if (CON_RISERVA) {
    richiesta.betas = ["server-side-fallback-2026-07-01"];
    richiesta.fallbacks = "default";
  }
  const risposta = await client.beta.messages.create(richiesta);
  if (risposta.stop_reason === "refusal") return "";
  return risposta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

module.exports = { chiediAClaude, attivo: !!client };
