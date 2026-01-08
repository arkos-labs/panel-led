import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Client, Livraison } from "@/types/logistics";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isAfter, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, Truck, AlertTriangle, Calendar as CalendarIcon, CheckCircle2, Package, Clock, Navigation, BrainCircuit, Home, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { OptimizerService, SlotSuggestion } from "@/services/optimizer";
import { VroomService } from "@/services/vroom";
import { LocalSolverService } from "@/services/localSolver";
import { cn, parseSafeDate, calculateDistance } from "@/lib/utils";
import { getRegionFromDept, getClientDeliveryDate, isSouthOfSleepLine } from "@/lib/business-logic";
import { SmartScheduler } from "../scheduler/SmartScheduler";
import { toast } from "sonner"; // Use toast for errors
import { supabase } from "@/lib/supabase";

interface PlanningModalProps {
    client: Client | null;
    allClients?: Client[];
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { date: Date; camionId: string }, optimizationPlan?: any) => void;
    initialDate?: Date; // Pour pré-remplir la date (ex: depuis Dispatch)
}

export function PlanningModal({ client, allClients, isOpen, onClose, onConfirm, initialDate }: PlanningModalProps) {
    const [date, setDate] = useState<Date | undefined>(initialDate); // Init avec la date fournie
    const [selectedCamionId, setSelectedCamionId] = useState<string>("");
    const [isAutoSelected, setIsAutoSelected] = useState(false);
    const [capacityCheck, setCapacityCheck] = useState<any>(null);
    const [camions, setCamions] = useState<any[]>([]); // Liste dynamique des camions
    const [vroomOptimization, setVroomOptimization] = useState<any>(null); // Résultat VROOM
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [excludedClientIds, setExcludedClientIds] = useState<string[]>([]); // Clients exclus temporairement du calcul // État de chargement
    const [showDetails, setShowDetails] = useState(!client); // Default true if global, false if specific client

    // Reset date when modal opens with a specific suggestion
    useEffect(() => {
        if (isOpen) {
            if (initialDate) setDate(initialDate);
            setShowDetails(!client); // Reset view mode based on context
        }
    }, [isOpen, initialDate, client]);

    // Fetch Camions Réels
    useEffect(() => {
        if (!isOpen) return;
        // Static definition similar to backend
        // DÉFINITION DYNAMIQUE DES CAMIONS SELON LA ZONE
        const allTrucks = [
            { id: '1', nom: 'Livreur France', volumeMax: 2000, secteurs: ['FR'], zone: 'FR' },
            { id: '3', nom: 'Livreur Corse', volumeMax: 300, secteurs: ['COR'], zone: '20' },
            { id: '4', nom: 'Livreur Guadeloupe', volumeMax: 300, secteurs: ['GP'], zone: '971' },
            { id: '5', nom: 'Livreur Martinique', volumeMax: 300, secteurs: ['MQ'], zone: '972' },
            { id: '6', nom: 'Livreur Réunion', volumeMax: 300, secteurs: ['RE'], zone: '974' },
            { id: '7', nom: 'Livreur Guyane', volumeMax: 300, secteurs: ['GF'], zone: '973' },
            { id: '8', nom: 'Livreur Mayotte', volumeMax: 300, secteurs: ['YT'], zone: '976' },
        ];

        let camionsReels = allTrucks;

        // Si un client est sélectionné, on ne montre QUE les camions de sa zone
        if (client && client.codePostal) {
            const cp = client.codePostal;
            const dom = cp.substring(0, 3); // 971, 972...
            const dept = cp.substring(0, 2); // 20, 75...

            if (['971', '972', '973', '974', '976'].includes(dom)) {
                // DOM-TOM : Un seul camion spécifique
                camionsReels = allTrucks.filter(t => t.zone === dom);
            } else if (dept === '20') {
                // Corse
                camionsReels = allTrucks.filter(t => t.zone === '20');
            } else {
                // Métropole (FR) : On garde Nicolas et David
                camionsReels = allTrucks.filter(t => t.zone === 'FR');
            }
        }

        // Fallback s'il ne trouve rien (ex: Code postal bizarre), on montre tout pour éviter blocage
        if (camionsReels.length === 0) camionsReels = allTrucks;

        setCamions(camionsReels);

        // AUTO-SÉLECTION FORCÉE du premier livreur pertinent
        if (camionsReels.length > 0) {
            console.log('🚚 Auto-sélection du camion:', camionsReels[0].id);
            setSelectedCamionId(camionsReels[0].id);
            setIsAutoSelected(true);
        }
    }, [isOpen]);

    // Auto-sélection du camion par secteur (DÉSACTIVÉ - Un seul livreur)
    // Le camion est auto-sélectionné au chargement et ne change jamais
    // AUTO-SELECTION INTELLIGENTE (Optimisation Flotte + Temps)
    useEffect(() => {
        // Stabilisation : Si un camion est déjà choisi, on ne ré-exécute pas l'auto-sélection
        // sauf si l'utilisateur change la date (auquel cas il faut reset selectedCamionId ailleurs)
        if (selectedCamionId) return;

        if (!date || !client || camions.length === 0) return;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Évaluer chaque camion
        const candidates = camions.map(truck => {
            // 1. Clients existants pour CE camion uniquement
            const truckClients = (allClients || []).filter(c => {
                const d = getClientDeliveryDate(c);
                if (!d) return false;
                const isDate = format(d, 'yyyy-MM-dd') === dateStr;
                return isDate && c.camionId === truck.id;
            });

            // 2. Simulation avec le nouveau client
            const simulationClients = [...truckClients, client];

            // 3. Check Capacité
            // Mapper vers format Livraison attendu par checkCapacity
            const simulationLivraisons = simulationClients.map(c => ({
                client: c,
                statut: 'PLANIFIÉE' // Simulé
            }));
            const capCheck = OptimizerService.checkCapacity(simulationLivraisons, truck);

            // 4. Check Temps (Départ 9h00 -> Limite 20h00 ou 24h00 pour Sud)
            const limitHour = (camions.indexOf(truck) === 1) ? 24 : 20;
            const timeCheck = OptimizerService.simulateTourSync(date, simulationClients as Client[], 9, 0, limitHour);

            // 5. Check Secteur (Pour éviter de proposer un camion Sud pour Lille)
            let sectorOk = true;
            if (client) {
                let dept = "00";
                const cp = (client as any).codePostal || (client as any).code_postal;
                if (cp) dept = cp.substring(0, 3); // 3 digits for DOM (971, 972...)
                else {
                    const match = ((client as any).adresse || "").match(/\b\d{5}\b/);
                    if (match) dept = match[0].substring(0, 3);
                }
                // Fallback for 2-digit depts (Metro)
                if (dept.length === 3 && !dept.startsWith('97')) dept = dept.substring(0, 2);
                if (dept.length > 2 && dept.startsWith('97')) {
                    // Keep 3 digits for DOM
                } else if (dept.length > 2) {
                    dept = dept.substring(0, 2);
                }

                const region = getRegionFromDept(dept);

                // Vérification simple : est-ce que le camion gère cette région ?
                if (truck.secteurs && truck.secteurs.includes(region)) {
                    sectorOk = true;
                } else {
                    // Fallback pour les anciens cas ou si secteurs mal définis
                    const NORD_REGIONS = ["HDF", "IDF", "NOR", "GES", "BRE", "PDL"];
                    const SUD_REGIONS = ["CVL", "BFC", "NAQ", "ARA", "OCC", "PACA"]; // COR et AUTRE retirés du fallback automatique Sud

                    const isSudTruck = (truck.id === '2');
                    const isNordTruck = (truck.id === '1');

                    if (isSudTruck && SUD_REGIONS.includes(region)) sectorOk = true;
                    else if (isNordTruck && NORD_REGIONS.includes(region)) sectorOk = true;
                    else sectorOk = false;
                }
            }

            return {
                truck,
                capacityOk: capCheck.success,
                timeOk: !timeCheck.isLate,
                sectorOk,
                volume: truck.volumeMax,
                returnTime: timeCheck.returnDate
            };
        });

        // Stratégie de sélection :
        // 1. Priorité absolue : SECTEUR OK + Capacité OK + Temps OK
        // 2. Si plusieurs validés : Choisir le PLUS PETIT volume (Optimisation flotte)

        const validCandidates = candidates.filter(c => c.capacityOk && c.timeOk && c.sectorOk);

        // Trier les valides par volume croissant (le plus petit d'abord)
        validCandidates.sort((a, b) => a.volume - b.volume);

        if (validCandidates.length > 0) {
            const best = validCandidates[0];
            console.log(`🤖 Auto-select (Perfect Match): ${best.truck.nom} (Vol: ${best.volume})`);
            setSelectedCamionId(best.truck.id);
        } else {
            // Essayer ceux qui ont la capacité OK même si retard
            const capCandidates = candidates.filter(c => c.capacityOk);
            capCandidates.sort((a, b) => a.volume - b.volume);

            if (capCandidates.length > 0) {
                const best = capCandidates[0];
                console.log(`🤖 Auto-select (Capacity OK, Date Late): ${best.truck.nom}`);
                setSelectedCamionId(best.truck.id);
            } else {
                // Surcharge inévitable -> Prendre le plus gros
                candidates.sort((a, b) => b.volume - a.volume);
                if (candidates.length > 0) {
                    console.log(`🤖 Auto-select (Overload Fallback): ${candidates[0].truck.nom}`);
                    setSelectedCamionId(candidates[0].truck.id);
                }
            }
        }

    }, [date, client, allClients, camions]);

    const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [stockCheck, setStockCheck] = useState<{ available: number; hasStock: boolean } | null>(null);

    useEffect(() => {
        if (isOpen && client) {
            setCapacityCheck(null);
            // Fetch Global Stock via Client Supabase calc
            const checkStock = async () => {
                try {
                    const { data: clients, error } = await supabase.from('clients').select('nombreLED, nb_led');
                    if (error) throw error;

                    const totalConso = (clients || []).reduce((acc: number, c: any) => acc + (c.nombreLED || c.nb_led || 0), 0);
                    const MOCK_INITIAL = 50000; // Hardcoded default
                    const available = MOCK_INITIAL - totalConso;

                    setStockCheck({
                        available,
                        hasStock: available >= (client.nombreLED || 0)
                    });
                } catch (e) {
                    console.error("Error fetching stock", e);
                }
            };
            checkStock();
        }
    }, [isOpen, client]);

    useEffect(() => {
        if (client && date && selectedCamionId) {
            calculatePreview();
        }
    }, [date, selectedCamionId, client]);

    const calculatePreview = () => {
        if (!client || !date || !selectedCamionId) return;

        if (!client || !date || !selectedCamionId) return;

        const camion = camions.find(c => c.id === selectedCamionId);
        if (!camion) return;

        const dateStr = format(date, 'yyyy-MM-dd');

        // RECHERCHE DES VRAIES LIVRAISONS PLANIFIÉES
        // on cherche dans tous les clients ceux qui sont 'PLANIFIÉE' ou 'LIVRÉ' à cette date
        const existingDeliveries = (allClients || []).filter(c => {
            // Vérifier la date via helper unifié
            const d = getClientDeliveryDate(c);
            if (!d) return false;
            const cDate = format(d, 'yyyy-MM-dd');

            // MODE MONO-LIVREUR : On prend TOUS les clients de ce jour-là
            // On ignore c.camionId pour être sûr de compter tout le monde
            return cDate === dateStr;
        });

        console.log(`📊 Calcul Capacité pour le ${dateStr}:`);
        console.log(`   - Clients existants trouvés: ${existingDeliveries.length}`);
        existingDeliveries.forEach(c => console.log(`     > ${c.nom} (${c.nombreLED} LEDs)`));
        console.log(`   - Nouveau client: ${client.nom} (${client.nombreLED} LEDs)`);

        const estimatedVolume = client.nombreLED || 0;

        const newDelivery: Livraison = {
            id: 'temp',
            clientId: client.id,
            client: client,
            datePrevue: dateStr,
            camionId: camion.id,
            volumeTotal: estimatedVolume,
            statut: 'PLANIFIÉE',
            ordre: 99
        };

        // CheckCapacity attend une liste de 'Livraison', on map nos clients vers ce format
        const realDeliveriesMapped: Livraison[] = existingDeliveries.map(c => ({
            id: c.id,
            clientId: c.id,
            client: c,
            datePrevue: dateStr,
            camionId: selectedCamionId,
            volumeTotal: c.nombreLED || 0,
            statut: 'PLANIFIÉE',
            ordre: 0
        }));

        const check = OptimizerService.checkCapacity(
            [...realDeliveriesMapped, newDelivery],
            camion
        );

        setCapacityCheck(check);
    };

    const handleOptimize = async () => {
        if (!client || !allClients) return;
        setLoadingSuggestions(true);
        try {
            const results = await OptimizerService.findBestSlots(client, allClients);
            setSuggestions(results);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // --- NOUVELLE VERSION AVEC SOLVEUR LOCAL (Zéro Latence) ---
    // --- RETOUR À VROOM (SOLVEUR GLOBAL) ---
    const handleOptimizeRoute = async () => {
        if (!date || !client || camions.length === 0) return;

        try {
            setIsOptimizing(true);
            toast.info("🧠 Optimisation VROOM (IA Global) en cours...");

            const dateStr = format(date, 'yyyy-MM-dd');

            // 1. Rassembler tous les clients du jour
            let existingClients = (allClients || []).filter(c => {
                const d = getClientDeliveryDate(c);
                return d && format(d, 'yyyy-MM-dd') === dateStr;
            });

            // Ajouter le nouveau client s'il manque
            const allTripClients = [...existingClients];
            if (!allTripClients.find(c => c.id === client.id)) {
                allTripClients.push({
                    ...client,
                    date_livraison_prevue: dateStr,
                    nb_led: client.nombreLED || client.nb_led,
                    gps: client.gps
                } as any);
            }

            // 2. Préparer les données pour VROOM Service
            // Mapper les camions pour que VroomService.optimize trouve 'capacite'
            // ET INJECTER LE DÉPÔT LOCAL (Pour les Îles)
            const mappedCamions = camions.map(c => {
                let start: [number, number] = [2.3522, 48.8566]; // Paris (Default)
                let end: [number, number] | undefined = [2.3522, 48.8566];

                if (client && client.codePostal) {
                    const dep = client.codePostal.substring(0, 3); // 971, 972...
                    const dep2 = client.codePostal.substring(0, 2); // 20...

                    if (dep === '971') { start = [-61.5510, 16.2650]; end = [-61.5510, 16.2650]; } // Guadeloupe
                    else if (dep === '972') { start = [-61.0242, 14.6415]; end = [-61.0242, 14.6415]; } // Martinique
                    else if (dep === '973') { start = [-52.3300, 4.9330]; end = [-52.3300, 4.9330]; } // Guyane
                    else if (dep === '974') { start = [55.4500, -20.8800]; end = [55.4500, -20.8800]; } // Réunion
                    else if (dep === '976') { start = [45.2300, -12.7800]; end = [45.2300, -12.7800]; } // Mayotte
                    else if (dep2 === '20') { start = [8.7386, 41.9192]; end = [8.7386, 41.9192]; } // Corse (Ajaccio default)
                }

                // LOGIQUE "DORMIR SUR PLACE" (Ligne Noire)
                // Calcul de la latitude moyenne des clients du jour
                let isSouth = false;
                const validClients = allTripClients.filter(c => c.gps || (c as any).latitude);
                if (validClients.length > 0) {
                    const avgLat = validClients.reduce((acc, c) => {
                        let lat = 48.85; // Default Paris
                        if ((c as any).latitude) lat = parseFloat((c as any).latitude);
                        else if ((c as any).gps?.lat) lat = parseFloat((c as any).gps.lat);
                        else if (typeof (c as any).gps === 'string' && (c as any).gps.includes(',')) lat = parseFloat((c as any).gps.split(',')[0]);
                        return acc + lat;
                    }, 0) / validClients.length;

                    if (isSouthOfSleepLine(avgLat)) isSouth = true;
                }

                if (isSouth && start[1] === 48.8566) {
                    // Si départ Paris ET Sud -> Pas de retour forcé
                    end = undefined;
                }

                return {
                    ...c,
                    capacite: c.volumeMax,
                    start,
                    end
                };
            });

            // 3. Appel API via Service
            const result = await VroomService.optimize(allTripClients, mappedCamions, date);

            // 4. Update State
            console.log("✅ VROOM Result:", result);
            setVroomOptimization(result);
            toast.success("✅ Tournées optimisées par IA (VROOM) !");

            // Auto-select le camion du client (Basé sur le résultat VROOM)
            // On cherche dans quel véhicule (route) le client a été assigné
            // result.idMap map VroomID -> SupabaseID
            // result.routes[i].steps[j].id est le VroomID
            if (result.routes && result.idMap) {
                // Convertir ID Client courant en string pour comparaison
                const currentClientId = String(client.id);

                // Trouver le VroomID correspondant (C'est un peu lourd car Map inverse, mais on peut chercher dans values)
                // Mais result.idMap est { "1001": "uuid-...", "1002": "uuid-..." }
                const vroomEntry = Object.entries(result.idMap).find(([vId, cId]) => String(cId) === currentClientId);

                if (vroomEntry) {
                    const vroomMsgId = parseInt(vroomEntry[0]);
                    // Chercher dans les routes
                    const foundRoute = result.routes.find((r: any) => r.steps.some((s: any) => s.id === vroomMsgId));

                    if (foundRoute) {
                        // foundRoute.vehicle est l'ID Vroom du véhicule (1 ou 2)
                        // On doit mapper vers l'ID Supabase du camion.
                        // VroomService mappe index 0 -> ID 1, index 1 -> ID 2.
                        const truckIndex = foundRoute.vehicle - 1;
                        if (camions[truckIndex]) {
                            setSelectedCamionId(camions[truckIndex].id);
                            toast.info(`Affecté au camion : ${camions[truckIndex].nom}`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Erreur VROOM:", error);
            toast.error("Erreur d'optimisation VROOM. Vérifiez les GPS.");
        } finally {
            setIsOptimizing(false);
        }
    };


    const handleConfirm = async () => {
        if (!date) {
            toast.error("Veuillez sélectionner une date");
            return;
        }

        // Gestion des Exclus (Clients "Retirés" de la tournée via poubelle)
        if (excludedClientIds.length > 0) {
            const confirmExclusion = window.confirm(
                `Attention : Vous avez exclu ${excludedClientIds.length} client(s) de cette tournée.\n\nIls seront retirés du planning (Date effacée) pour permettre cette validation.\n\nConfirmer ?`
            );
            if (!confirmExclusion) return;

            // Déplanifier les exclus via Supabase
            try {
                const { error } = await supabase
                    .from('clients')
                    .update({
                        date_livraison_prevue: null,
                        statut_livraison: 'À PLANIFIER', // Reset statut
                        tournee_confirmee: false
                    })
                    .in('id', excludedClientIds);

                if (error) throw error;
                toast.success(`${excludedClientIds.length} client(s) déplanifié(s) avec succès.`);
            } catch (err) {
                console.error("Erreur lors de la déplanification des exclus", err);
                toast.error("Erreur technique lors du retrait des clients exclus.");
                return; // Stop
            }
        }

        const finalDate = new Date(date);
        finalDate.setHours(12, 0, 0, 0);

        // MODE BULK / OPTIMISATION GLOBALE
        // Si on est en mode Bulk (pas de client) et qu'on a un plan VROOM
        if (isBulkMode && vroomOptimization) {
            onConfirm({ date: finalDate, camionId: selectedCamionId || 'OPTIM' }, vroomOptimization);
            onClose();
            return;
        }

        if (!selectedCamionId) {
            toast.error("Veuillez sélectionner un camion");
            return;
        }

        // --- SYNCHRONISATION HORAIRES OPTIMISÉS (VROOM / LOCAL) ---
        // On calcule les horaires précis pour TOUS les clients de la tournée et on sauvegarde
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            let updates: any[] = [];
            let finalReturnDate: Date | null = null; // Pour mettre à jour finalDate

            // CAS 1 : VROOM A DÉJÀ CALCULÉ (On utilise ses horaires précis)
            if (vroomOptimization && vroomOptimization.routes) {
                const selectedCamionIndex = camions.findIndex(c => c.id === selectedCamionId);
                const vroomId = selectedCamionIndex + 1; // Vroom ID mapping (1, 2...)
                const route = vroomOptimization.routes.find((r: any) => r.vehicle === vroomId);

                if (route && route.steps) {
                    console.log("🚀 Utilisation des horaires VROOM pour la sauvegarde...");

                    updates = route.steps
                        .filter((step: any) => step.type === 'job')
                        .map((step: any) => {
                            const originalId = vroomOptimization.idMap ? vroomOptimization.idMap[step.id] : step.id;
                            let foundClient = (allClients || []).find(c => String(c.id) === String(originalId));
                            if (!foundClient && client && String(client.id) === String(originalId)) foundClient = client;

                            if (!foundClient) return null;

                            // VROOM renvoie 'arrival' en secondes depuis minuit (ex: 32400 pour 9h00)
                            const arrivalSeconds = step.arrival;
                            const arrivalDate = new Date(date);
                            arrivalDate.setHours(0, 0, 0, 0);
                            arrivalDate.setSeconds(arrivalSeconds);

                            // Pour mettre à jour la date de fin globale si besoin
                            if (!finalReturnDate || arrivalDate > finalReturnDate) finalReturnDate = arrivalDate;

                            // Mise à jour date finale si c'est le client courant
                            if (client && String(foundClient.id) === String(client.id)) {
                                finalDate.setTime(arrivalDate.getTime());
                                console.log("🕒 Heure VROOM appliquée au client courant:", format(finalDate, 'HH:mm'));
                            }

                            return {
                                id: foundClient.id,
                                date_livraison_prevue: arrivalDate.toISOString(),
                                livreur_id: selectedCamionId
                            };
                        }).filter(Boolean);
                }
            }

            // CAS 2 : LOCAL SOLVER (Ou Fallback si VROOM n'a rien donné pour ce camion)
            if (updates.length === 0) {
                // Logique identique au render pour retrouver les clients
                const allClientsForDate = (allClients || []).filter(c => {
                    const dKey = c.date_livraison_prevue || c.dateLivraison;
                    if (!dKey) return false;
                    const d = parseSafeDate(dKey);
                    return d && format(d, 'yyyy-MM-dd') === dateStr;
                });

                let truckClients = allClientsForDate.filter(c => {
                    if (client && c.id === client.id) return false;
                    const cTruckId = (c as any).livreur_id || (c as any).camionId;
                    const cIdNorm = String(cTruckId || '').replace('camion-', '');
                    const tIdNorm = String(selectedCamionId).replace('camion-', '');
                    return cTruckId && cIdNorm === tIdNorm;
                });
                if (client) truckClients.push(client);

                truckClients = truckClients.filter(c => !excludedClientIds.includes(String(c.id)));

                // LOGIQUE "DORMIR SUR PLACE" (LocalSolver)
                // Vérifier la latitude des clients sélectionnés
                let isSouth = false;
                const validTruckClients = truckClients.filter(c => c.gps || (c as any).latitude);
                if (validTruckClients.length > 0) {
                    const avgLat = validTruckClients.reduce((acc, c) => {
                        let lat = 48.85;
                        if ((c as any).latitude) lat = parseFloat((c as any).latitude);
                        else if ((c as any).gps?.lat) lat = parseFloat((c as any).gps.lat);
                        else if (typeof (c as any).gps === 'string' && (c as any).gps.includes(',')) lat = parseFloat((c as any).gps.split(',')[0]);
                        return acc + lat;
                    }, 0) / validTruckClients.length;

                    if (isSouthOfSleepLine(avgLat)) isSouth = true;
                }

                // Si Sud, on ne rentre pas au dépôt (returnToDepot = false)
                // Sinon, on garde la logique "Vendredi" ou standard (si on veut que Paris rentre toujours le soir sauf Sud)
                const isDavid = String(selectedCamionId || '').includes('2') || camions.find(c => c.id === selectedCamionId)?.nom.toLowerCase().includes('david');
                const isFriday = date.getDay() === 5;

                // Base logic: Return to depot unless it's David not on Friday (Legacy logic?)
                // New logic: Only sleep out if South of Line OR legacy exception?
                // The user says "si c'est en dessous... dort sur place".
                // Implies: Above -> Sleep in Paris. Below -> Sleep on site.

                let returnToDepot = true;
                if (isSouth) {
                    returnToDepot = false; // Dort sur place
                } else {
                    // Au Nord : Rentre à Paris.
                    // (On garde l'exception David/Vendredi si nécessaire, mais la consigne semble généraliser)
                    returnToDepot = true;
                }

                const simResult = OptimizerService.simulateTourSync(
                    date,
                    truckClients as Client[],
                    9,
                    0,
                    22,
                    { returnToDepot, preserveOrder: false } // Pas de preserveOrder en mode manuel local
                );

                updates = simResult.sortedClients.map(c => {
                    if (!c.estimatedArrival) return null;
                    if (client && String(c.id) === String(client.id)) {
                        finalDate.setTime(c.estimatedArrival.getTime());
                        console.log("🕒 Heure LocalSolver appliquée au client courant:", format(finalDate, 'HH:mm'));
                    }
                    return {
                        id: c.id,
                        date_livraison_prevue: c.estimatedArrival.toISOString(),
                        livreur_id: selectedCamionId
                    };
                }).filter(Boolean);
            }

            // 3. Mise à jour Supabase (Batch)
            if (updates.length > 0) {
                console.log(`💾 Sauvegarde de ${updates.length} horaires...`);
                const { error: batchErr } = await supabase.from('clients').upsert(updates);
                if (batchErr) {
                    console.error("Erreur save batch:", batchErr);
                    toast.error("Erreur de sauvegarde des horaires.");
                } else {
                    toast.success(`Planning synchronisé (${updates.length} clients)`);
                }
            }

        } catch (err) {
            console.error("Erreur critique sync horaires:", err);
            // On continue quand même pour ne pas bloquer la validation
        }




        // 1. Confirm Planning (Normal Mode)
        // On passe aussi vroomOptimization si dispo (au cas où on veut appliquer le tri)
        onConfirm({ date: finalDate, camionId: selectedCamionId }, vroomOptimization);

        // 2. Clear Recall Status if it exists (Supabase Direct)
        if (client && client.rappel_info?.active) {
            try {
                await supabase.from('clients').update({
                    // Remove 'active' flag or set entire object to inactive equivalent
                    rappel_info: { ...client.rappel_info, active: false }
                    // Also we might want to update status_client if needed, but existing backend only did active:false effectively via customInfo
                }).eq('id', client.id);
            } catch (e) {
                console.error("Failed to clear recall status:", e);
            }
        }

        onClose();
    };

    const isBulkMode = !client;
    // Si pas de client ET pas de date initiale (mode normal mal appelé), on ferme.
    if (!client && !initialDate) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[1400px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isBulkMode ? "Optimisation Globale (FLOTTE)" : "Planifier Livraison"}</DialogTitle>
                    <DialogDescription>
                        {isBulkMode
                            ? "Optimisation de l'ensemble des tournées pour la date sélectionnée."
                            : <span>Organisation de la tournée pour <span className="font-semibold text-foreground">{client?.prenom} {client?.nom}</span></span>
                        }
                    </DialogDescription>
                </DialogHeader>

                {!isBulkMode && client && (
                    <div className="flex flex-col gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10 -mt-2">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Adresse de livraison</p>
                                <p className="font-medium text-foreground">{client.adresse}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Contenu commande</p>
                                    <p className="font-medium text-foreground">{client.nombreLED} LEDs</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-white/50 shadow-sm border-primary/20">
                                ≈ {((client.nombreLED || 0) * 0.015).toFixed(1)} m³
                            </Badge>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 py-4">

                    {stockCheck && !stockCheck.hasStock && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-red-700 text-sm">Stock global insuffisant !</h4>
                                <p className="text-red-600 text-xs mt-1">
                                    Il reste <strong>{stockCheck.available}</strong> LEDs en stock, mais le client en demande <strong>{client.nombreLED}</strong>.
                                    Veuillez vérifier les approvisionnements avant de planifier.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Smart Scheduler Integrated */}
                    <div className={cn("bg-slate-50 p-4 rounded-lg border border-slate-200", stockCheck && !stockCheck.hasStock && "opacity-50 pointer-events-none")}>
                        <Label className="mb-2 block font-semibold text-slate-700">Suggestion de Dates (Optimisation Tournée)</Label>
                        <SmartScheduler
                            defaultAddress={client.adresse}
                            clientId={client.id}
                            nbLed={client.nombreLED}
                            compact={true}
                            autoSearch={true}
                            onDateSelect={(dateStr, eta) => {
                                const d = new Date(dateStr);
                                setDate(d);
                                setSelectedCamionId(""); // Reset pour re-calculer le meilleur camion
                                // Plus besoin de setTime - heure fixée à midi automatiquement
                            }}
                        />
                    </div>

                    {/* Sélection Date et Heure */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => {
                                        if (date) {
                                            const prev = new Date(date);
                                            prev.setDate(prev.getDate() - 1);
                                            setDate(prev);
                                            setSelectedCamionId(""); // Reset
                                        }
                                    }}
                                    disabled={!date}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "P", { locale: fr }) : <span>Date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={(d) => {
                                                setDate(d);
                                                setSelectedCamionId(""); // Reset
                                            }}
                                            initialFocus
                                            numberOfMonths={4}
                                            className="rounded-md border shadow-sm"
                                            disabled={(date) => false} // Allow all dates including past
                                        />
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => {
                                        if (date) {
                                            const next = new Date(date);
                                            next.setDate(next.getDate() + 1);
                                            setDate(next);
                                        }
                                    }}
                                    disabled={!date}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* SÉLECTEUR DE VÉHICULE (Accessible pour choix manuel) */}
                    {(
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Choisir un véhicule</Label>
                                {isAutoSelected && (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-600 border-blue-200 animate-pulse">
                                        Secteur détecté : Sélection automatique
                                    </Badge>
                                )}
                            </div>
                            <Select onValueChange={(val) => {
                                setSelectedCamionId(val);
                                setIsAutoSelected(false);
                            }} value={selectedCamionId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner un camion" />
                                </SelectTrigger>
                                <SelectContent>
                                    {camions.map((camion) => {
                                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                                        const truckDeliveries = (allClients || []).filter(c => {
                                            if (!c.camionId) return false;
                                            const parsed = getClientDeliveryDate(c);
                                            if (!parsed) return false;
                                            const cDate = format(parsed, 'yyyy-MM-dd');

                                            // Comparaison souple des IDs (ex: "1" == "camion-1")
                                            const cId = String(c.camionId).replace('camion-', '');
                                            const tId = String(camion.id).replace('camion-', '');

                                            return cDate === dateStr && cId === tId;
                                        });
                                        const currentLoad = truckDeliveries.reduce((acc, c) => acc + (c.nombreLED || 0), 0);
                                        const newClientLEDs = client ? client.nombreLED : 0;
                                        const totalLoad = currentLoad + newClientLEDs;
                                        const capacity = camion.volumeMax;
                                        const fillPercentage = Math.round((totalLoad / capacity) * 100);
                                        const isFull = totalLoad > capacity;

                                        let isWrongSector = false;
                                        let sectorName = "";
                                        const targetDept = client.codePostal?.substring(0, 2);
                                        const targetRegion = getRegionFromDept(targetDept);
                                        if (truckDeliveries.length > 0) {
                                            const firstClient = truckDeliveries[0];
                                            const truckDept = firstClient.codePostal?.substring(0, 2);
                                            const truckRegion = getRegionFromDept(truckDept);
                                            if (truckRegion !== targetRegion) {
                                                isWrongSector = true;
                                                sectorName = truckRegion;
                                            }
                                        }
                                        const isDisabled = isFull || isWrongSector;
                                        return (
                                            <SelectItem
                                                key={camion.id}
                                                value={camion.id}
                                                disabled={isDisabled}
                                                className={isDisabled ? "opacity-50" : ""}
                                            >
                                                <div className="flex flex-col gap-2 w-full min-w-[400px] py-1">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Truck className={cn("h-4 w-4", isDisabled ? "text-muted-foreground" : "text-primary")} />
                                                            <span className="font-semibold">{camion.nom}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isFull ? (
                                                                <Badge variant="destructive" className="h-5 text-[9px] px-1 uppercase">Plein</Badge>
                                                            ) : isWrongSector ? (
                                                                <Badge variant="outline" className="h-5 text-[9px] px-1 border-orange-300 text-orange-700 bg-orange-50 uppercase font-bold">
                                                                    Région {sectorName} uniquement
                                                                </Badge>
                                                            ) : truckDeliveries.length > 0 ? (
                                                                <Badge variant="outline" className="h-5 text-[9px] px-1 border-primary/30 text-primary bg-primary/5 uppercase">
                                                                    Secteur : {getRegionFromDept(client.codePostal?.substring(0, 2))} ({client.codePostal?.substring(0, 2)})
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="h-5 text-[9px] px-1 border-green-300 text-green-700 bg-green-50 uppercase font-bold">
                                                                    Véhicule Libre
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Barre de progression de capacité */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                            <span>Charge: <span className="font-bold text-foreground">{currentLoad} LEDs</span> + <span className="text-primary font-bold">{newClientLEDs}</span> = {totalLoad} LEDs</span>
                                                            <span className="font-mono font-bold">{fillPercentage}%</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full transition-all rounded-full",
                                                                    fillPercentage > 100 ? "bg-red-500" :
                                                                        fillPercentage > 80 ? "bg-orange-500" :
                                                                            "bg-green-500"
                                                                )}
                                                                style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                                                            />
                                                        </div>
                                                        <div className="text-[9px] text-muted-foreground text-right">
                                                            Capacité max: <span className="font-bold">{capacity} LEDs</span> •
                                                            Reste: <span className={cn("font-bold", totalLoad > capacity ? "text-red-600" : "text-green-600")}>
                                                                {Math.max(0, capacity - totalLoad)} LEDs
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* APERÇU DU TRAJET COMPLET */}
                    {date && (
                        <div className="space-y-3 p-4 bg-blue-50/30 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Navigation className="h-4 w-4 text-blue-600" />
                                <h3 className="font-bold text-blue-900">Aperçu du Trajet - {format(date, 'PPP', { locale: fr })}</h3>
                            </div>

                            {(() => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const clientsForDate = (allClients || []).filter(c => {
                                    const d = getClientDeliveryDate(c);
                                    const isExcluded = excludedClientIds.includes(String(c.id));
                                    return d && format(d, 'yyyy-MM-dd') === dateStr && !isExcluded;
                                });

                                const allClientsIncludingNew = [...clientsForDate];
                                if (!allClientsIncludingNew.find(c => String(c.id) === String(client.id))) {
                                    allClientsIncludingNew.push(client);
                                }
                                const totalLEDs = allClientsIncludingNew.reduce((sum, c) => sum + (c.nombreLED || 0), 0);

                                // Calcul horaire dynamique pour aperçu global
                                const selectedCamionObj = camions.find(c => c.id === selectedCamionId);
                                const isDavidGlobal = selectedCamionObj
                                    ? (selectedCamionObj.nom.toLowerCase().includes('david') || camions.indexOf(selectedCamionObj) === 1)
                                    : false;
                                const isMondayGlobal = date.getDay() === 1;
                                const startHourGlobal = (isDavidGlobal && !isMondayGlobal) ? 8 : 9;

                                let orderedClients = [...allClientsIncludingNew];
                                let usePreservedOrder = false;

                                // Si une optimisation VROOM est disponible pour ce camion, on l'utilise pour trier
                                if (vroomOptimization && vroomOptimization.routes) {
                                    const truckIndex = camions.findIndex(trk => trk.id === selectedCamionId);
                                    if (truckIndex >= 0) {
                                        const vroomVehicleId = truckIndex + 1; // VROOM IDs start at 1
                                        const targetRoute = vroomOptimization.routes.find((r: any) => r.vehicle === vroomVehicleId);

                                        if (targetRoute && targetRoute.steps) {
                                            // Extraire l'ordre des IDs clients
                                            const orderedIds: string[] = [];
                                            targetRoute.steps.forEach((step: any) => {
                                                if (step.type === 'job') {
                                                    const clientId = vroomOptimization.idMap[step.id];
                                                    if (clientId) orderedIds.push(String(clientId));
                                                }
                                            });

                                            // Reconstruire la liste dans l'ordre VROOM
                                            const reordered: Client[] = [];
                                            orderedIds.forEach(Id => {
                                                const found = allClientsIncludingNew.find(c => String(c.id) === Id);
                                                if (found) reordered.push(found);
                                            });

                                            // Ajouter les clients manquants (ex: nouveaux ajoutés après VROOM sans re-optimiser)
                                            allClientsIncludingNew.forEach(c => {
                                                if (!orderedIds.includes(String(c.id))) reordered.push(c);
                                            });

                                            orderedClients = reordered;
                                            usePreservedOrder = true;
                                            console.log("✅ Using VROOM order for preview");
                                        }
                                    }
                                }

                                const timeCheck = OptimizerService.simulateTourSync(
                                    date,
                                    orderedClients,
                                    startHourGlobal,
                                    0,
                                    22,
                                    { returnToDepot: true, preserveOrder: usePreservedOrder }
                                );

                                return (
                                    <>
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            <div className="bg-white p-2 rounded border border-blue-100">
                                                <p className="text-[10px] text-muted-foreground">Clients</p>
                                                <p className="text-lg font-bold text-blue-900">{allClientsIncludingNew.length}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border border-blue-100">
                                                <p className="text-[10px] text-muted-foreground">Total LEDs</p>
                                                <p className="text-lg font-bold text-blue-900">{totalLEDs}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded border border-blue-100">
                                                <p className="text-[10px] text-muted-foreground">Retour</p>
                                                <p className={cn(
                                                    "text-lg font-bold",
                                                    timeCheck.isLate ? "text-orange-600" : "text-green-600"
                                                )}>{format(timeCheck.returnDate, 'HH:mm')}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Itinéraire ({timeCheck.sortedClients.length} destinations)</p>
                                            {timeCheck.sortedClients.map((c, index) => (
                                                <div
                                                    key={`route-client-${c.id || 'unknown'}-${index}-${c.nom || ''}`}
                                                    className={cn(
                                                        "flex items-center gap-2 p-2 rounded text-xs group relative", // Added group + relative
                                                        c.id === client.id ? "bg-primary/10 border border-primary/30" : "bg-white border border-slate-200"
                                                    )}
                                                >
                                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold truncate">{c.prenom} {c.nom}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{c.ville || c.adresse}</p>
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] shrink-0">
                                                        {c.nombreLED} LED
                                                    </Badge>
                                                    {!(c as any).estimatedArrival && (
                                                        <Badge className="text-[9px] shrink-0 bg-yellow-500 text-white">
                                                            ⚠️ Sans GPS
                                                        </Badge>
                                                    )}
                                                    {c.id === client.id && (
                                                        <Badge className="text-[9px] shrink-0 bg-primary">
                                                            Nouveau
                                                        </Badge>
                                                    )}

                                                    {/* Bouton Poubelle (Visible au survol ou toujours si mobile/touch, ici group-hover pour desktop propreté) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Eviter click parent
                                                            if (c.id === client.id) {
                                                                toast.error("Impossible d'exclure le nouveau client en cours d'ajout.");
                                                                return;
                                                            }
                                                            setExcludedClientIds([...excludedClientIds, String(c.id)]);
                                                            toast.info(`Client ${c.nom} exclu temporairement.`);
                                                        }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-red-200 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-700 shadow-sm z-10"
                                                        title="Exclure de la simulation"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* VÉRIFICATION CAPACITÉ GLOBALE */}
                    {date && (() => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const clientsForDate = (allClients || []).filter(c => {
                            if (!c.dateLivraison) return false;
                            const d = parseSafeDate(c.dateLivraison);
                            return d && format(d, 'yyyy-MM-dd') === dateStr;
                        });

                        const totalLEDsWithNew = clientsForDate.reduce((sum, c) => sum + (c.nombreLED || 0), 0) + (client?.nombreLED || 0);

                        // Vérifier si au moins UN camion peut prendre ce client
                        const availableTrucks = camions.filter(camion => {
                            const truckClients = clientsForDate.filter(c => c.camionId === camion.id);
                            const currentLoad = truckClients.reduce((sum, c) => sum + (c.nombreLED || 0), 0);
                            const totalLoad = currentLoad + (client?.nombreLED || 0);
                            return totalLoad <= camion.volumeMax;
                        });

                        // Calculer la capacité totale de tous les camions
                        const totalCapacity = camions.reduce((sum, c) => sum + c.volumeMax, 0);
                        const isOverCapacity = totalLEDsWithNew > totalCapacity;

                        // Nombre de chauffeurs déjà utilisés ce jour
                        const usedTrucks = new Set(clientsForDate.map(c => c.camionId).filter(Boolean)).size;
                        const canAddMoreTrucks = usedTrucks < camions.length;

                        if (availableTrucks.length === 0) {
                            return (
                                <div className="space-y-3 p-4 bg-red-50/50 border-2 border-red-300 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h3 className="font-bold text-red-900 mb-2">
                                                {isOverCapacity ? "⛔ Capacité totale dépassée !" : "⚠️ Tous les camions sont pleins !"}
                                            </h3>
                                            <p className="text-sm text-red-800 mb-3">
                                                {isOverCapacity
                                                    ? `La charge totale (${totalLEDsWithNew} LEDs) dépasse la capacité maximale de tous les camions combinés (${totalCapacity} LEDs).`
                                                    : `Aucun camion ne peut prendre ce client (${client?.nombreLED} LEDs) pour cette date.`
                                                }
                                            </p>

                                            {!isOverCapacity && canAddMoreTrucks && (
                                                <div className="bg-white p-3 rounded border border-red-200 mb-3">
                                                    <p className="text-sm font-semibold text-slate-800 mb-2">💡 Solution recommandée :</p>
                                                    <p className="text-xs text-slate-600 mb-2">
                                                        Ajoutez un 2ème chauffeur pour partager la charge du jour. Cela permettra de :
                                                    </p>
                                                    <ul className="text-xs text-slate-600 space-y-1 ml-4">
                                                        <li>✅ Répartir les clients entre plusieurs camions</li>
                                                        <li>✅ Réduire le temps de tournée</li>
                                                        <li>✅ Livrer tous les clients le même jour</li>
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="flex gap-2 text-xs">
                                                <Badge variant="outline" className="bg-white">
                                                    {usedTrucks} chauffeur{usedTrucks > 1 ? 's' : ''} utilisé{usedTrucks > 1 ? 's' : ''}
                                                </Badge>
                                                <Badge variant="outline" className="bg-white">
                                                    {camions.length - usedTrucks} disponible{camions.length - usedTrucks > 1 ? 's' : ''}
                                                </Badge>
                                            </div>

                                            {isOverCapacity && (
                                                <p className="text-xs text-red-700 mt-3 font-semibold">
                                                    ⚠️ Vous devez choisir une autre date ou diviser la commande.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        } else if (availableTrucks.length < camions.length && canAddMoreTrucks) {
                            // Certains camions sont pleins, mais au moins un est disponible
                            return (
                                <div className="space-y-2 p-3 bg-blue-50/30 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-blue-900">
                                                ✅ {availableTrucks.length} camion{availableTrucks.length > 1 ? 's' : ''} disponible{availableTrucks.length > 1 ? 's' : ''}
                                            </p>
                                            <p className="text-xs text-blue-700 mt-1">
                                                {camions.length - availableTrucks.length} camion{camions.length - availableTrucks.length > 1 ? 's' : ''} déjà plein{camions.length - availableTrucks.length > 1 ? 's' : ''} pour cette date
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* SÉLECTION INTELLIGENTE DE VÉHICULE - VUE 3 COLONNES */}
                    {date && (
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Label>Aperçu des Véhicules</Label>
                                    {client && (
                                        <div className="flex items-center space-x-2">
                                            <Switch id="details-mode" checked={showDetails} onCheckedChange={setShowDetails} />
                                            <Label htmlFor="details-mode" className="text-xs font-normal text-muted-foreground cursor-pointer">Détails tournée</Label>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOptimizeRoute}
                                    disabled={isOptimizing}
                                    className="gap-2"
                                >
                                    {isOptimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                                    {isOptimizing ? 'Optimisation...' : 'Optimiser (VROOM IV)'}
                                </Button>
                            </div>


                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {camions.map((camion, index) => {
                                    const dateStr = format(date, 'yyyy-MM-dd');

                                    // 1. Calcul des clients pour ce camion
                                    let truckClients: any[] = [];
                                    let isOptimizedView = false;
                                    let isAssignedToThisTruck = false;
                                    const vroomId = index + 1;

                                    if (vroomOptimization && vroomOptimization.routes) {
                                        // Mode Optimisé : On affiche UNIQUEMENT ce que VROOM a décidé pour ce camion
                                        isOptimizedView = true; // Toujours vrai si on a un résultat IA

                                        const route = vroomOptimization.routes.find((r: any) => r.vehicle === vroomId);

                                        if (route && route.steps) {
                                            truckClients = route.steps
                                                .filter((step: any) => step.type === 'job')
                                                .map((step: any) => {
                                                    // Retrouver le client original via la map IDs
                                                    const originalId = vroomOptimization.idMap ? vroomOptimization.idMap[step.id] : step.id;

                                                    // Chercher dans allClients ou client (le nouveau)
                                                    let foundClient = (allClients || []).find(c => String(c.id) === String(originalId));
                                                    if (!foundClient && client && String(client.id) === String(originalId)) foundClient = client;

                                                    // Si pas trouvé (cas edge), on crée un objet minimal
                                                    if (!foundClient) return { ...step, nom: 'Client Inconnu', id: originalId, ville: 'Inconnue' };

                                                    return foundClient;
                                                });

                                            // Vérifier si le nouveau client est dans cette route
                                            isAssignedToThisTruck = truckClients.some(c => client && String(c.id) === String(client.id));
                                        } else {
                                            // Camion non utilisé par l'IA -> Vide
                                            truckClients = [];
                                        }
                                    } else {
                                        // Mode Aperçu (Par défaut) : On montre TOUS les clients de la date
                                        const allClientsForDate = (allClients || []).filter(c => {
                                            const dKey = c.date_livraison_prevue || c.dateLivraison;
                                            if (!dKey) return false;
                                            const d = parseSafeDate(dKey);
                                            return d && format(d, 'yyyy-MM-dd') === dateStr;
                                        });

                                        // Filtrer pour ne garder que ceux de CE camion
                                        truckClients = allClientsForDate.filter(c => {
                                            if (client && c.id === client.id) return false;
                                            const cTruckId = (c as any).livreur_id || (c as any).camionId;

                                            // Normalisation robuste des IDs (ex: "camion-1" vs "1")
                                            const cIdNorm = String(cTruckId || '').replace('camion-', '');
                                            const tIdNorm = String(camion.id).replace('camion-', '');

                                            return cTruckId && cIdNorm === tIdNorm;
                                        });
                                    }

                                    // FILTRAGE DES EXCLUS (Important pour le recalcul de charge et temps)
                                    truckClients = truckClients.filter(c => !excludedClientIds.includes(String(c.id)));

                                    const currentLoad = truckClients.reduce((sum, c) => sum + (c.nb_led || c.nombreLED || 0), 0);

                                    // Charge totale : si optimisé, truckClients contient déjà tout le monde. 
                                    // Sinon, on simule l'ajout du nouveau client PARTOUT pour voir ce que ça donnerait.
                                    const totalLoad = isOptimizedView
                                        ? currentLoad
                                        : currentLoad + (client?.nb_led || client?.nombreLED || 0);

                                    const capacity = camion.volumeMax;
                                    const fillRate = Math.round((totalLoad / capacity) * 100);
                                    const isOverloaded = totalLoad > capacity;



                                    // 2. Vérification Temps
                                    let simulationClients = [...truckClients];

                                    // Si on n'est PAS en mode optimisé, on ajoute manuellement le client à TOUS les camions pour la simulation (Preview)
                                    if (!isOptimizedView) {
                                        // On vérifie qu'il n'est pas déjà dedans (au cas où)
                                        if (!simulationClients.some(c => String(c.id) === String(client.id))) {
                                            simulationClients.push(client);
                                        }
                                    }
                                    // En mode optimisé, truckClients (VROOM) contient déjà tout le monde, donc on ne touche à rien.

                                    // 2. Vérification Temps
                                    const isDavid = camion.id === 2 || String(camion.id).endsWith('2');
                                    const isFriday = date.getDay() === 5;
                                    const returnToDepot = !isDavid || (isDavid && isFriday);

                                    const timeCheck = OptimizerService.simulateTourSync(date, simulationClients as Client[], 9, 0, 20, { returnToDepot, preserveOrder: true });
                                    const timeOk = !timeCheck.isLate;

                                    // Context de la tournée (Villes)
                                    const cities = Array.from(new Set(truckClients.map(c => c.ville || c.adresse?.split(',')[1]?.trim() || 'Inconnu'))).filter(Boolean);
                                    const regionSummary = cities.slice(0, 3).join(', ') + (cities.length > 3 ? ` +${cities.length - 3}` : '');

                                    // Calcul des candidats valides (pour le fallback logique standard)
                                    const validTrucks = camions.filter(c => c.volumeMax >= totalLoad);
                                    const sortedCandidates = [...validTrucks].sort((a, b) => a.volumeMax - b.volumeMax);
                                    const bestCandidateId = sortedCandidates.length > 0 ? sortedCandidates[0].id : null;

                                    // Sélection automatique du camion qui contient le client après optimisation
                                    const isBestFit = isOptimizedView
                                        ? isAssignedToThisTruck
                                        : (bestCandidateId === camion.id); // Fallback ancienne logique

                                    // Mise à jour de l'ID sélectionné si optimisé et assigné
                                    if (isOptimizedView && isAssignedToThisTruck && selectedCamionId !== camion.id) {
                                        // On le fait de manière asynchrone pour éviter update during render
                                        setTimeout(() => setSelectedCamionId(camion.id), 0);
                                    }

                                    const betterOptionExists = sortedCandidates.some(c => c.volumeMax < camion.volumeMax);
                                    const isOversized = betterOptionExists && !isOverloaded && fillRate < 30;

                                    const isSelected = selectedCamionId === camion.id || (isOptimizedView && isAssignedToThisTruck);

                                    // Create a nice summary string
                                    const stopsSummary = truckClients.slice(0, 3).map(c => {
                                        const ville = c.ville || c.adresse?.split(',')[1]?.trim() || 'Ville inc.';
                                        return `${ville} (${c.nom})`;
                                    }).join(', ');

                                    const hasMore = truckClients.length > 3;
                                    const summaryDisplay = truckClients.length > 0
                                        ? `${stopsSummary}${hasMore ? ` + ${truckClients.length - 3} autres` : ''}`
                                        : "Aucune livraison (Départ Dépôt)";

                                    return (
                                        <div
                                            key={camion.id}
                                            onClick={() => setSelectedCamionId(camion.id)}
                                            className={cn(
                                                "relative flex flex-col p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md",
                                                isSelected ? "border-primary bg-primary/5 shadow-lg" : "border-slate-200 hover:border-primary/50",
                                                isOverloaded ? "opacity-60 border-red-100 bg-red-50/30" : ""
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-full flex items-center justify-center border shadow-sm",
                                                        isSelected ? "bg-white border-primary text-primary" : "bg-white border-slate-200 text-slate-400"
                                                    )}>
                                                        <Truck className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Chauffeur</span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">NAVETTE {index + 1}</Badge>
                                                                <span className="font-bold text-sm text-slate-800">{camion.nom}</span>
                                                            </div>
                                                            {isBestFit && <Badge className="bg-green-600 text-[10px] h-5">Recommandé</Badge>}

                                                            {/* Status Badges */}
                                                            {isOverloaded && <Badge variant="destructive" className="text-[10px] h-5">Trop petit</Badge>}
                                                            {isOversized && <Badge variant="outline" className="text-[10px] h-5 text-slate-500 border-slate-300">Trop grand</Badge>}
                                                            {!isBestFit && !isOverloaded && !isOversized && fillRate < 80 && (
                                                                <Badge variant="outline" className="text-[10px] h-5 text-slate-500">Disponible</Badge>
                                                            )}
                                                            {!timeOk && !isOverloaded && (
                                                                <Badge variant="outline" className="text-[10px] h-5 border-orange-200 text-orange-700 bg-orange-50">Retour Tardif</Badge>
                                                            )}
                                                            {isSelected && !isBestFit && <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-800">Sélectionné</Badge>}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                                            <span>Capacité: <strong>{camion.volumeMax}</strong></span>
                                                            <span className="mx-1">•</span>
                                                            <span className={cn(
                                                                "font-medium",
                                                                (camion.volumeMax - totalLoad) < 0 ? "text-red-600" : "text-slate-600"
                                                            )}>
                                                                Reste: {Math.max(0, camion.volumeMax - totalLoad)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    {isOverloaded ? (
                                                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" /> Surcharge
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-slate-500">
                                                            {totalLoad} / {camion.volumeMax}
                                                        </span>
                                                    )}
                                                    <div className={cn("h-1.5 w-16 mt-1 rounded-full overflow-hidden", isOverloaded ? "bg-red-200" : "bg-slate-100")}>
                                                        <div
                                                            className={cn("h-full transition-all", isOverloaded ? "bg-red-500" : isSelected ? "bg-primary" : "bg-slate-400")}
                                                            style={{ width: `${isOverloaded ? 100 : fillRate}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SECTION NAVETTE / TOURNÉE OPTIMISÉE */}
                                            <div className="bg-white/50 rounded p-3 border border-slate-100 mt-2 space-y-2">
                                                {/* Header avec stats */}
                                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-700">
                                                            Itinéraire ({truckClients.length + 1} stops)
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded",
                                                        timeOk ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                                                    )}>
                                                        <Clock className="h-3 w-3" />
                                                        Retour {format(timeCheck.returnDate, 'HH:mm')}
                                                    </div>
                                                </div>

                                                {/* TIMELINE DE LA NAVETTE (SCHÉMA) */}
                                                <div className="relative pl-4 space-y-0 pr-2 pt-2">

                                                    {/* Ligne verticale conductrice */}
                                                    <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-200 z-0" />

                                                    {/* DÉPART DYNAMIQUE */}
                                                    {(() => {
                                                        const isDavidMap = camion.nom.toLowerCase().includes('david') || index === 1;
                                                        const isMondayMap = date && date.getDay() === 1;

                                                        let startLabel = "🏢 Départ Dépôt";
                                                        let startH = 9;

                                                        if (isDavidMap) {
                                                            if (isMondayMap) {
                                                                startLabel = "🏢 Départ Paris (Aller)";
                                                                startH = 9;
                                                            } else {
                                                                // Recherche Ville J-1 pour affichage
                                                                startH = 8;
                                                                startLabel = "🏨 Départ Hôtel (J-1)";
                                                                try {
                                                                    // Mini logique de recherche J-1 pour l'affichage (similaire à l'algo VROOM)
                                                                    if (date) {
                                                                        const currentDateStr = format(date, 'yyyy-MM-dd');

                                                                        // 🕵️ DETECTIVE AVIGNON + BOURGES
                                                                        try {
                                                                            const targets = ["avignon", "bourges"];
                                                                            targets.forEach(t => {
                                                                                const found = (allClients || []).filter(c => (c.ville || "").toLowerCase().includes(t) || (c.adresse || "").toLowerCase().includes(t));
                                                                                console.log(`🕵️ DÉTECTIVE ${t.toUpperCase()}:`, found.map(c => ({
                                                                                    id: c.id,
                                                                                    date: c.dateLivraison,
                                                                                    truck: c.livreur_id || c.camionId,
                                                                                    raw: c
                                                                                })));
                                                                            });
                                                                        } catch (e) { }

                                                                        // BACKTRACKING SEARCH
                                                                        const prevClients = (allClients || []).filter(c => {
                                                                            if (!c.dateLivraison) return false;
                                                                            const cId = String(c.livreur_id || c.camionId || '').replace('camion-', '');
                                                                            const tId = String(camion.id).replace('camion-', '');
                                                                            const isDavid = (tId === '2' || tId === '1001');
                                                                            const targetMatch = isDavid ? (cId === '2' || cId === '1001') : (cId === tId);
                                                                            if (!targetMatch) return false;

                                                                            // Normalize Date
                                                                            let cDateStr = String(c.dateLivraison).split('T')[0];
                                                                            if (cDateStr.includes('/')) {
                                                                                const p = cDateStr.split('/');
                                                                                if (p.length === 3) cDateStr = `${p[2]}-${p[1]}-${p[0]}`;
                                                                            }

                                                                            return cDateStr < currentDateStr;
                                                                        });

                                                                        if (prevClients.length > 0) {
                                                                            // Trier par Date DESC (Format normalisé)
                                                                            prevClients.sort((a: any, b: any) => {
                                                                                let dA = String(a.dateLivraison).split('T')[0];
                                                                                if (dA.includes('/')) dA = `${dA.split('/')[2]}-${dA.split('/')[1]}-${dA.split('/')[0]}`;

                                                                                let dB = String(b.dateLivraison).split('T')[0];
                                                                                if (dB.includes('/')) dB = `${dB.split('/')[2]}-${dB.split('/')[1]}-${dB.split('/')[0]}`;

                                                                                const timeA = new Date(dA).getTime();
                                                                                const timeB = new Date(dB).getTime();

                                                                                if (timeA !== timeB) return timeB - timeA; // Descending
                                                                                return (Number(b.id) || 0) - (Number(a.id) || 0);
                                                                            });
                                                                            const last = prevClients[0];

                                                                            // Check Age Limit (Simlified Display Logic)
                                                                            let daysDiff = 999;
                                                                            try {
                                                                                let dL = String(last.dateLivraison).split('T')[0];
                                                                                if (dL.includes('/')) dL = `${dL.split('/')[2]}-${dL.split('/')[1]}-${dL.split('/')[0]}`;
                                                                                daysDiff = (Math.abs(new Date(currentDateStr).getTime() - new Date(dL).getTime())) / (1000 * 3600 * 24);
                                                                            } catch (e) { }

                                                                            if (daysDiff > 5) {
                                                                                startLabel = "🏢 Départ Paris";
                                                                            } else {
                                                                                let v = last.ville;
                                                                                if (!v && last.adresse) {
                                                                                    const m = last.adresse.match(/\d{5}\s+(.+)$/);
                                                                                    if (m) v = m[1];
                                                                                    else v = last.adresse.split(',').pop()?.trim();
                                                                                }
                                                                                if (v) startLabel = `🏨 Départ Hôtel (${v})`;
                                                                            }
                                                                        }
                                                                    }
                                                                } catch (e) { /* ignore */ }
                                                            }
                                                        }

                                                        return (
                                                            <div className="relative z-10 flex items-start gap-3 pb-6">
                                                                <div className="h-6 w-6 rounded-full bg-slate-800 border-2 border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                                                                    <div className="h-2 w-2 bg-white rounded-full" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-600">{startH}:00</p>
                                                                    <p className="text-sm font-bold text-slate-800">{startLabel}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ÉTAPES CLIENTS - TOGGLE VIEW */}
                                                    {!showDetails ? (
                                                        <div className="py-6 border-l-2 border-slate-200 ml-3 pl-6 relative">
                                                            <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-slate-200 border-2 border-white" />
                                                            <div className="text-sm text-slate-600 font-medium">
                                                                {timeCheck.sortedClients.length} visites prévues
                                                            </div>
                                                            {/* Show the TARGET client specifically if found */}
                                                            {timeCheck.sortedClients.map((c: any) => {
                                                                if (client && c.id === client.id) {
                                                                    const arrival = c.estimatedArrival ? new Date(c.estimatedArrival) : null;
                                                                    const h = arrival ? parseInt(format(arrival, 'HH')) : 0;
                                                                    const isLate = h >= 22 || (h >= 0 && h < 5);
                                                                    return (
                                                                        <div key={c.id} className={cn(
                                                                            "mt-3 p-3 border rounded-lg shadow-sm flex justify-between items-center transition-all animate-in fade-in zoom-in slide-in-from-left-4",
                                                                            isLate ? "bg-red-50 border-red-200" : "bg-blue-600 border-blue-700 shadow-md transform scale-105"
                                                                        )}>
                                                                            <div>
                                                                                <p className={cn("text-xs font-bold uppercase", isLate ? "text-red-800" : "text-blue-100")}>
                                                                                    Votre Client ici
                                                                                </p>
                                                                                <p className={cn("text-lg font-black", isLate ? "text-red-900" : "text-white")}>
                                                                                    {arrival ? format(arrival, 'HH:mm') : 'N/A'}
                                                                                </p>
                                                                            </div>
                                                                            {isLate && <Badge variant="destructive" className="animate-pulse">TROP TARD</Badge>}
                                                                            {!isLate && <CheckCircle2 className="h-6 w-6 text-white" />}
                                                                        </div>
                                                                    )
                                                                }
                                                                return null;
                                                            })}
                                                        </div>
                                                    ) : (
                                                        /* FULL DETAILED LIST */
                                                        timeCheck.sortedClients.map((c: any, idx: number) => {
                                                            const isNewClient = client && c.id === client.id;

                                                            // NOUVEAU : Récupération Heure Arrivée Précise
                                                            const arrivalDate = c.estimatedArrival ? new Date(c.estimatedArrival) : null;

                                                            // Check retard INDIVIDUEL (Le client est visité trop tard)
                                                            let isLate = false;
                                                            if (arrivalDate) {
                                                                const h = parseInt(format(arrivalDate, 'HH'));
                                                                // Limite à 22h00
                                                                isLate = h >= 22 || (h >= 0 && h < 5); // Entre 22h et 5h du mat
                                                            }

                                                            // Le client "pose problème" si c'est lui qui est en retard
                                                            const isProblematic = isLate;

                                                            const isExcluded = excludedClientIds.includes(String(c.id));
                                                            if (isExcluded) return null; // Ne pas afficher si exclu

                                                            const ville = (() => {
                                                                const addr = c.adresse_brute || c.adresse || c.ville || '';
                                                                const match = addr.match(/\d{5}\s+(.+)$/);
                                                                return match ? match[1] : addr.split(' ').slice(-1)[0] || 'Ville';
                                                            })();

                                                            return (
                                                                <div key={idx} className="relative z-10 flex items-start gap-3 pb-6 group">
                                                                    {/* Marqueur */}
                                                                    <div className={cn(
                                                                        "h-6 w-6 rounded-full border-2 shadow-sm flex items-center justify-center shrink-0 mt-0.5 transition-all text-[10px] font-bold",
                                                                        isProblematic
                                                                            ? "bg-red-600 border-red-200 ring-4 ring-red-500/20 text-white scale-110 animate-pulse" // Clignote si tard
                                                                            : isNewClient
                                                                                ? "bg-blue-600 border-blue-100 scale-110 ring-4 ring-blue-500/20 text-white"
                                                                                : "bg-white border-slate-300 group-hover:border-blue-300 text-slate-600"
                                                                    )}>
                                                                        {idx + 1}
                                                                    </div>

                                                                    {/* Contenu Carte */}
                                                                    <div className={cn(
                                                                        "flex-1 p-2 rounded-lg border text-left transition-all",
                                                                        isProblematic
                                                                            ? "bg-red-50 border-red-200 shadow-md"
                                                                            : isNewClient
                                                                                ? "bg-blue-50 border-blue-200 shadow-sm"
                                                                                : "bg-white border-slate-100 hover:border-blue-200"
                                                                    )}>
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    {arrivalDate ? (
                                                                                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-tight",
                                                                                            isProblematic ? "text-white bg-red-600"
                                                                                                : isNewClient ? "text-white bg-blue-600"
                                                                                                    : "bg-slate-200 text-slate-600")}>
                                                                                            {format(arrivalDate, 'HH:mm')}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-tight bg-yellow-100 text-yellow-700">
                                                                                            N/A
                                                                                        </span>
                                                                                    )}
                                                                                    <p className={cn("text-xs font-bold leading-none truncate",
                                                                                        isProblematic ? "text-red-800"
                                                                                            : isNewClient ? "text-blue-700"
                                                                                                : "text-slate-800")}>
                                                                                        {ville.toUpperCase()}
                                                                                    </p>
                                                                                </div>
                                                                                <p className="text-[10px] text-muted-foreground line-clamp-1">{c.prenom} {c.nom}</p>
                                                                            </div>
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                {!arrivalDate && (
                                                                                    <Badge className="text-[9px] h-4 bg-yellow-500 hover:bg-yellow-600 border-none px-1">⚠️ Sans GPS</Badge>
                                                                                )}
                                                                                {isProblematic && (
                                                                                    <Badge className="text-[9px] h-4 bg-red-600 hover:bg-red-700 border-none px-1 animate-pulse">❌ Trop Tard</Badge>
                                                                                )}
                                                                                {isNewClient && (
                                                                                    <Badge className="text-[9px] h-4 bg-blue-600 border-none px-1">Nouveau</Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {(!isNewClient && !isProblematic) && (
                                                                            <div className="mt-1 flex gap-2">
                                                                                <Badge variant="outline" className="text-[9px] h-4 bg-slate-50 text-slate-500 border-slate-200 px-1">
                                                                                    {c.nb_led || c.nombreLED} LED
                                                                                </Badge>

                                                                                {/* Bouton Supprimer/Exclure */}
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation(); // Empêcher la sélection du camion
                                                                                                    setExcludedClientIds([...excludedClientIds, String(c.id)]);
                                                                                                    toast.info(`Client ${c.nom} exclu de la simulation temporaire.`);
                                                                                                }}
                                                                                                className="ml-auto text-slate-400 hover:text-red-600 transition-colors p-1"
                                                                                            >
                                                                                                <Trash2 className="h-3 w-3" />
                                                                                            </button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>Retirer de ce trajet</TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}


                                                    {/* RETOUR */}
                                                    <div className="relative z-10 flex items-center gap-3 pb-2 mt-4 pt-4 border-t border-dashed border-slate-200">
                                                        <div className="h-8 w-8 rounded-full bg-slate-900 border-2 border-white shadow-md flex items-center justify-center shrink-0">
                                                            <span className="text-xs">{timeCheck.returnDate ? "🏁" : "🌙"}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                {returnToDepot ? "RETOUR PARIS" : "SOIRÉE ÉTAPE (HÔTEL)"}
                                                            </p>
                                                            <p className={cn(
                                                                "text-xl font-black tabular-nums",
                                                                timeOk ? "text-slate-800" : "text-red-600"
                                                            )}>
                                                                {format(timeCheck.returnDate, 'HH:mm')}
                                                            </p>
                                                        </div>
                                                        {!timeOk && (
                                                            <Badge variant="destructive" className="ml-auto text-[10px]">TARDIF</Badge>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* VERIFICATION HORAIRE (RETOUR PARIS) */}
                            {(() => {
                                if (!date || !selectedCamionId) return null;

                                const dateStr = format(date, 'yyyy-MM-dd');

                                // Récupérer les clients de CE camion
                                const clientsDuCamion = (allClients || []).filter(c => {
                                    if (!c.dateLivraison) return false;
                                    const d = parseSafeDate(c.dateLivraison);
                                    const isDate = d && format(d, 'yyyy-MM-dd') === dateStr;
                                    return isDate && c.camionId === selectedCamionId && !excludedClientIds.includes(String(c.id));
                                });

                                // Simulation
                                const simulationClients = [...clientsDuCamion, client];

                                const selectedCamionObj = camions.find(c => c.id === selectedCamionId);
                                const isDavid = selectedCamionObj
                                    ? (selectedCamionObj.nom.toLowerCase().includes('david') || camions.indexOf(selectedCamionObj) === 1)
                                    : String(selectedCamionId || '').includes('2');
                                const isMonday = date.getDay() === 1;
                                const isFriday = date.getDay() === 5;

                                // David : 9h le Lundi (Départ Dépôt), 8h les autres jours (Départ Hôtel)
                                // Autres : 9h par défaut (ou à affiner)
                                const startHour = (isDavid && !isMonday) ? 8 : 9;

                                const returnToDepot = !isDavid || (isDavid && isFriday);

                                const simResult = OptimizerService.simulateTourSync(date, simulationClients as Client[], startHour, 0, 20, { returnToDepot, preserveOrder: true });

                                const count = simulationClients.length;
                                const isLate = simResult.isLate;
                                const returnTimeStr = format(simResult.returnDate, 'HH:mm');

                                return (
                                    <div className={cn(
                                        "flex items-center justify-between p-2 rounded border text-xs mt-2",
                                        isLate ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-blue-50 border-blue-100 text-blue-800"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <Clock className={cn("h-4 w-4", isLate ? "text-orange-600" : "text-blue-600")} />
                                            <div>
                                                <span className="font-semibold block">
                                                    {isLate
                                                        ? `⚠ Fin tardive (> 20h) : ${returnTimeStr}`
                                                        : returnToDepot ? `✅ Retour Paris : ${returnTimeStr}` : `🌙 Fin de journée : ${returnTimeStr}`
                                                    }
                                                </span>
                                                <span className="text-[10px] opacity-80">
                                                    Départ {startHour}h00 • {Math.round(simResult.totalDurationMinutes)} min
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-sm block">{count} stops</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )
                    }

                    {/* Simulation Détail (Masqué si on a la liste au-dessus, ou gardé pour info supp) */}
                    {/* On garde juste le message de succès/erreur global en bas */}
                    {
                        false && capacityCheck && (
                            <div className={cn(
                                "rounded-lg border p-3 mt-4 text-xs",
                                capacityCheck.success ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
                            )}>
                                {capacityCheck.success ? (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="font-semibold">Véhicule validé : {capacityCheck.ledsUtilises} LEDs chargés sur {1000} (simulé)</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold">Attention : Capacité dépassée ! Choisissez un plus gros camion.</span>
                                    </div>
                                )}
                            </div>
                        )
                    }

                </div >

                {/* Alerte Clients Non Assignés (VROOM Rejets) */}
                {
                    vroomOptimization && vroomOptimization.unassigned && vroomOptimization.unassigned.length > 0 && (
                        <div className="mx-1 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                                <AlertTriangle className="h-4 w-4" />
                                {vroomOptimization.unassigned.length} Client(s) non planifié(s) par l'IA
                            </div>
                            <div className="text-xs text-red-600 mb-2">
                                Ces clients n'ont pas pu être assignés (horaire {'>'} 22h ou secteur incompatible) :
                            </div>
                            <ul className="list-disc list-inside text-xs font-bold text-red-800">
                                {vroomOptimization.unassigned.map((u: any) => {
                                    const originalId = vroomOptimization.idMap ? vroomOptimization.idMap[u.id] : u.id;
                                    let foundClient = (allClients || []).find(c => String(c.id) === String(originalId));
                                    if (!foundClient && client && String(client.id) === String(originalId)) foundClient = client;

                                    const clientName = foundClient ? `${foundClient.nom} (${foundClient.ville || 'Ville inconnue'})` : `Client ID #${originalId}`;

                                    return (
                                        <li key={u.id} className="flex justify-between items-center group">
                                            <span>{clientName}</span>
                                            <button
                                                onClick={() => {
                                                    setExcludedClientIds([...excludedClientIds, String(u.id)]);
                                                    toast.info(`Client ${foundClient?.nom || u.id} exclu de la simulation.`);
                                                }}
                                                className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Exclure ce client de la simulation"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )
                }

                <DialogFooter className="sm:justify-between items-center gap-4">
                    {/* Avertissement bloquant si dépassement horaire */}
                    {(() => {
                        if (!date || !selectedCamionId) return <div />;

                        // Recalcul rapide de l'horaire pour le check bloquant
                        // (Idéalement on aurait ça dans un state partagé, mais ici on le recalcule pour être sûr)
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const clientsDuCamion = (allClients || []).filter(c => {
                            if (!c.dateLivraison) return false;
                            const d = parseSafeDate(c.dateLivraison);
                            const isDate = d && format(d, 'yyyy-MM-dd') === dateStr;
                            return isDate && c.camionId === selectedCamionId;
                        });
                        const simulationClients = [...clientsDuCamion, client];
                        const simResult = OptimizerService.simulateTourSync(date, simulationClients as Client[], 9, 0);

                        // SI RETOUR > 22h00 (Heure limite stricte)
                        // SI RETOUR > 21h00 -> HOTEL
                        const returnHour = parseInt(format(simResult.returnDate, 'HH'));
                        const needsHotel = returnHour >= 21 || returnHour < 6; // Entre 21h et 6h du mat = Hôtel

                        // Limite ultime physique (ex: 2h du matin le lendemain ?)
                        // Pour l'instant on laisse ouvert, on alerte juste

                        if (needsHotel) {
                            return (
                                <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded border border-blue-200 flex items-center gap-2">
                                    <div className="bg-blue-600 text-white rounded p-1"><Home className="h-3 w-3" /></div>
                                    <span>Fin de tournée à {format(simResult.returnDate, 'HH:mm')} : <strong>PRÉVOIR HÔTEL</strong></span>
                                </div>
                            );
                        }
                        return <div />;
                    })()}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Annuler</Button>
                        {(() => {
                            // Logique de desactivation
                            let isDisabled = !date || (!selectedCamionId && !isBulkMode);
                            let label = "Planifier la livraison";
                            let isHotel = false;
                            let isTooLate = false;

                            // NOUVEAU: Check Région SUD
                            let isRegionSud = false;
                            if (client && client.codePostal) {
                                const d = client.codePostal.substring(0, 2);
                                const DEPTS_SUD = ["13", "83", "06", "84", "04", "05", "20", "30", "34", "11", "66", "48", "12", "81", "31", "32", "65", "09", "46", "82"];
                                isRegionSud = DEPTS_SUD.includes(d);
                            }

                            if (date && selectedCamionId) {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const clientsDuCamion = (allClients || []).filter(c => {
                                    if (!c.dateLivraison || !c.camionId) return false;
                                    const d = parseSafeDate(c.dateLivraison);
                                    if (!d || format(d, 'yyyy-MM-dd') !== dateStr) return false;

                                    const cId = String(c.camionId).replace('camion-', '');
                                    const tId = String(selectedCamionId).replace('camion-', '');
                                    return cId === tId && !excludedClientIds.includes(String(c.id));
                                });

                                const simulationClients = [...clientsDuCamion, client].filter(c => !!c) as Client[];

                                if (simulationClients.length > 0) {
                                    const selectedCamionObj = camions.find(c => c.id === selectedCamionId);
                                    const isDavid = selectedCamionObj
                                        ? (selectedCamionObj.nom.toLowerCase().includes('david') || camions.indexOf(selectedCamionObj) === 1)
                                        : String(selectedCamionId || '').includes('2');

                                    const isMonday = date.getDay() === 1;
                                    const isFriday = date.getDay() === 5;
                                    const startHour = (isDavid && !isMonday) ? 8 : 9;
                                    const returnToDepot = !isDavid || (isDavid && isFriday);

                                    const simResult = OptimizerService.simulateTourSync(date, simulationClients, startHour, 0, 20, { returnToDepot, preserveOrder: true });
                                    const returnHour = parseInt(format(simResult.returnDate, 'HH'));

                                    isTooLate = returnHour >= 22; // Hard limit
                                    // isHotel si dépassement horaire sans être too late, OU si c'est un découché prévu (Mardi-Jeudi)
                                    // Attention : si découché, returnDate est l'arrivée au dernier point.
                                    // Si !returnToDepot, on ne rentre pas. Donc pas de notion de "Trop tard pour rentrer à Paris".
                                    // Mais notion de "Trop tard pour finir la journée" (20h).

                                    if (!returnToDepot) {
                                        // Découché : Si > 20h, c'est tard.
                                        isTooLate = returnHour >= 21;
                                        isHotel = true; // Par définition
                                    } else {
                                        // Retour Dépôt
                                        isHotel = !isTooLate && (returnHour >= 21 || returnHour < 5);
                                    }
                                }
                            }

                            const hasUnassigned = vroomOptimization && vroomOptimization.unassigned && vroomOptimization.unassigned.length > 0;

                            // LOGIQUE FINALE AVEC EXCEPTION SUD
                            if (hasUnassigned) {
                                label = "⛔ Rejets IA (Impossible)";
                                isDisabled = true;
                            } else if (isTooLate) { // > 22h par défaut dans le calcul, on peut serrer
                                if (isRegionSud) {
                                    label = "⚠️ Forcer (SUD > 22h)";
                                    // Pas disabled
                                } else {
                                    label = "⛔ Impossible (> 22h)";
                                    isDisabled = true;
                                }
                            } else if (!date) {
                                label = "⏳ Sélectionnez une date";
                            } else if (isBulkMode && vroomOptimization) {
                                label = "✅ Valider Optimisation Globale";
                            } else if (!selectedCamionId && !isBulkMode) {
                                label = "🚛 Choisissez un camion";
                            } else if (isHotel) {
                                // Distinction : Hôtel (Découché) vs Retour Tardif (Vendredi/Nicolas)
                                const sId = String(selectedCamionId || '');
                                const isNicolas = sId.includes('1');
                                const isDavid = sId.includes('2');
                                const isRetourDepot = isNicolas || (date.getDay() === 5 && isDavid);
                                label = isRetourDepot ? "⚠️ Valider (Retour Tardif)" : "🏨 Planifier (Avec Hôtel)";
                            }

                            return (
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isDisabled}
                                    className={cn(
                                        isTooLate
                                            ? "bg-red-600 text-white opacity-100 hover:bg-red-700 font-bold" // Style Alerte Rouge
                                            : isDisabled
                                                ? "opacity-50 cursor-not-allowed"
                                                : isHotel
                                                    ? "bg-orange-600 hover:bg-orange-700 text-white border-2 border-orange-800" // Style Tardif/Hôtel
                                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                    )}
                                >
                                    {label}
                                </Button>
                            );
                        })()}
                    </div>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}
