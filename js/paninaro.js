// Pagina del paninaro: ordini di oggi divisi per classe, con il totale da preparare.
const { chiama, escape, euro } = window.Capolista;
const CHIAVE_TOKEN = "capolista_paninaro";
let token = "";

const $ = (id) => document.getElementById(id);

function leggiToken() { try { return sessionStorage.getItem(CHIAVE_TOKEN) || ""; } catch (e) { return ""; } }
function salvaToken(t) { try { t ? sessionStorage.setItem(CHIAVE_TOKEN, t) : sessionStorage.removeItem(CHIAVE_TOKEN); } catch (e) {} }

async function carica() {
  const r = await chiama("ordiniOggi", { token });
  if (!r.ok) throw new Error(r.errore);
  const ordini = r.classi.reduce((n, c) => n + c.ordini.length, 0);
  const pezzi = r.prodotti.reduce((n, p) => n + p.quantita, 0);
  $("stats").innerHTML =
    [[ordini, "Ordini"], [pezzi, "Pezzi"], [r.classi.length, "Classi"], [euro(r.totale), "Incasso"]]
      .map(([n, etichetta]) => '<div class="stat"><b>' + escape(n) + "</b><span>" + etichetta + "</span></div>")
      .join("");
  const giorno = new Date(r.giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  $("giorno").textContent = "Ordini di " + giorno + " (chiusi alle " + r.oraLimite + ").";
  $("prodotti").innerHTML = r.prodotti.length
    ? r.prodotti.map((p) => "<span>" + escape(p.prodotto) + "</span><b>" + p.quantita + "</b>").join("")
    : '<span class="vuoto">Ancora nessun ordine oggi.</span>';
  $("classi").innerHTML = r.classi.map((c) =>
    '<section class="card classe-ordini">' +
    '<div class="testa"><h3>' + escape(c.classe) + "</h3><span>" + escape(euro(c.totale)) + "</span></div>" +
    "<ul>" + c.ordini.map((o) =>
      "<li>" + escape(o.prodotti.join(", ")) +
      '<div class="chi">' + (o.nome ? escape(o.nome) + " · " : "") + "codice " + escape(o.codice) + " · " + escape(euro(o.totale)) + "</div></li>"
    ).join("") + "</ul></section>"
  ).join("");
}

function mostraLogin() {
  token = "";
  salvaToken("");
  $("pannello").hidden = true;
  $("login").hidden = false;
}

function gestisciErrore(err) {
  if (/Sessione scaduta/.test(err.message)) {
    mostraLogin();
    $("esito-login").className = "messaggio errore";
    $("esito-login").textContent = err.message;
  } else {
    alert(err.message);
  }
}

async function apriPannello(t) {
  token = t;
  await carica();
  salvaToken(t);
  $("login").hidden = true;
  $("pannello").hidden = false;
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const esito = $("esito-login");
  try {
    const r = await chiama("accediPaninaro", { password: $("password").value });
    if (!r.ok) throw new Error(r.errore);
    $("password").value = "";
    esito.textContent = "";
    esito.className = "messaggio";
    await apriPannello(r.token);
  } catch (err) {
    esito.className = "messaggio errore";
    esito.textContent = err.message || "Accesso non riuscito.";
  }
});

$("aggiorna").addEventListener("click", () => carica().catch(gestisciErrore));
$("stampa").addEventListener("click", () => window.print());
$("esci").addEventListener("click", async () => {
  try { await chiama("esci", { token }); } catch (e) { /* esce comunque */ }
  mostraLogin();
});

// Aggiorna da solo ogni minuto mentre la pagina è aperta.
setInterval(() => { if (token && !document.hidden) carica().catch(() => {}); }, 60000);

// Un membro che arriva dall'area membri (stessa scheda del browser) è già dentro.
let salvato = leggiToken();
try { salvato = salvato || sessionStorage.getItem("capolista_sessione") || ""; } catch (e) { /* ignora */ }
if (salvato) apriPannello(salvato).catch(mostraLogin);
