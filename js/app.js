// Schede dell'app (Chiedi, Circolari, Panino, Richieste): una sola pagina, si cambia con il menu in basso.
(function () {
  const SCHEDE = ["chat", "circolari", "panino", "richieste"];
  const aperte = {};

  function mostra() {
    const id = location.hash.slice(1);
    const scheda = SCHEDE.includes(id) ? id : SCHEDE[0];
    SCHEDE.forEach((s) => { document.getElementById(s).hidden = s !== scheda; });
    document.querySelectorAll(".schede a").forEach((a) => {
      const attiva = a.dataset.scheda === scheda;
      a.classList.toggle("attiva", attiva);
      if (attiva) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Ogni scheda carica i suoi dati solo la prima volta che viene aperta.
    if (!aperte[scheda]) {
      aperte[scheda] = true;
      document.dispatchEvent(new CustomEvent("apri-" + scheda));
    }
  }

  window.addEventListener("hashchange", () => { mostra(); window.scrollTo(0, 0); });
  document.addEventListener("DOMContentLoaded", mostra);
})();
