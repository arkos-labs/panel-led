# 📊 SYSTÈME DE MONITORING ET LOGS - DOCUMENTATION COMPLÈTE

**Date** : 04 Janvier 2026  
**Version** : 1.0.0  
**Statut** : ✅ Implémenté

---

## 🎯 FONCTIONNALITÉS IMPLÉMENTÉES

### **1. Logger Backend** (`server/logger.js`)
- ✅ Logs structurés en JSON
- ✅ 4 niveaux : ERROR, WARN, INFO, DEBUG
- ✅ Rotation automatique des fichiers (10 MB max)
- ✅ Nettoyage automatique (> 30 jours)
- ✅ Middleware Express pour requêtes HTTP
- ✅ Middleware pour capture d'erreurs

### **2. Logger Frontend** (`src/services/logger.ts`)
- ✅ Capture d'erreurs globales (window.error)
- ✅ Capture de promesses rejetées
- ✅ Capture d'erreurs de ressources
- ✅ Buffer de logs avec envoi automatique
- ✅ Envoi au backend toutes les 10 secondes

### **3. Error Boundary** (`src/components/ErrorBoundary.tsx`)
- ✅ Composant React pour capturer les erreurs
- ✅ UI d'erreur professionnelle
- ✅ Boutons de récupération (Réessayer, Accueil)
- ✅ Détails techniques en mode dev
- ✅ Code d'erreur unique pour support

### **4. Analytics** (`src/services/analytics.ts`)
- ✅ Tracking d'événements métier
- ✅ Suivi de session
- ✅ Buffer avec envoi automatique
- ✅ Méthodes spécifiques (livraisons, installations, stock)
- ✅ Stockage dans Supabase

### **5. Performance Monitor** (`src/services/performance.ts`)
- ✅ Mesure des temps de chargement
- ✅ Détection de Long Tasks (> 50ms)
- ✅ Mesure d'appels API
- ✅ Web Vitals (FCP, LCP)
- ✅ Alertes pour opérations lentes

---

## 📦 FICHIERS CRÉÉS

```
server/
├── logger.js                    # Logger backend
└── logs/                        # Dossier de logs (créé auto)
    ├── error.log
    ├── warn.log
    ├── info.log
    └── debug.log

src/
├── services/
│   ├── logger.ts               # Logger frontend
│   ├── analytics.ts            # Service d'analytics
│   └── performance.ts          # Monitoring de performance
└── components/
    └── ErrorBoundary.tsx       # Composant Error Boundary
```

---

## 🚀 UTILISATION

### **1. Logger Backend**

```javascript
// Dans server/index.js
import logger, { requestLogger, errorLogger } from './logger.js';

// Middleware pour logger les requêtes
app.use(requestLogger);

// Logger manuellement
logger.info('Serveur démarré', { port: 3001 });
logger.error('Erreur connexion DB', { error: err.message });
logger.warn('Stock critique', { zone: 'FR', remaining: 100 });
logger.debug('Debug info', { data: someData });

// Logger une exception
try {
  // ...
} catch (error) {
  logger.exception(error, { context: 'additional info' });
}

// Middleware d'erreurs (à la fin)
app.use(errorLogger);
```

### **2. Logger Frontend**

```typescript
// Dans n'importe quel composant
import logger from '@/services/logger';

// Logger une erreur
logger.error('Erreur chargement clients', { error: err.message });

// Logger un warning
logger.warn('Stock faible', { zone: 'FR', remaining: 100 });

// Logger une info
logger.info('Client créé', { clientId: '123' });

// Logger une exception
try {
  // ...
} catch (error) {
  logger.exception(error, { component: 'ClientForm' });
}

// Logger un événement métier
logger.event('delivery_completed', { clientId: '123', duration: 45 });

// Logger une action utilisateur
logger.userAction('button_clicked', { button: 'export_pdf' });
```

### **3. Error Boundary**

```typescript
// Dans App.tsx ou main.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}

// Ou avec un fallback personnalisé
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>

// Hook pour déclencher une erreur manuellement
import { useErrorHandler } from '@/components/ErrorBoundary';

function MyComponent() {
  const handleError = useErrorHandler();

  const doSomething = () => {
    try {
      // ...
    } catch (error) {
      handleError(error);
    }
  };
}
```

### **4. Analytics**

```typescript
import analytics from '@/services/analytics';

// Définir l'utilisateur (après login)
analytics.setUser('user-123');

// Tracker une page vue
analytics.pageView('Dashboard');

// Tracker une action utilisateur
analytics.userAction('export_clicked', { format: 'pdf' });

// Événements métier spécifiques
analytics.deliveryPlanned('client-123', '2026-01-10', 'FR');
analytics.deliveryCompleted('client-123', 45); // 45 minutes

analytics.installationPlanned('client-456', '2026-01-15', 'GP');
analytics.installationStarted('client-456');
analytics.installationCompleted('client-456', 2.5, 500); // 2.5h, 500 LEDs

analytics.stockAdded('FR', 5000);
analytics.stockCritical('FR', 100, 15); // 100 LEDs, 15%

analytics.reportGenerated('deliveries', 'pdf', 50);
analytics.routeOptimized(10, 1500); // 10 clients, 1500ms
```

### **5. Performance Monitor**

```typescript
import performanceMonitor from '@/services/performance';

// Mesurer une opération
performanceMonitor.start('load_clients');
// ... opération ...
const duration = performanceMonitor.end('load_clients', true); // true = log to console

// Mesurer une fonction async
const clients = await performanceMonitor.measure('fetch_clients', async () => {
  return await fetchClients();
});

// Mesurer un appel API
const data = await performanceMonitor.measureApiCall(
  'get_stock',
  'GET',
  '/api/stock/global',
  async () => {
    return await fetch('/api/stock/global?zone=FR').then(r => r.json());
  }
);

// Obtenir les Web Vitals
const vitals = performanceMonitor.getWebVitals();
console.log('FCP:', vitals.fcp, 'LCP:', vitals.lcp);
```

---

## 📊 STRUCTURE DES LOGS

### **Format Backend (JSON)**

```json
{
  "timestamp": "2026-01-04T21:30:00.000Z",
  "level": "INFO",
  "message": "HTTP Request",
  "method": "GET",
  "url": "/api/clients",
  "status": 200,
  "duration": "45ms",
  "ip": "127.0.0.1",
  "pid": 12345
}
```

### **Format Frontend (JSON)**

```json
{
  "timestamp": "2026-01-04T21:30:00.000Z",
  "level": "error",
  "message": "Failed to fetch clients",
  "meta": {
    "error": "Network error",
    "component": "ClientsView"
  },
  "userAgent": "Mozilla/5.0...",
  "url": "http://localhost:5173/clients"
}
```

---

## 🗄️ TABLE SUPABASE POUR ANALYTICS

Créer cette table dans Supabase :

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_properties JSONB,
  user_id TEXT,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes rapides
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_category ON analytics_events(event_category);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);
```

---

## 📈 DASHBOARD D'ANALYTICS (REQUÊTES SQL)

### **Événements les plus fréquents (24h)**

```sql
SELECT 
  event_name,
  event_category,
  COUNT(*) as count
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY event_name, event_category
ORDER BY count DESC
LIMIT 10;
```

### **Sessions par jour**

```sql
SELECT 
  DATE(timestamp) as date,
  COUNT(DISTINCT session_id) as sessions
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### **Temps moyen des opérations**

```sql
SELECT 
  event_name,
  AVG((event_properties->>'duration')::numeric) as avg_duration_ms
FROM analytics_events
WHERE event_category = 'performance'
  AND event_properties->>'duration' IS NOT NULL
GROUP BY event_name
ORDER BY avg_duration_ms DESC;
```

---

## 🔧 INTÉGRATION DANS L'APPLICATION

### **1. Ajouter l'Error Boundary dans App.tsx**

```typescript
// src/App.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* ... */}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
```

### **2. Ajouter le logger backend dans server/index.js**

```javascript
// server/index.js (ligne 8)
import logger, { requestLogger, errorLogger } from './logger.js';

// Après app.use(express.json()) (ligne 31)
app.use(requestLogger);

// Route pour recevoir les logs frontend
app.post('/api/logs', (req, res) => {
  const { logs } = req.body;
  
  if (Array.isArray(logs)) {
    logs.forEach(log => {
      logger.log(log.level.toUpperCase(), log.message, log.meta || {});
    });
  }
  
  res.json({ success: true });
});

// Route health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    logs: logger.getStats()
  });
});

// À la fin, avant app.listen
app.use(errorLogger);
```

### **3. Tracker les événements dans les vues**

```typescript
// Exemple dans LivraisonsView.tsx
import analytics from '@/services/analytics';

export function LivraisonsView() {
  useEffect(() => {
    analytics.pageView('Livraisons');
  }, []);

  const handlePlanDelivery = (clientId, date, zone) => {
    // ... logique de planification ...
    analytics.deliveryPlanned(clientId, date, zone);
  };

  return (
    // ...
  );
}
```

---

## ⚠️ NOTES IMPORTANTES

### **1. Logs Backend**

**Emplacement** : `server/logs/`
- `error.log` : Erreurs uniquement
- `warn.log` : Warnings
- `info.log` : Informations
- `debug.log` : Debug (désactivé en production)

**Rotation** : Automatique à 10 MB
**Nettoyage** : Automatique après 30 jours

### **2. Performance**

**Impact minimal** :
- Buffer de logs (envoi par batch)
- Logs asynchrones
- Pas de blocage de l'UI

**Désactivation en production** :
```javascript
// Dans logger.ts
enableConsole: import.meta.env.DEV // Console uniquement en dev
```

### **3. Vie privée**

**Données collectées** :
- URL de la page
- User Agent
- Événements métier (sans données personnelles)
- Erreurs et stack traces

**Non collecté** :
- Mots de passe
- Données sensibles
- Informations personnelles

---

## 🚀 PROCHAINES ÉTAPES

### **Intégration** (À faire)
- [ ] Ajouter Error Boundary dans App.tsx
- [ ] Ajouter middlewares logger dans server/index.js
- [ ] Créer la table analytics_events dans Supabase
- [ ] Ajouter tracking dans les vues principales
- [ ] Tester les logs en dev

### **Améliorations futures** (Optionnel)
- [ ] Dashboard d'analytics dans l'app
- [ ] Alertes email pour erreurs critiques
- [ ] Intégration Sentry (si souhaité)
- [ ] Export des logs en CSV
- [ ] Graphiques de performance

---

## ✅ CHECKLIST

- [x] Logger backend créé
- [x] Logger frontend créé
- [x] Error Boundary créé
- [x] Service Analytics créé
- [x] Service Performance créé
- [x] Documentation complète
- [ ] Intégration dans App.tsx
- [ ] Intégration dans server/index.js
- [ ] Table Supabase créée
- [ ] Tests effectués

---

**Date de création** : 04 Janvier 2026  
**Créé par** : Antigravity AI  
**Statut** : ✅ PRÊT POUR INTÉGRATION
