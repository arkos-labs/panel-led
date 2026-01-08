import { Client } from '@/types/logistics';

const ORS_API_KEY = '5b3ce3597851110001cf62480914993c9e614716b19e51b17409dbac'; // Clé reconstituée

interface VroomJob {
    id: number;
    location: [number, number]; // [lon, lat]
    service: number; // Durée du service en secondes (ex: 15min = 900s)
    amount: [number]; // [capacité utilisée] (ex: nombre de LEDs)
    skills?: number[]; // Pour forcer certains véhicules
    description?: string; // Ajout description pour mapping
}

interface VroomVehicle {
    id: number;
    profile?: string; // "driving-car" or "driving-hgv" (optionnel pour API publique)
    start: [number, number];
    end?: [number, number]; // Optionnel, si retour dépôt
    capacity: [number]; // [capacité max]
    time_window?: [number, number]; // [start, end] en secondes depuis minuit
    skills?: number[];
}

export const VroomService = {
    /**
     * Optimise une liste de clients pour une flotte de véhicules donnée via OpenRouteService
     */
    async optimize(clients: Client[], drivers: any[], date?: Date) {
        console.log("🔍 VROOM: Réception de", clients.length, "clients.");

        // 1. Préparer les données (Jobs)
        const idMap = new Map<number, string>(); // Map VROOM ID -> Real Client ID

        const jobs: VroomJob[] = clients
            .map((c, index) => {
                let lat = (c as any).latitude;
                let lon = (c as any).longitude;

                // Si pas de lat/lon mais un champ GPS texte "48.12, 2.34"
                const gpsStr = (c as any).gps;
                if ((!lat || !lon) && typeof gpsStr === 'string' && gpsStr.includes(',')) {
                    const parts = gpsStr.split(',').map((p: string) => parseFloat(p.trim()));
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        lat = parts[0];
                        lon = parts[1];
                    }
                }

                // Si le champ GPS est un Objet {lat, lon} (Cas Supabase JSON)
                if ((!lat || !lon) && typeof c.gps === 'object' && c.gps !== null) {
                    const gpsObj = c.gps as any;
                    if (gpsObj.lat && gpsObj.lon) {
                        lat = parseFloat(gpsObj.lat);
                        lon = parseFloat(gpsObj.lon);
                    }
                }

                // Tentative de récupération si format objet {lat: ..., lon: ...} ou autre
                if ((!lat || !lon) && (c as any).coords) {
                    lat = (c as any).coords.latitude;
                    lon = (c as any).coords.longitude;
                }

                if (!lat || !lon) {
                    console.warn(`⚠️ Client ignoré (Pas de GPS): ${c.prenom} ${c.nom} (GPS: ${c.gps})`);
                    return null;
                }

                // Générer un ID numérique stable basé sur l'index
                const vroomId = index + 1000; // Commence à 1000 pour éviter les conflits
                idMap.set(vroomId, c.id); // Sauvegarder la correspondance

                const job: VroomJob = {
                    id: vroomId,
                    location: [lon, lat] as [number, number], // Assertion de type explicite
                    service: 1200, // 20 min (Ajusté pour permettre ~5 livraisons/jour selon trajets)
                    amount: [c.nombreLED || 0],
                    description: `${c.prenom} ${c.nom}`,
                    // Transmission des compétences (Secteurs)
                    skills: (c as any).skills || undefined
                };
                return job;
            })
            .filter((j): j is VroomJob => j !== null); // Retirer les nuls

        if (jobs.length === 0) {
            console.warn("⚠️ Aucun client avec GPS valide pour VROOM.");
            // On retourne vide mais sans planter si possible, ou on throw
            // throw new Error("Aucun client n'a de coordonnées GPS valides.");
            return { routes: [], unassigned: [], idMap };
        }

        // 2. Préparer les véhicules
        // Dépôts par zone géographique
        const DEPOTS: Record<string, { name: string; location: [number, number] }> = {
            'FR': {
                name: 'Paris (France Métropolitaine)',
                location: [2.3522, 48.8566] // Paris
            },
            'CORSE': {
                name: 'Ajaccio (Corse)',
                location: [8.7386, 41.9268] // Ajaccio
            },
            'GP': {
                name: 'Pointe-à-Pitre (Guadeloupe)',
                location: [-61.5332, 16.2410] // Pointe-à-Pitre
            },
            'MQ': {
                name: 'Fort-de-France (Martinique)',
                location: [-61.0594, 14.6160] // Fort-de-France
            },
            'GF': {
                name: 'Cayenne (Guyane)',
                location: [-52.3261, 4.9227] // Cayenne
            },
            'RE': {
                name: 'Saint-Denis (Réunion)',
                location: [55.4504, -20.8824] // Saint-Denis
            }
        };

        // Détecter la zone des clients pour choisir le bon dépôt
        const detectZone = (): string => {
            // Compter les clients par zone
            const zoneCounts: Record<string, number> = {};
            clients.forEach(c => {
                const zone = (c as any).zone_pays || 'FR';
                zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
            });

            // Retourner la zone majoritaire
            let maxZone = 'FR';
            let maxCount = 0;
            Object.entries(zoneCounts).forEach(([zone, count]) => {
                if (count > maxCount) {
                    maxZone = zone;
                    maxCount = count;
                }
            });

            console.log(`📍 Zone détectée pour optimisation: ${maxZone} (${maxCount} clients)`);
            return maxZone;
        };

        const currentZone = detectZone();
        const depot = DEPOTS[currentZone] || DEPOTS['FR'];
        const depotLocation = depot.location;

        console.log(`🏢 Dépôt utilisé: ${depot.name} [${depotLocation}]`);

        let vehicles: VroomVehicle[] = [];

        // Check if drivers are already formatted as VroomVehicles (duck typing)
        if (drivers.length > 0 && drivers[0].id && Array.isArray(drivers[0].start) && Array.isArray(drivers[0].capacity)) {
            // Déjà formaté par l'appelant (PlanningModal)
            // On s'assure juste que profile est là
            // Mapping de la zone vers le profil OSRM local
            const zoneToProfile: Record<string, string> = {
                'FR': 'car',
                'GP': 'car-gp',
                'MQ': 'car-mq',
                'RE': 'car-re',
                'GF': 'car-gf',
                'CORSE': 'car-corse'
            };
            const targetProfile = zoneToProfile[currentZone] || 'car';

            vehicles = drivers.map(d => {
                const { profile, ...rest } = d;
                return {
                    ...rest,
                    profile: targetProfile, // Utilise le profil spécifique à la zone
                    // On laisse skills tel quel s'il est défini, sinon undefined.
                    skills: d.skills || undefined
                };
            });
        } else {
            // Ancien comportement : mapping depuis des objets Drivers simples
            vehicles = drivers.map((d, index) => ({
                id: index + 1,
                start: depotLocation,
                end: depotLocation,
                capacity: [d.capacite || 1000],
                time_window: [21600, 75600] // 06:00 - 21:00 (Strict, rejette si trop long)
            }));
        }

        const payload = {
            jobs,
            vehicles,
            options: {
                g: true // Geometry (pour tracer la route sur une carte si besoin)
            }
        };

        try {
            // Appel via le proxy backend pour éviter CORS
            // URL relative au serveur actuel
            const response = await fetch('/api/vroom/optimize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erreur API VROOM (${response.status}): ${errText}`);
            }

            const data = await response.json();

            // On attache la map des IDs au résultat pour que l'appelant puisse s'y retrouver
            data.idMap = Object.fromEntries(idMap);

            return data;

        } catch (error) {
            console.error("❌ Erreur service VROOM:", error);
            throw error; // Propager pour affichage toast
        }
    }
};
