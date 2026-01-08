import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Client } from "@/types/logistics";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Zap, CheckCircle2, Truck, BarChart3, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { LocalSolverService } from "@/services/localSolver";
import { VroomService } from "@/services/vroom";
import { getClientCommandoZone, ZONE_DEPOTS } from "@/lib/regions";
import { supabase } from "@/lib/supabaseClient";
import { LOGISTICS_CONFIG } from "@/config/logistics";
import { isStatusPlanned } from "@/lib/business-logic";
import { isZoneMatch, cn } from "@/lib/utils";

interface GlobalOptimizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    defaultZone?: string;
    targetDate?: Date;
}

export function GlobalOptimizerModal({ isOpen, onClose, onSuccess, defaultZone = 'FR', targetDate }: GlobalOptimizerModalProps) {
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [selectedZone, setSelectedZone] = useState(defaultZone);
    const [startDate, setStartDate] = useState(targetDate || new Date());

    useEffect(() => {
        if (isOpen) {
            if (defaultZone) setSelectedZone(defaultZone);
            if (targetDate) setStartDate(targetDate);
        }
    }, [isOpen, defaultZone, targetDate]);


    const clients = allClients.filter(c => {
        if (!isZoneMatch(c.zone_pays, selectedZone)) return false;

        // Filter by Week if targetDate is present
        // We want: Backlog (no date) + Clients of this specific week
        // We DO NOT want: Clients scheduled for OTHER weeks.
        if (targetDate) {
            const d = c.date_livraison_prevue ? new Date(c.date_livraison_prevue) : null;
            if (d && !isNaN(d.getTime())) {
                // If client has a date, it MUST be in the same week as targetDate
                const startOfWeek = new Date(targetDate);
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                if (d < startOfWeek || d > endOfWeek) return false;
            }
        }

        return true;
    });

    const [loading, setLoading] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [optimizedDays, setOptimizedDays] = useState<any[]>([]);
    const [stats, setStats] = useState({ distance: 0, stops: 0 });

    const fetchClients = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const candidates = (data || []).filter((c: any) => {
                const s = (c.statut_client || '').toUpperCase();

                // NOUVELLE LOGIQUE : On veut TOUT optimiser sauf ce qui est fini/livré/annulé.
                // Cela permet d'inclure les clients "Déjà Planifiés" pour les ré-optimiser globalement.

                const isFinalState =
                    s.includes('LIVRÉ') ||
                    s.includes('LIVREE') ||
                    s.includes('RECU') ||
                    s.includes('REÇU') ||
                    s.includes('MATERIEL') ||
                    s.includes('TERMIN') ||
                    s.includes('POSÉ') ||
                    s.includes('INSTALL') ||
                    s.includes('CLOS') ||
                    s.includes('ARCHIV') ||
                    s.includes('ANNUL') ||
                    s.includes('REFUS');

                return !isFinalState;
            });

            setAllClients(candidates);
        } catch (e: any) {
            toast.error(`Erreur récupération clients: ${e.message || "Erreur inconnue"}`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (defaultZone) setSelectedZone(defaultZone);
            if (targetDate) setStartDate(targetDate);
            fetchClients();
            setOptimizedDays([]);
            setStats({ distance: 0, stops: 0 });
        }
    }, [isOpen, defaultZone, targetDate]);

    const runOptimization = async () => {
        if (clients.length === 0) return;
        setOptimizing(true);
        try {
            // STRATEGIE VROOM GLOBALE : 
            // On crée 5 "véhicules" virtuels correspondant aux 5 jours de la semaine (Lundi-Vendredi)

            // 1. Calculer les 5 prochains jours ouvrés (Working Days)
            let ptr = new Date(startDate);
            // Si on commence un weekend, on décale à Lundi
            if (ptr.getDay() === 6) ptr = addDays(ptr, 2);
            if (ptr.getDay() === 0) ptr = addDays(ptr, 1);

            const workDays: Date[] = [];
            while (workDays.length < 5) {
                if (ptr.getDay() !== 0 && ptr.getDay() !== 6) {
                    workDays.push(new Date(ptr));
                }
                ptr = addDays(ptr, 1);
            }

            const drivers = [];
            const dayMap = new Map(); // Link Vehicle ID -> Date


            const depot = ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR'];
            const depotCoords = depot.location;

            // Création des véhicules pour chaque jour ouvré
            const workDaysIndices: Record<string, number> = {};

            workDays.forEach((date, i) => {
                const vId = i + 1; // Vehicle 1 to 5
                const dateStr = format(date, 'yyyy-MM-dd');
                workDaysIndices[dateStr] = vId;

                drivers.push({
                    id: vId,
                    profile: 'driving-car',
                    start: depotCoords,
                    end: depotCoords,
                    capacity: [1000],
                    time_window: [28800, 64800], // 08:00 - 18:00
                    skills: [vId] // Force unique skill for this day
                });
                dayMap.set(vId, date);
            });

            // Pre-process clients to lock them to their scheduled day
            const clientsWithConstraints = clients.map(client => {
                const c = { ...client } as any;
                if (c.date_livraison_prevue) {
                    const scheduledDate = format(new Date(c.date_livraison_prevue), 'yyyy-MM-dd');
                    const requiredVehicleId = workDaysIndices[scheduledDate];
                    if (requiredVehicleId) {
                        c.skills = [requiredVehicleId]; // Lock to this specific day/vehicle
                    }
                }
                return c;
            });

            // Appel VROOM (Backend Proxy -> Docker Local ou ORS)
            try {
                const result = await VroomService.optimize(clientsWithConstraints, drivers);
                processResult(result, dayMap, workDays); // On passe workDays pour forcer l'affichage
            } catch (err: any) {
                // FALLBACK INTELLIGENT (Split)
                if (err.message && err.message.includes('Too many vehicles')) {
                    console.log("⚠️ Limite API détectée, passage en mode SPLIT...");
                    toast.info("Optimisation en 2 étapes (API Gratuite)...");

                    // Note: Split optimization logic currently doesn't support the new skill constraints purely
                    // We would need to pass the constrained clients subset.
                    // For now, let's just reuse the generic logic but with our constrained clients.

                    // PARTIE 1 : Jours 1-3
                    const driversPart1 = drivers.slice(0, 3);
                    const result1 = await VroomService.optimize(clientsWithConstraints, driversPart1);

                    const assignedIds1 = new Set();
                    if (result1.routes) {
                        result1.routes.forEach((r: any) => {
                            r.steps.forEach((s: any) => {
                                if (s.type === 'job' && result1.idMap) assignedIds1.add(result1.idMap[s.job]);
                            });
                        });
                    }

                    const remainingClients = clients.filter(c => !assignedIds1.has(c.id));

                    if (remainingClients.length > 0) {
                        // PARTIE 2 : Jours 4-5
                        const driversPart2 = drivers.slice(3, 5);
                        const result2 = await VroomService.optimize(remainingClients, driversPart2);

                        // Fusion manuelle des résultats pour correspondre au format attendu par processResult
                        // On doit tricher un peu pour fusionner proprement les idMaps et routes
                        const mergedRoutes = [...(result1.routes || []), ...(result2.routes || [])];
                        // Note: idMap est spécifique à chaque appel. processRoutes doit être appelé séparément.

                        const days1 = processRoutes(result1, dayMap, clients);
                        const days2 = processRoutes(result2, dayMap, remainingClients);

                        // On combine les jours remplis
                        const filledDays = [...days1, ...days2];

                        // On construit la vue complète (5 jours)
                        const finalDays = workDays.map(date => {
                            const existing = filledDays.find(d => d.date.getTime() === date.getTime());
                            return existing || {
                                date: date,
                                stops: [],
                                totalDistance: 0,
                                drivingTime: 0,
                                serviceTime: 0,
                                startPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] },
                                endPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] }
                            };
                        });

                        finalizeOptimization(finalDays, result2.unassigned?.length || 0);

                    } else {
                        processResult(result1, dayMap, workDays);
                    }

                } else {
                    throw err;
                }
            }

        } catch (e: any) {
            console.error(e);
            let msg = e.message || "Erreur VROOM";
            if (msg.includes('403')) {
                msg = "Installation locale en cours... Veuillez patienter (fenêtre noire).";
            } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
                msg = "Serveur VROOM introuvable (Vérifiez la fenêtre noire)";
            }
            toast.error(msg);
        } finally {
            setOptimizing(false);
        }
    };

    const processRoutes = (result: any, dayMap: Map<number, Date>, contextClients: Client[]) => {
        const days: any[] = [];
        if (result.routes) {
            result.routes.forEach((route: any) => {
                const vehicleId = route.vehicle;
                const date = dayMap.get(vehicleId);
                // Security check
                if (!date) return;

                const stops = route.steps
                    .filter((step: any) => step.type === 'job')
                    .map((step: any, index: number, array: any[]) => {
                        const originalClientId = result.idMap ? result.idMap[step.job] : null;
                        const client = contextClients.find(c => c.id === originalClientId);
                        if (!client) return null;

                        const arrivalSeconds = step.arrival || 0;
                        const arrivalDate = new Date(date);
                        arrivalDate.setHours(0, 0, 0, 0);
                        arrivalDate.setSeconds(arrivalSeconds);

                        const prevStep = index > 0 ? array[index - 1] : { distance: 0, duration: 0, arrival: 0, service: 0 };

                        // Robust Math to avoid NaN
                        const stepDist = step.distance || 0;
                        const prevDist = prevStep.distance || 0;
                        const stepDur = step.duration || 0;
                        const prevArrival = prevStep.arrival || 0;
                        const prevService = prevStep.service || 0;

                        // Distance relative en Km
                        const legDistance = Math.max(0, stepDist - prevDist);

                        // Travel Time relative en Secondes
                        let travelTimeVal = 0;
                        if (index === 0) {
                            // First stop: Duration is time from depot or arrival - start
                            travelTimeVal = stepDur;
                        } else {
                            // Subsequent: Arrival - (PrevArrival + PrevService)
                            travelTimeVal = arrivalSeconds - (prevArrival + prevService);
                        }

                        // Fallback if negative
                        if (travelTimeVal < 0) travelTimeVal = 0;

                        return {
                            ...client,
                            arrival: format(arrivalDate, 'HH:mm'),
                            travelTime: Math.round(travelTimeVal / 60),
                            serviceTime: Math.round((step.service || 0) / 60),
                            distanceTo: Math.round(legDistance / 1000)
                        };
                    })
                    .filter((s: any) => s !== null);

                if (stops.length > 0) {
                    days.push({
                        date: date,
                        stops: stops,
                        totalDistance: Math.round((route.distance || 0) / 1000),
                        drivingTime: Math.round((route.duration || 0) / 60),
                        serviceTime: Math.round((route.service || 0) / 60),
                        startPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] },
                        endPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] }
                    });
                }
            });
        }
        return days;
    }

    const processResult = (result: any, dayMap: Map<number, Date>, forcedWorkDays?: Date[]) => {
        const filledDays = processRoutes(result, dayMap, clients);

        let finalDays = filledDays;

        // Si on a passé les jours ouvrés, on s'assure qu'ils sont tous présents (même vides)
        if (forcedWorkDays) {
            finalDays = forcedWorkDays.map(date => {
                const existing = filledDays.find(d => d.date.getTime() === date.getTime());
                return existing || {
                    date: date,
                    stops: [],
                    totalDistance: 0,
                    drivingTime: 0,
                    serviceTime: 0,
                    startPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] },
                    endPoint: { lat: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[1], lon: (ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR']).location[0] }
                };
            });
        }

        finalizeOptimization(finalDays, result.unassigned ? result.unassigned.length : 0);
    }

    const finalizeOptimization = (days: any[], unassignedCount: number) => {
        // Tri simple par date (normalement déjà bon via le map)
        days.sort((a, b) => a.date.getTime() - b.date.getTime());

        setOptimizedDays(days);
        setStats({
            distance: days.reduce((acc, d) => acc + d.totalDistance, 0),
            stops: days.reduce((acc, d) => acc + d.stops.length, 0)
        });

        if (unassignedCount > 0) {
            toast.warning(`${unassignedCount} clients non planifiés.`);
        }
        toast.success(`Planning 5 jours généré !`);
    }

    const saveOptimization = async () => {
        setSaving(true);
        try {
            const updates = optimizedDays.flatMap(day =>
                day.stops.map((stop: any) => ({
                    id: stop.id,
                    date_livraison_prevue: format(day.date, 'yyyy-MM-dd'),
                    statut_client: '🚚 2. LIVRAISON CONFIRMÉE',
                    statut_livraison: 'PLANIFIÉE',
                    livreur_id: `camion-standard-${LOGISTICS_CONFIG.TRUCK_CAPACITY}`
                }))
            );

            // 1. UPDATE SUPABASE
            for (const update of updates) {
                const { error } = await supabase
                    .from('clients')
                    .update(update)
                    .eq('id', update.id);
                if (error) throw error;
            }

            // 2. SYNC GOOGLE CALENDAR
            // On envoie chaque journée à l'API de synchro
            const syncPromises = optimizedDays.map(async (day) => {
                const dayDateStr = format(day.date, 'yyyy-MM-dd');
                const clientsPayload = day.stops.map((stop: any) => ({
                    id: stop.id,
                    nom: stop.nom,
                    adresse: stop.adresse_brute || stop.adresse || "",
                    time: stop.arrival // Format déjà "HH:mm"
                }));

                // Appel API Backend Sync
                return fetch('/api/tour/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: dayDateStr,
                        clients: clientsPayload
                    })
                });
            });

            await Promise.all(syncPromises);

            toast.success("Planning global validé et synchronisé avec l'Agenda !");
            if (onSuccess) onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la sauvegarde/synchronisation");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="max-w-6xl h-[95vh] flex flex-col p-6 overflow-hidden bg-slate-50"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="pb-4 border-b">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                                    <Zap className="h-6 w-6 text-white fill-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                        Optimisation de Masse VRP
                                    </DialogTitle>
                                    <p className="text-sm text-slate-500 font-medium">
                                        Traitement algorithmique de <span className="text-blue-600 font-bold">{clients.length} clients</span> en attente
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="rounded-xl font-bold h-12 px-6"
                                    onClick={onClose}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="rounded-xl font-black h-12 px-8 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 gap-2 min-w-[240px]"
                                    onClick={runOptimization}
                                    disabled={loading || clients.length === 0 || optimizing}
                                >
                                    {optimizing ? (
                                        <>
                                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                            Calcul en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Truck className="h-5 w-5" /> Lancer l'Algorithme
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-1 overflow-x-auto pb-1 pt-2">
                            {[
                                { id: 'FR', label: '🇫🇷 France' },
                                { id: 'GP', label: '🏖️ Guadeloupe' },
                                { id: 'MQ', label: '🍌 Martinique' },
                                { id: 'CORSE', label: '🐂 Corse' },
                            ].map((zone) => (
                                <Button
                                    key={zone.id}
                                    variant={selectedZone === zone.id ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn("whitespace-nowrap transition-all rounded-lg", selectedZone === zone.id ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-100 border-slate-200")}
                                    onClick={() => {
                                        setSelectedZone(zone.id);
                                        setOptimizedDays([]);
                                    }}
                                >
                                    {zone.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden pt-6">
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <ListChecks className="h-4 w-4" /> File d'attente ({selectedZone})
                            </h3>
                            <Badge variant="outline" className="bg-white">{clients.length} à traiter</Badge>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <Loader2 className="animate-spin mb-2" />
                                    <p className="text-xs font-bold uppercase">Chargement...</p>
                                </div>
                            ) : clients.length === 0 ? (
                                <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center opacity-50">
                                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-4" />
                                    <p className="font-bold text-slate-900">Aucun client pour {selectedZone}</p>
                                    <p className="text-xs text-slate-500">Tous les clients de cette zone sont déjà planifiés.</p>
                                </div>
                            ) : (
                                clients.map(client => (
                                    <div key={client.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-slate-900 truncate uppercase">{client.prenom} {client.nom}</p>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{client.ville} ({client.codePostal?.substring(0, 2)})</p>
                                        </div>
                                        <Badge className="text-[9px] bg-slate-50 text-slate-600 border-none">
                                            {getClientCommandoZone(client)?.name || "Hors Zone"}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-blue-600" /> Itinéraire Calculé
                            </h3>
                            {optimizedDays.length > 0 && (
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Distance Totale</p>
                                        <p className="text-base font-black text-blue-600">{stats.distance} km</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Jours de Route</p>
                                        <p className="text-base font-black text-blue-600">{optimizedDays.length}</p>
                                    </div>
                                    <Button
                                        className="bg-green-600 hover:bg-green-700 font-black rounded-xl px-6 h-12 shadow-lg shadow-green-100 gap-2"
                                        onClick={saveOptimization}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Push vers Planning</>}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30 min-h-[300px]">
                            {optimizing ? (
                                <div className="h-full flex flex-col items-center justify-center text-blue-500 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-blue-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                        <Loader2 className="h-16 w-16 animate-spin relative z-10" />
                                    </div>
                                    <div className="text-center z-10">
                                        <p className="font-black text-sm uppercase tracking-widest text-slate-700">Calcul d'itinéraire en cours...</p>
                                        <p className="text-xs font-medium text-slate-500 mt-1">L'IA analyse les meilleures routes pour vous.</p>
                                    </div>
                                </div>
                            ) : optimizedDays.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                                    <Truck className="h-20 w-20" />
                                    <div className="text-center">
                                        <p className="font-black text-sm uppercase tracking-widest">En attente d'optimisation</p>
                                        <p className="text-xs font-medium">Cliquez sur "Lancer l'Algorithme" pour générer la tournée.</p>
                                    </div>
                                </div>
                            ) : (
                                optimizedDays.map((day, idx) => (
                                    <div key={idx} className="relative pl-8">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-blue-200 to-transparent rounded-full shadow-sm"></div>
                                        <div className="absolute left-[-8px] top-0 h-4 w-4 rounded-full bg-blue-600 border-4 border-white shadow-md"></div>

                                        <div className="mb-4">
                                            <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight flex items-center gap-2">
                                                <span>JOUR {idx + 1}</span>
                                                <span className="text-slate-400 font-medium">—</span>
                                                <span className="text-blue-600 font-black">{format(day.date, 'EEEE dd MMMM', { locale: fr })}</span>
                                                <Badge className="bg-slate-900 ml-auto">{day.stops.length} arrêts</Badge>
                                            </h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {day.stops.length > 0 ? (
                                                <>
                                                    {day.stops.map((stop: any, sIdx: number) => (
                                                        <div key={sIdx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 hover:border-blue-200 transition-colors group">
                                                            <div className="h-8 w-10 flex flex-col items-center justify-center bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                                                <span className="text-[10px] font-black text-blue-600">{stop.arrival}</span>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="font-black text-sm text-slate-900 uppercase truncate leading-tight">{stop.prenom} {stop.nom}</p>
                                                                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-[11px] font-bold shadow-sm whitespace-nowrap">
                                                                        +{stop.distanceTo} km
                                                                    </span>
                                                                </div>

                                                                <p className="text-xs font-black text-blue-950 uppercase mt-1">{stop.ville}</p>
                                                                <p className="text-[11px] text-slate-500 font-medium truncate mb-2">{stop.adresse}</p>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                                                                        🚗 {stop.travelTime} min
                                                                    </span>
                                                                    <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                                                                        🔧 {stop.serviceTime} min
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="col-span-1 md:col-span-2 mt-2 bg-slate-100/50 p-2 rounded-xl flex items-center justify-between px-4">
                                                        <div className="flex items-center gap-4">
                                                            <p className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2">
                                                                🛑 FIN : {day.stops[day.stops.length - 1].ville}
                                                            </p>
                                                            <span className="text-slate-300">|</span>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                                                Distance jour : {day.totalDistance} km
                                                            </p>
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-800 uppercase bg-white px-3 py-1 rounded-lg">
                                                            Total service : {Math.round((day.drivingTime + day.serviceTime) / 60)}H
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="col-span-1 md:col-span-2 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 gap-2">
                                                    <p className="text-xs font-bold uppercase">Aucune livraison planifiée ce jour</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
