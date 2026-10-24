# Capolista – Sito richieste

Sito della lista **Capolista** (rappresentanti d'istituto, Villa Greppi) dove gli studenti inviano richieste e i rappresentanti le leggono e rispondono.

- `index.html` – pagina pubblica: modulo richiesta (anche anonima) + controllo dello stato con un codice.
- `admin.html` – area rappresentanti protetta da password: elenco, filtri, cambio stato, risposta allo studente.
- `apps-script/Code.gs` – backend gratuito su Google Apps Script; le richieste finiscono in un Google Sheet.

Costo: **0 €**. Sito su GitHub Pages, dati su Google Sheets.

## Provarlo subito

Apri `index.html` nel browser: senza configurazione gira in **modalità demo** (le richieste restano solo nel tuo browser, password admin: `demo`).

## Messa online (circa 10 minuti)

### 1. Backend (Google Sheets + Apps Script)

1. Con l'account Google della lista crea un nuovo **Google Sheet** (es. "Richieste Capolista").
2. Menu **Estensioni → Apps Script**.
3. Cancella il codice di esempio e incolla tutto il contenuto di `apps-script/Code.gs`. Salva.
4. A sinistra **⚙ Impostazioni progetto → Proprietà script → Aggiungi proprietà**:
   - Proprietà: `ADMIN_PASSWORD`
   - Valore: una password robusta da condividere solo tra i rappresentanti.
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

### 3. Pubblicare il sito (GitHub Pages)

Nel repository: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / root** → Save.
Dopo un minuto il sito è su `https://<utente>.github.io/lista-rappresentanti/`. Mettete il link in bio su Instagram.

## Come lo usano i rappresentanti

- Vanno su `/admin.html`, inseriscono la password e vedono tutte le richieste.
- Possono filtrarle, cambiare lo stato (Nuova / In lavorazione / Risolta / Non accolta) e scrivere una risposta.
- Lo studente, con il codice ricevuto dopo l'invio, vede stato e risposta dalla home.
- Tutte le richieste sono anche nel Google Sheet, comodo per esportarle o stamparle.

## Note

- Se modificate `Code.gs`, serve **Esegui il deployment → Gestisci deployment → Modifica → Nuova versione** perché le modifiche vadano online (l'URL resta lo stesso).
- Per cambiare la password basta modificare la proprietà `ADMIN_PASSWORD`.
- Per usare il vostro logo vero al posto del disegno della villa, sostituite `assets/villa.svg` (o cambiate il `src` dell'immagine in `index.html` e `admin.html`).
