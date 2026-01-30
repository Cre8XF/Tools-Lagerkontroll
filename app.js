/**
 * Lagerkontroll - Etterfyllingsregistrering
 * Enkelt webverktøy for å registrere behov ved lagergjennomgang
 *
 * Funksjoner:
 * - Start ny runde med lokasjon, avdeling, etc.
 * - Registrer artikkellinjer med nummer, antall og kommentar
 * - Automatisk dato og uke
 * - Eksport til CSV
 * - Offline-first med localStorage
 */

// Global tilstand
let currentRound = null;

// DOM-elementer
const startView = document.getElementById('startView');
const registrationView = document.getElementById('registrationView');
const startForm = document.getElementById('startForm');
const itemForm = document.getElementById('itemForm');
const itemsList = document.getElementById('itemsList');
const itemCount = document.getElementById('itemCount');
const finishRoundBtn = document.getElementById('finishRoundBtn');
const cancelRoundBtn = document.getElementById('cancelRoundBtn');

// Visningselementer for rundeinfo
const displayLocation = document.getElementById('displayLocation');
const displayDepartment = document.getElementById('displayDepartment');
const displayDate = document.getElementById('displayDate');
const displayWeek = document.getElementById('displayWeek');

/**
 * Hent ISO-ukenummer for en gitt dato
 * @param {Date} date - Datoobjekt
 * @returns {number} ISO-ukenummer
 */
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

/**
 * Formater dato til YYYY-MM-DD
 * @param {Date} date - Datoobjekt
 * @returns {string} Formatert dato
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Last inn runde fra localStorage
 */
function loadRoundFromStorage() {
    const stored = localStorage.getItem('currentRound');
    if (stored) {
        try {
            currentRound = JSON.parse(stored);
            showRegistrationView();
        } catch (e) {
            console.error('Feil ved lasting av runde:', e);
            localStorage.removeItem('currentRound');
        }
    }
}

/**
 * Lagre runde til localStorage
 */
function saveRoundToStorage() {
    if (currentRound) {
        localStorage.setItem('currentRound', JSON.stringify(currentRound));
    }
}

/**
 * Start en ny runde
 * @param {Event} e - Form submit event
 */
function startRound(e) {
    e.preventDefault();

    const location = document.getElementById('location').value.trim();
    const department = document.getElementById('department').value.trim();
    const csvFilename = document.getElementById('csvFilename').value.trim();
    const registeredBy = document.getElementById('registeredBy').value.trim();

    const now = new Date();
    const date = formatDate(now);
    const week = getISOWeek(now);

    currentRound = {
        location: location,
        department: department || '',
        csvFilename: csvFilename,
        registeredBy: registeredBy || '',
        date: date,
        week: week,
        items: []
    };

    saveRoundToStorage();
    showRegistrationView();
    startForm.reset();
}

/**
 * Vis registreringsvisningen
 */
function showRegistrationView() {
    startView.classList.add('hidden');
    registrationView.classList.remove('hidden');

    // Oppdater visningselementer
    displayLocation.textContent = currentRound.location;
    displayDepartment.textContent = currentRound.department || '(ikke angitt)';
    displayDate.textContent = currentRound.date;
    displayWeek.textContent = currentRound.week;

    updateItemsList();
}

/**
 * Vis startvisningen
 */
function showStartView() {
    registrationView.classList.add('hidden');
    startView.classList.remove('hidden');
}

/**
 * Legg til en ny artikkel
 * @param {Event} e - Form submit event
 */
function addItem(e) {
    e.preventDefault();

    const articleNumber = document.getElementById('articleNumber').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value);
    const comment = document.getElementById('comment').value.trim();

    const item = {
        id: Date.now(), // Enkel ID basert på timestamp
        articleNumber: articleNumber,
        quantity: quantity,
        comment: comment || ''
    };

    currentRound.items.push(item);
    saveRoundToStorage();
    updateItemsList();
    itemForm.reset();

    // Sett fokus tilbake til artikkelnummer-feltet
    document.getElementById('articleNumber').focus();
}

/**
 * Slett en artikkel
 * @param {number} itemId - ID til artikkelen som skal slettes
 */
function deleteItem(itemId) {
    if (confirm('Er du sikker på at du vil slette denne linjen?')) {
        currentRound.items = currentRound.items.filter(item => item.id !== itemId);
        saveRoundToStorage();
        updateItemsList();
    }
}

/**
 * Oppdater visningen av artikler
 */
function updateItemsList() {
    itemCount.textContent = currentRound.items.length;

    if (currentRound.items.length === 0) {
        itemsList.innerHTML = '<p class="empty-message">Ingen linjer registrert ennå.</p>';
        return;
    }

    itemsList.innerHTML = currentRound.items.map(item => `
        <div class="item">
            <div class="item-header">
                <span class="item-article">${escapeHtml(item.articleNumber)}</span>
                <span class="item-quantity">× ${item.quantity}</span>
            </div>
            ${item.comment ? `<div class="item-comment">${escapeHtml(item.comment)}</div>` : ''}
            <button class="item-delete" onclick="deleteItem(${item.id})">🗑️ Slett</button>
        </div>
    `).join('');
}

/**
 * Escape HTML for å unngå XSS
 * @param {string} text - Tekst som skal escapes
 * @returns {string} Escapet tekst
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Generer CSV-innhold
 * @returns {string} CSV-innhold
 */
function generateCSV() {
    // CSV-header
    const headers = ['dato', 'uke', 'lokasjon', 'avdeling', 'artikkelnummer', 'antall', 'kommentar', 'registrert_av'];

    // CSV-rader
    const rows = currentRound.items.map(item => {
        return [
            currentRound.date,
            currentRound.week,
            escapeCSV(currentRound.location),
            escapeCSV(currentRound.department),
            escapeCSV(item.articleNumber),
            item.quantity,
            escapeCSV(item.comment),
            escapeCSV(currentRound.registeredBy)
        ];
    });

    // Kombiner header og rader
    const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
    ].join('\n');

    return csvContent;
}

/**
 * Escape CSV-felt (håndterer komma, anførselstegn, linjeskift)
 * @param {string} field - Felt som skal escapes
 * @returns {string} Escapet felt
 */
function escapeCSV(field) {
    if (field === undefined || field === null) {
        return '';
    }

    const stringField = String(field);

    // Hvis feltet inneholder komma, anførselstegn eller linjeskift, må det omsluttes av anførselstegn
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        // Doble anførselstegn må escapes
        return `"${stringField.replace(/"/g, '""')}"`;
    }

    return stringField;
}

/**
 * Generer filnavn for CSV
 * @returns {string} Filnavn
 */
function generateFilename() {
    // Format: <csv-filnavn>_<lokasjon>_<dato>.csv
    const safeCsvFilename = currentRound.csvFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeLocation = currentRound.location.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeCsvFilename}_${safeLocation}_${currentRound.date}.csv`;
}

/**
 * Last ned CSV-fil
 * @param {string} content - CSV-innhold
 * @param {string} filename - Filnavn
 */
function downloadCSV(content, filename) {
    // Legg til BOM for korrekt UTF-8-håndtering i Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Avslutt runde og eksporter til CSV
 */
function finishRound() {
    if (currentRound.items.length === 0) {
        alert('Du må registrere minst én linje før du kan avslutte runden.');
        return;
    }

    if (confirm(`Avslutt runde og eksporter ${currentRound.items.length} linjer til CSV?`)) {
        const csvContent = generateCSV();
        const filename = generateFilename();

        downloadCSV(csvContent, filename);

        // Rydd opp
        localStorage.removeItem('currentRound');
        currentRound = null;
        showStartView();

        alert(`CSV-fil "${filename}" er lastet ned!`);
    }
}

/**
 * Avbryt runde og slett data
 */
function cancelRound() {
    if (confirm('Er du sikker på at du vil slette hele runden og starte på nytt? Alle registrerte linjer vil gå tapt.')) {
        localStorage.removeItem('currentRound');
        currentRound = null;
        showStartView();
    }
}

/**
 * Initialiser app
 */
function init() {
    // Event listeners
    startForm.addEventListener('submit', startRound);
    itemForm.addEventListener('submit', addItem);
    finishRoundBtn.addEventListener('click', finishRound);
    cancelRoundBtn.addEventListener('click', cancelRound);

    // Last inn eksisterende runde hvis den finnes
    loadRoundFromStorage();
}

// Start appen når DOM er klar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
