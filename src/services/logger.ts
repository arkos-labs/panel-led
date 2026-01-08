/**
 * Logger Frontend - Capture d'erreurs et événements
 * Envoie les logs au backend pour centralisation
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    meta?: Record<string, any>;
    userAgent?: string;
    url?: string;
}

class FrontendLogger {
    private apiUrl: string;
    private enableConsole: boolean;
    private enableRemote: boolean;
    private buffer: LogEntry[] = [];
    private flushInterval: number = 10000; // 10 secondes
    private maxBufferSize: number = 50;

    constructor(options: {
        apiUrl?: string;
        enableConsole?: boolean;
        enableRemote?: boolean;
    } = {}) {
        this.apiUrl = options.apiUrl || `http://${window.location.hostname}:3001/api/logs`;
        this.enableConsole = options.enableConsole !== false;
        this.enableRemote = options.enableRemote !== false;

        // Démarrer le flush automatique
        if (this.enableRemote) {
            setInterval(() => this.flush(), this.flushInterval);
        }

        // Capturer les erreurs globales
        this.setupGlobalHandlers();
    }

    /**
     * Configurer les gestionnaires d'erreurs globaux
     */
    private setupGlobalHandlers() {
        // Erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            this.error('Uncaught Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Promesses rejetées non capturées
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: String(event.promise)
            });
        });

        // Erreurs de ressources (images, scripts, etc.)
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.warn('Resource Load Error', {
                    tagName: (event.target as any).tagName,
                    src: (event.target as any).src || (event.target as any).href
                });
            }
        }, true);
    }

    /**
     * Créer une entrée de log
     */
    private createEntry(level: LogLevel, message: string, meta: Record<string, any> = {}): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }

    /**
     * Ajouter au buffer
     */
    private addToBuffer(entry: LogEntry) {
        this.buffer.push(entry);

        // Flush si le buffer est plein
        if (this.buffer.length >= this.maxBufferSize) {
            this.flush();
        }
    }

    /**
     * Envoyer les logs au backend
     */
    private async flush() {
        if (!this.enableRemote || this.buffer.length === 0) return;

        const logsToSend = [...this.buffer];
        this.buffer = [];

        try {
            await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: logsToSend })
            });
        } catch (error) {
            // En cas d'erreur, remettre les logs dans le buffer
            this.buffer = [...logsToSend, ...this.buffer];

            // Limiter la taille du buffer pour éviter une fuite mémoire
            if (this.buffer.length > this.maxBufferSize * 2) {
                this.buffer = this.buffer.slice(-this.maxBufferSize);
            }
        }
    }

    /**
     * Log générique
     */
    private log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
        const entry = this.createEntry(level, message, meta);

        // Console
        if (this.enableConsole) {
            const style = {
                error: 'color: #ef4444; font-weight: bold',
                warn: 'color: #f59e0b; font-weight: bold',
                info: 'color: #3b82f6',
                debug: 'color: #6b7280'
            }[level];

            console.log(`%c[${level.toUpperCase()}]`, style, message, meta);
        }

        // Buffer pour envoi au backend
        this.addToBuffer(entry);
    }

    /**
     * Méthodes publiques
     */
    error(message: string, meta: Record<string, any> = {}) {
        this.log('error', message, meta);
    }

    warn(message: string, meta: Record<string, any> = {}) {
        this.log('warn', message, meta);
    }

    info(message: string, meta: Record<string, any> = {}) {
        this.log('info', message, meta);
    }

    debug(message: string, meta: Record<string, any> = {}) {
        this.log('debug', message, meta);
    }

    /**
     * Logger une erreur avec stack trace
     */
    exception(error: Error, context: Record<string, any> = {}) {
        this.error(error.message, {
            ...context,
            name: error.name,
            stack: error.stack
        });
    }

    /**
     * Logger un événement métier
     */
    event(name: string, properties: Record<string, any> = {}) {
        this.info(`Event: ${name}`, properties);
    }

    /**
     * Logger une action utilisateur
     */
    userAction(action: string, details: Record<string, any> = {}) {
        this.info(`User Action: ${action}`, details);
    }

    /**
     * Logger une métrique de performance
     */
    performance(metric: string, value: number, unit: string = 'ms') {
        this.debug(`Performance: ${metric}`, { value, unit });
    }

    /**
     * Forcer l'envoi des logs
     */
    async forceFlush() {
        await this.flush();
    }
}

// Instance singleton
const logger = new FrontendLogger({
    enableConsole: import.meta.env.DEV, // Console uniquement en dev
    enableRemote: true
});

// Exporter l'instance
export default logger;

// Exporter aussi comme named export pour plus de flexibilité
export { logger };
