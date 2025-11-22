// =======================================================
// === CONFIGURAZIONE GOOGLE API ===
// =======================================================

// !!! RICORDA: Sostituisci questo CLIENT_ID nel tuo index.html, non solo qui!
const CLIENT_ID = '198577538752-vc5aa0dshsflvqlnt221oig3h1451hao.apps.googleusercontent.com';
let gapi_token = null; // Token di accesso per le API
const SPREADSHEET_ID = 'IL_TUO_ID_FOGLIO_DI_CALCOLO'; // <<< DA SOSTITUIRE

// =======================================================
// === VARIABILI GLOBALI E ELEMENTI DOM ===
// =======================================================

let transactions = [];
let isLoggedIn = false;
let currentSpreadsheetId = null;

// Elementi DOM
const list = document.getElementById('list');
const balanceEl = document.getElementById('balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const descriptionEl = document.getElementById('description');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const addBtn = document.getElementById('add-btn');
const authStatusEl = document.getElementById('auth-status');
const appInterfaceEl = document.getElementById('app-interface');
// googleLoginBtn non è più usato, il widget GSI gestisce il pulsante

// =======================================================
// === LOGICA DI AUTENTICAZIONE E INIZIALIZZAZIONE API ===
// =======================================================

// 1. Funzione chiamata dal widget GSI dopo il login di successo
function handleCredentialResponse(response) {
    if (response.credential) {
        gapi.load('client', initClient);
    }
}

// 2. Inizializza il client API di Google
function initClient() {
    alert('init') ;
    gapi.client.init({
        clientId: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file', // Richiesta di permesso
        discoveryDocs: [
            "https://sheets.googleapis.com/$discovery/rest?version=v4",
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest" // Discovery per Drive API
        ],
    }).then(function () {
        alert('then') ;
        // Esegui il login se non già connesso e ottieni il token
        gapi.auth2.getAuthInstance().signIn().then(function() {
            // Ottieni il token di accesso reale
            gapi_token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            
            isLoggedIn = true;
            authStatusEl.textContent = 'Connesso e API pronte!';
            authStatusEl.style.color = '#2ecc71';
            appInterfaceEl.style.display = 'block';
            alert('carico...') ;
            // Carica i dati non appena l'accesso è completo
            loadTransactionsFromSheets(); 
        });
    }, function(error) {
        console.error("Errore durante l'inizializzazione di gapi:", error);
    });
}

// =======================================================
// === FUNZIONI GOOGLE SHEETS (LETURA E SCRITTURA) ===
// =======================================================

// FUNZIONE REALE PER IL SALVATAGGIO (APPEND)
async function saveTransactionToSheets(transaction) {
    if (!gapi_token) return;

    // Assicurati che l'ID del foglio sia disponibile
    const sheetId = await getOrCreateSheetId();
    if (!sheetId) return;

    const RANGE = 'Foglio1!A:D'; 

    const values = [
        [
            new Date().toISOString(), 
            transaction.description, 
            transaction.amount.toFixed(2), 
            transaction.type
        ]
    ];
    
    const body = { values: values };

    gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId, // Usa l'ID dinamico
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: body
    }).then((response) => {
        console.log('Transazione salvata:', response.result);
    }, (error) => {
        console.error('Errore nel salvataggio su Sheets:', error);
    });
}

/*
function saveTransactionToSheets(transaction) {
    if (!gapi_token || SPREADSHEET_ID === 'IL_TUO_ID_FOGLIO_DI_CALCOLO') {
        console.warn('Impossibile salvare: ID FOGLIO non impostato o token non disponibile.');
        return;
    }

    // Aggiunge la riga alla fine del foglio (ad esempio, Foglio1)
    const RANGE = 'Foglio1!A:D'; 

    const values = [
        [
            new Date().toISOString(), 
            transaction.description, 
            transaction.amount.toFixed(2), // Importo, assicurati che sia positivo/negativo correttamente
            transaction.type
        ]
    ];
    
    const body = {
        values: values
    };

    gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: body
    }).then((response) => {
        console.log('Transazione salvata:', response.result);
    }, (error) => {
        console.error('Errore nel salvataggio su Sheets:', error);
    });
}
*/

async function getOrCreateSheetId() {
    if (currentSpreadsheetId) return currentSpreadsheetId;
    
    const currentYear = new Date().getFullYear();
    const sheetTitle = `Dati Finanziari ${currentYear}`;
    
    // 1. Cerca il foglio esistente
    try {
        const searchResponse = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetTitle}' and trashed=false`,
            fields: 'files(id, name)'
        });
        
        const files = searchResponse.result.files;
        if (files.length > 0) {
            // Trovato! Usa il primo
            currentSpreadsheetId = files[0].id;
            console.log(`Foglio trovato: ${sheetTitle}`);
            return currentSpreadsheetId;
        }
    } catch (error) {
        console.error("Errore nella ricerca del foglio Drive:", error);
        // Continua provando a creare
    }

    // 2. Se non trovato, crea un nuovo foglio
    try {
        const createResponse = await gapi.client.sheets.spreadsheets.create({
            properties: {
                title: sheetTitle
            }
        });

        currentSpreadsheetId = createResponse.result.spreadsheetId;
        console.log(`Foglio creato: ${sheetTitle}`);
        
        // OPZIONALE: Aggiungi intestazioni al nuovo foglio
        await gapi.client.sheets.spreadsheets.values.update({
             spreadsheetId: currentSpreadsheetId,
             range: 'A1:D1',
             valueInputOption: 'USER_ENTERED',
             values: [['Data', 'Descrizione', 'Importo', 'Tipo']]
        });
        
        return currentSpreadsheetId;
    } catch (error) {
        console.error("Errore nella creazione del foglio Sheets:", error);
        return null; 
    }
}

// FUNZIONE REALE PER IL CARICAMENTO (GET)
function loadTransactionsFromSheets() {
    // QUI DEVI IMPLEMENTARE LA LOGICA REALE PER LEGGERE I DATI.
    // Per ora, useremo i dati di esempio per non rompere l'interfaccia.

    console.log('Simulazione: Caricamento dati di esempio...');
    
    // Dati di esempio (placeholder)
    transactions = [
        { id: 1, description: 'Stipendio', amount: 1500.00, type: 'income' },
        { id: 2, description: 'Affitto', amount: -650.00, type: 'expense' },
        { id: 3, description: 'Cibo', amount: -120.00, type: 'expense' }
    ];
    
    updateUI();
}


// =======================================================
// === LOGICA DELL'APPLICAZIONE (UI, Calcoli) ===
// =======================================================

// Genera un ID semplice
function generateID() {
    return transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
}

// FUNZIONE PRINCIPALE PER L'AGGIUNTA DI TRANSAZIONI
addBtn.addEventListener('click', () => {
    const description = descriptionEl.value.trim();
    const amount = parseFloat(amountEl.value);
    const type = typeEl.value;

    if (description === '' || isNaN(amount) || amount <= 0) {
        alert('Per favore, inserisci una descrizione valida e un importo positivo.');
        return;
    }

    // L'importo viene convertito in negativo solo per la visualizzazione e i calcoli locali
    const newAmount = (type === 'expense' ? -amount : amount);
    
    const newTransaction = {
        id: generateID(),
        description,
        amount: newAmount,
        type
    };

    transactions.push(newTransaction);
    
    // Aggiorna l'interfaccia
    addTransactionDOM(newTransaction);
    updateValues();
    
    // Invia la transazione a Google Sheets
    saveTransactionToSheets(newTransaction);

    // Resetta il form
    descriptionEl.value = '';
    amountEl.value = '';
});


// Aggiunge la transazione all'elenco DOM
function addTransactionDOM(transaction) {
    const sign = transaction.amount > 0 ? '+' : '';
    const itemClass = transaction.type === 'income' ? 'income' : 'expense';

    const item = document.createElement('li');
    item.classList.add(itemClass);
    item.innerHTML = `
        <span class="transaction-description">${transaction.description}</span>
        <span class="transaction-amount">${sign}€ ${Math.abs(transaction.amount).toFixed(2)}</span>
        <button onclick="removeTransaction(${transaction.id})" class="delete-btn">x</button>
    `;

    list.appendChild(item);
}

// Aggiorna i valori totali (Saldo, Entrate, Uscite)
function updateValues() {
    const incomeAmounts = transactions
        .filter(item => item.amount > 0)
        .map(item => item.amount);

    const expenseAmounts = transactions
        .filter(item => item.amount < 0)
        .map(item => item.amount);

    const totalIncome = incomeAmounts
        .reduce((acc, item) => acc + item, 0)
        .toFixed(2);

    const totalExpense = expenseAmounts
        .reduce((acc, item) => acc + item, 0)
        .toFixed(2);

    const totalBalance = (parseFloat(totalIncome) + parseFloat(totalExpense)).toFixed(2);
    
    balanceEl.style.color = totalBalance >= 0 ? '#27ae60' : '#e74c3c';

    balanceEl.textContent = `€ ${totalBalance}`;
    totalIncomeEl.textContent = `€ ${totalIncome}`;
    totalExpenseEl.textContent = `€ ${Math.abs(totalExpense).toFixed(2)}`;
}

// Rimuove una transazione
function removeTransaction(id) {
    transactions = transactions.filter(transaction => transaction.id !== id);
    updateUI();
    
    // NOTA: Implementare qui l'eliminazione da Google Sheets.
    console.log(`Simulazione: Transazione con ID ${id} eliminata. (Implementare DELETE/UPDATE su Sheets)`);
}

// Ridisegna completamente l'interfaccia
function updateUI() {
    list.innerHTML = ''; // Svuota la lista
    transactions.forEach(addTransactionDOM);
    updateValues();
}
