
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class GoogleManager {
    constructor() {
        this.sheets = null;
        this.calendar = null;
        this.auth = null;
        this.isReady = false;

        // Configuration des files d'attente (Queues)
        // On limite la cadence pour éviter les erreurs 429
        this.queues = {
            sheets: { list: [], running: false, interval: 300 },      // Speed up: 1 req / 300ms
            calendar: { list: [], running: false, interval: 600 }     // 1 req / 600ms
        };
    }

    async connect() {
        if (this.isReady) return true;

        try {
            const credPath = path.resolve(process.cwd(), 'credentials.json');
            if (fs.existsSync(credPath)) {
                this.auth = new google.auth.GoogleAuth({
                    keyFile: credPath,
                    scopes: [
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/calendar'
                    ]
                });

                const client = await this.auth.getClient();
                this.sheets = google.sheets({ version: 'v4', auth: client });
                this.calendar = google.calendar({ version: 'v3', auth: client });

                this.isReady = true;
                console.log("✅ [GoogleManager] Connexion réussie à Google APIs");
                return true;
            } else {
                console.warn("⚠️ [GoogleManager] Fichier credentials.json introuvable.");
                return false;
            }
        } catch (error) {
            console.error("❌ [GoogleManager] Erreur de connexion:", error.message);
            return false;
        }
    }

    // --- GENERIC QUEUE SYSTEM ---
    async addToQueue(type, fn) {
        return new Promise((resolve, reject) => {
            this.queues[type].list.push({ fn, resolve, reject });
            this.processQueue(type);
        });
    }

    async processQueue(type) {
        if (this.queues[type].running) return;
        this.queues[type].running = true;

        while (this.queues[type].list.length > 0) {
            const task = this.queues[type].list.shift();
            try {
                // On exécute avec tentatives de réessai (Retry pattern)
                await this.executeWithRetry(task.fn, task.resolve, task.reject);
            } catch (e) {
                // Should not happen as executeWithRetry calls reject, but safety first
                task.reject(e);
            }

            // Délai obligatoire entre les appels pour respecter les quotas
            await new Promise(r => setTimeout(r, this.queues[type].interval));
        }

        this.queues[type].running = false;
    }

    /**
     * Exécute une fonction avec stratégie de Backoff Exponentiel
     * Si Google renvoie une erreur 429 (Trop de requêtes) ou 5xx, on attend et on réessaie.
     */
    async executeWithRetry(fn, resolve, reject, attempt = 1) {
        try {
            if (!this.isReady) await this.connect();
            const result = await fn();
            resolve(result);
        } catch (error) {
            const code = error.code || (error.response ? error.response.status : 0);

            // Erreurs qui méritent un nouvel essai
            const isRateLimit = code === 429 || // Too Many Requests
                code === 403 || // User Rate Limit Exceeded (parfois)
                (error.message && error.message.includes('Quota'));

            const isServerErr = code >= 500 && code < 599; // Google internal errors

            if ((isRateLimit || isServerErr) && attempt <= 7) {
                // Backoff: 1s, 2s, 4s, 8s, 16s... + Jitter aléatoire
                const delay = Math.pow(2, attempt) * 1000 + (Math.random() * 1000);

                console.warn(`⏳ [GoogleManager] Bloqué par API (Code ${code}). Pause de ${Math.round(delay / 1000)}s avant réessai ${attempt}/7...`);

                setTimeout(() => {
                    this.executeWithRetry(fn, resolve, reject, attempt + 1);
                }, delay);
            } else {
                console.error(`❌ [GoogleManager] Échec après ${attempt} tentatives. Erreur: ${error.message}`);
                reject(error);
            }
        }
    }

    // --- WRAPPERS SHEETS ---

    async sheetsGet(params) {
        return this.addToQueue('sheets', () => this.sheets.spreadsheets.values.get(params));
    }

    async sheetsUpdate(params) {
        return this.addToQueue('sheets', () => this.sheets.spreadsheets.values.update(params));
    }

    async sheetsBatchUpdate(params) {
        return this.addToQueue('sheets', async () => {
            const res = await this.sheets.spreadsheets.values.batchUpdate(params);
            return res;
        });
    }

    async sheetsBatchUpdateDirect(params) {
        return this.addToQueue('sheets', async () => {
            const res = await this.sheets.spreadsheets.batchUpdate(params);
            return res;
        });
    }

    async sheetsGetMeta(params) {
        return this.addToQueue('sheets', () => this.sheets.spreadsheets.get(params));
    }

    async sheetsAppend(params) {
        return this.addToQueue('sheets', () => this.sheets.spreadsheets.values.append(params));
    }

    // --- WRAPPERS CALENDAR ---

    async calendarList(params) {
        return this.addToQueue('calendar', () => this.calendar.events.list(params));
    }

    async calendarInsert(params) {
        return this.addToQueue('calendar', () => this.calendar.events.insert(params));
    }

    async calendarUpdate(params) {
        return this.addToQueue('calendar', () => this.calendar.events.update(params));
    }

    async calendarGet(params) {
        return this.addToQueue('calendar', () => this.calendar.events.get(params));
    }
}

export const googleManager = new GoogleManager();
