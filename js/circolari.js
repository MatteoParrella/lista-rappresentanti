// Elenco delle circolari con il riassunto in 3 righe.
(function () {
  const { chiama, escape } = window.Capolista;
  const lista = document.getElementById("lista-circolari");
  const cerca = document.getElementById("cerca-circolari");
  let circolari = [];

  function dataBreve(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }

  function disegna() {
    const q = cerca.value.trim().toLowerCase();
    const visibili = circolari.filter((c) => !q || [c.numero, c.titolo, c.riassunto].join(" ").toLowerCase().includes(q));
    if (!visibili.length) {
      lista.innerHTML = '<div class="card vuoto">' + (circolari.length ? "Nessuna circolare trovata." : "Ancora nessuna circolare pubblicata.") + "</div>";
      return;
    }
    lista.innerHTML = visibili.map((c) =>
      '<article class="card circolare">' +
      '<div class="meta">' + (c.numero ? "Circolare n. " + escape(c.numero) + " · " : "") + escape(dataBreve(c.data)) + "</div>" +
      "<h3>" + escape(c.titolo) + "</h3>" +
      '<div class="corpo">' + escape(c.riassunto) + "</div>" +
      // Solo link https, controllati anche dal backend.
      (/^https:\/\//.test(c.link) ? '<a class="leggi" href="' + escape(c.link) + '" target="_blank" rel="noopener noreferrer">Leggi tutta →</a>' : "") +
      "</article>"
    ).join("");
  }

  async function carica() {
    try {
      const r = await chiama("circolari");
      if (!r.ok) throw new Error(r.errore);
      circolari = r.circolari || [];
      disegna();
    } catch (err) {
      lista.innerHTML = '<div class="card vuoto">Le circolari non sono disponibili in questo momento. Riprova più tardi.</div>';
    }
  }

  cerca.addEventListener("input", disegna);
  document.addEventListener("apri-circolari", carica);
})();
