/**
 * AVATOUR Admin - POI Manager
 */

// API_BASE e AUTH_KEY sono definiti in admin.js e auth.js
// fetchAuthAPI è definito in admin.js

let allPOIs = [];
let allClients = [];
let currentMap = null;
let currentMarker = null;

/**
 * Carica la lista dei clienti dall'API
 */
async function loadClientsForDropdown() {
    try {
        allClients = await fetchAuthAPI('/admin/clients');
        if (!Array.isArray(allClients)) {
            allClients = [];
        }
        return allClients;
    } catch (error) {
        console.error('Errore caricamento clienti:', error);
        allClients = [];
        return [];
    }
}

/**
 * Popola un dropdown con i clienti
 */
function populateClientDropdown(selectElement, includeEmpty = true) {
    if (!selectElement) return;

    // Salva valore corrente se presente
    const currentValue = selectElement.value;

    // Svuota e ripopola
    selectElement.innerHTML = '';

    if (includeEmpty) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Seleziona cliente';
        selectElement.appendChild(emptyOption);
    }

    allClients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.slug;
        option.textContent = `${client.slug} - ${client.name}`;
        selectElement.appendChild(option);
    });

    // Ripristina valore se presente
    if (currentValue) {
        selectElement.value = currentValue;
    }
}

/**
 * Popola il dropdown filtro clienti nella lista POI
 */
async function populateFilterClientDropdown() {
    const filterSelect = document.getElementById('filterClient');
    if (!filterSelect) return;

    await loadClientsForDropdown();

    // Mantieni l'opzione "Tutti i clienti"
    filterSelect.innerHTML = '<option value="">Tutti i clienti</option>';

    allClients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.slug;
        option.textContent = `${client.slug} - ${client.name}`;
        filterSelect.appendChild(option);
    });
}

/**
 * Carica la lista di tutti i POI (usa endpoint autenticato)
 */
async function loadPOIsList() {
    try {
        // Prima carica i clienti per il dropdown filtro
        await populateFilterClientDropdown();

        // Usa fetchAuthAPI definito in admin.js per chiamare endpoint autenticato
        allPOIs = await fetchAuthAPI('/admin/pois');

        // Verifica che sia un array
        if (!Array.isArray(allPOIs)) {
            console.error('I dati ricevuti non sono un array:', allPOIs);
            throw new Error('Formato dati non valido');
        }

        // Leggi parametro client da URL se presente
        const urlParams = new URLSearchParams(window.location.search);
        const clientFromUrl = urlParams.get('client');

        // Se c'è un filtro client nell'URL, pre-selezionalo
        if (clientFromUrl) {
            const filterSelect = document.getElementById('filterClient');
            if (filterSelect) {
                filterSelect.value = clientFromUrl;
            }
        }

        setupFilters();

        // Applica il filtro (mostrerà filtrato se c'è parametro URL)
        filterPOIs();
    } catch (error) {
        console.error('Errore caricamento POI:', error);
        document.getElementById('poisTableBody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; padding: 40px; color: red;">
                Errore caricamento POI: ${error.message}
            </td></tr>
        `;
    }
}

/**
 * Mostra la lista dei POI nella tabella
 */
function displayPOIsList(pois) {
    const tbody = document.getElementById('poisTableBody');

    if (!pois || pois.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Nessun POI trovato</td></tr>';
        return;
    }

    tbody.innerHTML = pois.map(poi => {
        // Il backend ora ritorna client: {slug, name} invece di client_slug
        const clientSlug = poi.client?.slug || poi.client_slug || 'N/A';

        return `
            <tr>
                <td><code>${poi.poi_code}</code></td>
                <td>${poi.name}</td>
                <td>${clientSlug}</td>
                <td>${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}</td>
                <td>${(poi.languages || []).map(l => l.toUpperCase()).join(', ')}</td>
                <td>
                    <button onclick="showQRModal('${poi.poi_code}', '${poi.name.replace(/'/g, "\\'")}')" class="btn-qr" title="QR Code">📱</button>
                </td>
                <td>
                    <a href="poi-edit.html?code=${poi.poi_code}" class="btn-sm">✏️ Modifica</a>
                    <button onclick="openDeleteModal('${poi.poi_code}', '${poi.name.replace(/'/g, "\\'")}')" class="btn-sm btn-danger" style="margin-left: 8px;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Setup filtri di ricerca
 */
function setupFilters() {
    const searchInput = document.getElementById('searchPOI');
    const filterClient = document.getElementById('filterClient');

    if (searchInput) {
        searchInput.addEventListener('input', filterPOIs);
    }

    if (filterClient) {
        filterClient.addEventListener('change', filterPOIs);
    }
}

/**
 * Filtra i POI in base ai criteri
 */
function filterPOIs() {
    const searchTerm = document.getElementById('searchPOI').value.toLowerCase();
    const clientFilter = document.getElementById('filterClient').value;

    const filtered = allPOIs.filter(poi => {
        const matchesSearch = poi.name.toLowerCase().includes(searchTerm) ||
                            poi.poi_code.toLowerCase().includes(searchTerm);
        // Il backend ritorna client: {slug, name} invece di client_slug
        const clientSlug = poi.client?.slug || poi.client_slug || '';
        const matchesClient = !clientFilter || clientSlug === clientFilter;

        return matchesSearch && matchesClient;
    });

    displayPOIsList(filtered);
}

/**
 * Inizializza il form di aggiunta POI
 */
async function initPOIForm() {
    // Carica clienti per dropdown
    await loadClientsForDropdown();
    const clientSelect = document.getElementById('clientSlug');
    populateClientDropdown(clientSelect, true);

    // Genera codice POI automaticamente
    setupPOICodeGenerator();

    // Inizializza mappa
    initMapPicker();

    // Gestione lingue selezionate
    setupLanguageSelection();

    // Handle form submit
    const form = document.getElementById('poiForm');
    if (form) {
        form.addEventListener('submit', handlePOISubmit);
    }
}

/**
 * Setup generatore codice POI
 */
function setupPOICodeGenerator() {
    const clientSlugInput = document.getElementById('clientSlug');
    const poiNumberInput = document.getElementById('poiNumber');
    const generatedCodeEl = document.getElementById('generatedCode');

    function updateCode() {
        const client = clientSlugInput.value;
        const number = poiNumberInput.value;

        if (client && number) {
            const code = `${client}-${String(number).padStart(3, '0')}`;
            generatedCodeEl.textContent = code;
        } else {
            generatedCodeEl.textContent = '-';
        }
    }

    clientSlugInput.addEventListener('change', updateCode);
    poiNumberInput.addEventListener('input', updateCode);
}

/**
 * Inizializza il map picker con Leaflet
 */
function initMapPicker() {
    const mapContainer = document.getElementById('mapPicker');
    if (!mapContainer) return;

    // Default center
    const defaultLat = 40.0292;
    const defaultLng = 15.2794;

    currentMap = L.map('mapPicker').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(currentMap);

    // Aggiungi marker iniziale
    currentMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(currentMap);

    // Update inputs quando si muove il marker
    currentMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        document.getElementById('lat').value = pos.lat.toFixed(6);
        document.getElementById('lng').value = pos.lng.toFixed(6);
    });

    // Click sulla mappa per spostare il marker
    currentMap.on('click', function(e) {
        currentMarker.setLatLng(e.latlng);
        document.getElementById('lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('lng').value = e.latlng.lng.toFixed(6);
    });

    // Update marker quando cambiano gli input
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    function updateMarkerFromInputs() {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);

        if (!isNaN(lat) && !isNaN(lng)) {
            currentMarker.setLatLng([lat, lng]);
            currentMap.setView([lat, lng], 13);
        }
    }

    latInput.addEventListener('change', updateMarkerFromInputs);
    lngInput.addEventListener('change', updateMarkerFromInputs);
}

/**
 * Gestione selezione lingue e input video dinamici
 */
function setupLanguageSelection() {
    const languageCheckboxes = document.querySelectorAll('input[name="languages"]');
    const videoInputsContainer = document.getElementById('videoInputs');

    function updateVideoInputs() {
        const selectedLanguages = Array.from(languageCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        if (selectedLanguages.length === 0) {
            videoInputsContainer.innerHTML = '<p style="color: #6b7280;">Seleziona almeno una lingua per configurare i video</p>';
            return;
        }

        const langNames = {
            it: '🇮🇹 Italiano',
            en: '🇬🇧 Inglese',
            de: '🇩🇪 Tedesco',
            fr: '🇫🇷 Francese',
            es: '🇪🇸 Spagnolo'
        };

        videoInputsContainer.innerHTML = selectedLanguages.map(lang => `
            <div class="video-input-group">
                <div class="video-input-header">
                    ${langNames[lang]}
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="video_host_${lang}">Host Video</label>
                        <select id="video_host_${lang}" name="video_host_${lang}" required>
                            <option value="vimeo">Vimeo</option>
                            <option value="cloudflare">Cloudflare Stream</option>
                            <option value="local">File Locale</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="video_id_${lang}">Video ID *</label>
                        <input type="text" id="video_id_${lang}" name="video_id_${lang}"
                               placeholder="es: 123456789" required>
                        <small>ID del video su Vimeo, Cloudflare o nome file locale</small>
                    </div>
                </div>
            </div>
        `).join('');
    }

    languageCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateVideoInputs);
    });

    // Init
    updateVideoInputs();
}

/**
 * Gestisce il submit del form POI
 */
async function handlePOISubmit(e) {
    e.preventDefault();

    const formData = collectPOIFormData();

    try {
        // Chiama API per creare POI (usa fetchAuthAPI per autenticazione)
        await fetchAuthAPI('/admin/poi', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        alert('POI creato con successo!');
        window.location.href = 'poi-list.html';

    } catch (error) {
        console.error('Errore salvataggio POI:', error);
        alert('Errore durante il salvataggio del POI');
    }
}

/**
 * Raccoglie i dati dal form
 */
function collectPOIFormData() {
    const clientSlug = document.getElementById('clientSlug').value;
    const poiNumber = document.getElementById('poiNumber').value;
    const poi_code = `${clientSlug}-${String(poiNumber).padStart(3, '0')}`;

    const languages = Array.from(document.querySelectorAll('input[name="languages"]:checked'))
        .map(cb => cb.value);

    const videos = {};
    languages.forEach(lang => {
        const host = document.getElementById(`video_host_${lang}`).value;
        const video_id = document.getElementById(`video_id_${lang}`).value;

        videos[lang] = { host, video_id };
    });

    return {
        poi_code,
        client_slug: clientSlug,
        name: document.getElementById('poiName').value,
        description: document.getElementById('poiDescription')?.value || '',
        address: document.getElementById('poiAddress')?.value || '',
        lat: parseFloat(document.getElementById('lat').value),
        lng: parseFloat(document.getElementById('lng').value),
        languages,
        videos
    };
}

/**
 * Inizializza il form di modifica POI
 */
async function initPOIEditForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const poiCode = urlParams.get('code');

    if (!poiCode) {
        alert('Codice POI mancante');
        window.location.href = 'poi-list.html';
        return;
    }

    try {
        // Carica clienti per dropdown
        await loadClientsForDropdown();
        const clientSelect = document.getElementById('clientSlug');
        populateClientDropdown(clientSelect, false);

        // Carica POI
        const poi = await fetchAPI(`/poi/${poiCode}`);

        // Mostra codice POI
        document.getElementById('currentPOICode').textContent = poi.poi_code;

        // Popola form
        populatePOIForm(poi);

        // Nascondi loading, mostra form
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('poiForm').style.display = 'block';

        // Inizializza mappa
        initMapPicker();

        // Setup language selection
        setupLanguageSelection();

        // Handle form submit
        const form = document.getElementById('poiForm');
        form.addEventListener('submit', (e) => handlePOIUpdate(e, poiCode));

    } catch (error) {
        console.error('Errore caricamento POI:', error);
        alert('Errore caricamento POI');
        window.location.href = 'poi-list.html';
    }
}

/**
 * Popola il form con i dati del POI
 */
function populatePOIForm(poi) {
    // Dati base
    const parts = poi.poi_code.split('-');
    document.getElementById('clientSlug').value = parts[0];
    document.getElementById('poiNumber').value = parseInt(parts[1]);
    document.getElementById('poiName').value = poi.name;
    if (document.getElementById('poiDescription')) {
        document.getElementById('poiDescription').value = poi.description || '';
    }

    // Coordinate
    document.getElementById('lat').value = poi.lat;
    document.getElementById('lng').value = poi.lng;

    // Indirizzo
    if (document.getElementById('poiAddress')) {
        document.getElementById('poiAddress').value = poi.address || '';
    }

    // Lingue
    poi.languages.forEach(lang => {
        const checkbox = document.querySelector(`input[name="languages"][value="${lang}"]`);
        if (checkbox) checkbox.checked = true;
    });

    // Carica QR Code
    loadQRCodePreview(poi.poi_code);

    // Update marker position
    setTimeout(() => {
        if (currentMarker && currentMap) {
            currentMarker.setLatLng([poi.lat, poi.lng]);
            currentMap.setView([poi.lat, poi.lng], 13);
        }

        // Popola video inputs
        setupLanguageSelection();

        // Popola dati video esistenti
        setTimeout(() => {
            Object.keys(poi.videos).forEach(lang => {
                const video = poi.videos[lang];
                const hostSelect = document.getElementById(`video_host_${lang}`);
                const idInput = document.getElementById(`video_id_${lang}`);

                if (hostSelect) hostSelect.value = video.host;
                if (idInput) idInput.value = video.video_id;
            });
        }, 100);
    }, 500);
}

/**
 * Gestisce l'aggiornamento del POI
 */
async function handlePOIUpdate(e, poiCode) {
    e.preventDefault();

    const formData = collectPOIFormData();
    delete formData.poi_code; // Non si può modificare il codice

    try {
        await fetchAuthAPI(`/admin/poi/${poiCode}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });

        alert('POI aggiornato con successo!');
        window.location.href = 'poi-list.html';

    } catch (error) {
        console.error('Errore aggiornamento POI:', error);
        alert('Errore durante l\'aggiornamento del POI');
    }
}

/**
 * Apre il modal di conferma eliminazione
 */
function openDeleteModal(poiCode, poiName) {
    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDelete');
    const poiNameEl = document.getElementById('deletePOIName');

    if (poiNameEl) {
        poiNameEl.textContent = `${poiCode} - ${poiName}`;
    }

    modal.style.display = 'flex';

    confirmBtn.onclick = () => deletePOI(poiCode);
}

/**
 * Chiude il modal di eliminazione
 */
function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'none';
}

/**
 * Elimina un POI
 */
async function deletePOI(poiCode) {
    try {
        await fetchAuthAPI(`/admin/poi/${poiCode}`, {
            method: 'DELETE'
        });

        closeDeleteModal();
        alert('POI eliminato con successo');
        loadPOIsList();

    } catch (error) {
        console.error('Errore eliminazione POI:', error);
        alert('Errore durante l\'eliminazione del POI');
    }
}

// ========================================
// QR CODE FUNCTIONS
// ========================================

/**
 * Mostra il modal con il QR Code del POI
 */
async function showQRModal(poiCode, poiName) {
    const modal = document.getElementById('qrModal');
    const qrImage = document.getElementById('qrCodeImage');
    const qrPoiCode = document.getElementById('qrPOICode');
    const qrPoiName = document.getElementById('qrPOIName');
    const qrUrl = document.getElementById('qrUrl');

    // Mostra loading
    qrPoiCode.textContent = poiCode;
    qrPoiName.textContent = poiName;
    qrImage.src = '';
    qrImage.alt = 'Caricamento QR Code...';
    qrUrl.textContent = 'Generazione URL...';

    modal.style.display = 'flex';

    try {
        // Chiama API per ottenere QR Code
        const response = await fetchAPI(`/qrcode/${poiCode}`);

        // fetchAPI restituisce già result.data, quindi accediamo direttamente alle proprietà
        if (response && response.qr_code_data_url) {
            qrImage.src = response.qr_code_data_url;
            qrImage.alt = `QR Code per ${poiCode}`;
            qrUrl.textContent = response.url;
        } else {
            throw new Error('Risposta API non valida');
        }
    } catch (error) {
        console.error('Errore generazione QR Code:', error);
        qrImage.alt = 'Errore nel caricamento del QR Code';
        qrUrl.textContent = 'Errore nella generazione';
    }
}

/**
 * Chiude il modal QR Code
 */
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
}

/**
 * Scarica il QR Code come immagine PNG
 */
function downloadQR(poiCode) {
    // Apre direttamente l'URL per il download del QR Code PNG
    const downloadUrl = `${API_BASE}/qrcode/${poiCode}/image?download=true`;
    window.open(downloadUrl, '_blank');
}

// ========================================
// QR CODE FUNCTIONS FOR EDIT PAGE
// ========================================

// Variabile globale per memorizzare il POI code corrente nella pagina edit
let currentEditPOICode = null;
let currentEditPOIUrl = null;

/**
 * Carica il QR Code preview nella pagina di modifica
 */
async function loadQRCodePreview(poiCode) {
    currentEditPOICode = poiCode;

    const container = document.getElementById('qrPreviewContainer');
    const urlDisplay = document.getElementById('poiUrlDisplay');

    if (!container) return;

    try {
        // Chiama API per ottenere QR Code
        const response = await fetchAPI(`/qrcode/${poiCode}`);

        // fetchAPI restituisce già result.data, quindi accediamo direttamente alle proprietà
        if (response && response.qr_code_data_url) {
            container.innerHTML = `<img src="${response.qr_code_data_url}" alt="QR Code ${poiCode}">`;
            currentEditPOIUrl = response.url;
            if (urlDisplay) {
                urlDisplay.textContent = response.url;
            }
        } else {
            throw new Error('Risposta API non valida');
        }
    } catch (error) {
        console.error('Errore caricamento QR Code:', error);
        container.innerHTML = '<div class="qr-loading">Errore caricamento QR</div>';
        if (urlDisplay) {
            urlDisplay.textContent = 'Errore';
        }
    }
}

/**
 * Scarica QR Code dalla pagina edit
 */
function downloadQRFromEdit() {
    if (currentEditPOICode) {
        downloadQR(currentEditPOICode);
    }
}

/**
 * Copia l'URL del POI negli appunti
 */
async function copyPoiUrl() {
    if (!currentEditPOIUrl) {
        alert('URL non disponibile');
        return;
    }

    try {
        await navigator.clipboard.writeText(currentEditPOIUrl);
        alert('URL copiato negli appunti!');
    } catch (error) {
        // Fallback per browser che non supportano clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = currentEditPOIUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('URL copiato negli appunti!');
    }
}
