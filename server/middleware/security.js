/**
 * 🔒 MIDDLEWARE DE SÉCURITÉ
 * 
 * Ce fichier centralise les mesures de sécurité structurelles :
 * - Headers de sécurité (Helmet)
 * - Protection CSRF
 * - Sanitization des données
 * - Logging des activités suspectes
 * - Timeouts de requête
 * - Authentification par API Key
 */

import helmet from 'helmet';

/**
 * Configuration Helmet pour la sécurité
 */
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://unpkg.com",
                "https://cdn.jsdelivr.net",
                "https://vercel.live"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://unpkg.com",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "data:"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "blob:"
            ],
            connectSrc: [
                "'self'",
                "https:",
                "wss:",
                "ws://localhost:*",
                "http://localhost:*"
            ],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Middleware de sanitization récursive des entrées
 */
export function sanitizeInput(req, res, next) {
    const clean = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .replace(/[<>]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim();
        }
        if (Array.isArray(obj)) return obj.map(clean);
        if (obj !== null && typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                cleaned[key] = clean(value);
            }
            return cleaned;
        }
        return obj;
    };

    if (req.body) {
        const cleaned = clean(req.body);
        // On ne réassigne pas l'objet entier car il peut être en lecture seule (getter)
        Object.assign(req.body, cleaned);
    }
    if (req.query) {
        const cleaned = clean(req.query);
        // On ne réassigne pas req.query directement
        // Note: Object.assign sur req.query peut échouer si les propriétés sont en lecture seule également
        // Mais c'est plus sûr que la réassignation totale.
        try {
            Object.assign(req.query, cleaned);
        } catch (e) {
            console.warn("Could not sanitize req.query: Properties are read-only");
        }
    }
    if (req.params) {
        const cleaned = clean(req.params);
        Object.assign(req.params, cleaned);
    }

    next();
}

/**
 * Middleware de protection CSRF (basé sur l'origine)
 */
export function csrfProtection(req, res, next) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const origin = req.get('origin');
        const host = req.get('host');

        if (process.env.NODE_ENV === 'production' && origin) {
            try {
                const originHost = new URL(origin).host;
                if (originHost !== host) {
                    console.warn(`🚨 CSRF attempt detected: origin=${origin}, host=${host}`);
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: 'Origine non autorisée'
                    });
                }
            } catch (e) {
                return res.status(403).json({ error: 'Origine invalide' });
            }
        }
    }
    next();
}

/**
 * Authentification par API Key pour les endpoints sensibles
 */
export function requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

    if (process.env.NODE_ENV === 'development' && validKeys.length === 0) {
        return next();
    }

    if (!apiKey || !validKeys.includes(apiKey)) {
        return res.status(401).json({
            error: 'Clé API invalide ou manquante'
        });
    }
    next();
}

/**
 * Détection d'activité suspecte (Patterns d'attaque)
 */
export function suspiciousActivityLogger(req, res, next) {
    const suspiciousPatterns = [
        /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i,
        /<script|javascript:|onerror=/i,
        /(union|select|insert|update|delete|drop|create|alter)\s/i,
        /(\$\{|<%|%>)/i,
    ];

    const checkString = `${req.url} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkString)) {
            console.error(`🚨 ACTIVITÉ SUSPECTE DÉTECTÉE [IP: ${req.ip}]:`, {
                method: req.method,
                url: req.url,
                userAgent: req.get('user-agent')
            });
            break;
        }
    }
    next();
}

/**
 * Middleware de timeout des requêtes
 */
export function requestTimeout(timeoutMs = 30000) {
    return (req, res, next) => {
        req.setTimeout(timeoutMs, () => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request Timeout',
                    message: 'La requête a pris trop de temps'
                });
            }
        });
        next();
    };
}

/**
 * Limitation de taille du body
 */
export const bodyLimiter = {
    json: { limit: '10mb' },
    urlencoded: { limit: '10mb', extended: true }
};

export default {
    securityHeaders,
    sanitizeInput,
    csrfProtection,
    requireApiKey,
    suspiciousActivityLogger,
    requestTimeout,
    bodyLimiter
};
