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
      case "accediPaninaro":
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
      case "circolari":
        return { ok: true, circolari: DEMO_CIRCOLARI };
      case "aggiungiCircolare":
      case "eliminaCircolare":
        return { ok: true };
      case "ordiniOggi":
        return { ok: true, giorno: new Date().toISOString().slice(0, 10), oraLimite: "10:00", totale: 6.5,
          prodotti: [{ prodotto: "Focaccia", quantita: 1 }, { prodotto: "Panino salame", quantita: 2 }],
          classi: [{ classe: "3B", totale: 6.5, ordini: [
            { codice: "K7QM", nome: "Gio", prodotti: ["2× Panino salame"], totale: 5 },
            { codice: "P2XA", nome: "", prodotti: ["1× Focaccia"], totale: 1.5 }] }] };
      case "menu":
        return { ok: true, menu: DEMO_MENU, classi: ["1A", "1B", "2A", "3B", "4C", "5A"], aperto: true, motivo: "", oraLimite: "10:00" };
      case "ordina":
        return { ok: true, codice: "DEMO", totale: 0, riepilogo: dati.prodotti.map((p) => p.quantita + "× " + p.prodotto) };
      case "riassumi":
        return { ok: true, riassunto: "Riga 1 del riassunto di esempio.\nRiga 2 del riassunto di esempio.\nRiga 3 del riassunto di esempio." };
      case "chat":
        return { ok: true, risposta: "Modalità demo: qui risponderà l'AI leggendo regolamento e circolari." };
    }
    return { ok: false, errore: "Azione sconosciuta." };
  }

  // Esempi per provare il sito senza backend (modalità demo).
  const DEMO_CIRCOLARI = [
    { id: "C1", data: new Date().toISOString(), numero: "45", titolo: "Assemblea d'istituto di novembre", link: "",
      riassunto: "Venerdì 14 novembre c'è l'assemblea d'istituto in palestra.\nLe lezioni finiscono alle 10:00 per tutte le classi.\nServe la firma dei genitori per uscire prima." }
  ];
  const DEMO_MENU = [
    { prodotto: "Panino cotto e fontina", prezzo: 2.5 },
    { prodotto: "Panino salame", prezzo: 2.5 },
    { prodotto: "Focaccia", prezzo: 1.5 }
  ];

  // Azioni degli studenti che passano da Vercel (che conosce l'IP per i limiti anti-spam).
  const SU_VERCEL = { invia: "/api/invia", ordina: "/api/ordina", chat: "/api/chat", riassumi: "/api/riassumi" };

  async function chiama(azione, dati) {
    dati = dati || {};
    if (DEMO) return demo(azione, dati);
    // Content-Type text/plain evita il preflight CORS, che Apps Script non gestisce.
    const risposta = await fetch(SU_VERCEL[azione] || API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ azione: azione }, dati))
    });
    if (!risposta.ok) {
      // Le funzioni di Vercel spiegano l'errore nel JSON anche quando lo stato non è 200.
      const spiegazione = await risposta.json().catch(() => null);
      if (spiegazione && spiegazione.errore) return spiegazione;
      throw new Error("Errore di rete (" + risposta.status + ")");
    }
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

  function euro(n) {
    return Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  }

  window.Capolista = { chiama, escape, formattaData, euro, DEMO };

  if (DEMO) {
    document.addEventListener("DOMContentLoaded", function () {
      const b = document.createElement("div");
      b.className = "avviso-demo";
      b.textContent = "Modalità demo: le richieste restano solo in questo browser. Configura js/config.js per usarlo davvero.";
      document.body.prepend(b);
    });
  }
})();
