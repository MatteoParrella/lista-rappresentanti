/**
 * Backend del sito Capolista su Google Apps Script + Google Sheets.
 * Istruzioni di installazione nel README.md del repository.
 *
 * Proprietà dello script (Impostazioni progetto → Proprietà script):
 *   ADMIN_PASSWORD  password dell'area membri (obbligatoria)
 */

const FOGLIO = 'Richieste';
// Nessuna colonna identifica chi scrive: le richieste sono anonime.
// L'id serve solo ai membri per eliminare spam o messaggi offensivi.
const COLONNE = ['id', 'data', 'categoria', 'titolo', 'messaggio'];
const LIMITI = { categoria: 40, titolo: 120, messaggio: 3000 };

function doPost(e) {
  let esito;
  try {
    const dati = JSON.parse(e.postData.contents);
    switch (dati.azione) {
      case 'invia': esito = invia(dati); break;
      case 'lista': controllaPassword(dati); esito = lista(); break;
      case 'elimina': controllaPassword(dati); esito = elimina(dati); break;
      default: esito = { ok: false, errore: 'Azione sconosciuta.' };
    }
  } catch (err) {
    esito = { ok: false, errore: err.message || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(esito)).setMimeType(ContentService.MimeType.JSON);
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
  // L'apostrofo iniziale impedisce che il foglio interpreti il testo come formula.
  let s = String(valore == null ? '' : valore).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function controllaPassword(dati) {
  const giusta = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!giusta) throw new Error('ADMIN_PASSWORD non configurata nello script.');
  if (dati.password !== giusta) {
    Utilities.sleep(800); // rallenta i tentativi a raffica
    throw new Error('Password errata.');
  }
}

function nuovoCodice() {
  const caratteri = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 8; i++) c += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  return c;
}

function invia(dati) {
  if (dati.sito) return { ok: true }; // bot: finge successo, non salva
  const r = {};
  ['categoria', 'titolo', 'messaggio'].forEach(function (k) {
    r[k] = pulisci(dati[k], LIMITI[k]);
  });
  if (!r.categoria || !r.titolo || !r.messaggio) throw new Error('Compila categoria, oggetto e messaggio.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
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
    const r = righe().find(function (x) { return x.id === dati.id; });
    if (!r) throw new Error('Richiesta non trovata.');
    foglio().deleteRow(r.riga);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
