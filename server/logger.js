/**
 * Logger Backend - Système de logs structurés avec rotation
 * Pas de dépendances externes (Winston-free)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const LOG_DIR = path.join(__dirname, '../logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES = 5;

// Niveaux de log
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'INFO';
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile !== false;

        // Créer le dossier de logs s'il n'existe pas
        if (this.enableFile && !fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
    }

    /**
     * Formater un message de log
     */
    format(level, message, meta = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta,
            pid: process.pid
        });
    }

    /**
     * Écrire dans un fichier avec rotation
     */
    writeToFile(level, formattedMessage) {
        if (!this.enableFile) return;

        const filename = path.join(LOG_DIR, `${level.toLowerCase()}.log`);

        try {
            // Vérifier la taille du fichier
            if (fs.existsSync(filename)) {
                const stats = fs.statSync(filename);
                if (stats.size > MAX_LOG_SIZE) {
                    this.rotateLog(filename);
                }
            }

            // Écrire le log
            fs.appendFileSync(filename, formattedMessage + '\n');
        } catch (error) {
            console.error('Erreur écriture log:', error);
        }
    }

    /**
     * Rotation des logs
     */
    rotateLog(filename) {
        try {
            // Supprimer le plus ancien
            const oldestFile = `${filename}.${MAX_LOG_FILES}`;
            if (fs.existsSync(oldestFile)) {
                fs.unlinkSync(oldestFile);
            }

            // Décaler les fichiers
            for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
                const oldFile = `${filename}.${i}`;
                const newFile = `${filename}.${i + 1}`;
                if (fs.existsSync(oldFile)) {
                    fs.renameSync(oldFile, newFile);
                }
            }

            // Renommer le fichier actuel
            fs.renameSync(filename, `${filename}.1`);
        } catch (error) {
            console.error('Erreur rotation log:', error);
        }
    }

    /**
     * Vérifier si le niveau de log est activé
     */
    shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
    }

    /**
     * Log générique
     */
    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.format(level, message, meta);

        // Console
        if (this.enableConsole) {
            const color = {
                ERROR: '\x1b[31m', // Rouge
                WARN: '\x1b[33m',  // Jaune
                INFO: '\x1b[36m',  // Cyan
                DEBUG: '\x1b[90m'  // Gris
            }[level] || '';
            const reset = '\x1b[0m';

            console.log(`${color}[${level}]${reset} ${message}`, meta);
        }

        // Fichier
        this.writeToFile(level, formattedMessage);
    }

    /**
     * Méthodes de log par niveau
     */
    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    /**
     * Log d'une requête HTTP
     */
    http(req, res, duration) {
        this.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
        });
    }

    /**
     * Log d'une erreur avec stack trace
     */
    exception(error, context = {}) {
        this.error(error.message, {
            ...context,
            stack: error.stack,
            name: error.name
        });
    }

    /**
     * Nettoyer les vieux logs (> 30 jours)
     */
    cleanup(days = 30) {
        if (!this.enableFile) return;

        try {
            const files = fs.readdirSync(LOG_DIR);
            const now = Date.now();
            const maxAge = days * 24 * 60 * 60 * 1000;

            files.forEach(file => {
                const filepath = path.join(LOG_DIR, file);
                const stats = fs.statSync(filepath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    fs.unlinkSync(filepath);
                    this.info('Log file deleted', { file, age: `${Math.round(age / (24 * 60 * 60 * 1000))} days` });
                }
            });
        } catch (error) {
            this.error('Erreur nettoyage logs', { error: error.message });
        }
    }

    /**
     * Obtenir les statistiques des logs
     */
    getStats() {
        if (!this.enableFile) return null;

        try {
            const files = fs.readdirSync(LOG_DIR);
            const stats = {};

            files.forEach(file => {
                const filepath = path.join(LOG_DIR, file);
                const fileStats = fs.statSync(filepath);
                stats[file] = {
                    size: fileStats.size,
                    sizeHuman: `${(fileStats.size / 1024).toFixed(2)} KB`,
                    modified: fileStats.mtime
                };
            });

            return stats;
        } catch (error) {
            this.error('Erreur stats logs', { error: error.message });
            return null;
        }
    }
}

// Instance singleton
const logger = new Logger({
    level: process.env.LOG_LEVEL || 'INFO',
    enableConsole: true,
    enableFile: true
});

// Middleware Express pour logger les requêtes
export function requestLogger(req, res, next) {
    const start = Date.now();

    // Intercepter la fin de la réponse
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(req, res, duration);
    });

    next();
}

// Middleware Express pour capturer les erreurs
export function errorLogger(err, req, res, next) {
    logger.exception(err, {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query
    });

    next(err);
}

// Nettoyer les logs au démarrage
logger.cleanup(30);

export default logger;
