/**
 * Backend del sito Capolista su Google Apps Script + Google Sheets.
 * Istruzioni di installazione nel README.md del repository.
 *
 * Proprietà dello script (Impostazioni progetto → Proprietà script):
 *   ADMIN_PASSWORD  password dell'area membri (obbligatoria)
 *   INVII_CHIUSI    scrivete "si" per chiudere subito gli invii (es. durante un attacco di spam)
 *
 * Per cancellare in blocco lo spam: scegliete la funzione cancellaSpamDiOggi in alto
 * nell'editor e premete Esegui (vedi la funzione in fondo al file).
 */

const FOGLIO = 'Richieste';
// Nessuna colonna identifica chi scrive: le richieste sono anonime.
// L'id serve solo ai membri per eliminare spam o messaggi offensivi.
const COLONNE = ['id', 'data', 'categoria', 'titolo', 'messaggio'];
const LIMITI = { categoria: 40, titolo: 120, messaggio: 3000 };
const MAX_CORPO = 20000;          // byte massimi di una richiesta al backend
const DURATA_SESSIONE = 4 * 3600; // secondi di validità dell'accesso membri
const MAX_TENTATIVI = 8;          // password sbagliate prima del blocco
const BLOCCO = 15 * 60;           // secondi di blocco dopo troppi tentativi
const MAX_INVII = 20;             // richieste massime ogni 10 minuti per tutto il sito
const MAX_INVII_GIORNO = 150;     // richieste massime al giorno per tutto il sito
const FUSO = 'Europe/Rome';

function doPost(e) {
  let esito;
  try {
    const corpo = e && e.postData && e.postData.contents;
    if (!corpo || corpo.length > MAX_CORPO) throw new ErroreUtente('Richiesta non valida.');
    const dati = JSON.parse(corpo);
    if (!dati || typeof dati !== 'object') throw new ErroreUtente('Richiesta non valida.');
    switch (dati.azione) {
      case 'invia': esito = invia(dati); break;
      case 'accedi': esito = accedi(dati); break;
      case 'esci': esito = esci(dati); break;
      case 'lista': controllaSessione(dati); esito = lista(); break;
      case 'elimina': controllaSessione(dati); esito = elimina(dati); break;
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

function foglio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(FOGLIO);
  if (!sh) {
    sh = ss.insertSheet(FOGLIO);
    sh.appendRow(COLONNE);
    sh.getRange('A:A').setNumberFormat('@'); // i codici restano testo (es. "234567" o "MAY2")
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLONNE.length).setFontWeight('bold');
  }
  return sh;
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

// Confronto che impiega sempre lo stesso tempo, per non far indovinare la password a pezzi.
function uguali(a, b) {
  a = String(a); b = String(b);
  let diversi = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diversi |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diversi === 0;
}

function accedi(dati) {
  const giusta = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!giusta) throw new ErroreUtente('ADMIN_PASSWORD non configurata nello script.');
  const c = cache();
  // Apps Script non conosce l'IP di chi scrive: il conteggio dei tentativi è unico per tutti.
  if (c.get('blocco')) throw new ErroreUtente('Troppi tentativi sbagliati. Riprova tra 15 minuti.');
  if (typeof dati.password !== 'string' || !uguali(dati.password, giusta)) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const n = Number(c.get('tentativi') || 0) + 1;
      if (n >= MAX_TENTATIVI) {
        c.put('blocco', '1', BLOCCO);
        c.remove('tentativi');
      } else {
        c.put('tentativi', String(n), BLOCCO);
      }
    } finally {
      lock.releaseLock();
    }
    Utilities.sleep(1000);
    throw new ErroreUtente('Password errata.');
  }
  c.remove('tentativi');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  c.put('sessione_' + token, '1', DURATA_SESSIONE);
  return { ok: true, token: token };
}

function controllaSessione(dati) {
  if (typeof dati.token !== 'string' || !/^[0-9a-f]{64}$/.test(dati.token) || !cache().get('sessione_' + dati.token)) {
    throw new ErroreUtente('Sessione scaduta: accedi di nuovo.');
  }
}

function esci(dati) {
  if (typeof dati.token === 'string' && /^[0-9a-f]{64}$/.test(dati.token)) cache().remove('sessione_' + dati.token);
  return { ok: true };
}

function nuovoCodice() {
  const caratteri = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 8; i++) c += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  return c;
}

function invia(dati) {
  if (dati.sito) return { ok: true }; // bot: finge successo, non salva
  const chiusi = PropertiesService.getScriptProperties().getProperty('INVII_CHIUSI');
  if (chiusi && /^s/i.test(chiusi)) throw new ErroreUtente('Le richieste sono chiuse per qualche ora. Riprova più tardi.');
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
    const finestra = 'invii_' + Math.floor(Date.now() / 600000);
    const n = Number(c.get(finestra) || 0);
    if (n >= MAX_INVII) throw new ErroreUtente('Stiamo ricevendo troppe richieste. Riprova tra qualche minuto.');
    const giorno = 'invii_giorno_' + Utilities.formatDate(new Date(), FUSO, 'yyyyMMdd');
    const g = Number(c.get(giorno) || 0);
    if (g >= MAX_INVII_GIORNO) throw new ErroreUtente('Per oggi abbiamo ricevuto troppe richieste. Riprova domani.');
    c.put(finestra, String(n + 1), 900);
    c.put(giorno, String(g + 1), 25 * 3600);
    c.put(impronta, '1', 3600);
    foglio().appendRow([nuovoCodice(), new Date(), r.categoria, r.titolo, r.messaggio]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function righe() {
  const sh = foglio();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, COLONNE.length).getValues().map(function (v, i) {
    const o = { riga: i + 2 };
    COLONNE.forEach(function (k, j) { o[k] = v[j]; });
    o.id = String(o.id);
    o.data = o.data instanceof Date ? o.data.toISOString() : String(o.data);
    return o;
  });
}

function lista() {
  const tutte = righe().reverse().map(function (r) { delete r.riga; return r; });
  return { ok: true, richieste: tutte };
}

function elimina(dati) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (typeof dati.id !== 'string' || !dati.id) throw new ErroreUtente('Richiesta non trovata.');
    const r = righe().find(function (x) { return x.id === dati.id; });
    if (!r) throw new ErroreUtente('Richiesta non trovata.');
    foglio().deleteRow(r.riga);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

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
