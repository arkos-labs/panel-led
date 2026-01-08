# 🔐 SÉCURITÉ - DOCUMENTATION TECHNIQUE (Mise à jour)

Cette application utilise une architecture de sécurité en trois couches (Middlewares).

## 📁 Structure des fichiers

1.  `server/middleware/security.js` : Protections structurelles et protocolaires.
2.  `server/middleware/rateLimiter.js` : Contrôle des flux et prévention des abus (DoS/Brute-force).
3.  `server/middleware/validation.js` : Validation et typage des données entrantes (Zod).

---

## 🛡️ Couche 1 : Sécurité Protocolaire (`security.js`)

Appliqué globalement au démarrage du serveur.

- **Helmet** : Configure les headers HTTP (`CSP`, `HSTS`, `X-XSS-Protection`, etc.).
- **Sanitization** : Nettoie récursivement `body`, `query` et `params` (supprime `<script>`, `javascript:`, etc.).
- **CSRF Protection** : Vérifie l'origine des requêtes en production.
- **Suspicious Activity Logger** : Détecte les patterns d'attaque (SQLi, Path Traversal, XSS) dans les logs.
- **Request Timeout** : Empêche les requêtes de bloquer le serveur indéfiniment (défaut 30s).

---

## 🚦 Couche 2 : Rate Limiting (`rateLimiter.js`)

Limite le nombre de requêtes par IP.

| Limiteur | Paramètres | Usage recommandé |
| :--- | :--- | :--- |
| `generalLimiter` | 100 req / 15m | Routes publiques et générales |
| `apiLimiter` | 50 req / 1m | Routes API standards (VROOM, etc.) |
| `strictLimiter` | 10 req / 15m | Routes sensibles (Validation chauffeur) |
| `geoLimiter` | 30 req / 1m | Géocodage externe |
| `scanLimiter` | 1 req / 5m | Opérations lourdes (Scan GPS global) |
| `mutationLimiter` | 30 req / 1h | Écritures base de données |

---

## ✅ Couche 3 : Validation des données (`validation.js`)

Utilise **Zod** pour garantir l'integrité des données.

**Usage :**
```javascript
import { validate, stockUpdateSchema } from './middleware/validation.js';

app.post('/api/stock/add', validate(stockUpdateSchema), async (req, res) => {
    // req.body est garanti conforme au schéma
});
```

---

## 🔑 Authentification API Key

Pour protéger des endpoints internes ou sensibles sans système de login complet :
Utilisez `requireApiKey` de `security.js`. La clé doit être envoyée dans le header `x-api-key`.
Configurez les clés autorisées dans `.env` : `API_KEYS=key1,key2`.

---

## 🧪 Comment tester ?

1.  **Rate Limit** : Envoyez plus de 100 requêtes en moins de 15 minutes sur une route API.
2.  **Validation** : Envoyez des données mal formées à `/api/stock/add`.
3.  **XSS** : Essayez d'injecter `<script>alert('xss')</script>` dans un champ texte.
4.  **Suspicion** : Essayez d'accéder à `/api/../../etc/passwd`.

---
**Dernière mise à jour** : 04 Janvier 2026
**Statut** : ✅ PRODUCTION READY
