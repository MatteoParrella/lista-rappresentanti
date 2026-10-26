// Piccolo client per il backend (Google Apps Script).
// Senza API_URL usa localStorage, così il sito si può provare subito.
(function () {
  const API_URL = (window.CAPOLISTA_CONFIG && window.CAPOLISTA_CONFIG.API_URL) || "";
  const DEMO = !API_URL;
  const DEMO_KEY = "capolista_demo_richieste";
  const DEMO_PASSWORD = "demo";
  const DEMO_TOKEN = "demo".repeat(16);

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
        lista.push({
          id: nuovoCodice(),
          data: new Date().toISOString(),
          categoria: dati.categoria,
          titolo: dati.titolo,
          messaggio: dati.messaggio
        });
        scriviDemo(lista);
        return { ok: true };
      }
      case "accedi":
        if (dati.password !== DEMO_PASSWORD) return { ok: false, errore: "Password errata." };
        return { ok: true, token: DEMO_TOKEN };
      case "esci":
        return { ok: true };
      case "lista":
        if (dati.token !== DEMO_TOKEN) return { ok: false, errore: "Sessione scaduta: accedi di nuovo." };
        return { ok: true, richieste: lista.slice().reverse() };
      case "elimina":
        if (dati.token !== DEMO_TOKEN) return { ok: false, errore: "Sessione scaduta: accedi di nuovo." };
        scriviDemo(lista.filter((x) => x.id !== dati.id));
        return { ok: true };
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


  window.Capolista = { chiama, escape, formattaData, DEMO };

  if (DEMO) {
    document.addEventListener("DOMContentLoaded", function () {
      const b = document.createElement("div");
      b.className = "avviso-demo";
      b.textContent = "Modalità demo: le richieste restano solo in questo browser. Configura js/config.js per usarlo davvero.";
      document.body.prepend(b);
    });
  }
})();
