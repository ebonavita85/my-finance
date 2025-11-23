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
let monthlyChartInstance = null; // Riferimento all'oggetto Chart.js

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
// 1. Funzione chiamata dal widget GSI dopo l'autenticazione dell'utente (ID Token ricevuto)
function handleCredentialResponse(response) {
    if (response.credential) {
        // La fase 1 (Autenticazione ID) è completata. Carichiamo la libreria GAPI
        gapi.load('client', initClient);
    }
}

// 2. Inizializza il client GAPI e il client per l'autorizzazione (Access Token)
function initClient() {
    // Inizializza GAPI client (non l'autenticazione)
    gapi.client.init({
        // Non passiamo clientId o scope qui, lo farà tokenClient
        discoveryDocs: [
            "https://sheets.googleapis.com/$discovery/rest?version=v4",
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest" 
        ],
    }).then(function () {
        
        // 3. Inizializza il Token Client (GSI) per richiedere l'Access Token e gli SCOPE
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            callback: (tokenResponse) => {
                // Funzione eseguita quando l'utente autorizza gli scope
                if (tokenResponse && tokenResponse.access_token) {
                    
                    // 4. Imposta l'Access Token nella libreria GAPI per le chiamate API
                    gapi.client.setToken({ access_token: tokenResponse.access_token });
                    gapi_token = tokenResponse.access_token; 
                    
                    isLoggedIn = true;
                    authStatusEl.textContent = 'Connesso e API pronte!';
                    authStatusEl.style.color = '#2ecc71';
                    appInterfaceEl.style.display = 'block';
                    
                    loadTransactionsFromSheets(); 
                } else {
                    alert("Autorizzazione API (Access Token) fallita o token non ricevuto.");
                }
            },
        });
        
        // 5. Richiede l'Access Token (mostrando il popup di autorizzazione degli scope)
        tokenClient.requestAccessToken();
        
    }, function(error) {
        // Errore di inizializzazione GAPI (es. discovery docs errati)
        let errorMessage = "Errore sconosciuto durante l'inizializzazione.";
        if (error && error.details) {
             errorMessage = error.details;
        } else if (error && error.message) {
             errorMessage = error.message;
        }
        
        alert(`ERRORE INIZIALIZZAZIONE GAPI:\n${errorMessage}`);
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


async function loadTransactionsFromSheets() {
    // 1. Ottieni o crea l'ID del foglio corrente
    const sheetId = await getOrCreateSheetId();
    
    if (!sheetId) {
        transactions = []; // Nessun ID, nessun dato
        updateUI();
        return;
    }
    
    // Leggiamo i dati dal Foglio1, partendo dalla riga 2 (dopo le intestazioni)
    const RANGE = 'Foglio1!A2:D'; 

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: RANGE,
        });

        const rows = response.result.values;
        
        if (rows && rows.length) {
            // Trasforma i dati in righe nell'oggetto 'transactions'
            transactions = rows.map((row, index) => {
                const amount = parseFloat(row[2]); // L'importo è nella colonna C (indice 2)
                const type = row[3] ? row[3].toLowerCase() : 'expense'; // Tipo è nella colonna D (indice 3)
                
                return {
                    // Usiamo index come ID temporaneo. In produzione è meglio un ID univoco.
                    id: index + 1, 
                    description: row[1] || 'N/D',
                    amount: amount, // L'importo deve già essere negativo per le uscite
                    type: type, 
                    date: row[0]
                };
            });
            console.log(`✅ Caricati ${transactions.length} transazioni da Sheets.`);
        } else {
            console.log('Foglio vuoto: Nessuna transazione trovata.');
            transactions = [];
        }

    } catch (error) {
        console.error("❌ Errore nella lettura da Sheets:", error);
        alert("Errore di lettura dati: Impossibile recuperare le transazioni dal Foglio Google.");
        transactions = [];
    }
    
    // Infine, aggiorna l'interfaccia con i dati (anche se vuoti)
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

// Funzione: Calcola i saldi aggregati per mese
function calculateMonthlyBalances() {
    const monthlyData = {};

    transactions.forEach(t => {
        // Supponiamo che la colonna 'Data' sia sempre disponibile per le transazioni reali
        // Qui usiamo la data corrente come fallback se la transazione non ha data
        const date = new Date(t.date || Date.now()); 
        
        // Formatta come 'YYYY-MM' (es. 2025-11) per raggruppare
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = {
                income: 0,
                expense: 0,
                balance: 0
            };
        }

        const amount = parseFloat(t.amount);
        
        if (amount > 0) {
            monthlyData[yearMonth].income += amount;
        } else {
            monthlyData[yearMonth].expense += amount;
        }
        monthlyData[yearMonth].balance += amount;
    });

    // Trasforma l'oggetto in un array ordinato per Chart.js
    return Object.keys(monthlyData)
        .sort()
        .map(key => ({
            month: key,
            balance: monthlyData[key].balance.toFixed(2)
        }));
}

function renderMonthlyChart() {
    const data = calculateMonthlyBalances();
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    // Se esiste una vecchia istanza del grafico, distruggila prima di crearne una nuova
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }
    
    // Mappa i dati per Chart.js
    const labels = data.map(item => item.month);
    const balances = data.map(item => item.balance);

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Saldo Mensile',
                data: balances,
                backgroundColor: balances.map(b => b >= 0 ? '#2ecc71' : '#e74c3c'), // Verde o Rosso
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Saldo (€)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mese'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Bilancio Mensile Aggregato'
                }
            }
        }
    });
}


// Ridisegna completamente l'interfaccia
function updateUI() {
    list.innerHTML = ''; // Svuota la lista
    transactions.forEach(addTransactionDOM);
    updateValues();
    renderMonthlyChart();
}
