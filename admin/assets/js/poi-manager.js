/**
 * AVATOUR Admin - POI Manager
 */

// API_BASE e AUTH_KEY sono definiti in admin.js e auth.js
// fetchAuthAPI è definito in admin.js

let allPOIs = [];
let currentMap = null;
let currentMarker = null;

/**
 * Carica la lista di tutti i POI (usa endpoint autenticato)
 */
async function loadPOIsList() {
    try {
        // Usa fetchAuthAPI definito in admin.js per chiamare endpoint autenticato
        allPOIs = await fetchAuthAPI('/admin/pois');

        // Verifica che sia un array
        if (!Array.isArray(allPOIs)) {
            console.error('I dati ricevuti non sono un array:', allPOIs);
            throw new Error('Formato dati non valido');
        }

        displayPOIsList(allPOIs);
        setupFilters();
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Nessun POI trovato</td></tr>';
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
        const matchesClient = !clientFilter || poi.client_slug === clientFilter;

        return matchesSearch && matchesClient;
    });

    displayPOIsList(filtered);
}

/**
 * Inizializza il form di aggiunta POI
 */
function initPOIForm() {
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
        // Chiama API per creare POI
        await fetchAPI('/admin/poi', {
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

    // Lingue
    poi.languages.forEach(lang => {
        const checkbox = document.querySelector(`input[name="languages"][value="${lang}"]`);
        if (checkbox) checkbox.checked = true;
    });

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
        await fetchAPI(`/admin/poi/${poiCode}`, {
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
        await fetchAPI(`/admin/poi/${poiCode}`, {
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
