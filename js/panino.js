// Ordine del panino: entro l'ora limite, il paninaro vede la lista divisa per classe.
(function () {
  const { chiama, escape, euro } = window.Capolista;
  const form = document.getElementById("form-panino");
  const stato = document.getElementById("stato-panino");
  const esito = document.getElementById("esito-panino");
  const menuEl = document.getElementById("menu");
  const totaleEl = document.getElementById("totale-panino");
  const CHIAVE_CLASSE = "capolista_classe"; // solo per ricordare la classe in questo telefono
  const MAX_PEZZI = 10;
  let menu = [];
  const quantita = {};

  function mostra(el, tipo, html) {
    el.className = "messaggio " + tipo;
    el.innerHTML = html;
  }

  function pezzi() { return Object.values(quantita).reduce((a, b) => a + b, 0); }

  function aggiornaTotale() {
    const totale = menu.reduce((s, p, i) => s + (quantita[i] || 0) * p.prezzo, 0);
    totaleEl.textContent = euro(totale);
    menuEl.querySelectorAll(".prodotto").forEach((riga) => {
      const i = riga.dataset.i;
      riga.querySelector(".q").textContent = quantita[i] || 0;
      riga.classList.toggle("scelto", (quantita[i] || 0) > 0);
    });
  }

  function disegnaMenu() {
    menuEl.innerHTML = menu.map((p, i) =>
      '<div class="prodotto" data-i="' + i + '">' +
      '<div class="nome">' + escape(p.prodotto) + '<span class="prezzo">' + escape(euro(p.prezzo)) + "</span></div>" +
      '<div class="passo">' +
      '<button type="button" class="meno" aria-label="Togli ' + escape(p.prodotto) + '">−</button>' +
      '<span class="q">0</span>' +
      '<button type="button" class="piu" aria-label="Aggiungi ' + escape(p.prodotto) + '">+</button>' +
      "</div></div>"
    ).join("");
  }

  menuEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const i = b.closest(".prodotto").dataset.i;
    const q = quantita[i] || 0;
    if (b.classList.contains("piu") && pezzi() < MAX_PEZZI) quantita[i] = q + 1;
    if (b.classList.contains("meno") && q > 0) quantita[i] = q - 1;
    aggiornaTotale();
  });

  async function carica() {
    try {
      const r = await chiama("menu");
      if (!r.ok) throw new Error(r.errore);
      document.querySelectorAll(".ora-limite").forEach((el) => { el.textContent = r.oraLimite; });
      if (!r.aperto) {
        mostra(stato, "errore", escape(r.motivo));
        return;
      }
      if (!r.menu.length) {
        mostra(stato, "errore", "Oggi il menù è vuoto.");
        return;
      }
      menu = r.menu;
      const sel = document.getElementById("classe");
      sel.innerHTML = '<option value="">Scegli…</option>' + r.classi.map((c) => "<option>" + escape(c) + "</option>").join("");
      try { const c = localStorage.getItem(CHIAVE_CLASSE); if (r.classi.includes(c)) sel.value = c; } catch (e) { /* ignora */ }
      disegnaMenu();
      aggiornaTotale();
      stato.className = "messaggio";
      form.hidden = false;
    } catch (err) {
      mostra(stato, "errore", "Gli ordini del panino non sono ancora attivi. Torna presto!");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const classe = document.getElementById("classe").value;
    const prodotti = menu.map((p, i) => ({ prodotto: p.prodotto, quantita: quantita[i] || 0 })).filter((p) => p.quantita > 0);
    if (!classe) return mostra(esito, "errore", "Scegli la tua classe.");
    if (!prodotti.length) return mostra(esito, "errore", "Scegli almeno un prodotto con il +.");
    const bottone = document.getElementById("invia-panino");
    bottone.disabled = true;
    bottone.textContent = "Invio…";
    try {
      const r = await chiama("ordina", {
        classe,
        nome: document.getElementById("nome-panino").value.trim(),
        prodotti,
        sito: document.getElementById("sito-panino").value
      });
      if (!r.ok) throw new Error(r.errore || "Errore sconosciuto");
      try { localStorage.setItem(CHIAVE_CLASSE, classe); } catch (e2) { /* ignora */ }
      Object.keys(quantita).forEach((k) => delete quantita[k]);
      aggiornaTotale();
      mostra(esito, "ok",
        "<b>Ordine inviato! Codice " + escape(r.codice) + "</b><br>" +
        escape((r.riepilogo || []).join(", ")) + " · " + escape(euro(r.totale)) + "<br>" +
        "Arriva in " + escape(classe) + " a ricreazione. Prepara i soldi giusti.");
      esito.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      mostra(esito, "errore", "Ordine non riuscito: " + escape(err.message));
    } finally {
      bottone.disabled = false;
      bottone.textContent = "Ordina";
    }
  });

  document.addEventListener("apri-panino", carica);
})();
