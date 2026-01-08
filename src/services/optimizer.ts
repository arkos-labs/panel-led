import { Client } from '../types/logistics';
import { format, addMinutes, parseISO } from 'date-fns';
import { LocalSolverService } from './localSolver';
import { LOGISTICS_CONFIG } from '@/config/logistics';

export interface SlotSuggestion {
    date: Date;
    score: number;
    reason: string;
    camionId: string;
}

// Helper pour extraire lat/lon de manière robuste
const getLatLon = (c: Client | any): { lat: number, lon: number } | null => {
    if (c.gps && typeof c.gps === 'object' && 'lat' in c.gps) return { lat: c.gps.lat, lon: c.gps.lon };
    if (c.lat && c.lon) return { lat: Number(c.lat), lon: Number(c.lon) };
    if (c.latitude && c.longitude) return { lat: Number(c.latitude), lon: Number(c.longitude) };
    if (typeof c.gps === 'string' && c.gps.includes(',')) {
        const parts = c.gps.split(',');
        return { lat: Number(parts[0]), lon: Number(parts[1]) };
    }
    return null;
};

export class OptimizerService {

    /**
     * Simule une tournée de manière SYNCHRONE via LocalSolverService
     * Utiliser ceci pour l'affichage temps réel dans les composants React
     */
    static simulateTourSync(
        date: Date,
        clients: Client[],
        startHour: number = 8,
        startMinute: number = 0,
        maxEndHour: number = 22,
        options: { returnToDepot: boolean, preserveOrder: boolean } = { returnToDepot: true, preserveOrder: false },
        startLocation: { lat: number, lon: number, id: string } = { lat: 48.8566, lon: 2.3522, id: 'DEPOT' }
    ): {
        totalDistance: number;
        totalDurationMinutes: number;
        returnDate: Date;
        isLate: boolean;
        stops: number;
        sortedClients: Client[];
    } {
        // Conversion des inputs pour LocalSolver
        const result = LocalSolverService.solve(
            clients,
            startLocation,
            date,
            startHour,
            options // Pass both returnToDepot and preserveOrder
        );

        return {
            totalDistance: result.totalDistanceKm,
            totalDurationMinutes: result.totalDurationMinutes,
            returnDate: result.returnDate,
            isLate: result.isLate,
            stops: result.sortedClients.length,
            sortedClients: result.sortedClients
        };
    }

    /**
     * @deprecated Utiliser simulateTourSync pour l'UI.
     * Wrapper Async pour compatibilité existante.
     */
    static async simulateTour(
        date: Date,
        clients: Client[],
        startHour: number = 8,
        startMinute: number = 0,
        maxEndHour: number = 22,
        options: { returnToDepot: boolean, preserveOrder: boolean } = { returnToDepot: true, preserveOrder: false }
    ): Promise<{
        totalDistance: number;
        totalDurationMinutes: number;
        returnDate: Date;
        isLate: boolean;
        stops: number;
        sortedClients: Client[];
    }> {
        // Délègue simplement à la version synchrone
        return this.simulateTourSync(date, clients, startHour, startMinute, maxEndHour, options);
    }

    static estimateVolume(clients: Client[]): number {
        return clients.reduce((acc, c) => acc + (c.nombreLED || c.nb_led || 0), 0);
    }

    // Calcul de la distance à vol d'oiseau (Haversine)
    static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Estime la durée de trajet (vitesse moyenne 60km/h + 15 min arrêt)
    static estimateDuration(distanceKm: number): number {
        return Math.round(distanceKm * 1 + 15);
    }

    // Vérifie si un client est dans la zone d'un groupe (max 50km)
    static isInZone(center: Client, target: Client, radiusKm: number = 50): boolean {
        const cLoc = getLatLon(center);
        const tLoc = getLatLon(target);
        if (!cLoc || !tLoc) return false;
        return this.calculateDistance(cLoc.lat, cLoc.lon, tLoc.lat, tLoc.lon) <= radiusKm;
    }

    // Trouve le meilleur créneau pour un nouveau client parmi les tournées existantes
    static async findBestSlots(newClient: Client, allClients: Client[]): Promise<any[]> {
        return [];
    }

    /**
     * Calcule la charge actuelle d'un camion en fonction des livraisons planifiées
     */
    static checkCapacity(
        livraisons: { client: Client, statut: string }[],
        installations: Record<string, any>
    ): { success: boolean; ledsCharge: number; percent: number } {
        const totalLEDs = livraisons.reduce((sum, item) => {
            // Ignorer si livré/installé
            if (['LIVRÉ', 'INSTALLÉ'].includes(item.statut)) return sum;
            return sum + (item.client.nombreLED || item.client.nb_led || 0);
        }, 0);

        const MAX_CAPACITY = LOGISTICS_CONFIG.TRUCK_CAPACITY;

        return {
            success: totalLEDs <= MAX_CAPACITY,
            ledsCharge: totalLEDs,
            percent: Math.round((totalLEDs / MAX_CAPACITY) * 100)
        };
    }

    static async findOptimalCutoff(
        date: Date,
        clients: Client[],
        startHour: number = 9,
        startMinute: number = 0,
        limitHour: number = 20
    ): Promise<{
        keepIds: string[];
        dropIds: string[];
        returnTime: Date;
    }> {
        // Utilise la version synchrone
        const fullTour = this.simulateTourSync(date, clients, startHour, startMinute, limitHour);

        const kept = fullTour.sortedClients.map(c => String(c.id));
        const allIds = clients.map(c => String(c.id));
        const dropped = allIds.filter(id => !kept.includes(id));

        return {
            keepIds: kept,
            dropIds: dropped,
            returnTime: fullTour.returnDate
        };
    }
}
