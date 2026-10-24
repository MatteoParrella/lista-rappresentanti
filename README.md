# Capolista – Sito richieste

Sito della lista **Capolista** (rappresentanti d'istituto, Villa Greppi) dove gli studenti inviano richieste **anonime** e i membri della lista le leggono e rispondono.

- `index.html` → **link per gli studenti** (`https://<progetto>.vercel.app/`) – pagina per gli studenti: modulo richiesta anonimo (niente nome, classe o contatti) + controllo dello stato con un codice.
- `admin.html` → **link per i membri** (`https://<progetto>.vercel.app/membri`) – area protetta da password: elenco, filtri, cambio stato, risposta allo studente.
- `apps-script/Code.gs` – backend gratuito su Google Apps Script; le richieste finiscono in un Google Sheet.

Costo: **0 €**. Sito su Vercel, dati su Google Sheets.

I due link sono separati: la pagina studenti non contiene nessun collegamento all'area membri.

## Provarlo subito

Apri `index.html` nel browser: senza configurazione gira in **modalità demo** (le richieste restano solo nel tuo browser, password admin: `demo`).

## Messa online (circa 10 minuti)

### 1. Backend (Google Sheets + Apps Script)

1. Con l'account Google della lista crea un nuovo **Google Sheet** (es. "Richieste Capolista").
2. Menu **Estensioni → Apps Script**.
3. Cancella il codice di esempio e incolla tutto il contenuto di `apps-script/Code.gs`. Salva.
4. A sinistra **⚙ Impostazioni progetto → Proprietà script → Aggiungi proprietà**:
   - Proprietà: `ADMIN_PASSWORD`
   - Valore: una password robusta da condividere solo tra i membri della lista.
5. In alto **Esegui il deployment → Nuovo deployment** → tipo **App web**:
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
6. Autorizza i permessi richiesti e copia l'**URL dell'app web** (finisce con `/exec`).

### 2. Collegare il sito

Apri `js/config.js` e incolla l'URL:

```js
window.CAPOLISTA_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
};
```

### 3. Pubblicare il sito (Vercel)

1. Accedete a [vercel.com](https://vercel.com) con GitHub → **Add New… → Project** → importate questo repository.
2. Framework Preset: **Other**. Non serve nessun comando di build: lasciate tutto vuoto → **Deploy**.
3. Il nome del progetto decide il link (es. `capolista` → `capolista.vercel.app`). Si cambia in **Settings → General**.

Avrete due link:

| Per chi | Link |
| --- | --- |
| Studenti (da mettere in bio su Instagram) | `https://capolista.vercel.app` |
| Membri della lista (da non condividere) | `https://capolista.vercel.app/membri` |

Ogni push sul branch principale aggiorna il sito da solo. Il routing è in `vercel.json`.

## Come la usano i membri

- Vanno su `/membri`, inseriscono la password e vedono tutte le richieste.
- Possono filtrarle, cambiare lo stato (Nuova / In lavorazione / Risolta / Non accolta) e scrivere una risposta.
- Lo studente, con il codice ricevuto dopo l'invio, vede stato e risposta dalla home.
- Tutte le richieste sono anche nel Google Sheet, comodo per esportarle o stamparle.

## Note

- Se modificate `Code.gs`, serve **Esegui il deployment → Gestisci deployment → Modifica → Nuova versione** perché le modifiche vadano online (l'URL resta lo stesso).
- Per cambiare la password basta modificare la proprietà `ADMIN_PASSWORD`.
- Per usare il vostro logo vero al posto del disegno della villa, sostituite `assets/villa.svg` (o cambiate il `src` dell'immagine in `index.html` e `admin.html`).
