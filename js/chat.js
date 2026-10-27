// Chat con l'AI su regolamento e circolari. La conversazione resta solo in questa pagina.
(function () {
  const { chiama } = window.Capolista;
  const log = document.getElementById("chat-log");
  const form = document.getElementById("form-chat");
  const campo = document.getElementById("domanda");
  const bottone = document.getElementById("invia-chat");
  const storia = [];

  function aggiungi(ruolo, testo) {
    const div = document.createElement("div");
    div.className = "bolla " + ruolo;
    div.textContent = testo; // sempre testo semplice, mai HTML
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  async function chiedi(domanda) {
    domanda = domanda.trim();
    if (!domanda || bottone.disabled) return;
    const suggerimenti = document.getElementById("suggerimenti");
    if (suggerimenti) suggerimenti.remove();
    aggiungi("utente", domanda);
    campo.value = "";
    bottone.disabled = true;
    const attesa = aggiungi("ai attesa", "Sto leggendo i documenti…");
    try {
      const r = await chiama("chat", { domanda, storia: storia.slice(-6) });
      if (!r.ok) throw new Error(r.errore || "Errore sconosciuto");
      attesa.className = "bolla ai";
      attesa.textContent = r.risposta;
      storia.push({ ruolo: "utente", testo: domanda }, { ruolo: "ai", testo: r.risposta });
    } catch (err) {
      attesa.className = "bolla ai errore";
      attesa.textContent = err.message;
    } finally {
      bottone.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); chiedi(campo.value); });
  log.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip")) chiedi(e.target.textContent);
  });
})();
