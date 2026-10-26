# Capolista – Sito richieste

Sito della lista **Capolista** (rappresentanti d'istituto, Villa Greppi) dove gli studenti inviano richieste **anonime** e i membri della lista vedono cosa chiede la scuola.

- `index.html` → **link per gli studenti** (`https://<progetto>.vercel.app/`) – pagina per gli studenti: modulo richiesta anonimo (niente nome, classe o contatti).
- `membri/index.html` → **link per i membri** (`https://<progetto>.vercel.app/membri`) – area protetta da password: classifica delle categorie più richieste, elenco, filtri, ricerca.
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

Ogni push sul branch principale aggiorna il sito da solo. La pagina membri è nella cartella `membri/`, quindi il link funziona senza configurazioni speciali.

## Come la usano i membri

- Vanno su `/membri`, inseriscono la password e vedono tutte le richieste.
- In alto vedono i numeri (totale, ultime 24 ore, ultimi 7 giorni) e la classifica delle categorie più richieste.
- Possono filtrare per categoria, cercare per parola ed eliminare spam o messaggi offensivi.
- Tutte le richieste sono anche nel Google Sheet, comodo per esportarle o stamparle.

## Sicurezza

Il sito non usa un database SQL, quindi la "SQL injection" non è possibile. Sono coperti i rischi equivalenti:

- **Testo pericoloso nelle richieste**: tutto quello che scrivono gli studenti viene mostrato come semplice testo, mai come codice. In più gli header di sicurezza (`vercel.json`) impediscono al browser di eseguire script che non siano i nostri file.
- **Formule nel foglio**: un testo che inizia con `=`, `+`, `-`, `@` viene salvato con un apostrofo davanti, così Google Sheets non lo esegue.
- **Password**: viene inviata solo al momento dell'accesso. Il backend risponde con una chiave di sessione valida 4 ore; il browser salva solo quella (e la cancella quando si chiude la scheda). Dopo 8 password sbagliate l'accesso si blocca per 15 minuti per tutti; chi è già dentro resta dentro.
- **Spam**: massimo 40 richieste ogni 10 minuti per tutto il sito, una richiesta ogni 30 secondi dallo stesso browser, e lo stesso testo inviato due volte entro un'ora viene salvato una volta sola.
- **Pagina membri**: non viene indicizzata dai motori di ricerca, non viene salvata in cache e non può essere inserita dentro altri siti.

Usate una password lunga (almeno 12 caratteri, meglio una frase) e cambiatela se un membro lascia la lista.

## Note

- Se modificate `Code.gs`, serve **Esegui il deployment → Gestisci deployment → Modifica → Nuova versione** perché le modifiche vadano online (l'URL resta lo stesso).
- Per cambiare la password basta modificare la proprietà `ADMIN_PASSWORD`.
- Per usare il vostro logo vero al posto del disegno della villa, sostituite `assets/villa.svg` (o cambiate il `src` dell'immagine in `index.html` e `membri/index.html`).
