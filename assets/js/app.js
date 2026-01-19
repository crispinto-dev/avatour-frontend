// ========================================
// AVATOUR - Main Application Logic
// Versione 2.0 - Collegato alle API Backend
// ========================================

// Configurazione API Backend
//const API_BASE_URL = 'http://localhost:3000/api';
const API_BASE_URL = 'http://72.60.80.53:3000/api';
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
        let poiCode = 'PAL-001';
        const pathMatch = window.location.pathname.match(/\/poi\/([A-Z]{3}-\d{3})/i);
        if (pathMatch) {
            poiCode = pathMatch[1].toUpperCase();
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            poiCode = urlParams.get('poi') || 'PAL-001';
        }

        // Load POI data from API
        await this.loadPOIData(poiCode);

        // Check orientation
        this.checkOrientation();
        window.addEventListener('resize', () => this.checkOrientation());

        // Initialize orientation listener for auto-fullscreen
        this.initOrientationListener();

        // Show tutorial for first-time visitors
        if (this.firstVisit) {
            setTimeout(() => {
                this.showTutorial();
            }, 3000);
        }

        // Show rotation hint on mobile in portrait
        this.showRotationHint();
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
        if (tutorial) {
            tutorial.classList.remove('hidden');
        }
    }

    closeTutorial() {
        const tutorial = document.getElementById('tutorial-overlay');
        if (tutorial) {
            tutorial.classList.add('hidden');
            localStorage.setItem('avatour_visited', 'true');
        }
    }

    async loadPOIData(poiCode) {
        try {
            this.showLoading();

            // Chiamata API per ottenere POI
            const poi = await fetchAPI(`/poi/${poiCode}`);

            console.log('POI caricato:', poi);
            this.currentPoi = poi;

            // Aggiorna UI
            this.elements.poiTitle.textContent = poi.name;
            this.elements.poiDescription.textContent = poi.description || '';

            // Carica video nella lingua del browser
            const userLang = navigator.language.slice(0, 2);
            const initialLang = poi.languages.includes(userLang) ? userLang : poi.languages[0];
            this.currentLanguage = initialLang;

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

    loadVideo(poi, lang) {
        const video = poi.videos[lang];

        if (!video) {
            this.showError('Video non disponibile per questa lingua');
            return;
        }

        let videoUrl;
        if (video.host === 'vimeo') {
            videoUrl = `https://player.vimeo.com/video/${video.video_id}`;
            // Per Vimeo usiamo iframe invece di video element
            this.loadVimeoVideo(videoUrl);
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

        // Crea iframe per Vimeo
        const iframe = document.createElement('iframe');
        iframe.id = 'vimeo-iframe';
        iframe.src = `${vimeoUrl}?autoplay=0&title=0&byline=0&portrait=0&dnt=1`;
        iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;

        // Inserisci iframe nel container video
        const videoContainer = document.querySelector('.video-container');
        videoContainer.appendChild(iframe);

        // Nascondi loading
        this.hideLoading();

        // Nascondi controlli custom (Vimeo ha i suoi)
        if (this.elements.videoControls) {
            this.elements.videoControls.style.display = 'none';
        }
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
        const flags = { it: '🇮🇹', en: '🇬🇧', de: '🇩🇪' };
        const codes = { it: 'IT', en: 'EN', de: 'DE' };

        this.elements.currentFlag.textContent = flags[this.currentLanguage];
        this.elements.currentLang.textContent = codes[this.currentLanguage];
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

            // Controls
            playPause: document.getElementById('play-pause'),
            playIcon: document.getElementById('play-icon'),
            pauseIcon: document.getElementById('pause-icon'),
            restart: document.getElementById('restart'),
            mute: document.getElementById('mute'),
            volumeIcon: document.getElementById('volume-icon'),
            muteIcon: document.getElementById('mute-icon'),
            volumeSlider: document.getElementById('volume-slider'),
            subtitles: document.getElementById('subtitles'),
            fullscreen: document.getElementById('fullscreen'),
            fullscreenIcon: document.getElementById('fullscreen-icon'),
            exitFullscreenIcon: document.getElementById('exit-fullscreen-icon'),

            // Progress
            progressBar: document.querySelector('.progress-bar'),
            progressFilled: document.getElementById('progress-filled'),
            progressBuffer: document.getElementById('progress-buffer'),
            currentTime: document.getElementById('current-time'),
            duration: document.getElementById('duration'),

            // POI Info
            poiTitle: document.getElementById('poi-title'),
            poiDescription: document.getElementById('poi-description-text'),

            // Navigation
            prevPoi: document.getElementById('prev-poi'),
            nextPoi: document.getElementById('next-poi'),
            showMap: document.getElementById('show-map'),
            backToMap: document.getElementById('back-to-map'),

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
            closeTutorialBtn: document.getElementById('close-tutorial'),

            // Orientation
            orientationWarning: document.getElementById('orientation-warning')
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

        // Control events
        this.elements.playPause.addEventListener('click', () => this.togglePlay());
        this.elements.restart.addEventListener('click', () => this.restartVideo());
        this.elements.mute.addEventListener('click', () => this.toggleMute());
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.elements.subtitles.addEventListener('click', () => this.toggleSubtitles());
        this.elements.fullscreen.addEventListener('click', () => this.toggleFullscreen());

        // Progress bar
        this.elements.progressBar.addEventListener('click', (e) => this.seek(e));

        // Navigation
        this.elements.prevPoi.addEventListener('click', () => this.previousPOI());
        this.elements.nextPoi.addEventListener('click', () => this.nextPOI());
        this.elements.showMap.addEventListener('click', () => this.goToMap());
        this.elements.backToMap.addEventListener('click', () => this.goToMap());

        // Language
        this.elements.langToggle.addEventListener('click', () => this.toggleLanguageDropdown());
        document.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', (e) => this.changeLanguage(e.currentTarget.dataset.lang));
        });

        // Share
        this.elements.shareBtn.addEventListener('click', () => this.openShareModal());
        this.elements.closeShare.addEventListener('click', () => this.closeShareModal());
        this.elements.shareModal.addEventListener('click', (e) => {
            if (e.target === this.elements.shareModal) {
                this.closeShareModal();
            }
        });
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
        this.elements.duration.textContent = this.formatTime(this.elements.video.duration);

        // Set initial volume
        this.elements.video.volume = 0.8;

        // Show controls initially
        this.elements.videoControls.classList.add('show');
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
    }

    onPause() {
        this.isPlaying = false;
        this.elements.playIcon.classList.remove('hidden');
        this.elements.pauseIcon.classList.add('hidden');
    }

    togglePlay() {
        if (this.elements.video.paused) {
            this.elements.video.play();
        } else {
            this.elements.video.pause();
        }
    }

    restartVideo() {
        this.elements.video.currentTime = 0;
        this.elements.video.play();
    }

    toggleMute() {
        this.elements.video.muted = !this.elements.video.muted;

        if (this.elements.video.muted) {
            this.elements.volumeIcon.classList.add('hidden');
            this.elements.muteIcon.classList.remove('hidden');
        } else {
            this.elements.volumeIcon.classList.remove('hidden');
            this.elements.muteIcon.classList.add('hidden');
        }
    }

    setVolume(value) {
        this.elements.video.volume = value / 100;

        if (value == 0) {
            this.elements.video.muted = true;
            this.elements.volumeIcon.classList.add('hidden');
            this.elements.muteIcon.classList.remove('hidden');
        } else {
            this.elements.video.muted = false;
            this.elements.volumeIcon.classList.remove('hidden');
            this.elements.muteIcon.classList.add('hidden');
        }
    }

    toggleSubtitles() {
        const tracks = this.elements.video.textTracks;
        if (tracks.length > 0) {
            const track = tracks[0];
            track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
        }

        // Visual feedback
        this.elements.subtitles.style.color = this.elements.subtitles.style.color === 'rgb(245, 158, 11)' ? '' : 'rgb(245, 158, 11)';
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

        if (this.isFullscreen) {
            this.elements.fullscreenIcon.classList.add('hidden');
            this.elements.exitFullscreenIcon.classList.remove('hidden');
        } else {
            this.elements.fullscreenIcon.classList.remove('hidden');
            this.elements.exitFullscreenIcon.classList.add('hidden');
        }
    }

    updateProgress() {
        const percent = (this.elements.video.currentTime / this.elements.video.duration) * 100;
        this.elements.progressFilled.style.width = percent + '%';
        this.elements.currentTime.textContent = this.formatTime(this.elements.video.currentTime);
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
        this.elements.video.currentTime = percent * this.elements.video.duration;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    previousPOI() {
        // Da implementare: navigazione tra POI
        this.showError('Navigazione POI non ancora implementata');
    }

    nextPOI() {
        // Da implementare: navigazione tra POI
        this.showError('Navigazione POI non ancora implementata');
    }

    goToMap() {
        if (this.currentPoi) {
            window.location.href = `map.html?client=${this.currentPoi.client_slug}&lang=${this.currentLanguage}`;
        } else {
            window.location.href = 'map.html';
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
        const text = this.currentPoi ? this.currentPoi.description : 'Esplora il territorio con guide virtuali';

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
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.elements.video.currentTime = Math.max(0, this.elements.video.currentTime - 5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.elements.video.currentTime = Math.min(this.elements.video.duration, this.elements.video.currentTime + 5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.elements.video.volume = Math.min(1, this.elements.video.volume + 0.1);
                this.elements.volumeSlider.value = this.elements.video.volume * 100;
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.elements.video.volume = Math.max(0, this.elements.video.volume - 0.1);
                this.elements.volumeSlider.value = this.elements.video.volume * 100;
                break;
            case '0':
                e.preventDefault();
                this.elements.video.currentTime = 0;
                break;
        }
    }

    checkOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isShort = window.innerHeight < 500;

        if (isLandscape && isShort) {
            this.elements.orientationWarning.classList.remove('hidden');
        } else {
            this.elements.orientationWarning.classList.add('hidden');
        }
    }

    // ========================================
    // Auto-Fullscreen on Orientation Change
    // ========================================

    /**
     * Check if device is mobile
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768 && 'ontouchstart' in window);
    }

    /**
     * Initialize orientation change listener
     */
    initOrientationListener() {
        if (!this.isMobileDevice()) return;

        // Use matchMedia for better cross-browser support
        const landscapeQuery = window.matchMedia("(orientation: landscape)");

        // Handle orientation change
        const handleChange = (e) => {
            // Delay to allow orientation to stabilize
            setTimeout(() => {
                this.handleOrientationChange(e.matches);
            }, 100);
        };

        // Modern browsers
        if (landscapeQuery.addEventListener) {
            landscapeQuery.addEventListener('change', handleChange);
        } else if (landscapeQuery.addListener) {
            // Safari < 14
            landscapeQuery.addListener(handleChange);
        }

        // Also listen to orientationchange event for broader support
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const isLandscape = window.innerWidth > window.innerHeight;
                this.handleOrientationChange(isLandscape);
            }, 100);
        });
    }

    /**
     * Handle orientation change - enter/exit fullscreen
     */
    handleOrientationChange(isLandscape) {
        if (!this.isMobileDevice()) return;

        const container = document.querySelector('.video-container');
        if (!container) return;

        if (isLandscape) {
            // Enter fullscreen when rotating to landscape
            this.enterFullscreen(container);
            // Hide rotation hint
            this.hideRotationHint();
        } else {
            // Exit fullscreen when rotating to portrait
            this.exitFullscreenAuto();
        }
    }

    /**
     * Enter fullscreen (cross-browser)
     */
    async enterFullscreen(element) {
        if (!element) return;

        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                // Safari
                await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                // Firefox
                await element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                // IE/Edge
                await element.msRequestFullscreen();
            } else if (element.webkitEnterFullscreen) {
                // iOS Safari video element
                await element.webkitEnterFullscreen();
            }
        } catch (err) {
            console.log('Fullscreen request failed:', err.message);
        }
    }

    /**
     * Exit fullscreen (cross-browser)
     */
    async exitFullscreenAuto() {
        const fullscreenElement = document.fullscreenElement ||
                                   document.webkitFullscreenElement ||
                                   document.mozFullScreenElement ||
                                   document.msFullscreenElement;

        if (!fullscreenElement) return;

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                // Safari
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                // Firefox
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                // IE/Edge
                await document.msExitFullscreen();
            }
        } catch (err) {
            console.log('Exit fullscreen failed:', err.message);
        }
    }

    /**
     * Show rotation hint for mobile users
     */
    showRotationHint() {
        if (!this.isMobileDevice()) return;

        // Only show in portrait mode
        const isPortrait = window.innerHeight > window.innerWidth;
        if (!isPortrait) return;

        const hint = document.getElementById('rotation-hint');
        if (hint) {
            hint.classList.remove('hidden');
            // Auto-hide after 4 seconds
            setTimeout(() => {
                this.hideRotationHint();
            }, 4000);
        }
    }

    /**
     * Hide rotation hint
     */
    hideRotationHint() {
        const hint = document.getElementById('rotation-hint');
        if (hint) {
            hint.classList.add('hidden');
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
