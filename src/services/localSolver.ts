import { Client } from "@/types/logistics";
import { format, addMinutes, isSameDay } from "date-fns";
import { getClientCommandoZone } from "@/lib/regions";
import { LOGISTICS_CONFIG } from "@/config/logistics";

const EARTH_RADIUS_KM = 6371;
const AVERAGE_SPEED_KMH = LOGISTICS_CONFIG.AVERAGE_SPEED || 70;
const TORTUOSITY_FACTOR = 1.3;
const SERVICE_TIME_MINUTES = LOGISTICS_CONFIG.STOP_DURATION || 15;
const MAX_SERVICE_HOURS_PER_DAY = 8; // Limite stricte du protocole

interface GeoPoint {
    lat: number;
    lon: number;
    id: string;
}

interface TourDay {
    date: Date;
    stops: (Client & { arrival: string; travelTime: number; serviceTime: number })[];
    totalDistance: number;
    drivingTime: number;
    serviceTime: number;
    startPoint: GeoPoint;
    endPoint: GeoPoint;
}

export class LocalSolverService {

    static getDistance(p1: GeoPoint, p2: GeoPoint): number {
        if (!p1 || !p2) return 999999;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lon - p1.lon) * Math.PI / 180;
        const lat1 = p1.lat * Math.PI / 180;
        const lat2 = p2.lat * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_KM * c * TORTUOSITY_FACTOR;
    }

    /**
     * Protocole VRP : Clustering par zone + Tri chronologique + Découpage temporel
     */
    static solve(
        clients: Client[],
        startPoint: GeoPoint = { lat: 48.8566, lon: 2.3522, id: 'DEPOT' },
        startDate: Date,
        startHour: number = 8,
        options: { preserveOrder?: boolean, returnToDepot?: boolean } = { preserveOrder: false, returnToDepot: true }
    ) {
        // 1. Filtrage et enrichissement des points
        const validPoints = clients.map(c => {
            let lat = c.lat || (c.gps as any)?.lat;
            let lon = c.lon || (c.gps as any)?.lon;
            if ((!lat || !lon) && typeof c.gps === 'string' && (c.gps as string).includes(',')) {
                const parts = (c.gps as string).split(',');
                lat = parseFloat(parts[0]);
                lon = parseFloat(parts[1]);
            }
            const zone = getClientCommandoZone(c);
            return {
                ...c,
                lat: Number(lat) || 0,
                lon: Number(lon) || 0,
                zoneIndex: zone?.dayIndex || 99,
                id: c.id
            };
        }).filter(p => p.lat !== 0 && p.lon !== 0);

        // 2. Anti-Zigzag : Tri par Zone Commando d'abord
        // Si l'ordre n'est pas préservé, on trie par zone puis par distance
        let sortedPoints = [...validPoints];
        if (!options.preserveOrder) {
            sortedPoints.sort((a, b) => a.zoneIndex - b.zoneIndex);

            // Raffinement par distance dans chaque zone (Nearest Neighbor simple)
            const refined: typeof validPoints = [];
            let currentRefPos = startPoint;
            let unvisited = [...sortedPoints];

            while (unvisited.length > 0) {
                // Trouver le plus proche PARMI LA ZONE LA PLUS BASSE disponible
                const currentMinZone = unvisited[0].zoneIndex;
                const candidatesFromZone = unvisited.filter(v => v.zoneIndex === currentMinZone);

                let nearestIdx = -1;
                let minDist = Infinity;

                candidatesFromZone.forEach((cand, idx) => {
                    const d = this.getDistance(currentRefPos, cand);
                    if (d < minDist) {
                        minDist = d;
                        nearestIdx = unvisited.indexOf(cand);
                    }
                });

                const next = unvisited[nearestIdx];
                refined.push(next);
                currentRefPos = next;
                unvisited.splice(nearestIdx, 1);
            }
            sortedPoints = refined;
        }

        // 3. Découpage Temporel (8h max par jour)
        const days: TourDay[] = [];
        let currentDayDate = new Date(startDate);
        let currentTime = new Date(currentDayDate);
        currentTime.setHours(startHour, 0, 0, 0);

        let currentPos = startPoint;
        let dayStops: TourDay['stops'] = [];
        let dayDistance = 0;
        let dayDrivingTime = 0;
        let dayServiceTime = 0;

        sortedPoints.forEach((pt) => {
            const dist = this.getDistance(currentPos, pt);
            const travelMinutes = Math.round((dist / AVERAGE_SPEED_KMH) * 60);
            const totalMinutesNeeded = travelMinutes + SERVICE_TIME_MINUTES;

            // Calcul du temps cumulé
            const totalDayMinutes = dayDrivingTime + dayServiceTime + totalMinutesNeeded;

            // Si on dépasse 8h, on finit la journée et on commence le lendemain
            if (totalDayMinutes > MAX_SERVICE_HOURS_PER_DAY * 60 && dayStops.length > 0) {
                // Fin de journée
                days.push({
                    date: new Date(currentDayDate),
                    stops: dayStops,
                    totalDistance: Math.round(dayDistance),
                    drivingTime: Math.round(dayDrivingTime),
                    serviceTime: Math.round(dayServiceTime),
                    startPoint: days.length === 0 ? startPoint : days[days.length - 1].endPoint,
                    endPoint: currentPos
                });

                // Reset pour le lendemain
                currentDayDate = new Date(currentDayDate);
                currentDayDate.setDate(currentDayDate.getDate() + 1);
                // Sauter le week-end
                if (currentDayDate.getDay() === 6) currentDayDate.setDate(currentDayDate.getDate() + 2);
                if (currentDayDate.getDay() === 0) currentDayDate.setDate(currentDayDate.getDate() + 1);

                currentTime = new Date(currentDayDate);
                currentTime.setHours(startHour, 0, 0, 0);

                // On repart du dernier point ! (Logic Sommeil sur place)
                // Redéclencher le calcul pour ce point sur le nouveau jour
                const freshDist = this.getDistance(currentPos, pt);
                const freshTravel = Math.round((freshDist / AVERAGE_SPEED_KMH) * 60);

                dayStops = [];
                dayDistance = freshDist;
                dayDrivingTime = freshTravel;
                dayServiceTime = SERVICE_TIME_MINUTES;

                const arrival = new Date(currentTime);
                arrival.setMinutes(arrival.getMinutes() + freshTravel);

                dayStops.push({
                    ...pt,
                    arrival: format(arrival, "HH:mm"),
                    travelTime: freshTravel,
                    serviceTime: SERVICE_TIME_MINUTES
                });

                currentTime.setMinutes(currentTime.getMinutes() + freshTravel + SERVICE_TIME_MINUTES);
                currentPos = pt;
            } else {
                // On ajoute au jour actuel
                dayDistance += dist;
                dayDrivingTime += travelMinutes;
                dayServiceTime += SERVICE_TIME_MINUTES;

                const arrival = new Date(currentTime);
                arrival.setMinutes(arrival.getMinutes() + travelMinutes);

                dayStops.push({
                    ...pt,
                    arrival: format(arrival, "HH:mm"),
                    travelTime: travelMinutes,
                    serviceTime: SERVICE_TIME_MINUTES
                });

                currentTime.setMinutes(currentTime.getMinutes() + travelMinutes + SERVICE_TIME_MINUTES);
                currentPos = pt;
            }
        });

        // Ajouter le dernier jour
        if (dayStops.length > 0) {
            days.push({
                date: new Date(currentDayDate),
                stops: dayStops,
                totalDistance: Math.round(dayDistance),
                drivingTime: Math.round(dayDrivingTime),
                serviceTime: Math.round(dayServiceTime),
                startPoint: days.length > 1 ? days[days.length - 2].endPoint : startPoint,
                endPoint: currentPos
            });
        }

        // Pour compatibilité avec OptimizerService.simulateTour
        // On retourne les stats du premier jour ou une synthèse
        if (days.length === 0) {
            return {
                days: [],
                sortedClients: [],
                totalDistanceKm: 0,
                totalDurationMinutes: 0,
                returnDate: startDate,
                isLate: false
            };
        }

        return {
            days, // Nouveau : Liste complète des jours
            sortedClients: sortedPoints,
            totalDistanceKm: days.reduce((acc, d) => acc + d.totalDistance, 0),
            totalDurationMinutes: days.reduce((acc, d) => acc + d.drivingTime + d.serviceTime, 0),
            returnDate: days[days.length - 1].date,
            isLate: false // Le découpage évite d'être en retard
        };
    }


    /**
     * OPTIMISATION CLOUD (Via API Serveur -> ORS/VROOM)
     * Remplace la méthode heuristique locale par un vrai solver VRP.
     */
    static async solveCloud(
        clients: Client[],
        startPoint: GeoPoint = { lat: 48.8566, lon: 2.3522, id: 'DEPOT' },
        startDate: Date
    ): Promise<any> {
        console.log("☁️ Début Optimisation Cloud...");

        // 1. MAPPING ID (String -> Int pour VROOM)
        const clientMap = new Map<number, Client>();
        const jobs = clients.map((c, index) => {
            const vroomId = index + 1; // ID unique simple
            clientMap.set(vroomId, c);

            // Gestion robuste des coords
            let lat = c.lat || (c.gps as any)?.lat;
            let lon = c.lon || (c.gps as any)?.lon;

            // Fallback string parse
            if ((!lat || !lon) && typeof c.gps === 'string' && (c.gps as string).includes(',')) {
                const parts = (c.gps as string).split(',');
                lat = parseFloat(parts[0]);
                lon = parseFloat(parts[1]);
            }

            return {
                id: vroomId,
                description: `${c.nom} ${c.prenom}`,
                location: [Number(lon), Number(lat)],
                service: (LOGISTICS_CONFIG.STOP_DURATION || 15) * 60, // Secondes
                // time_windows: [[32400, 64800]] // Optionnel: 9h-18h
            };
        }).filter(j => !isNaN(j.location[0]) && !isNaN(j.location[1]));

        if (jobs.length === 0) {
            console.warn("⚠️ Aucun client avec GPS valide pour l'optimisation");
            return this.solve(clients, startPoint, startDate); // Fallback local
        }

        // 2. VÉHICULE (1 seul véhicule pour la journée sélectionnée)
        // On définit une plage large via config ou defaut (8h - 19h)
        const vehicle = {
            id: 1,
            start: [startPoint.lon, startPoint.lat],
            end: [startPoint.lon, startPoint.lat],
            profile: "car",
            capacity: [100], // Capacité arbitraire large
            time_window: [8 * 3600, 19 * 3600] // 08:00 - 19:00 (en secondes)
        };

        const payload = {
            jobs,
            vehicles: [vehicle],
            // Options ORS/VROOM
            options: {
                g: true // Geometry (pour tracé précis si besoin plus tard)
            }
        };

        try {
            // 3. APPEL API
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/vroom/optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`API Error ${res.status}`);
            }

            const data = await res.json();

            // 4. MAPPING RETOUR (VROOM -> App Format)
            if (!data.routes || data.routes.length === 0) {
                console.warn("⚠️ VROOM n'a trouvé aucune route valide (Unassigned?)");
                // Fallback local si échec total
                return this.solve(clients, startPoint, startDate);
            }

            const route = data.routes[0];
            const steps = route.steps;

            // Parser les steps (Start -> Job -> Job -> End)
            // On récupère les arrêts optimisés
            const refinedStops = steps
                .filter((s: any) => s.type === 'job')
                .map((step: any, i: number, arr: any[]) => {
                    const originalClient = clientMap.get(step.id);

                    // Calcul delta travel time approx
                    // (Note: pour VROOM, step.duration est le temps accumulé de CONDUITE)
                    // On essaie de trouver le step précédent "job" ou "start" pour faire le delta
                    // Mais `steps` contient tout.
                    // Donc step.duration - prevStep.duration = travel time pour ce leg.

                    // Index dans 'steps' (incluant start/end)
                    const realIndex = steps.indexOf(step);
                    const prevStep = realIndex > 0 ? steps[realIndex - 1] : steps[0];

                    const travelSeconds = step.duration - prevStep.duration;

                    const arrivalSeconds = step.arrival;
                    const d = new Date(startDate);
                    d.setHours(0, 0, 0, 0);
                    d.setSeconds(arrivalSeconds);

                    return {
                        ...originalClient,
                        arrival: format(d, 'HH:mm'),
                        travelTime: Math.round(Math.max(0, travelSeconds) / 60)
                    };
                });

            return {
                days: [{
                    date: startDate,
                    stops: refinedStops,
                    totalDistance: Math.round(route.distance / 1000), // m -> km
                    drivingTime: Math.round(route.duration / 60),
                    startPoint,
                    endPoint: startPoint
                }],
                totalDistanceKm: Math.round(route.distance / 1000),
                totalDurationMinutes: Math.round(route.duration / 60),
                isLate: false
            };

        } catch (err) {
            console.error("🔴 Erreur Cloud Optimization:", err);
            // Fallback GRACEFUL au solver local
            return this.solve(clients, startPoint, startDate);
        }
    }
}
