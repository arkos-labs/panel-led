/**
 * Service d'Analytics - Suivi des événements métier
 * Stockage dans Supabase pour analyse ultérieure
 */

import { supabase } from '@/lib/supabaseClient';
import logger from './logger';

interface AnalyticsEvent {
    event_name: string;
    event_category: string;
    event_properties?: Record<string, any>;
    user_id?: string;
    session_id?: string;
    timestamp?: string;
}

class AnalyticsService {
    private sessionId: string;
    private userId: string | null = null;
    private buffer: AnalyticsEvent[] = [];
    private flushInterval: number = 30000; // 30 secondes
    private maxBufferSize: number = 20;

    constructor() {
        // Générer un ID de session unique
        this.sessionId = this.generateSessionId();

        // Démarrer le flush automatique
        setInterval(() => this.flush(), this.flushInterval);

        // Flush avant fermeture de la page
        window.addEventListener('beforeunload', () => {
            this.flush();
        });

        // Tracker la session
        this.trackSession();
    }

    /**
     * Générer un ID de session unique
     */
    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Définir l'utilisateur courant
     */
    setUser(userId: string) {
        this.userId = userId;
    }

    /**
     * Tracker le début de session
     */
    private trackSession() {
        this.track('session_start', 'system', {
            referrer: document.referrer,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            platform: navigator.platform
        });
    }

    /**
     * Ajouter un événement au buffer
     */
    private addToBuffer(event: AnalyticsEvent) {
        this.buffer.push({
            ...event,
            session_id: this.sessionId,
            user_id: this.userId || undefined,
            timestamp: event.timestamp || new Date().toISOString()
        });

        // Flush si le buffer est plein
        if (this.buffer.length >= this.maxBufferSize) {
            this.flush();
        }
    }

    /**
     * Envoyer les événements à Supabase
     */
    private async flush() {
        if (this.buffer.length === 0) return;

        const eventsToSend = [...this.buffer];
        this.buffer = [];

        try {
            const { error } = await supabase
                .from('analytics_events')
                .insert(eventsToSend);

            if (error) {
                logger.error('Erreur envoi analytics', { error: error.message });
                // Remettre dans le buffer en cas d'erreur
                this.buffer = [...eventsToSend, ...this.buffer];
            }
        } catch (error: any) {
            logger.error('Erreur flush analytics', { error: error.message });
            this.buffer = [...eventsToSend, ...this.buffer];
        }
    }

    /**
     * Tracker un événement générique
     */
    track(eventName: string, category: string, properties: Record<string, any> = {}) {
        this.addToBuffer({
            event_name: eventName,
            event_category: category,
            event_properties: properties
        });

        // Logger aussi pour debug
        logger.event(eventName, { category, ...properties });
    }

    /**
     * Tracker une page vue
     */
    pageView(pageName: string, properties: Record<string, any> = {}) {
        this.track('page_view', 'navigation', {
            page: pageName,
            path: window.location.pathname,
            ...properties
        });
    }

    /**
     * Tracker une action utilisateur
     */
    userAction(action: string, properties: Record<string, any> = {}) {
        this.track(action, 'user_action', properties);
    }

    /**
     * Tracker une erreur
     */
    trackError(error: Error, context: Record<string, any> = {}) {
        this.track('error', 'system', {
            error_message: error.message,
            error_name: error.name,
            ...context
        });
    }

    /**
     * Événements métier spécifiques
     */

    // Livraisons
    deliveryPlanned(clientId: string, date: string, zone: string) {
        this.track('delivery_planned', 'logistics', {
            client_id: clientId,
            delivery_date: date,
            zone
        });
    }

    deliveryCompleted(clientId: string, duration: number) {
        this.track('delivery_completed', 'logistics', {
            client_id: clientId,
            duration_minutes: duration
        });
    }

    // Installations
    installationPlanned(clientId: string, date: string, zone: string) {
        this.track('installation_planned', 'logistics', {
            client_id: clientId,
            installation_date: date,
            zone
        });
    }

    installationStarted(clientId: string) {
        this.track('installation_started', 'logistics', {
            client_id: clientId
        });
    }

    installationCompleted(clientId: string, duration: number, nbLeds: number) {
        this.track('installation_completed', 'logistics', {
            client_id: clientId,
            duration_hours: duration,
            nb_leds: nbLeds
        });
    }

    // Stock
    stockAdded(zone: string, quantity: number) {
        this.track('stock_added', 'inventory', {
            zone,
            quantity
        });
    }

    stockCritical(zone: string, remaining: number, percentage: number) {
        this.track('stock_critical', 'inventory', {
            zone,
            remaining,
            percentage
        });
    }

    // Exports
    reportGenerated(type: string, format: string, recordCount: number) {
        this.track('report_generated', 'reports', {
            report_type: type,
            format,
            record_count: recordCount
        });
    }

    // Optimisation
    routeOptimized(clientCount: number, duration: number) {
        this.track('route_optimized', 'optimization', {
            client_count: clientCount,
            optimization_duration_ms: duration
        });
    }

    /**
     * Forcer l'envoi des événements
     */
    async forceFlush() {
        await this.flush();
    }
}

// Instance singleton
const analytics = new AnalyticsService();

export default analytics;
export { analytics };
