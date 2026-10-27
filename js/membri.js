// Codice della pagina membri (file separato per la Content-Security-Policy).
const { chiama, escape, formattaData, DEMO } = window.Capolista;
// Nel browser resta solo la chiave di sessione, mai la password.
const CHIAVE_TOKEN = "capolista_sessione";
let token = "";
let richieste = [];

const $ = (id) => document.getElementById(id);

function leggiToken() { try { return sessionStorage.getItem(CHIAVE_TOKEN) || ""; } catch (e) { return ""; } }
function salvaToken(t) { try { t ? sessionStorage.setItem(CHIAVE_TOKEN, t) : sessionStorage.removeItem(CHIAVE_TOKEN); } catch (e) {} }
try { sessionStorage.removeItem("capolista_admin_pw"); } catch (e) {} // vecchia versione salvava la password

if (DEMO) $("esito-login").outerHTML += '<p class="desc">In modalità demo la password è <b>demo</b>.</p>';

async function carica() {
  const r = await chiama("lista", { token });
  if (!r.ok) throw new Error(r.errore);
  richieste = r.richieste;
  const categorie = [...new Set(richieste.map((x) => x.categoria).filter(Boolean))].sort();
  const sel = $("filtro-categoria");
  const attuale = sel.value;
  sel.innerHTML = '<option value="">Tutte le categorie</option>' +
    categorie.map((c) => "<option>" + escape(c) + "</option>").join("");
  sel.value = categorie.includes(attuale) ? attuale : "";
  disegna();
}

function disegna() {
  const ora = Date.now();
  const giorno = 24 * 60 * 60 * 1000;
  const recenti = (ms) => richieste.filter((x) => ora - new Date(x.data).getTime() < ms).length;
  const conteggi = {};
  richieste.forEach((x) => { conteggi[x.categoria] = (conteggi[x.categoria] || 0) + 1; });
  const ordinate = Object.entries(conteggi).sort((a, b) => b[1] - a[1]);

  $("stats").innerHTML =
    [[richieste.length, "Totale"], [recenti(giorno), "Ultime 24 ore"], [recenti(7 * giorno), "Ultimi 7 giorni"], [ordinate.length, "Categorie"]]
      .map(([n, etichetta]) => '<div class="stat"><b>' + n + "</b><span>" + etichetta + "</span></div>")
      .join("");

  const max = ordinate.length ? ordinate[0][1] : 1;
  $("classifica").innerHTML = ordinate.length
    ? ordinate.map(([c, n]) =>
        '<button class="barra" data-categoria="' + escape(c) + '">' +
        '<span class="nome">' + escape(c) + '</span><span class="num">' + n + "</span>" +
        '<span class="riempi" data-larghezza="' + Math.round((n / max) * 100) + '"></span></button>').join("")
    : '<p class="vuoto">Ancora nessuna richiesta.</p>';
  // Larghezza impostata da JS: la Content-Security-Policy blocca gli attributi style nell'HTML.
  $("classifica").querySelectorAll(".riempi").forEach((el) => { el.style.width = el.dataset.larghezza + "%"; });

  const fc = $("filtro-categoria").value;
  const q = $("cerca").value.trim().toLowerCase();
  const visibili = richieste.filter((x) =>
    (!fc || x.categoria === fc) &&
    (!q || [x.titolo, x.messaggio].join(" ").toLowerCase().includes(q)));

  if (!visibili.length) {
    $("lista").innerHTML = '<div class="card vuoto">Nessuna richiesta da mostrare.</div>';
    return;
  }

  $("lista").innerHTML = visibili.map((x) =>
    '<article class="card richiesta" data-id="' + escape(x.id) + '">' +
    '<div class="testa"><h3>' + escape(x.titolo) + '</h3><button class="elimina" title="Elimina (spam o offensiva)">Elimina</button></div>' +
    '<div class="meta">' + escape(x.categoria) + " · " + escape(formattaData(x.data)) + " · <i>Anonima</i></div>" +
    '<div class="corpo">' + escape(x.messaggio) + "</div></article>"
  ).join("");
}

$("classifica").addEventListener("click", (e) => {
  const b = e.target.closest(".barra");
  if (!b) return;
  const sel = $("filtro-categoria");
  sel.value = sel.value === b.dataset.categoria ? "" : b.dataset.categoria;
  disegna();
  $("lista").scrollIntoView({ behavior: "smooth" });
});

$("lista").addEventListener("click", async (e) => {
  if (!e.target.classList.contains("elimina")) return;
  if (!confirm("Eliminare questa richiesta? Non si può annullare.")) return;
  const id = e.target.closest(".richiesta").dataset.id;
  e.target.disabled = true;
  try {
    const r = await chiama("elimina", { token, id });
    if (!r.ok) throw new Error(r.errore);
    richieste = richieste.filter((x) => x.id !== id);
    disegna();
  } catch (err) {
    if (sessioneScaduta(err)) return;
    alert("Eliminazione non riuscita: " + err.message);
    e.target.disabled = false;
  }
});

function mostraLogin() {
  token = "";
  salvaToken("");
  $("pannello").hidden = true;
  $("login").hidden = false;
}

function sessioneScaduta(err) {
  if (!/Sessione scaduta/.test(err.message)) return false;
  mostraLogin();
  const esito = $("esito-login");
  esito.className = "messaggio errore";
  esito.textContent = err.message;
  return true;
}

async function apriPannello(t) {
  token = t;
  await carica();
  caricaCircolari().catch(() => {});
  salvaToken(t);
  $("login").hidden = true;
  $("pannello").hidden = false;
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const esito = $("esito-login");
  try {
    const r = await chiama("accedi", { password: $("password").value });
    if (!r.ok) throw new Error(r.errore);
    $("password").value = "";
    esito.textContent = "";
    await apriPannello(r.token);
  } catch (err) {
    esito.className = "messaggio errore";
    esito.textContent = err.message || "Accesso non riuscito.";
  }
});

/* ---------- Circolari ---------- */

async function caricaCircolari() {
  const r = await chiama("circolari");
  if (!r.ok) throw new Error(r.errore);
  $("lista-circolari-membri").innerHTML = r.circolari.length
    ? "<h3>Pubblicate</h3>" + r.circolari.map((c) =>
        '<div class="circolare-membri" data-id="' + escape(c.id) + '"><span>' +
        (c.numero ? "n. " + escape(c.numero) + " · " : "") + escape(c.titolo) +
        '</span><button class="elimina" type="button">Elimina</button></div>').join("")
    : "";
}

function esitoCircolare(tipo, testo) {
  $("esito-circolare").className = "messaggio " + tipo;
  $("esito-circolare").textContent = testo;
}

$("circ-riassumi").addEventListener("click", async (e) => {
  const b = e.target;
  b.disabled = true;
  b.textContent = "Sto riassumendo…";
  try {
    const r = await chiama("riassumi", { token, testo: $("circ-testo").value });
    if (!r.ok) throw new Error(r.errore);
    $("circ-riassunto").value = r.riassunto;
    esitoCircolare("ok", "Riassunto pronto: controllalo e poi premi Pubblica.");
  } catch (err) {
    if (!sessioneScaduta(err)) esitoCircolare("errore", err.message);
  } finally {
    b.disabled = false;
    b.textContent = "Riassumi con l'AI";
  }
});

$("form-circolare").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dati = {
    token,
    numero: $("circ-numero").value.trim(),
    link: $("circ-link").value.trim(),
    titolo: $("circ-titolo").value.trim(),
    testo: $("circ-testo").value.trim(),
    riassunto: $("circ-riassunto").value.trim()
  };
  if (!dati.titolo || !dati.riassunto) return esitoCircolare("errore", "Servono almeno titolo e riassunto.");
  if (dati.link && !/^https:\/\//.test(dati.link)) return esitoCircolare("errore", "Il link deve iniziare con https://");
  $("circ-pubblica").disabled = true;
  try {
    const r = await chiama("aggiungiCircolare", dati);
    if (!r.ok) throw new Error(r.errore);
    $("form-circolare").reset();
    esitoCircolare("ok", "Circolare pubblicata.");
    await caricaCircolari();
  } catch (err) {
    if (!sessioneScaduta(err)) esitoCircolare("errore", "Pubblicazione non riuscita: " + err.message);
  } finally {
    $("circ-pubblica").disabled = false;
  }
});

$("lista-circolari-membri").addEventListener("click", async (e) => {
  if (!e.target.classList.contains("elimina")) return;
  if (!confirm("Eliminare questa circolare dall'app?")) return;
  const id = e.target.closest(".circolare-membri").dataset.id;
  e.target.disabled = true;
  try {
    const r = await chiama("eliminaCircolare", { token, id });
    if (!r.ok) throw new Error(r.errore);
    await caricaCircolari();
  } catch (err) {
    if (!sessioneScaduta(err)) alert("Eliminazione non riuscita: " + err.message);
    e.target.disabled = false;
  }
});

$("filtro-categoria").addEventListener("change", disegna);
$("cerca").addEventListener("input", disegna);
$("aggiorna").addEventListener("click", () => carica().catch((err) => { if (!sessioneScaduta(err)) alert(err.message); }));
$("esci").addEventListener("click", async () => {
  try { await chiama("esci", { token }); } catch (e) { /* esce comunque */ }
  mostraLogin();
  location.reload();
});

const salvato = leggiToken();
if (salvato) apriPannello(salvato).catch(mostraLogin);
