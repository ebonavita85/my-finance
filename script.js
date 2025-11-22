// VARIABILI GLOBALI
let transactions = [];
let isLoggedIn = false;

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
const googleLoginBtn = document.getElementById('google-login-btn');


// --- LOGICA DI AUTENTICAZIONE (SIMULATA) ---

googleLoginBtn.addEventListener('click', () => {
    // In una vera app, qui si attiverebbe la finestra di Google Sign-In.
    // Una volta ricevuta la risposta di successo (e il token di accesso),
    // si imposterebbe isLoggedIn su true e si aggiornerebbe l'interfaccia.
    
    // Simulazione di accesso riuscito:
    if (!isLoggedIn) {
        isLoggedIn = true;
        authStatusEl.textContent = 'Connesso come utente Google.';
        authStatusEl.style.color = '#2ecc71';
        appInterfaceEl.style.display = 'block';
        googleLoginBtn.textContent = 'Disconnetti';
        // Inizializza o carica i dati da Google Sheets qui
        loadTransactionsFromSheets(); 
    } else {
        isLoggedIn = false;
        authStatusEl.textContent = 'Disconnesso';
        authStatusEl.style.color = '#7f8c8d';
        appInterfaceEl.style.display = 'none';
        googleLoginBtn.textContent = 'Accedi con Google (Simulato)';
    }
});

// FUNZIONE PLACEHOLDER PER GOOGLE SHEETS
function loadTransactionsFromSheets() {
    // QUI DOVRESTI INSERIRE LA LOGICA PER CHIAMARE LE GOOGLE SHEETS API
    // Utilizzando il token di accesso dell'utente.

    // Per ora, carica transazioni di esempio
    transactions = [
        { id: 1, description: 'Stipendio', amount: 1500.00, type: 'income' },
        { id: 2, description: 'Affitto', amount: -650.00, type: 'expense' },
        { id: 3, description: 'Cibo', amount: -120.00, type: 'expense' }
    ];
    updateUI();
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
    
    // Invia la transazione a Google Sheets (Placeholder)
    saveTransactionToSheets(newTransaction);

    // Resetta il form
    descriptionEl.value = '';
    amountEl.value = '';
});

// Genera un ID semplice
function generateID() {
    return transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
}

// FUNZIONE PLACEHOLDER PER GOOGLE SHEETS (SALVATAGGIO)
function saveTransactionToSheets(transaction) {
    // QUI DOVRESTI INSERIRE LA LOGICA PER INVIARE LA NUOVA RIGA
    // AL TUO FOGLIO GOOGLE TRAMITE LE API.
    
    console.log('Simulazione: Transazione inviata a Google Sheets:', transaction);
    // Esempio: 
    /* const data = [
        [new Date().toISOString(), transaction.description, transaction.amount, transaction.type]
    ];
    gapi.client.sheets.spreadsheets.values.append({...});
    */
}


// --- GESTIONE INTERFACCIA UTENTE ---

// Aggiunge la transazione all'elenco DOM
function addTransactionDOM(transaction) {
    // Determina la classe CSS e il segno
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
    
    // Aggiorna il colore del saldo totale
    balanceEl.style.color = totalBalance >= 0 ? '#27ae60' : '#e74c3c';

    balanceEl.textContent = `€ ${totalBalance}`;
    totalIncomeEl.textContent = `€ ${totalIncome}`;
    totalExpenseEl.textContent = `€ ${Math.abs(totalExpense).toFixed(2)}`;
}

// Rimuove una transazione
function removeTransaction(id) {
    // Rimuovi dalla lista locale
    transactions = transactions.filter(transaction => transaction.id !== id);
    
    // Aggiorna l'interfaccia e ricalcola i totali
    updateUI();
    
    // NOTA: In una vera applicazione, dovresti anche eliminare la riga da Google Sheets qui.
    console.log(`Simulazione: Transazione con ID ${id} eliminata. (Devi implementare l'eliminazione su Google Sheets)`);
}

// Ridisegna completamente l'interfaccia
function updateUI() {
    list.innerHTML = ''; // Svuota la lista
    transactions.forEach(addTransactionDOM);
    updateValues();
}

// Inizializzazione al caricamento della pagina
// Non chiamiamo loadTransactionsFromSheets qui, 
// attendiamo il login (simulato) per caricarle.
// updateUI(); 
