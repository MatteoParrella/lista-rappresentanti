// Piccolo client per il backend (Google Apps Script).
// Senza API_URL usa localStorage, così il sito si può provare subito.
(function () {
  const API_URL = (window.CAPOLISTA_CONFIG && window.CAPOLISTA_CONFIG.API_URL) || "";
  const DEMO = !API_URL;
  const DEMO_KEY = "capolista_demo_richieste";
  const DEMO_PASSWORD = "demo";

  function nuovoCodice() {
    const caratteri = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 6; i++) c += caratteri[Math.floor(Math.random() * caratteri.length)];
    return c;
  }

  function leggiDemo() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch (e) { return []; }
  }
  function scriviDemo(lista) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(lista)); } catch (e) { /* ignora */ }
  }

  function demo(azione, dati) {
    const lista = leggiDemo();
    switch (azione) {
      case "invia": {
        const r = Object.assign({}, dati, {
          id: nuovoCodice(),
          data: new Date().toISOString(),
          stato: "nuova",
          risposta: ""
        });
        lista.push(r);
        scriviDemo(lista);
        return { ok: true, id: r.id };
      }
      case "stato": {
        const r = lista.find((x) => x.id === String(dati.id).toUpperCase());
        if (!r) return { ok: false, errore: "Codice non trovato." };
        return { ok: true, richiesta: { id: r.id, titolo: r.titolo, data: r.data, stato: r.stato, risposta: r.risposta } };
      }
      case "lista":
        if (dati.password !== DEMO_PASSWORD) return { ok: false, errore: "Password errata." };
        return { ok: true, richieste: lista.slice().reverse() };
      case "aggiorna": {
        if (dati.password !== DEMO_PASSWORD) return { ok: false, errore: "Password errata." };
        const r = lista.find((x) => x.id === dati.id);
        if (!r) return { ok: false, errore: "Richiesta non trovata." };
        r.stato = dati.stato;
        r.risposta = dati.risposta;
        scriviDemo(lista);
        return { ok: true };
      }
    }
    return { ok: false, errore: "Azione sconosciuta." };
  }

  async function chiama(azione, dati) {
    dati = dati || {};
    if (DEMO) return demo(azione, dati);
    // Content-Type text/plain evita il preflight CORS, che Apps Script non gestisce.
    const risposta = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ azione: azione }, dati))
    });
    if (!risposta.ok) throw new Error("Errore di rete (" + risposta.status + ")");
    return risposta.json();
  }

  function escape(testo) {
    const d = document.createElement("div");
    d.textContent = testo == null ? "" : String(testo);
    return d.innerHTML;
  }

  function formattaData(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const ETICHETTE_STATO = {
    "nuova": "Nuova",
    "in-lavorazione": "In lavorazione",
    "risolta": "Risolta",
    "respinta": "Non accolta"
  };

  window.Capolista = { chiama, escape, formattaData, DEMO, ETICHETTE_STATO };

  if (DEMO) {
    document.addEventListener("DOMContentLoaded", function () {
      const b = document.createElement("div");
      b.className = "avviso-demo";
      b.textContent = "Modalità demo: le richieste restano solo in questo browser. Configura js/config.js per usarlo davvero.";
      document.body.prepend(b);
    });
  }
})();
