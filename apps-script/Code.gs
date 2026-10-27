/**
 * Backend del sito Capolista su Google Apps Script + Google Sheets.
 * Istruzioni di installazione nel README.md del repository.
 *
 * Proprietà dello script (Impostazioni progetto → Proprietà script):
 *   ADMIN_PASSWORD     password dell'area membri (obbligatoria)
 *   PROXY_SECRET       segreto condiviso con Vercel (variabile d'ambiente con lo stesso nome):
 *                      invii, ordini e domande all'AI sono accettati solo se passano dal sito
 *   PANINARO_PASSWORD  password della pagina /paninaro (lista ordini per classe)
 *   CLASSI             elenco delle classi separate da virgola (es. "1A,1B,2A"); se manca usa 1A-5E
 *   INVII_CHIUSI       scrivete "si" per chiudere subito le richieste (es. durante un attacco di spam)
 *   ORDINI_CHIUSI      scrivete "si" per chiudere gli ordini del panino (es. paninaro assente)
 *   CHAT_CHIUSA        scrivete "si" per spegnere la chat AI
 *
 * Fogli usati (si creano da soli al primo utilizzo):
 *   Richieste  richieste anonime degli studenti
 *   Circolari  circolari pubblicate dai membri con il riassunto
 *   Menu       prodotti del paninaro: modificate prezzi e disponibilità direttamente nel foglio
 *   Ordini     ordini del panino (cancellati da soli dopo 14 giorni)
 *
 * Per cancellare in blocco lo spam: scegliete la funzione cancellaSpamDiOggi in alto
 * nell'editor e premete Esegui (vedi la funzione in fondo al file).
 */

const FOGLIO = 'Richieste';
// Nessuna colonna identifica chi scrive: le richieste sono anonime.
// L'id serve solo ai membri per eliminare spam o messaggi offensivi.
const COLONNE = ['id', 'data', 'categoria', 'titolo', 'messaggio'];
const LIMITI = { categoria: 40, titolo: 120, messaggio: 3000 };
const MAX_CORPO = 60000;          // byte massimi di una richiesta al backend (le circolari sono lunghe)
const DURATA_SESSIONE = 4 * 3600; // secondi di validità dell'accesso membri
const MAX_TENTATIVI = 8;          // password sbagliate prima del blocco
const BLOCCO = 15 * 60;           // secondi di blocco dopo troppi tentativi
const MAX_PER_IP = 5;             // richieste massime ogni 10 minuti dallo stesso indirizzo IP
const MAX_INVII_GIORNO = 300;     // tetto di sicurezza al giorno per tutto il sito
const FUSO = 'Europe/Rome';

const FOGLIO_CIRCOLARI = 'Circolari';
const COLONNE_CIRCOLARI = ['id', 'data', 'numero', 'titolo', 'riassunto', 'link', 'testo'];
const LIMITI_CIRCOLARI = { numero: 20, titolo: 150, riassunto: 600, link: 500, testo: 40000 };
const CIRCOLARI_PER_AI = 15;      // circolari più recenti che la chat AI può leggere
const MAX_CHAT_PER_IP = 40;       // domande all'AI ogni 10 minuti dallo stesso IP (a scuola il Wi-Fi è uno solo)
const MAX_CHAT_GIORNO = 500;      // tetto giornaliero di domande, per tenere bassi i costi

const FOGLIO_MENU = 'Menu';
const FOGLIO_ORDINI = 'Ordini';
const COLONNE_ORDINI = ['id', 'data', 'giorno', 'classe', 'nome', 'prodotti', 'totale'];
const ORA_LIMITE = '10:00';       // dopo quest'ora gli ordini del giorno sono chiusi
const GIORNI_ORDINI = [1, 2, 3, 4, 5, 6]; // da lunedì (1) a sabato (6)
const MAX_PEZZI = 10;             // pezzi massimi in un singolo ordine
const MAX_ORDINI_PER_IP = 60;     // ordini ogni 10 minuti dallo stesso IP (alto: il Wi-Fi della scuola è condiviso)
const MAX_ORDINI_GIORNO = 800;
const GIORNI_CONSERVAZIONE = 14;  // gli ordini più vecchi vengono cancellati
const MENU_ESEMPIO = [
  ['Panino cotto e fontina', 2.5, 'si'],
  ['Panino salame', 2.5, 'si'],
  ['Panino crudo e mozzarella', 3, 'si'],
  ['Piadina vegetariana', 3, 'si'],
  ['Focaccia', 1.5, 'si'],
  ['Acqua naturale 0,5 L', 0.8, 'si']
];

function doPost(e) {
  let esito;
  try {
    const corpo = e && e.postData && e.postData.contents;
    if (!corpo || corpo.length > MAX_CORPO) throw new ErroreUtente('Richiesta non valida.');
    const dati = JSON.parse(corpo);
    if (!dati || typeof dati !== 'object') throw new ErroreUtente('Richiesta non valida.');
    switch (dati.azione) {
      case 'invia': esito = invia(dati); break;
      case 'accedi': esito = accedi(dati, 'ADMIN_PASSWORD', 'membri'); break;
      case 'accediPaninaro': esito = accedi(dati, 'PANINARO_PASSWORD', 'paninaro'); break;
      case 'esci': esito = esci(dati); break;
      case 'sessione': controllaSessione(dati, dati.ruolo === 'paninaro' ? 'paninaro' : 'membri'); esito = { ok: true }; break;
      case 'lista': controllaSessione(dati); esito = lista(); break;
      case 'elimina': controllaSessione(dati); esito = elimina(dati); break;
      case 'circolari': esito = listaCircolari(); break;
      case 'aggiungiCircolare': controllaSessione(dati); esito = aggiungiCircolare(dati); break;
      case 'eliminaCircolare': controllaSessione(dati); esito = eliminaCircolare(dati); break;
      case 'contestoChat': esito = contestoChat(dati); break;
      case 'menu': esito = menu(); break;
      case 'ordina': esito = ordina(dati); break;
      case 'ordiniOggi': controllaSessione(dati, 'paninaro'); esito = ordiniOggi(); break;
      default: esito = { ok: false, errore: 'Azione sconosciuta.' };
    }
  } catch (err) {
    // Agli utenti arrivano solo i nostri messaggi, non i dettagli interni dello script.
    esito = { ok: false, errore: err instanceof ErroreUtente ? err.message : 'Errore del server. Riprova tra poco.' };
    if (!(err instanceof ErroreUtente)) console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify(esito)).setMimeType(ContentService.MimeType.JSON);
}

function ErroreUtente(messaggio) {
  this.message = messaggio;
}

function doGet() {
  return ContentService.createTextOutput('Backend Capolista attivo.');
}

// Restituisce il foglio con quel nome; se non esiste lo crea con le intestazioni (e le righe iniziali).
function foglioDi(nome, colonne, righeIniziali) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(colonne);
    sh.getRange('A:A').setNumberFormat('@'); // i codici restano testo (es. "234567" o "MAY2")
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, colonne.length).setFontWeight('bold');
    if (righeIniziali && righeIniziali.length) {
      sh.getRange(2, 1, righeIniziali.length, colonne.length).setValues(righeIniziali);
    }
  }
  return sh;
}

function foglio() {
  return foglioDi(FOGLIO, COLONNE);
}

function pulisci(valore, max) {
  // Toglie i caratteri di controllo e taglia alla lunghezza massima.
  let s = String(valore == null ? '' : valore)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim().slice(0, max);
  // L'apostrofo iniziale impedisce che il foglio interpreti il testo come formula.
  if (/^[=+\-@\t\r|]/.test(s)) s = "'" + s;
  return s;
}

function cache() {
  return CacheService.getScriptCache();
}

function proprietaAttiva(nome) {
  const v = PropertiesService.getScriptProperties().getProperty(nome);
  return !!(v && /^s/i.test(v));
}

// Confronto che impiega sempre lo stesso tempo, per non far indovinare la password a pezzi.
function uguali(a, b) {
  a = String(a); b = String(b);
  let diversi = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diversi |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diversi === 0;
}

// ruolo "membri" (area membri) o "paninaro" (pagina ordini): ognuno ha la sua password e il suo blocco tentativi.
function accedi(dati, nomeProprieta, ruolo) {
  const giusta = PropertiesService.getScriptProperties().getProperty(nomeProprieta);
  if (!giusta) throw new ErroreUtente(nomeProprieta + ' non configurata nello script.');
  const c = cache();
  const prefisso = ruolo === 'membri' ? '' : ruolo + '_';
  // Apps Script non conosce l'IP di chi scrive: il conteggio dei tentativi è unico per tutti.
  if (c.get(prefisso + 'blocco')) throw new ErroreUtente('Troppi tentativi sbagliati. Riprova tra 15 minuti.');
  if (typeof dati.password !== 'string' || !uguali(dati.password, giusta)) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const n = Number(c.get(prefisso + 'tentativi') || 0) + 1;
      if (n >= MAX_TENTATIVI) {
        c.put(prefisso + 'blocco', '1', BLOCCO);
        c.remove(prefisso + 'tentativi');
      } else {
        c.put(prefisso + 'tentativi', String(n), BLOCCO);
      }
    } finally {
      lock.releaseLock();
    }
    Utilities.sleep(1000);
    throw new ErroreUtente('Password errata.');
  }
  c.remove(prefisso + 'tentativi');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  // "1" = membri (vedono tutto, anche gli ordini), "paninaro" = solo gli ordini.
  c.put('sessione_' + token, ruolo === 'membri' ? '1' : ruolo, DURATA_SESSIONE);
  return { ok: true, token: token };
}

function controllaSessione(dati, ruolo) {
  const valore = typeof dati.token === 'string' && /^[0-9a-f]{64}$/.test(dati.token) && cache().get('sessione_' + dati.token);
  const valida = valore === '1' || (ruolo === 'paninaro' && valore === 'paninaro');
  if (!valida) throw new ErroreUtente('Sessione scaduta: accedi di nuovo.');
}

function esci(dati) {
  if (typeof dati.token === 'string' && /^[0-9a-f]{64}$/.test(dati.token)) cache().remove('sessione_' + dati.token);
  return { ok: true };
}

function nuovoCodice(lunghezza) {
  const caratteri = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < (lunghezza || 8); i++) c += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  return c;
}

// Le azioni degli studenti (richieste, ordini, chat) devono passare dal sito su Vercel,
// che aggiunge il segreto e l'impronta dell'IP.
function controllaProxy(dati) {
  const segreto = PropertiesService.getScriptProperties().getProperty('PROXY_SECRET');
  // Senza il segreto giusto l'invio non arriva dal sito ma da qualcuno che chiama lo script direttamente.
  if (!segreto || typeof dati.segreto !== 'string' || !uguali(dati.segreto, segreto)) {
    throw new ErroreUtente('Invio non consentito.');
  }
  if (typeof dati.impronta !== 'string' || !/^[0-9a-f]{32}$/.test(dati.impronta)) throw new ErroreUtente('Invio non consentito.');
}

// Conta un utilizzo per IP (finestre di 10 minuti) e per giorno. Va chiamata dentro il lock.
// L'impronta dell'IP resta solo in questa cache per 10 minuti: non finisce mai nel foglio.
function conta(tipo, impronta, maxIp, maxGiorno, erroreIp, erroreGiorno) {
  const c = cache();
  const finestra = tipo + 'ip_' + impronta + '_' + Math.floor(Date.now() / 600000);
  const n = Number(c.get(finestra) || 0);
  if (n >= maxIp) throw new ErroreUtente(erroreIp);
  const giorno = tipo + 'invii_giorno_' + Utilities.formatDate(new Date(), FUSO, 'yyyyMMdd');
  const g = Number(c.get(giorno) || 0);
  if (g >= maxGiorno) throw new ErroreUtente(erroreGiorno);
  c.put(finestra, String(n + 1), 600);
  c.put(giorno, String(g + 1), 25 * 3600);
}

function invia(dati) {
  if (dati.sito) return { ok: true }; // bot: finge successo, non salva
  controllaProxy(dati);
  if (proprietaAttiva('INVII_CHIUSI')) throw new ErroreUtente('Le richieste sono chiuse per qualche ora. Riprova più tardi.');
  const r = {};
  ['categoria', 'titolo', 'messaggio'].forEach(function (k) {
    r[k] = pulisci(dati[k], LIMITI[k]);
  });
  if (!r.categoria || !r.titolo || !r.messaggio) throw new ErroreUtente('Compila categoria, oggetto e messaggio.');

  const c = cache();
  // Stesso testo inviato di nuovo entro un'ora: finge successo, non salva il doppione.
  const impronta = 'testo_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, r.titolo + '\n' + r.messaggio, Utilities.Charset.UTF_8));
  if (c.get(impronta)) return { ok: true };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    conta('', dati.impronta, MAX_PER_IP, MAX_INVII_GIORNO,
      'Hai inviato troppe richieste. Riprova tra qualche minuto.',
      'Per oggi abbiamo ricevuto troppe richieste. Riprova domani.');
    c.put(impronta, '1', 3600);
    foglio().appendRow([nuovoCodice(), new Date(), r.categoria, r.titolo, r.messaggio]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function righeDi(sh, colonne) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, colonne.length).getValues().map(function (v, i) {
    const o = { riga: i + 2 };
    colonne.forEach(function (k, j) { o[k] = v[j]; });
    o.id = String(o.id);
    o.data = o.data instanceof Date ? o.data.toISOString() : String(o.data);
    return o;
  });
}

function righe() {
  return righeDi(foglio(), COLONNE);
}

function lista() {
  const tutte = righe().reverse().map(function (r) { delete r.riga; return r; });
  return { ok: true, richieste: tutte };
}

function eliminaDa(sh, colonne, id, messaggio) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (typeof id !== 'string' || !id) throw new ErroreUtente(messaggio);
    const r = righeDi(sh, colonne).find(function (x) { return x.id === id; });
    if (!r) throw new ErroreUtente(messaggio);
    sh.deleteRow(r.riga);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function elimina(dati) {
  return eliminaDa(foglio(), COLONNE, dati.id, 'Richiesta non trovata.');
}

/* ---------- Circolari ---------- */

function foglioCircolari() {
  return foglioDi(FOGLIO_CIRCOLARI, COLONNE_CIRCOLARI);
}

function circolariRecenti() {
  return righeDi(foglioCircolari(), COLONNE_CIRCOLARI)
    .sort(function (a, b) { return new Date(b.data) - new Date(a.data); });
}

function listaCircolari() {
  const elenco = circolariRecenti().slice(0, 60).map(function (r) {
    return { id: r.id, data: r.data, numero: String(r.numero), titolo: r.titolo, riassunto: r.riassunto, link: r.link };
  });
  return { ok: true, circolari: elenco };
}

function aggiungiCircolare(dati) {
  const r = {};
  Object.keys(LIMITI_CIRCOLARI).forEach(function (k) { r[k] = pulisci(dati[k], LIMITI_CIRCOLARI[k]); });
  if (!r.titolo || !r.riassunto) throw new ErroreUtente('Servono almeno titolo e riassunto.');
  if (r.link && !/^https:\/\/[^\s"'<>]+$/.test(r.link)) throw new ErroreUtente('Il link deve iniziare con https://');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    foglioCircolari().appendRow([nuovoCodice(), new Date(), r.numero, r.titolo, r.riassunto, r.link, r.testo]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function eliminaCircolare(dati) {
  return eliminaDa(foglioCircolari(), COLONNE_CIRCOLARI, dati.id, 'Circolare non trovata.');
}

// Chiamata da /api/chat prima di ogni domanda: conta i limiti e passa le circolari da leggere.
// La domanda non arriva qui e non viene salvata da nessuna parte.
function contestoChat(dati) {
  controllaProxy(dati);
  if (proprietaAttiva('CHAT_CHIUSA')) throw new ErroreUtente('La chat è spenta per qualche ora. Riprova più tardi.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    conta('chat_', dati.impronta, MAX_CHAT_PER_IP, MAX_CHAT_GIORNO,
      'Hai fatto tante domande di fila: riprova tra qualche minuto.',
      'Per oggi la chat ha risposto a troppe domande. Riprova domani.');
  } finally {
    lock.releaseLock();
  }
  const circolari = circolariRecenti().slice(0, CIRCOLARI_PER_AI).map(function (r) {
    return {
      numero: String(r.numero),
      data: Utilities.formatDate(new Date(r.data), FUSO, 'dd/MM/yyyy'),
      titolo: r.titolo,
      riassunto: r.riassunto,
      testo: String(r.testo || '').slice(0, 8000)
    };
  });
  return { ok: true, circolari: circolari };
}

/* ---------- Panino ---------- */

function classi() {
  const p = PropertiesService.getScriptProperties().getProperty('CLASSI');
  if (p) return p.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(String);
  const tutte = [];
  for (let anno = 1; anno <= 5; anno++) ['A', 'B', 'C', 'D', 'E'].forEach(function (s) { tutte.push(anno + s); });
  return tutte;
}

function prodottiMenu() {
  const sh = foglioDi(FOGLIO_MENU, ['prodotto', 'prezzo', 'disponibile'], MENU_ESEMPIO);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 3).getValues()
    .map(function (v) {
      return {
        prodotto: String(v[0]).replace(/[|×]/g, ' ').trim().slice(0, 60),
        prezzo: Math.round(Number(String(v[1]).replace(',', '.')) * 100) / 100,
        disponibile: !/^n/i.test(String(v[2]).trim())
      };
    })
    .filter(function (p) { return p.prodotto && p.prezzo > 0 && p.disponibile; })
    .map(function (p) { return { prodotto: p.prodotto, prezzo: p.prezzo }; });
}

function statoOrdini() {
  const ora = new Date();
  const giornoSettimana = Number(Utilities.formatDate(ora, FUSO, 'u')); // 1 = lunedì … 7 = domenica
  const orario = Utilities.formatDate(ora, FUSO, 'HH:mm');
  if (proprietaAttiva('ORDINI_CHIUSI')) return { aperto: false, motivo: 'Oggi gli ordini sono chiusi.' };
  if (GIORNI_ORDINI.indexOf(giornoSettimana) < 0) return { aperto: false, motivo: 'Oggi non c\'è scuola: gli ordini riaprono il prossimo giorno di lezione.' };
  if (orario >= ORA_LIMITE) return { aperto: false, motivo: 'Gli ordini di oggi sono chiusi alle ' + ORA_LIMITE + '. Riaprono il prossimo giorno di lezione.' };
  return { aperto: true, motivo: '' };
}

function menu() {
  const stato = statoOrdini();
  return { ok: true, menu: prodottiMenu(), classi: classi(), aperto: stato.aperto, motivo: stato.motivo, oraLimite: ORA_LIMITE };
}

function ordina(dati) {
  if (dati.sito) return { ok: true, codice: nuovoCodice(4), totale: 0 }; // bot
  controllaProxy(dati);
  const stato = statoOrdini();
  if (!stato.aperto) throw new ErroreUtente(stato.motivo);
  const classe = String(dati.classe || '').trim().toUpperCase();
  if (classi().indexOf(classe) < 0) throw new ErroreUtente('Scegli la tua classe.');
  const nome = pulisci(dati.nome, 30).replace(/[|×]/g, ' ');
  if (!Array.isArray(dati.prodotti) || !dati.prodotti.length || dati.prodotti.length > 20) throw new ErroreUtente('Scegli almeno un prodotto.');

  // Prezzi e nomi vengono dal foglio Menu, mai dal browser.
  const listino = {};
  prodottiMenu().forEach(function (p) { listino[p.prodotto] = p.prezzo; });
  const voci = [];
  let pezzi = 0;
  let totale = 0;
  dati.prodotti.forEach(function (p) {
    const nomeProdotto = p && String(p.prodotto);
    const q = p && Number(p.quantita);
    if (!Object.prototype.hasOwnProperty.call(listino, nomeProdotto)) throw new ErroreUtente('Un prodotto non è più disponibile: ricarica la pagina.');
    if (!(q >= 1 && q <= MAX_PEZZI && Math.floor(q) === q)) throw new ErroreUtente('Quantità non valida.');
    pezzi += q;
    totale += q * listino[nomeProdotto];
    voci.push(q + '× ' + nomeProdotto);
  });
  if (pezzi > MAX_PEZZI) throw new ErroreUtente('Massimo ' + MAX_PEZZI + ' pezzi per ordine.');
  totale = Math.round(totale * 100) / 100;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    conta('ordini_', dati.impronta, MAX_ORDINI_PER_IP, MAX_ORDINI_GIORNO,
      'Troppi ordini di fila da questa rete. Riprova tra qualche minuto.',
      'Per oggi il paninaro ha ricevuto troppi ordini.');
    const codice = nuovoCodice(4);
    const oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
    foglioDi(FOGLIO_ORDINI, COLONNE_ORDINI).appendRow([codice, new Date(), oggi, classe, nome, voci.join(' | '), totale]);
    return { ok: true, codice: codice, totale: totale, riepilogo: voci };
  } finally {
    lock.releaseLock();
  }
}

function ordiniOggi() {
  const sh = foglioDi(FOGLIO_ORDINI, COLONNE_ORDINI);
  pulisciOrdiniVecchi(sh);
  const oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  const perClasse = {};
  const perProdotto = {};
  let totale = 0;
  righeDi(sh, COLONNE_ORDINI).forEach(function (r) {
    const giorno = Object.prototype.toString.call(r.giorno) === '[object Date]' ? Utilities.formatDate(r.giorno, FUSO, 'yyyy-MM-dd') : String(r.giorno);
    if (giorno !== oggi) return;
    const prodotti = String(r.prodotti).split(' | ').filter(String);
    prodotti.forEach(function (p) {
      const m = /^(\d+)× (.+)$/.exec(p);
      if (m) perProdotto[m[2]] = (perProdotto[m[2]] || 0) + Number(m[1]);
    });
    const c = perClasse[r.classe] || (perClasse[r.classe] = { classe: String(r.classe), ordini: [], totale: 0 });
    c.ordini.push({ codice: r.id, nome: String(r.nome || ''), prodotti: prodotti, totale: Number(r.totale) });
    c.totale = Math.round((c.totale + Number(r.totale)) * 100) / 100;
    totale += Number(r.totale);
  });
  const ordineClassi = classi();
  const elenco = Object.keys(perClasse).map(function (k) { return perClasse[k]; })
    .sort(function (a, b) { return ordineClassi.indexOf(a.classe) - ordineClassi.indexOf(b.classe); });
  const prodotti = Object.keys(perProdotto).sort().map(function (k) { return { prodotto: k, quantita: perProdotto[k] }; });
  return { ok: true, giorno: oggi, classi: elenco, prodotti: prodotti, totale: Math.round(totale * 100) / 100, oraLimite: ORA_LIMITE };
}

// Gli ordini servono solo per il giorno stesso: dopo GIORNI_CONSERVAZIONE giorni vengono cancellati.
function pulisciOrdiniVecchi(sh) {
  const limite = new Date(Date.now() - GIORNI_CONSERVAZIONE * 24 * 3600 * 1000);
  const vecchi = righeDi(sh, COLONNE_ORDINI).filter(function (r) { return new Date(r.data) < limite; });
  // Le righe sono in ordine di arrivo, quindi quelle vecchie sono tutte in cima.
  if (vecchi.length && vecchi[vecchi.length - 1].riga === vecchi.length + 1) sh.deleteRows(2, vecchi.length);
}

/* ---------- Pulizia spam ---------- */

// Da eseguire a mano dall'editor: cancella tutte le richieste arrivate oggi dalle 8:30 in poi.
// Per un altro orario cambiate '08:30' qui sotto.
function cancellaSpamDiOggi() {
  const oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  cancellaDal(Utilities.parseDate(oggi + ' 08:30', FUSO, 'yyyy-MM-dd HH:mm'));
}

function cancellaDal(inizio) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = foglio();
    const da = righe()
      .filter(function (r) { return new Date(r.data) >= inizio; })
      .map(function (r) { return r.riga; });
    // Dal basso verso l'alto, a blocchi di righe consecutive, così i numeri di riga restano validi.
    let i = da.length - 1;
    while (i >= 0) {
      let j = i;
      while (j > 0 && da[j - 1] === da[j] - 1) j--;
      sh.deleteRows(da[j], i - j + 1);
      i = j - 1;
    }
    console.log('Cancellate ' + da.length + ' richieste arrivate dal ' + Utilities.formatDate(inizio, FUSO, 'dd/MM/yyyy HH:mm') + '.');
  } finally {
    lock.releaseLock();
  }
}
