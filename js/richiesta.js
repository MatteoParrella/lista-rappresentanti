// Codice della pagina studenti (file separato per la Content-Security-Policy).
const { chiama, escape } = window.Capolista;

const form = document.getElementById("form-richiesta");
const esito = document.getElementById("esito");
// Pausa minima tra due invii dallo stesso browser (il vero limite è nel backend).
const ATTESA_MS = 30 * 1000;
const CHIAVE_ULTIMO = "capolista_ultimo_invio";
function ultimoInvio() { try { return Number(localStorage.getItem(CHIAVE_ULTIMO)) || 0; } catch (e) { return 0; } }
function segnaInvio() { try { localStorage.setItem(CHIAVE_ULTIMO, String(Date.now())); } catch (e) { /* ignora */ } }
function mostra(el, tipo, html) {
  el.className = "messaggio " + tipo;
  el.innerHTML = html;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dati = {
    categoria: form.categoria.value,
    titolo: form.titolo.value.trim(),
    messaggio: form.messaggio.value.trim(),
    sito: form.sito.value
  };
  if (!dati.categoria || !dati.titolo || !dati.messaggio) {
    mostra(esito, "errore", "Compila categoria, oggetto e messaggio.");
    return;
  }
  const mancano = Math.ceil((ultimoInvio() + ATTESA_MS - Date.now()) / 1000);
  if (mancano > 0) {
    mostra(esito, "errore", "Hai appena inviato una richiesta: aspetta " + mancano + " secondi prima di mandarne un'altra.");
    return;
  }
  const bottone = document.getElementById("invia");
  bottone.disabled = true;
  bottone.textContent = "Invio…";
  try {
    const r = await chiama("invia", dati);
    if (!r.ok) throw new Error(r.errore || "Errore sconosciuto");
    segnaInvio();
    form.reset();
    mostra(esito, "ok",
      "<b>Richiesta inviata, grazie!</b><br>L'abbiamo ricevuta in forma anonima. Se vuoi, puoi inviarne un'altra tra 30 secondi.");
  } catch (err) {
    mostra(esito, "errore", "Invio non riuscito: " + escape(err.message) + ". Riprova tra poco.");
  } finally {
    bottone.disabled = false;
    bottone.textContent = "Invia richiesta";
  }
});

