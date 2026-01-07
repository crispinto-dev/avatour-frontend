/**
 * AVATOUR Admin - Dashboard & General Functions
 */

const API_BASE = 'http://localhost:3000/api';
// AUTH_KEY è definito in auth.js

/**
 * Helper per chiamate API pubbliche (senza auth)
 */
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

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

/**
 * Helper per chiamate API autenticate (con JWT)
 */
async function fetchAuthAPI(endpoint, options = {}) {
    try {
        const token = localStorage.getItem(AUTH_KEY);

        if (!token) {
            throw new Error('Token non trovato. Effettua il login.');
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Token scaduto o non valido
            localStorage.removeItem(AUTH_KEY);
            window.location.href = 'login.html';
            throw new Error('Sessione scaduta. Effettua nuovamente il login.');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.data || result;
    } catch (error) {
        console.error('Auth API Error:', error);
        throw error;
    }
}

/**
 * Carica le statistiche per la dashboard
 */
async function loadDashboardStats() {
    try {
        // Carica statistiche dal backend (già filtrate per client se necessario)
        const stats = await fetchAuthAPI('/admin/stats');

        // Aggiorna UI con le statistiche
        document.getElementById('totalPOIs').textContent = stats.totalPOIs || 0;
        document.getElementById('totalClients').textContent = stats.totalClients || 0;
        document.getElementById('totalVideos').textContent = stats.totalVideos || 0;
        document.getElementById('totalLanguages').textContent = stats.languages?.length || 0;

        // Carica POI recenti (primi 5, già ordinati per created_at DESC)
        const pois = await fetchAuthAPI('/admin/pois');
        const recentPOIs = pois.slice(0, 5);
        displayRecentPOIs(recentPOIs);

    } catch (error) {
        console.error('Errore caricamento stats:', error);
        showError('Errore caricamento statistiche: ' + error.message);
    }
}

/**
 * Mostra i POI recenti nella dashboard
 */
function displayRecentPOIs(pois) {
    const tbody = document.getElementById('recentPOIsBody');

    if (!pois || pois.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">Nessun POI disponibile</td></tr>';
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
                <td>${(poi.languages || []).map(l => l.toUpperCase()).join(', ')}</td>
                <td>
                    <a href="poi-edit.html?code=${poi.poi_code}" class="btn-sm">✏️ Modifica</a>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Carica statistiche per la pagina clienti
 */
async function loadClientsStats() {
    try {
        // Usa l'endpoint /admin/stats che già calcola tutto
        const stats = await fetchAuthAPI('/admin/stats');

        // stats.clients è un array di { slug, name, poisCount }
        // stats.poisByClient è un oggetto { PAL: 2, ROM: 1, ... }

        // Aggiorna UI per ogni cliente
        if (stats.clients && Array.isArray(stats.clients)) {
            stats.clients.forEach(client => {
                const slug = client.slug;
                const lowerSlug = slug.toLowerCase();

                const poisEl = document.getElementById(`${lowerSlug}POIs`);
                const videosEl = document.getElementById(`${lowerSlug}Videos`);

                if (poisEl) poisEl.textContent = client.poisCount || 0;

                // Per i video, dobbiamo contarli dai POI
                // Alternativamente possiamo aggiungere videosCount al backend
                if (videosEl) {
                    // Placeholder - il backend potrebbe fornire questo dato
                    videosEl.textContent = '—';
                }
            });
        }

        // Se vogliamo anche il conteggio video per client, dobbiamo caricare i POI
        const pois = await fetchAuthAPI('/admin/pois');

        // Calcola video per client
        const videosByClient = {};
        pois.forEach(poi => {
            const slug = poi.client?.slug || poi.client_slug;
            if (!videosByClient[slug]) videosByClient[slug] = 0;
            videosByClient[slug] += (poi.videos || []).length;
        });

        // Aggiorna i conteggi video
        Object.entries(videosByClient).forEach(([slug, count]) => {
            const videosEl = document.getElementById(`${slug.toLowerCase()}Videos`);
            if (videosEl) videosEl.textContent = count;
        });

    } catch (error) {
        console.error('Errore caricamento stats clienti:', error);
        showError('Errore caricamento statistiche clienti: ' + error.message);
    }
}

/**
 * Mostra un messaggio di errore
 */
function showError(message) {
    alert(message);
}

/**
 * Mostra un messaggio di successo
 */
function showSuccess(message) {
    alert(message);
}

/**
 * Conferma azione
 */
function confirm(message) {
    return window.confirm(message);
}
