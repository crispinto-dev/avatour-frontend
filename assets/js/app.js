// ========================================
// AVATOUR - Main Application Logic
// Versione 2.0 - Collegato alle API Backend
// ========================================

// Configurazione API Backend - usa sempre lo stesso origin della pagina
const API_BASE_URL = window.location.origin + '/api';
// Helper per chiamate API
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        return result.data || result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

class AvatourApp {
    constructor() {
        // Application state
        this.currentPoi = null;
        this.currentLanguage = 'it';
        this.isPlaying = false;
        this.isFullscreen = false;
        this.vimeoPlayer = null; // Vimeo Player instance
        this.allPois = []; // Lista di tutti i POI per navigazione

        // DOM elements
        this.elements = {};

        // Settings
        this.firstVisit = !localStorage.getItem('avatour_visited');

        // Initialize
        this.init();
    }

    async init() {
        // Show splash screen for 2.5 seconds
        setTimeout(() => {
            this.hideSplash();
        }, 2500);

        // Cache DOM elements
        this.cacheElements();

        // Setup event listeners
        this.setupEventListeners();

        // Get POI from URL - supporta sia /poi/CODE che ?poi=CODE
        let poiCode = null;
        const pathMatch = window.location.pathname.match(/\/poi\/([A-Za-z0-9][A-Za-z0-9-]*)/);
        if (pathMatch) {
            poiCode = pathMatch[1].toUpperCase();
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            poiCode = urlParams.get('poi') || null;
        }

        // Se non c'è un codice POI nell'URL mostra solo il tutorial
        if (!poiCode) {
            this.showTutorial();
            return;
        }

        // Load all POIs for navigation
        await this.loadAllPOIs();

        // Load POI data from API
        await this.loadPOIData(poiCode);

        // Show tutorial for first-time visitors
        if (this.firstVisit) {
            setTimeout(() => {
                this.showTutorial();
            }, 3000);
        }
    }

    hideSplash() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
        }
    }

    showTutorial() {
        const tutorial = document.getElementById('tutorial-overlay');
        if (!tutorial) return;

        const texts = {
            it: {
                title: 'Benvenuto in AVATOUR!',
                subtitle: 'Inquadra un QR code per iniziare il tour virtuale con il tuo avatar personale.',
                tip1: 'Esplora i POI nelle vicinanze dalla mappa',
                tip2: 'Scansiona il QR code per avviare il tour',
                btn: 'Ho capito, iniziamo!'
            },
            en: {
                title: 'Welcome to AVATOUR!',
                subtitle: 'Scan a QR code to start the virtual tour with your personal avatar.',
                tip1: 'Explore nearby points of interest on the map',
                tip2: 'Scan the QR code to start the tour',
                btn: "Got it, let's go!"
            },
            de: {
                title: 'Willkommen bei AVATOUR!',
                subtitle: 'Scannen Sie einen QR-Code, um die virtuelle Tour zu starten.',
                tip1: 'Erkunden Sie POIs in der Nähe auf der Karte',
                tip2: 'QR-Code scannen, um die Tour zu starten',
                btn: "Verstanden, los geht's!"
            }
        };

        // Lingua iniziale: prima localStorage, poi browser, poi 'it'
        const savedLang = localStorage.getItem('avatour_language');
        const browserLang = navigator.language.slice(0, 2);
        let activeLang = savedLang || (['it','en','de'].includes(browserLang) ? browserLang : 'it');

        const applyLang = (lang) => {
            activeLang = lang;
            const t = texts[lang] || texts.it;
            const el = (id) => document.getElementById(id);
            if (el('tutorial-title'))    el('tutorial-title').textContent    = t.title;
            if (el('tutorial-subtitle')) el('tutorial-subtitle').textContent = t.subtitle;
            if (el('tutorial-tip1'))     el('tutorial-tip1').textContent     = t.tip1;
            if (el('tutorial-tip2'))     el('tutorial-tip2').textContent     = t.tip2;
            if (el('close-tutorial'))    el('close-tutorial').textContent    = t.btn;

            document.querySelectorAll('.tutorial-lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
        };

        // Aggiungi listener ai bottoni lingua
        document.querySelectorAll('.tutorial-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => applyLang(btn.dataset.lang));
        });

        applyLang(activeLang);
        tutorial.classList.remove('hidden');
    }

    closeTutorial() {
        const tutorial = document.getElementById('tutorial-overlay');
        if (tutorial) {
            tutorial.classList.add('hidden');
            localStorage.setItem('avatour_visited', 'true');

            // Salva la lingua scelta nel tutorial
            const activeBtn = document.querySelector('.tutorial-lang-btn.active');
            if (activeBtn) {
                localStorage.setItem('avatour_language', activeBtn.dataset.lang);
            }
        }
    }

    async loadAllPOIs() {
        try {
            const response = await fetchAPI('/poi');
            this.allPois = response.pois || [];
            console.log('Tutti i POI caricati:', this.allPois.length);
        } catch (error) {
            console.error('Errore caricamento lista POI:', error);
            this.allPois = [];
        }
    }

    async loadPOIData(poiCode) {
        try {
            this.showLoading();

            // Chiamata API per ottenere POI
            const poi = await fetchAPI(`/poi/${poiCode}`);

            console.log('POI caricato:', poi);
            this.currentPoi = poi;

            // Lingua: prima quella salvata, poi quella del browser, poi la prima disponibile
            const savedLang = localStorage.getItem('avatour_language');
            const browserLang = navigator.language.slice(0, 2);
            const preferredLang = savedLang || browserLang;
            const initialLang = poi.languages.includes(preferredLang) ? preferredLang : poi.languages[0];
            this.currentLanguage = initialLang;

            // Aggiorna UI con titolo e descrizione nella lingua corrente
            this.updatePOIContent(poi, this.currentLanguage);

            // Init selettore lingua
            this.initLanguageSelector(poi);

            // Carica video
            this.loadVideo(poi, this.currentLanguage);

            this.hideLoading();
        } catch (error) {
            console.error('Errore caricamento POI:', error);
            this.showError('Impossibile caricare il punto di interesse');
            this.hideLoading();
        }
    }

    /**
     * Aggiorna titolo e descrizione del POI nella lingua specificata
     */
    updatePOIContent(poi, lang) {
        // Usa la traduzione se disponibile, altrimenti il valore di default
        let title = poi.name;
        let description = poi.description || '';

        if (poi.translations && poi.translations[lang]) {
            const trans = poi.translations[lang];
            if (trans.name) title = trans.name;
            if (trans.description) description = trans.description;
        }

        this.elements.poiTitle.textContent = title;
        this.elements.poiDescription.textContent = description;
    }

    loadVideo(poi, lang) {
        const video = poi.videos[lang];

        if (!video) {
            this.showError('Video non disponibile per questa lingua');
            return;
        }

        let videoUrl;
        if (video.host === 'vimeo') {
            // Supporta video_id con o senza hash (es: "123456789" o "123456789?h=abc123")
            let vimeoId = video.video_id;
            let vimeoUrl = `https://player.vimeo.com/video/${vimeoId}`;

            // Se il video_id contiene già parametri (es: hash), gestiscili correttamente
            if (vimeoId.includes('?')) {
                // Il video_id contiene già il hash, usa & per aggiungere altri parametri
                console.log('Vimeo video with hash detected:', vimeoId);
            }

            // Per Vimeo usiamo iframe invece di video element
            this.loadVimeoVideo(vimeoUrl);
            return;
        } else if (video.host === 'cloudflare') {
            videoUrl = `https://customer-${video.video_id}.cloudflarestream.com/manifest/video.m3u8`;
        } else if (video.host === 'local') {
            videoUrl = `videos/${video.video_id}`;
        } else {
            videoUrl = 'assets/videos/placeholder.mp4';
        }

        const videoElement = this.elements.video;
        videoElement.src = videoUrl;
        videoElement.load();
    }

    loadVimeoVideo(vimeoUrl) {
        console.log('Loading Vimeo video:', vimeoUrl);

        // Nascondi il video element HTML5
        const videoElement = this.elements.video;
        videoElement.style.display = 'none';

        // Rimuovi iframe esistente se presente
        const existingIframe = document.getElementById('vimeo-iframe');
        if (existingIframe) {
            existingIframe.remove();
        }

        // Distruggi player Vimeo esistente
        if (this.vimeoPlayer) {
            this.vimeoPlayer.destroy();
            this.vimeoPlayer = null;
        }

        // Reset icona audio a "non muto" ad ogni caricamento video
        this.elements.volumeIcon?.classList.remove('hidden');
        this.elements.muteIcon?.classList.add('hidden');

        // Crea iframe per Vimeo (senza controlli nativi)
        const iframe = document.createElement('iframe');
        iframe.id = 'vimeo-iframe';

        // Gestisci URL con o senza parametri esistenti (es: hash)
        const separator = vimeoUrl.includes('?') ? '&' : '?';
        const iframeSrc = `${vimeoUrl}${separator}autoplay=0&title=0&byline=0&portrait=0&controls=0&dnt=1&transparent=1`;
        console.log('Final iframe src:', iframeSrc);

        iframe.src = iframeSrc;
        iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;

        // Inserisci iframe nel container video
        const videoContainer = document.querySelector('.video-container');
        videoContainer.appendChild(iframe);

        // Inizializza Vimeo Player API
        this.vimeoPlayer = new Vimeo.Player(iframe);

        // Bind eventi Vimeo ai nostri controlli
        this.setupVimeoEvents();

        // Mostra controlli custom
        if (this.elements.videoControls) {
            this.elements.videoControls.style.display = '';
        }

        // Nascondi loading quando pronto
        this.vimeoPlayer.ready().then(() => {
            console.log('Vimeo player ready');
            this.hideLoading();
            // Show paused state initially
            this.elements.videoContainer.classList.add('video-paused');
            // Imposta volume iniziale (fa scattare volumechange con valore > 0)
            this.vimeoPlayer.setVolume(0.8);
        }).catch(err => {
            console.error('Vimeo player ready error:', err);
            this.hideLoading();
            this.showError('Errore nel caricamento del video Vimeo: ' + err.message);
        });

        // Gestisci errori del player
        this.vimeoPlayer.on('error', (err) => {
            console.error('Vimeo player error:', err);
            this.showError('Errore Vimeo: ' + (err.message || 'Errore sconosciuto'));
        });
    }

    setupVimeoEvents() {
        if (!this.vimeoPlayer) return;

        // Play/Pause
        this.vimeoPlayer.on('play', () => {
            this.isPlaying = true;
            this.elements.playIcon.classList.add('hidden');
            this.elements.pauseIcon.classList.remove('hidden');
            this.elements.videoContainer.classList.remove('video-paused');
        });

        this.vimeoPlayer.on('pause', () => {
            this.isPlaying = false;
            this.elements.playIcon.classList.remove('hidden');
            this.elements.pauseIcon.classList.add('hidden');
            this.elements.videoContainer.classList.add('video-paused');
        });

        this.vimeoPlayer.on('ended', () => {
            this.isPlaying = false;
            this.elements.playIcon.classList.remove('hidden');
            this.elements.pauseIcon.classList.add('hidden');
            this.elements.videoContainer.classList.add('video-paused');
        });

        // Progresso
        this.vimeoPlayer.on('timeupdate', (data) => {
            const percent = (data.seconds / data.duration) * 100;
            this.elements.progressFilled.style.width = percent + '%';
        });

        // Buffer
        this.vimeoPlayer.on('progress', (data) => {
            const percent = (data.seconds / data.duration) * 100;
            this.elements.progressBuffer.style.width = percent + '%';
        });

        // Volume
        this.vimeoPlayer.on('volumechange', (data) => {
            if (data.volume === 0) {
                this.elements.volumeIcon.classList.add('hidden');
                this.elements.muteIcon.classList.remove('hidden');
            } else {
                this.elements.volumeIcon.classList.remove('hidden');
                this.elements.muteIcon.classList.add('hidden');
            }
        });
    }

    initLanguageSelector(poi) {
        // Aggiorna dropdown con le lingue disponibili
        const langDropdown = this.elements.langDropdown;
        const langOptions = langDropdown.querySelectorAll('.lang-option');

        // Nascondi tutte le opzioni di lingua
        langOptions.forEach(option => {
            const lang = option.dataset.lang;
            if (poi.languages.includes(lang)) {
                option.style.display = 'flex';
                option.classList.toggle('active', lang === this.currentLanguage);
            } else {
                option.style.display = 'none';
            }
        });

        // Aggiorna flag corrente
        this.updateLanguageUI();
    }

    updateLanguageUI() {
        const codes = { it: 'IT', en: 'EN', de: 'DE' };
        const flagCodes = { it: 'it', en: 'gb', de: 'de' };
        const code = codes[this.currentLanguage] || this.currentLanguage.toUpperCase();
        const flagCode = flagCodes[this.currentLanguage] || this.currentLanguage;

        const flagEl = this.elements.currentFlag;
        flagEl.className = `fi fi-${flagCode}`;
        this.elements.currentLang.textContent = code;
    }

    showLoading() {
        if (this.elements.videoLoading) {
            this.elements.videoLoading.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.elements.videoLoading) {
            this.elements.videoLoading.classList.add('hidden');
        }
    }

    showError(message) {
        console.error(message);
        alert(message);
    }

    cacheElements() {
        this.elements = {
            // Video
            video: document.getElementById('avatar-video'),
            videoLoading: document.getElementById('video-loading'),
            videoControls: document.getElementById('video-controls'),
            videoContainer: document.querySelector('.video-container'),

            // Controls
            playPause: document.getElementById('play-pause'),
            playIcon: document.getElementById('play-icon'),
            pauseIcon: document.getElementById('pause-icon'),
            playPauseOverlay: document.getElementById('play-pause-overlay'),
            mute: document.getElementById('mute'),
            volumeIcon: document.getElementById('volume-icon'),
            muteIcon: document.getElementById('mute-icon'),

            // Progress
            progressBar: document.querySelector('.progress-bar'),
            progressFilled: document.getElementById('progress-filled'),
            progressBuffer: document.getElementById('progress-buffer'),

            // POI Info
            poiTitle: document.getElementById('poi-title'),
            poiDescription: document.getElementById('poi-description-text'),

            // Navigation
            showMap: document.getElementById('show-map'),

            // Language
            langToggle: document.getElementById('lang-toggle'),
            langDropdown: document.getElementById('lang-dropdown'),
            currentFlag: document.getElementById('current-flag'),
            currentLang: document.getElementById('current-lang'),

            // Share
            shareBtn: document.getElementById('share-btn'),
            shareModal: document.getElementById('share-modal'),
            closeShare: document.getElementById('close-share'),

            // Tutorial
            closeTutorialBtn: document.getElementById('close-tutorial')
        };
    }

    setupEventListeners() {
        // Video events
        this.elements.video.addEventListener('loadstart', () => this.onVideoLoadStart());
        this.elements.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
        this.elements.video.addEventListener('timeupdate', () => this.updateProgress());
        this.elements.video.addEventListener('progress', () => this.updateBuffer());
        this.elements.video.addEventListener('ended', () => this.onVideoEnded());
        this.elements.video.addEventListener('play', () => this.onPlay());
        this.elements.video.addEventListener('pause', () => this.onPause());

        // Play/Pause - tap on overlay or button
        if (this.elements.playPause) {
            this.elements.playPause.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlay();
            });
        }

        // Tap on video area to toggle play/pause
        if (this.elements.playPauseOverlay) {
            this.elements.playPauseOverlay.addEventListener('click', (e) => {
                // Don't toggle if clicking on controls
                if (e.target.closest('.side-controls') || e.target.closest('.video-controls')) {
                    return;
                }
                this.togglePlay();
            });
        }

        // Mute button
        if (this.elements.mute) {
            this.elements.mute.addEventListener('click', () => this.toggleMute());
        }

        // Progress bar
        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('click', (e) => this.seek(e));
        }

        // Navigation - Map button
        if (this.elements.showMap) {
            this.elements.showMap.addEventListener('click', () => this.goToMap());
        }

        // Language
        if (this.elements.langToggle) {
            this.elements.langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLanguageDropdown();
            });
        }
        document.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.changeLanguage(e.currentTarget.dataset.lang);
            });
        });

        // Share
        if (this.elements.shareBtn) {
            this.elements.shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openShareModal();
            });
        }
        if (this.elements.closeShare) {
            this.elements.closeShare.addEventListener('click', () => this.closeShareModal());
        }
        if (this.elements.shareModal) {
            this.elements.shareModal.addEventListener('click', (e) => {
                if (e.target === this.elements.shareModal) {
                    this.closeShareModal();
                }
            });
        }
        document.querySelectorAll('.share-option').forEach(option => {
            option.addEventListener('click', (e) => this.share(e.currentTarget.dataset.platform));
        });

        // Tutorial
        if (this.elements.closeTutorialBtn) {
            this.elements.closeTutorialBtn.addEventListener('click', () => this.closeTutorial());
        }

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.language-selector')) {
                this.elements.langDropdown.classList.add('hidden');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Fullscreen change
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    }

    onVideoLoadStart() {
        this.elements.videoLoading.classList.remove('hidden');
    }

    onVideoLoaded() {
        this.elements.videoLoading.classList.add('hidden');

        // Set initial volume
        this.elements.video.volume = 0.8;

        // Show paused state initially
        this.elements.videoContainer.classList.add('video-paused');
    }

    onVideoEnded() {
        this.isPlaying = false;
        this.elements.playIcon.classList.remove('hidden');
        this.elements.pauseIcon.classList.add('hidden');
    }

    onPlay() {
        this.isPlaying = true;
        this.elements.playIcon.classList.add('hidden');
        this.elements.pauseIcon.classList.remove('hidden');
        this.elements.videoContainer.classList.remove('video-paused');
    }

    onPause() {
        this.isPlaying = false;
        this.elements.playIcon.classList.remove('hidden');
        this.elements.pauseIcon.classList.add('hidden');
        this.elements.videoContainer.classList.add('video-paused');
    }

    togglePlay() {
        if (this.vimeoPlayer) {
            // Vimeo Player
            console.log('togglePlay: Vimeo player detected');
            this.vimeoPlayer.getPaused().then(paused => {
                console.log('togglePlay: paused =', paused);
                if (paused) {
                    console.log('togglePlay: calling play()');
                    this.vimeoPlayer.play().then(() => {
                        console.log('togglePlay: play() success');
                    }).catch(err => {
                        console.error('togglePlay: play() error:', err);
                        this.showError('Impossibile avviare il video: ' + err.message);
                    });
                } else {
                    console.log('togglePlay: calling pause()');
                    this.vimeoPlayer.pause();
                }
            }).catch(err => {
                console.error('togglePlay: getPaused() error:', err);
            });
        } else {
            // HTML5 Video
            if (this.elements.video.paused) {
                this.elements.video.play();
            } else {
                this.elements.video.pause();
            }
        }
    }

    toggleMute() {
        if (this.vimeoPlayer) {
            this.vimeoPlayer.getVolume().then(volume => {
                if (volume > 0) {
                    this._lastVolume = volume;
                    this.vimeoPlayer.setVolume(0);
                } else {
                    this.vimeoPlayer.setVolume(this._lastVolume || 0.8);
                }
            });
        } else {
            this.elements.video.muted = !this.elements.video.muted;

            if (this.elements.video.muted) {
                this.elements.volumeIcon.classList.add('hidden');
                this.elements.muteIcon.classList.remove('hidden');
            } else {
                this.elements.volumeIcon.classList.remove('hidden');
                this.elements.muteIcon.classList.add('hidden');
            }
        }
    }


    async toggleFullscreen() {
        const container = document.querySelector('.video-container');

        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Enter fullscreen
            if (container.requestFullscreen) {
                await container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                await container.webkitRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            }
        }
    }

    onFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    updateProgress() {
        const percent = (this.elements.video.currentTime / this.elements.video.duration) * 100;
        this.elements.progressFilled.style.width = percent + '%';
    }

    updateBuffer() {
        if (this.elements.video.buffered.length > 0) {
            const bufferedEnd = this.elements.video.buffered.end(this.elements.video.buffered.length - 1);
            const duration = this.elements.video.duration;
            const percent = (bufferedEnd / duration) * 100;
            this.elements.progressBuffer.style.width = percent + '%';
        }
    }

    seek(e) {
        const rect = this.elements.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;

        if (this.vimeoPlayer) {
            this.vimeoPlayer.getDuration().then(duration => {
                this.vimeoPlayer.setCurrentTime(percent * duration);
            });
        } else {
            this.elements.video.currentTime = percent * this.elements.video.duration;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    previousPOI() {
        if (!this.currentPoi || this.allPois.length === 0) return;

        // Filtra POI dello stesso client
        const clientPois = this.allPois.filter(p =>
            p.client_slug === this.currentPoi.client_slug
        ).sort((a, b) => a.poi_code.localeCompare(b.poi_code));

        const currentIndex = clientPois.findIndex(p => p.poi_code === this.currentPoi.poi_code);

        if (currentIndex > 0) {
            const prevPoi = clientPois[currentIndex - 1];
            window.location.href = `/poi/${prevPoi.poi_code}`;
        } else if (clientPois.length > 1) {
            // Vai all'ultimo se siamo al primo (loop)
            const lastPoi = clientPois[clientPois.length - 1];
            window.location.href = `/poi/${lastPoi.poi_code}`;
        }
    }

    nextPOI() {
        if (!this.currentPoi || this.allPois.length === 0) return;

        // Filtra POI dello stesso client
        const clientPois = this.allPois.filter(p =>
            p.client_slug === this.currentPoi.client_slug
        ).sort((a, b) => a.poi_code.localeCompare(b.poi_code));

        const currentIndex = clientPois.findIndex(p => p.poi_code === this.currentPoi.poi_code);

        if (currentIndex < clientPois.length - 1) {
            const nextPoi = clientPois[currentIndex + 1];
            window.location.href = `/poi/${nextPoi.poi_code}`;
        } else if (clientPois.length > 1) {
            // Vai al primo se siamo all'ultimo (loop)
            const firstPoi = clientPois[0];
            window.location.href = `/poi/${firstPoi.poi_code}`;
        }
    }

    goToMap() {
        // Salva l'URL corrente per poter tornare indietro dalla mappa
        sessionStorage.setItem('avatour_return_url', window.location.href);

        if (this.currentPoi) {
            window.location.href = `/map.html?client=${this.currentPoi.client_slug}&lang=${this.currentLanguage}`;
        } else {
            window.location.href = '/map.html';
        }
    }

    toggleLanguageDropdown() {
        this.elements.langDropdown.classList.toggle('hidden');
        this.elements.langToggle.classList.toggle('active');
    }

    changeLanguage(lang) {
        if (!this.currentPoi || !this.currentPoi.languages.includes(lang)) {
            console.log('Lingua non disponibile:', lang);
            return;
        }

        this.currentLanguage = lang;

        // Update flag and code
        this.updateLanguageUI();

        // Update active state
        document.querySelectorAll('.lang-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === lang);
        });

        // Aggiorna titolo e descrizione nella nuova lingua
        this.updatePOIContent(this.currentPoi, lang);

        // Reload video with new language
        this.loadVideo(this.currentPoi, lang);

        // Close dropdown
        this.elements.langDropdown.classList.add('hidden');
        this.elements.langToggle.classList.remove('active');
    }

    openShareModal() {
        this.elements.shareModal.classList.remove('hidden');
    }

    closeShareModal() {
        this.elements.shareModal.classList.add('hidden');
    }

    share(platform) {
        const url = window.location.href;
        const title = `AVATOUR - ${this.currentPoi ? this.currentPoi.name : 'Virtual Tour'}`;
        switch (platform) {
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
                break;
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(title + ' - ' + url)}`, '_blank');
                break;
            case 'copy':
                navigator.clipboard.writeText(url).then(() => {
                    alert('Link copiato negli appunti!');
                    this.closeShareModal();
                });
                break;
        }
    }

    handleKeyboard(e) {
        // Ignore if user is typing in an input
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (this.vimeoPlayer) {
                    this.vimeoPlayer.getCurrentTime().then(time => {
                        this.vimeoPlayer.setCurrentTime(Math.max(0, time - 5));
                    });
                } else {
                    this.elements.video.currentTime = Math.max(0, this.elements.video.currentTime - 5);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (this.vimeoPlayer) {
                    Promise.all([this.vimeoPlayer.getCurrentTime(), this.vimeoPlayer.getDuration()]).then(([time, duration]) => {
                        this.vimeoPlayer.setCurrentTime(Math.min(duration, time + 5));
                    });
                } else {
                    this.elements.video.currentTime = Math.min(this.elements.video.duration, this.elements.video.currentTime + 5);
                }
                break;
            case '0':
                e.preventDefault();
                if (this.vimeoPlayer) {
                    this.vimeoPlayer.setCurrentTime(0);
                } else {
                    this.elements.video.currentTime = 0;
                }
                break;
        }
    }

}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.avatourApp = new AvatourApp();
    });
} else {
    window.avatourApp = new AvatourApp();
}
