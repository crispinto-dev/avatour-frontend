# AVATOUR Admin Panel

Pannello di amministrazione per la gestione dei POI, video e clienti del progetto AVATOUR.

## 🔐 Credenziali di Accesso

- **Username:** `admin`
- **Password:** `avatour2025`

## 🚀 Accesso

Apri il browser e vai a:

```
http://localhost:3000/admin/login.html
```

## 📋 Funzionalità

### 1. Dashboard
- Statistiche generali (totale POI, clienti, video, lingue)
- Lista POI recenti
- Accesso rapido alle sezioni

### 2. Gestione POI
- **Lista POI**: Visualizza tutti i POI con filtri per ricerca e cliente
- **Aggiungi POI**: Crea nuovi punti di interesse
  - Selezione cliente e generazione automatica codice
  - Mappa interattiva per scegliere la posizione
  - Gestione lingue multiple
  - Configurazione video per ogni lingua (Vimeo, Cloudflare, Local)
- **Modifica POI**: Aggiorna POI esistenti
- **Elimina POI**: Rimuovi POI dal sistema

### 3. Gestione Clienti
- Visualizza statistiche per ogni cliente
- Accesso rapido alla lista POI del cliente
- Link alla mappa pubblica del cliente

## 🗂️ Struttura Files

```
avatour-demo/admin/
├── login.html              # Pagina di login
├── dashboard.html          # Dashboard principale
├── poi-list.html          # Lista POI
├── poi-add.html           # Aggiungi nuovo POI
├── poi-edit.html          # Modifica POI esistente
├── clients.html           # Gestione clienti
├── assets/
│   ├── css/
│   │   └── admin.css      # Stili admin panel
│   └── js/
│       ├── auth.js        # Sistema autenticazione
│       ├── admin.js       # Funzioni generali admin
│       └── poi-manager.js # Gestione POI
```

## 🔧 API Utilizzate

### Admin Routes
- `GET /api/admin/pois` - Ottiene tutti i POI
- `POST /api/admin/pois` - Crea nuovo POI
- `PUT /api/admin/pois/:poi_code` - Aggiorna POI
- `DELETE /api/admin/pois/:poi_code` - Elimina POI
- `GET /api/admin/stats` - Statistiche generali

### Public Routes
- `GET /api/poi` - Lista POI pubblici
- `GET /api/poi/:poi_code` - Dettagli POI
- `GET /api/clients/:client_slug/pois` - POI per cliente

## 📝 Come Aggiungere un Nuovo POI

1. Vai su **POI** → **Aggiungi POI**
2. Seleziona il **cliente** (PAL, ROM, BST, TSC)
3. Inserisci il **numero POI** (es: 1, 2, 3...)
   - Il codice verrà generato automaticamente (es: PAL-001)
4. Inserisci il **nome del POI**
5. Aggiungi una **descrizione** (opzionale)
6. Seleziona la **posizione** sulla mappa o inserisci coordinate
7. Seleziona le **lingue disponibili**
8. Per ogni lingua selezionata, configura il **video**:
   - Scegli l'host (Vimeo, Cloudflare, Local)
   - Inserisci l'ID del video
9. Clicca **Salva POI**

## 🎥 Configurazione Video

### Vimeo
- Host: `vimeo`
- Video ID: es. `123456789` (ID del video Vimeo)

### Cloudflare Stream
- Host: `cloudflare`
- Video ID: Customer ID di Cloudflare Stream

### File Locale
- Host: `local`
- Video ID: Nome del file video (es: `capo_palinuro.mp4`)

## 🗺️ Mappa Interattiva

Il form di aggiunta/modifica POI include una mappa Leaflet interattiva:

- **Click sulla mappa**: Posiziona il marker
- **Drag del marker**: Sposta la posizione
- **Input coordinate**: Aggiorna automaticamente il marker

## 🔍 Filtri e Ricerca

Nella lista POI puoi:
- Cercare per nome o codice POI
- Filtrare per cliente specifico
- Visualizzare coordinate, lingue disponibili

## 🎨 Design

Il pannello admin utilizza:
- Font: **Inter** (Google Fonts)
- Colori:
  - Primary: `#1e40af` (Blu Navy)
  - Accent: `#f59e0b` (Arancione)
  - Danger: `#dc2626` (Rosso)
  - Success: `#10b981` (Verde)
- Layout responsive con sidebar fissa
- Cards con shadow e hover effects
- Form ben spaziati e validati

## 🔒 Sicurezza

⚠️ **IMPORTANTE**: Il sistema di autenticazione attuale è di base e va utilizzato solo in sviluppo.

Per produzione implementare:
- Sistema di autenticazione robusto (JWT, OAuth)
- Hashing delle password
- Rate limiting sulle route admin
- HTTPS obbligatorio
- Protezione CSRF
- Validazione server-side completa

## 📱 Responsive

Il pannello è ottimizzato per:
- Desktop (1920x1080+)
- Tablet (768px+)
- Mobile (nasconde sidebar, layout verticale)

## 🐛 Troubleshooting

### Errore "API Error"
- Verifica che il backend sia in esecuzione su `http://localhost:3000`
- Controlla la console del browser (F12) per dettagli errore

### Non riesco a fare login
- Usa le credenziali: `admin` / `avatour2025`
- Cancella localStorage del browser se necessario

### La mappa non si carica
- Verifica connessione internet (usa CDN Leaflet)
- Controlla console per errori JavaScript

### Le modifiche non vengono salvate
- Verifica che il file `avatour-backend/data/pois.json` sia scrivibile
- Controlla i permessi della cartella

## 🚀 Next Steps

Possibili miglioramenti futuri:
- Upload immagini thumbnail per POI
- Gestione sottotitoli per video
- Sistema di versioning delle modifiche
- Export/Import POI in CSV/JSON
- Dashboard con grafici statistici
- Log delle attività admin
- Gestione utenti multipli con ruoli
- Preview video direttamente nell'admin
- Batch operations (modifica multipla POI)

## 📞 Supporto

Per problemi o domande, contatta il team di sviluppo AVATOUR.
