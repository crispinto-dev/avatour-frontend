// ========================================
// AVATOUR - Map Page Logic
// Versione 2.0 - Collegato alle API Backend
// ========================================

// Configurazione API Backend
//const API_BASE_URL = 'http://localhost:3000/api';
const API_BASE_URL = 'http://72.60.80.53:3000/api';
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
        }

        // Load POI data from API
        await this.loadPOIs();

        // Initialize map
        this.initMap();

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

    async loadPOIs() {
        try {
            // Chiamata API per ottenere tutti i POI del client
            const response = await fetchAPI(`/clients/${this.clientSlug}/pois`);

            // L'API ritorna {client_slug, pois, total}, estraiamo l'array pois
            this.pois = response.pois || [];

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

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
        this.pois.forEach((poi, index) => {
            // Create custom icon
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        background: #1e40af;
                        color: white;
                        width: 36px;
                        height: 36px;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ">
                        <span style="transform: rotate(45deg); font-weight: bold; font-size: 14px;">
                            ${index + 1}
                        </span>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });

            // Create marker
            const marker = L.marker([poi.lat, poi.lng], { icon })
                .addTo(this.map);

            // Add popup
            const popupContent = `
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 1.1rem;">
                        ${poi.name}
                    </h3>
                    <p style="margin: 0 0 12px 0; color: #64748b; font-size: 0.9rem; line-height: 1.4;">
                        ${poi.description || ''}
                    </p>
                    <p style="margin: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        🌍 ${this.getLanguages(poi).map(l => l.toUpperCase()).join(', ')}
                    </p>
                    <a href="index.html?poi=${poi.poi_code}"
                       style="display: inline-block; width: 100%; text-align: center;
                              padding: 8px 16px; background: #f59e0b; color: white;
                              text-decoration: none; border-radius: 6px; font-weight: 600;">
                        🎧 Ascolta l'Avatar
                    </a>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Click event
            marker.on('click', () => {
                this.highlightPOICard(poi.poi_code);
            });

            this.markers.push(marker);
        });
    }

    renderPOIList() {
        const listContainer = document.getElementById('poi-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (this.pois.length === 0) {
            listContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Nessun punto di interesse trovato</p>';
            return;
        }

        this.pois.forEach(poi => {
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
                    <div class="poi-card-title">${poi.name}</div>
                    <div class="poi-card-description">${poi.description || ''}</div>
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

        // Update modal content
        const thumbnailUrl = poi.thumbnail || 'assets/images/placeholder-poi.svg';
        document.getElementById('modal-thumbnail').src = thumbnailUrl;
        document.getElementById('modal-thumbnail').alt = poi.name;
        document.getElementById('modal-thumbnail').onerror = function() {
            this.src = 'assets/images/placeholder-poi.svg';
        };
        document.getElementById('modal-title').textContent = poi.name;
        document.getElementById('modal-description').textContent = poi.description || '';
        document.getElementById('modal-coordinates').textContent =
            `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`;

        // Update languages display
        const languagesText = this.getLanguages(poi).map(l => {
            const langNames = { it: 'Italiano', en: 'English', de: 'Deutsch' };
            return langNames[l] || l.toUpperCase();
        }).join(', ');
        document.getElementById('modal-languages').textContent = languagesText;

        // Show modal
        document.getElementById('poi-modal').classList.remove('hidden');

        // Highlight card
        this.highlightPOICard(poiCode);

        // Center map on POI
        const index = this.pois.findIndex(p => p.poi_code === poiCode);
        if (index !== -1 && this.markers[index]) {
            this.map.setView([poi.lat, poi.lng], 15);
            this.markers[index].openPopup();
        }
    }

    closeModal() {
        document.getElementById('poi-modal').classList.add('hidden');
        this.selectedPoi = null;
    }

    startTour() {
        if (this.selectedPoi) {
            window.location.href = `index.html?poi=${this.selectedPoi.poi_code}&lang=${this.currentLanguage}`;
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
                // Check if there's a previous page in history
                if (document.referrer && document.referrer.includes('index.html')) {
                    window.history.back();
                } else {
                    window.location.href = 'index.html';
                }
            });
        }

        // Toggle list button
        const toggleBtn = document.getElementById('toggle-list');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.togglePOIList());
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
        const flags = { it: '🇮🇹', en: '🇬🇧', de: '🇩🇪' };
        const codes = { it: 'IT', en: 'EN', de: 'DE' };

        document.getElementById('current-flag').textContent = flags[this.currentLanguage];
        document.getElementById('current-lang').textContent = codes[this.currentLanguage];

        // Update active state
        document.querySelectorAll('.lang-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === this.currentLanguage);
        });
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
