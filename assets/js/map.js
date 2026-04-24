// ========================================
// AVATOUR - Map Page Logic
// Versione 2.0 - Collegato alle API Backend
// ========================================

// Configurazione API Backend - usa sempre lo stesso origin della pagina
const API_BASE_URL = window.location.origin + '/api';
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return result.data || result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

class AvatourMap {
    constructor() {
        // Application state
        this.pois = [];
        this.map = null;
        this.markers = [];
        this.currentLanguage = 'it';
        this.selectedPoi = null;
        this.isPanelCollapsed = false;
        this.clientSlug = 'PAL';
        this.userMarker = null;
        this.userAccuracyCircle = null;

        // Centri mappa per i diversi client
        this.clientCenters = {
            'PAL': { center: [40.0269, 15.2753], zoom: 13 },   // Palinuro
            'ROM': { center: [41.9028, 12.4964], zoom: 12 },   // Roma
            'BST': { center: [45.7648, 11.7277], zoom: 13 },   // Bassano del Grappa
            'TSC': { center: [42.4173, 11.8688], zoom: 11 }    // Tuscia
        };

        // Default center (Palinuro area)
        this.defaultCenter = [40.0269, 15.2753];
        this.defaultZoom = 13;

        // Initialize
        this.init();
    }

    async init() {
        // Show loading
        this.showLoading();

        // Recupera l'URL di ritorno da sessionStorage (salvato da app.js)
        this.previousPage = sessionStorage.getItem('avatour_return_url') || null;

        // Get params from URL
        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang');
        const client = urlParams.get('client');

        if (lang && ['it', 'en', 'de'].includes(lang)) {
            this.currentLanguage = lang;
            this.updateLanguageUI();
        }

        if (client) {
            this.clientSlug = client;
        } else {
            // Prova a leggere lo slug dal path URL (es. /greccio)
            const pathSlug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
            if (pathSlug && !pathSlug.includes('/') && !pathSlug.includes('.')) {
                this.clientSlug = pathSlug.toUpperCase();
            }
        }

        // Load client info (logo, name) and POI data
        await this.loadClientInfo();
        await this.loadPOIs();

        // Initialize map
        this.initMap();

        // Request geolocation (solo marker, non centra la mappa)
        this.locate(false);

        // Setup event listeners
        this.setupEventListeners();

        // Render POI list
        this.renderPOIList();

        // Hide loading
        this.hideLoading();
    }

    showLoading() {
        const loading = document.getElementById('map-loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('map-loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    async loadClientInfo() {
        try {
            const client = await fetchAPI(`/clients/${this.clientSlug}`);
            if (client && client.logo_url) {
                const logoEl = document.getElementById('client-logo');
                const iconEl = document.getElementById('map-default-icon');
                if (logoEl) {
                    logoEl.src = client.logo_url;
                    logoEl.style.display = 'block';
                    if (iconEl) iconEl.style.display = 'none';
                }
            }
            if (client && client.client_name) {
                document.title = `${client.client_name} - AVATOUR`;
                const titleEl = document.getElementById('map-title-text');
                if (titleEl) titleEl.textContent = `${client.client_name} Avatour`;
            }
        } catch (err) {
            // Nessun logo disponibile, mantieni l'icona di default
        }
    }

    async loadPOIs() {
        try {
            // Chiamata API per ottenere tutti i POI del client
            const response = await fetchAPI(`/clients/${this.clientSlug}/pois`);

            // L'API ritorna {client_slug, pois, total}, estraiamo l'array pois
            // Ordina per poi_code in modo che i numeri sui marker siano coerenti
            this.pois = (response.pois || []).sort((a, b) => a.poi_code.localeCompare(b.poi_code));

            console.log('POI caricati:', this.pois);

            if (this.pois.length === 0) {
                console.warn('Nessun POI trovato per il client:', this.clientSlug);
            }

        } catch (error) {
            console.error('Errore caricamento POI:', error);
            this.pois = [];
            alert('Impossibile caricare i punti di interesse');
        }
    }

    initMap() {
        // Usa il centro specifico per il client, o fallback al default
        const clientConfig = this.clientCenters[this.clientSlug.toUpperCase()];
        const mapCenter = clientConfig ? clientConfig.center : this.defaultCenter;
        const mapZoom = clientConfig ? clientConfig.zoom : this.defaultZoom;

        // Create map
        this.map = L.map('map', {
            center: mapCenter,
            zoom: mapZoom,
            zoomControl: true,
            attributionControl: true
        });

        // Add tile layer (CartoDB Voyager - production friendly, no Referer restrictions)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
        }).addTo(this.map);

        // Add POI markers
        this.addMarkers();

        // Fit bounds to show all markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    addMarkers() {
        this.pois.forEach((poi) => {
            // Create custom pin/teardrop icon
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
                    <path d="M11 0C4.9 0 0 4.9 0 11c0 7.7 11 19 11 19s11-11.3 11-19C22 4.9 17.1 0 11 0z"
                          fill="#1e40af" stroke="white" stroke-width="1.5"/>
                    <circle cx="11" cy="11" r="4" fill="white"/>
                </svg>`,
                iconSize: [22, 30],
                iconAnchor: [11, 30],
                popupAnchor: [0, -32]
            });

            // Create marker
            const marker = L.marker([poi.lat, poi.lng], { icon })
                .addTo(this.map);

            // Add popup
            marker.bindPopup(() => this.buildPopupContent(poi), { maxWidth: 260 });

            // Click event: center map on POI and ensure popup is fully visible
            marker.on('click', () => {
                this.map.setView([poi.lat, poi.lng], Math.max(this.map.getZoom(), 15));
                setTimeout(() => { this.map.panBy([0, -80]); }, 150);
                this.highlightPOICard(poi.poi_code);
            });

            this.markers.push(marker);
        });
    }

    getTranslated(poi, field) {
        const t = poi.translations?.[this.currentLanguage];
        return (t && t[field]) || poi[field] || '';
    }

    buildPopupContent(poi) {
        const btnLabels = { it: 'VEDI E ASCOLTA', en: 'WATCH & LISTEN', de: 'SEHEN & HÖREN' };
        const btnText = btnLabels[this.currentLanguage] || btnLabels.it;
        const thumbUrl = poi.thumbnail || 'assets/images/placeholder-poi.svg';
        const poiUrl = poi.url_slug ? `/poi/${poi.url_slug}` : `/poi/${poi.poi_code}`;
        const name = this.getTranslated(poi, 'name');
        const description = this.getTranslated(poi, 'description');
        return `
            <div style="min-width: 200px;">
                <img src="${thumbUrl}"
                     onerror="this.src='assets/images/placeholder-poi.svg'"
                     style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:6px; margin-bottom:8px; display:block;">
                <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 1.1rem;">${name}</h3>
                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 0.9rem; line-height: 1.4;">${description}</p>
                <a href="${poiUrl}"
                   style="display: inline-block; width: 100%; text-align: center;
                          padding: 8px 16px; background: #f59e0b; color: white;
                          text-decoration: none; border-radius: 6px; font-weight: 700;
                          letter-spacing: 0.5px;">
                    ${btnText}
                </a>
            </div>
        `;
    }

    renderPOIList() {
        const listContainer = document.getElementById('poi-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (this.pois.length === 0) {
            listContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Nessun punto di interesse trovato</p>';
            return;
        }

        const sorted = [...this.pois].sort((a, b) => a.name.localeCompare(b.name, 'it'));
        sorted.forEach(poi => {
            const card = document.createElement('div');
            card.className = 'poi-card';
            card.dataset.poiId = poi.poi_code;

            // Usa thumbnail se disponibile, altrimenti placeholder
            const thumbnailUrl = poi.thumbnail || 'assets/images/placeholder-poi.svg';

            card.innerHTML = `
                <img
                    src="${thumbnailUrl}"
                    alt="${poi.name}"
                    class="poi-card-image"
                    onerror="this.src='assets/images/placeholder-poi.svg'"
                >
                <div class="poi-card-content">
                    <div class="poi-card-title">${this.getTranslated(poi, 'name')}</div>
                    <div class="poi-card-description">${this.getTranslated(poi, 'description')}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.showPOIDetail(poi.poi_code);
            });

            listContainer.appendChild(card);
        });
    }

    highlightPOICard(poiCode) {
        // Remove previous highlights
        document.querySelectorAll('.poi-card').forEach(card => {
            card.style.background = '';
            card.style.borderLeft = '';
        });

        // Highlight selected card
        const card = document.querySelector(`[data-poi-id="${poiCode}"]`);
        if (card) {
            card.style.background = '#e0f2fe';
            card.style.borderLeft = '4px solid #f59e0b';
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    showPOIDetail(poiCode) {
        const poi = this.pois.find(p => p.poi_code === poiCode);
        if (!poi) return;

        this.selectedPoi = poi;

        // Switch to map view if currently in list view
        this.switchView('map');

        // Center map on POI and open popup
        const index = this.pois.findIndex(p => p.poi_code === poiCode);
        if (index !== -1 && this.markers[index]) {
            this.map.setView([poi.lat, poi.lng], Math.max(this.map.getZoom(), 15));
            setTimeout(() => {
                this.markers[index].openPopup();
                this.map.panBy([0, -80]);
            }, 150);
        }

        this.highlightPOICard(poiCode);
    }

    switchView(view) {
        const body = document.body;
        body.classList.toggle('view-map', view === 'map');
        body.classList.toggle('view-list', view === 'list');

        document.getElementById('tab-map')?.classList.toggle('active', view === 'map');
        document.getElementById('tab-list')?.classList.toggle('active', view === 'list');

        if (view === 'map') {
            setTimeout(() => this.map.invalidateSize(), 50);
        }
    }

    togglePOIList() {
        const list = document.getElementById('poi-list');
        const chevronUp = document.getElementById('chevron-up');
        const chevronDown = document.getElementById('chevron-down');

        this.isPanelCollapsed = !this.isPanelCollapsed;

        if (this.isPanelCollapsed) {
            list.classList.add('collapsed');
            chevronUp.classList.add('hidden');
            chevronDown.classList.remove('hidden');
        } else {
            list.classList.remove('collapsed');
            chevronUp.classList.remove('hidden');
            chevronDown.classList.add('hidden');
        }

        // Resize map
        setTimeout(() => {
            this.map.invalidateSize();
        }, 300);
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // Torna alla pagina POI salvata in sessionStorage
                if (this.previousPage) {
                    window.location.href = this.previousPage;
                } else {
                    // Fallback: vai alla home
                    window.location.href = '/';
                }
            });
        }

        // Locate button
        const locateBtn = document.getElementById('locate-btn');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => this.locate());
        }

        // Modal close
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        // Modal background click
        const modal = document.getElementById('poi-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Start tour button
        const startTourBtn = document.getElementById('start-tour');
        if (startTourBtn) {
            startTourBtn.addEventListener('click', () => this.startTour());
        }

        // Tab view toggle
        document.getElementById('tab-map')?.addEventListener('click', () => this.switchView('map'));
        document.getElementById('tab-list')?.addEventListener('click', () => this.switchView('list'));

        // Language selector
        const langToggle = document.getElementById('lang-toggle');
        const langDropdown = document.getElementById('lang-dropdown');

        if (langToggle) {
            langToggle.addEventListener('click', () => {
                langDropdown.classList.toggle('hidden');
            });
        }

        // Language options
        document.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const lang = e.currentTarget.dataset.lang;
                this.changeLanguage(lang);
            });
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.language-selector')) {
                langDropdown.classList.add('hidden');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    changeLanguage(lang) {
        this.currentLanguage = lang;

        // Update flag and code
        this.updateLanguageUI();

        // Update active state
        document.querySelectorAll('.lang-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === lang);
        });

        // Close dropdown
        document.getElementById('lang-dropdown').classList.add('hidden');

        // Aggiorna il popup aperto (se c'è) con il nuovo testo
        this.markers.forEach((marker, i) => {
            if (marker.isPopupOpen()) {
                marker.setPopupContent(this.buildPopupContent(this.pois[i]));
            }
        });

        // Ri-renderizza la lista POI con la nuova lingua
        this.renderPOIList();

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.pushState({}, '', url);
    }

    /**
     * Estrae le lingue disponibili per un POI
     * Prima cerca nel campo languages, altrimenti estrae dalle chiavi di videos
     */
    getLanguages(poi) {
        if (poi.languages && Array.isArray(poi.languages) && poi.languages.length > 0) {
            return poi.languages;
        }
        // Fallback: estrai le lingue dalle chiavi dell'oggetto videos
        if (poi.videos && typeof poi.videos === 'object') {
            return Object.keys(poi.videos);
        }
        return ['it']; // Default
    }

    updateLanguageUI() {
        const codes = { it: 'IT', en: 'EN', de: 'DE' };
        const flagCodes = { it: 'it', en: 'gb', de: 'de' };
        const code = codes[this.currentLanguage] || this.currentLanguage.toUpperCase();
        const flagCode = flagCodes[this.currentLanguage] || this.currentLanguage;

        const flagEl = document.getElementById('current-flag');
        if (flagEl) {
            flagEl.className = `fi fi-${flagCode}`;
        }
        const langEl = document.getElementById('current-lang');
        if (langEl) langEl.textContent = code;

        document.querySelectorAll('.lang-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === this.currentLanguage);
        });
    }

    locate(centerOnUser = true) {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                if (this.userMarker) {
                    this.map.removeLayer(this.userMarker);
                }
                if (this.userAccuracyCircle) {
                    this.map.removeLayer(this.userAccuracyCircle);
                }

                this.userAccuracyCircle = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#1e40af',
                    fillColor: '#1e40af',
                    fillOpacity: 0.1,
                    weight: 1
                }).addTo(this.map);

                this.userMarker = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: '#1e40af',
                    color: 'white',
                    weight: 2,
                    fillOpacity: 1
                }).bindPopup('📍 La tua posizione').addTo(this.map);

                if (centerOnUser) {
                    this.map.setView([lat, lng], 15);
                }
            },
            (err) => {
                console.log('Geolocation non disponibile:', err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.avatourMap = new AvatourMap();
    });
} else {
    window.avatourMap = new AvatourMap();
}
