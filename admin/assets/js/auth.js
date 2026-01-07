/**
 * AVATOUR Admin - Authentication Module
 * Gestisce login/logout tramite API backend con JWT
 */

const AUTH_KEY = 'avatour_admin_token';
const USER_KEY = 'avatour_user';

// API_BASE è definito in admin.js
// Per il login standalone, usa un valore di default se non definito
const getApiBase = () => {
    return (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:3000/api';
};

/**
 * Effettua il login tramite API
 */
async function login(email, password) {
    try {
        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login fallito');
        }

        const data = await response.json();

        // Il token può essere in data.token o data.data.token
        const token = data.token || data.data?.token;
        const user = data.user || data.data?.user;

        if (!token) {
            throw new Error('Token non ricevuto dal server');
        }

        // Salva token e user info in localStorage
        localStorage.setItem(AUTH_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        return { success: true, user };

    } catch (error) {
        console.error('Errore login:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Effettua il logout
 */
function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'login.html';
}

/**
 * Verifica se l'utente è autenticato
 */
function isAuthenticated() {
    const token = localStorage.getItem(AUTH_KEY);
    return token !== null && token !== '';
}

/**
 * Controlla l'autenticazione e reindirizza al login se necessario
 */
function checkAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}

/**
 * Ottiene i dati utente correnti
 */
function getCurrentUser() {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
        try {
            return JSON.parse(userJson);
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Ottiene il nome utente corrente
 */
function getUsername() {
    const user = getCurrentUser();
    return user?.full_name || user?.email || 'Admin';
}

/**
 * Ottiene il ruolo utente corrente
 */
function getUserRole() {
    const user = getCurrentUser();
    return user?.role || 'viewer';
}

/**
 * Ottiene il token di autenticazione
 */
function getAuthToken() {
    return localStorage.getItem(AUTH_KEY);
}

/**
 * Verifica se l'utente ha un determinato ruolo
 */
function hasRole(...roles) {
    const userRole = getUserRole();
    return roles.includes(userRole);
}
