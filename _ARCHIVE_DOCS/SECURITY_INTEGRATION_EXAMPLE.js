/**
 * EXEMPLE D'INTÉGRATION DES MIDDLEWARES DE SÉCURITÉ
 * À intégrer dans server/index.js
 */

// ================================================
// IMPORTS
// ================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Middlewares de sécurité
import {
    generalLimiter,
    strictLimiter,
    apiLimiter,
    exportLimiter,
    mutationLimiter
} from './middleware/rateLimiter.js';

import {
    securityHeaders,
    sanitizeInput,
    csrfProtection,
    suspiciousActivityLogger,
    requestTimeout,
    bodyLimiter
} from './middleware/security.js';

import {
    validate,
    clientSchema,
    deliverySchema,
    stockUpdateSchema,
    stockQuerySchema,
    reportQuerySchema
} from './middleware/validation.js';

// ================================================
// CONFIGURATION DE L'APP
// ================================================

const app = express();

// 1. CORS (avant tout)
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Headers de sécurité (Helmet)
app.use(securityHeaders);

// 3. Timeout des requêtes
app.use(requestTimeout(30000)); // 30 secondes

// 4. Limitation de taille du body
app.use(express.json(bodyLimiter.json));
app.use(express.urlencoded(bodyLimiter.urlencoded));

// 5. Sanitization des entrées
app.use(sanitizeInput);

// 6. Détection d'activité suspecte
app.use(suspiciousActivityLogger);

// 7. Protection CSRF
app.use(csrfProtection);

// 8. Rate limiting général
app.use(generalLimiter);

// ================================================
// ROUTES AVEC SÉCURITÉ
// ================================================

// Route publique (pas de rate limiting strict)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes API avec rate limiting
app.use('/api', apiLimiter);

// ================================================
// EXEMPLES DE ROUTES SÉCURISÉES
// ================================================

// GET avec validation des query params
app.get('/api/stock/global',
    validate(stockQuerySchema, 'query'),
    async (req, res) => {
        try {
            const { zone } = req.query; // Validé par Zod
            // ... logique métier
            res.json({ zone, stock: 1000 });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// POST avec validation du body et rate limiting strict
app.post('/api/clients',
    mutationLimiter, // Limite les modifications
    validate(clientSchema), // Valide le body
    async (req, res) => {
        try {
            const client = req.body; // Validé par Zod
            // ... logique de création
            res.status(201).json({ success: true, client });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// PUT avec validation
app.put('/api/clients/:id',
    mutationLimiter,
    validate(clientSchema),
    async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            // ... logique de mise à jour
            res.json({ success: true, id, updates });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Route d'export avec rate limiting strict
app.post('/api/reports/export',
    exportLimiter, // Max 5 exports par heure
    validate(reportQuerySchema),
    async (req, res) => {
        try {
            const { type, format, dateRange } = req.body;
            // ... logique d'export
            res.json({ success: true, type, format });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Route de livraison avec validation
app.post('/api/deliveries',
    mutationLimiter,
    validate(deliverySchema),
    async (req, res) => {
        try {
            const delivery = req.body;
            // ... logique de planification
            res.status(201).json({ success: true, delivery });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Route de stock avec validation
app.post('/api/stock/add',
    mutationLimiter,
    validate(stockUpdateSchema),
    async (req, res) => {
        try {
            const { zone, quantite } = req.body;
            // ... logique d'ajout de stock
            res.json({ success: true, zone, quantite });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ================================================
// GESTION DES ERREURS
// ================================================

// 404 - Route non trouvée
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Route non trouvée',
        path: req.path
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Erreur de validation
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }

    // Erreur de rate limiting
    if (err.status === 429) {
        return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Trop de requêtes, veuillez réessayer plus tard'
        });
    }

    // Erreur générique
    res.status(err.status || 500).json({
        error: err.name || 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'Une erreur est survenue'
            : err.message
    });
});

// ================================================
// DÉMARRAGE DU SERVEUR
// ================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🔒 Serveur sécurisé démarré sur le port ${PORT}`);
    console.log(`📊 Rate limiting activé`);
    console.log(`🛡️ Headers de sécurité configurés`);
    console.log(`✅ Validation des données activée`);
});

// ================================================
// NOTES D'IMPLÉMENTATION
// ================================================

/*
CHECKLIST D'INTÉGRATION :

1. ✅ Installer les dépendances :
   npm install express-rate-limit helmet cors zod

2. ✅ Copier les middlewares dans server/middleware/

3. ✅ Importer les middlewares dans server/index.js

4. ✅ Appliquer les middlewares dans l'ordre correct :
   - CORS
   - Helmet
   - Timeout
   - Body parser
   - Sanitization
   - Suspicious activity logger
   - CSRF protection
   - Rate limiting

5. ✅ Ajouter la validation sur les routes sensibles

6. ✅ Tester les limites de rate limiting

7. ✅ Vérifier les headers de sécurité

8. ✅ Tester la validation des données

VARIABLES D'ENVIRONNEMENT À AJOUTER :

- ALLOWED_ORIGINS : Liste des origines autorisées (séparées par des virgules)
- NODE_ENV : 'production' ou 'development'

EXEMPLE .env :
ALLOWED_ORIGINS=https://votre-app.vercel.app,http://localhost:5173
NODE_ENV=production
*/
