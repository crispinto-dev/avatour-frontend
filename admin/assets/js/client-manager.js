/**
 * AVATOUR Admin - Client Manager
 * Gestione CRUD dei clienti
 */

// API_BASE e AUTH_KEY sono definiti in admin.js e auth.js
// fetchAuthAPI è definito in admin.js

let allClients = [];

/**
 * Carica la lista di tutti i clienti
 */
async function loadClientsList() {
    try {
        allClients = await fetchAuthAPI('/admin/clients');

        if (!Array.isArray(allClients)) {
            console.error('I dati ricevuti non sono un array:', allClients);
            throw new Error('Formato dati non valido');
        }

        displayClientsList(allClients);
    } catch (error) {
        console.error('Errore caricamento clienti:', error);
        document.getElementById('clientsGrid').innerHTML = `
            <div style="text-align: center; padding: 40px; color: red; grid-column: 1/-1;">
                Errore caricamento clienti: ${error.message}
            </div>
        `;
    }
}

/**
 * Mostra la lista dei clienti nella griglia
 */
function displayClientsList(clients) {
    const grid = document.getElementById('clientsGrid');

    if (!clients || clients.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1/-1;">Nessun cliente trovato</div>';
        return;
    }

    grid.innerHTML = clients.map(client => {
        const statusBadge = client.is_active
            ? '<span class="client-badge">Attivo</span>'
            : '<span class="client-badge client-badge-inactive">Inattivo</span>';

        const langsDisplay = (client.available_langs || ['it']).map(l => l.toUpperCase()).join(', ');

        return `
            <div class="client-card" data-slug="${client.slug}">
                <div class="client-header">
                    <h3>${client.slug} - ${client.name}</h3>
                    ${statusBadge}
                </div>
                <div class="client-info" style="margin: 12px 0; color: #64748b; font-size: 14px;">
                    ${client.email ? `<div>📧 ${client.email}</div>` : ''}
                    <div>🌍 Lingue: ${langsDisplay}</div>
                </div>
                <div class="client-stats">
                    <div class="stat-item">
                        <span class="stat-label">POI:</span>
                        <span class="stat-value" id="${client.slug.toLowerCase()}POIs">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Video:</span>
                        <span class="stat-value" id="${client.slug.toLowerCase()}Videos">-</span>
                    </div>
                </div>
                <div class="client-actions">
                    <a href="poi-list.html?client=${client.slug}" class="btn-sm">Vedi POI</a>
                    <a href="../map.html?client=${client.slug}" target="_blank" class="btn-sm btn-outline">Mappa</a>
                    <a href="client-edit.html?slug=${client.slug}" class="btn-sm btn-outline">✏️ Modifica</a>
                    <button onclick="openDeleteClientModal('${client.slug}', '${client.name.replace(/'/g, "\\'")}')" class="btn-sm btn-danger">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    // Carica statistiche per ogni cliente
    loadClientsStats();
}

/**
 * Inizializza il form di aggiunta cliente
 */
function initClientForm() {
    const form = document.getElementById('clientForm');
    if (form) {
        form.addEventListener('submit', handleClientSubmit);
    }

    // Uppercase automatico per slug
    const slugInput = document.getElementById('clientSlug');
    if (slugInput) {
        slugInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
}

/**
 * Gestisce il submit del form nuovo cliente
 */
async function handleClientSubmit(e) {
    e.preventDefault();

    const formData = collectClientFormData();

    // Valida password se inserita
    const password = document.getElementById('clientPassword').value;
    const passwordConfirm = document.getElementById('clientPasswordConfirm').value;

    if (password && password !== passwordConfirm) {
        alert('Le password non coincidono');
        return;
    }

    if (password && password.length < 6) {
        alert('La password deve essere di almeno 6 caratteri');
        return;
    }

    try {
        await fetchAuthAPI('/admin/clients', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        alert('Cliente creato con successo!');
        window.location.href = 'clients.html';

    } catch (error) {
        console.error('Errore salvataggio cliente:', error);
        alert('Errore durante il salvataggio: ' + error.message);
    }
}

/**
 * Raccoglie i dati dal form cliente
 */
function collectClientFormData() {
    const availableLangs = Array.from(document.querySelectorAll('input[name="available_langs"]:checked'))
        .map(cb => cb.value);

    const data = {
        slug: document.getElementById('clientSlug').value.toUpperCase(),
        name: document.getElementById('clientName').value,
        email: document.getElementById('clientEmail').value || null,
        logo_url: document.getElementById('clientLogo').value || null,
        default_lang: document.getElementById('defaultLang').value,
        available_langs: availableLangs.length > 0 ? availableLangs : ['it'],
        is_active: document.getElementById('isActive').checked
    };

    // Aggiungi password se inserita
    const password = document.getElementById('clientPassword').value;
    if (password) {
        data.password = password;
    }

    return data;
}

/**
 * Inizializza il form di modifica cliente
 */
async function initClientEditForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientSlug = urlParams.get('slug');

    if (!clientSlug) {
        alert('Slug cliente mancante');
        window.location.href = 'clients.html';
        return;
    }

    try {
        // Carica dati cliente
        const client = await fetchAuthAPI(`/admin/clients/${clientSlug}`);

        // Mostra slug
        document.getElementById('currentClientSlug').textContent = client.slug;

        // Popola form
        populateClientForm(client);

        // Carica statistiche
        await loadClientStats(client.slug);

        // Genera codici embed
        await generateEmbedCodes(client.slug);

        // Nascondi loading, mostra form
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('clientForm').style.display = 'block';

        // Handle form submit
        const form = document.getElementById('clientForm');
        form.addEventListener('submit', (e) => handleClientUpdate(e, clientSlug));

    } catch (error) {
        console.error('Errore caricamento cliente:', error);
        alert('Errore caricamento cliente: ' + error.message);
        window.location.href = 'clients.html';
    }
}

/**
 * Popola il form con i dati del cliente
 */
function populateClientForm(client) {
    document.getElementById('clientSlug').value = client.slug;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientLogo').value = client.logo_url || '';
    document.getElementById('defaultLang').value = client.default_lang || 'it';
    document.getElementById('isActive').checked = client.is_active;

    // Seleziona lingue disponibili
    const availableLangs = client.available_langs || ['it'];
    document.querySelectorAll('input[name="available_langs"]').forEach(cb => {
        cb.checked = availableLangs.includes(cb.value);
    });

    // Mostra data creazione
    if (client.created_at) {
        const date = new Date(client.created_at);
        document.getElementById('clientCreatedAt').textContent = date.toLocaleDateString('it-IT');
    }
}

/**
 * Carica statistiche per un singolo cliente
 */
async function loadClientStats(slug) {
    try {
        // Carica POI del cliente
        const pois = await fetchAuthAPI('/admin/pois');
        const clientPOIs = pois.filter(poi => {
            const poiSlug = poi.client?.slug || poi.client_slug;
            return poiSlug === slug;
        });

        document.getElementById('clientPOICount').textContent = clientPOIs.length;

        // Conta video
        let videoCount = 0;
        clientPOIs.forEach(poi => {
            videoCount += (poi.videos || []).length;
        });
        document.getElementById('clientVideoCount').textContent = videoCount;

    } catch (error) {
        console.error('Errore caricamento statistiche cliente:', error);
    }
}

/**
 * Gestisce l'aggiornamento del cliente
 */
async function handleClientUpdate(e, clientSlug) {
    e.preventDefault();

    const formData = collectClientFormData();
    delete formData.slug; // Non si può modificare lo slug

    // Valida password se inserita
    const password = document.getElementById('clientPassword').value;
    const passwordConfirm = document.getElementById('clientPasswordConfirm').value;

    if (password && password !== passwordConfirm) {
        alert('Le password non coincidono');
        return;
    }

    if (password && password.length < 6) {
        alert('La password deve essere di almeno 6 caratteri');
        return;
    }

    try {
        await fetchAuthAPI(`/admin/clients/${clientSlug}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });

        alert('Cliente aggiornato con successo!');
        window.location.href = 'clients.html';

    } catch (error) {
        console.error('Errore aggiornamento cliente:', error);
        alert('Errore durante l\'aggiornamento: ' + error.message);
    }
}

/**
 * Apre il modal di conferma eliminazione cliente
 */
function openDeleteClientModal(slug, name) {
    const modal = document.getElementById('deleteClientModal');
    const confirmBtn = document.getElementById('confirmDeleteClient');
    const clientNameEl = document.getElementById('deleteClientName');

    if (clientNameEl) {
        clientNameEl.textContent = `${slug} - ${name}`;
    }

    modal.style.display = 'flex';

    confirmBtn.onclick = () => deleteClient(slug);
}

/**
 * Chiude il modal di eliminazione cliente
 */
function closeDeleteClientModal() {
    const modal = document.getElementById('deleteClientModal');
    modal.style.display = 'none';
}

/**
 * Elimina un cliente
 */
async function deleteClient(slug) {
    try {
        await fetchAuthAPI(`/admin/clients/${slug}`, {
            method: 'DELETE'
        });

        closeDeleteClientModal();
        alert('Cliente eliminato con successo');
        loadClientsList();

    } catch (error) {
        console.error('Errore eliminazione cliente:', error);
        alert('Errore durante l\'eliminazione: ' + error.message);
    }
}

// ============================================
// EMBED CODE GENERATOR
// ============================================

/**
 * Genera e mostra i codici embed per il cliente
 */
async function generateEmbedCodes(clientSlug) {
    const embedSection = document.getElementById('embedSection');
    if (!embedSection) return;

    try {
        // Carica POI del cliente
        const allPois = await fetchAuthAPI('/admin/pois');
        const clientPOIs = allPois.filter(poi => {
            const poiSlug = poi.client?.slug || poi.client_slug;
            return poiSlug === clientSlug;
        });

        if (clientPOIs.length === 0) {
            embedSection.style.display = 'block';
            embedSection.innerHTML = `
                <h3>📋 Codice Embed per Siti Esterni</h3>
                <p style="color: #64748b; padding: 20px; background: #f1f5f9; border-radius: 8px; text-align: center;">
                    Nessun POI trovato per questo cliente. Aggiungi dei POI per generare i codici embed.
                </p>
            `;
            return;
        }

        // Base URL (prendi dall'ambiente o usa default)
        const baseUrl = window.location.origin.replace('/admin', '').replace(':3000', ':3000');
        const frontendUrl = baseUrl.includes('admin') ? baseUrl.replace('/admin', '') : baseUrl;

        // Genera codice iframe mappa
        const mapEmbedCode = generateMapEmbedCode(clientSlug, frontendUrl);
        document.getElementById('mapEmbed').value = mapEmbedCode;

        // Genera lista POI HTML
        const poiListCode = generatePOIListEmbedCode(clientPOIs, frontendUrl);
        document.getElementById('poiListEmbed').value = poiListCode;

        // Genera link diretti
        generateDirectLinks(clientPOIs, frontendUrl);

        // Mostra sezione
        embedSection.style.display = 'block';

    } catch (error) {
        console.error('Errore generazione codici embed:', error);
    }
}

/**
 * Genera il codice iframe per la mappa
 */
function generateMapEmbedCode(clientSlug, baseUrl) {
    return `<!-- AVATOUR Mappa POI - ${clientSlug} -->
<div style="position: relative; width: 100%; padding-bottom: 75%; height: 0; overflow: hidden;">
    <iframe
        src="${baseUrl}/map.html?client=${clientSlug}&embed=true"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
        allowfullscreen
        loading="lazy"
        title="AVATOUR Mappa POI ${clientSlug}">
    </iframe>
</div>
<!-- Fine AVATOUR Mappa -->`;
}

/**
 * Genera il codice HTML per la lista POI
 */
function generatePOIListEmbedCode(pois, baseUrl) {
    const poiItems = pois.map(poi => {
        const name = poi.name || poi.poi_code;
        const description = poi.description ? poi.description.substring(0, 100) + '...' : '';
        const videoUrl = `${baseUrl}/poi/${poi.poi_code}`;

        return `    <li style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
        <a href="${videoUrl}" target="_blank" style="text-decoration: none; color: #1e40af; font-weight: 600;">
            📍 ${name}
        </a>
        ${description ? `<p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">${description}</p>` : ''}
    </li>`;
    }).join('\n');

    return `<!-- AVATOUR Lista POI -->
<div class="avatour-poi-list" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <h3 style="color: #1e40af; margin-bottom: 16px;">🎬 Tour Virtuali Disponibili</h3>
    <ul style="list-style: none; padding: 0; margin: 0;">
${poiItems}
    </ul>
    <p style="margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
        Powered by <a href="https://avatour.it" target="_blank" style="color: #f59e0b;">AVATOUR</a>
    </p>
</div>
<!-- Fine AVATOUR Lista POI -->`;
}

/**
 * Genera i link diretti ai video
 */
function generateDirectLinks(pois, baseUrl) {
    const container = document.getElementById('directLinksContainer');
    if (!container) return;

    container.innerHTML = pois.map(poi => {
        const name = poi.name || poi.poi_code;
        const videoUrl = `${baseUrl}/poi/${poi.poi_code}`;

        return `
            <div class="direct-link-item">
                <span class="poi-name">📍 ${name}</span>
                <div class="link-actions">
                    <input type="text" value="${videoUrl}" readonly class="link-input">
                    <button type="button" onclick="copyToClipboard('${videoUrl}')" class="btn-copy-small" title="Copia link">
                        📋
                    </button>
                    <a href="${videoUrl}" target="_blank" class="btn-open-small" title="Apri">
                        🔗
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Copia il codice embed negli appunti
 */
function copyEmbedCode(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    textarea.select();
    textarea.setSelectionRange(0, 99999); // Per mobile

    try {
        navigator.clipboard.writeText(textarea.value).then(() => {
            showCopyFeedback(textareaId);
        });
    } catch (err) {
        // Fallback per browser più vecchi
        document.execCommand('copy');
        showCopyFeedback(textareaId);
    }
}

/**
 * Copia un testo negli appunti
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Feedback visivo temporaneo
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = '#10b981';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 1500);
    });
}

/**
 * Mostra feedback dopo la copia
 */
function showCopyFeedback(textareaId) {
    const textarea = document.getElementById(textareaId);
    const originalBg = textarea.style.background;
    textarea.style.background = '#d1fae5';
    setTimeout(() => {
        textarea.style.background = originalBg || '#f8fafc';
    }, 1500);

    // Alert o toast
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = '✓ Codice copiato!';
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}
