
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Package, CheckCircle2, Navigation, Calendar as CalendarIcon, Clock, Scissors, BrainCircuit } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Client } from '@/types/logistics';
import { cn, parseSafeDate } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { OptimizerService } from '@/services/optimizer';
import { VroomService } from '@/services/vroom'; // Import VROOM
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";

interface Driver {
    id: string;
    nom: string;
    capacite: number;
    secteur: string;
}

interface RouteInfo {
    clients: any[];
    totalLEDs: number;
    totalDistance: number;
    returnTime: Date;
    isLate: boolean;
    estimatedDuration: number;
}

export function ShuttleAssignmentView() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [clients, setClients] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState<string>('');
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isVroomLoading, setIsVroomLoading] = useState(false);
    const [vroomRoutes, setVroomRoutes] = useState<any[]>([]); // Stocker toutes les routes VROOM
    const [vroomIdMap, setVroomIdMap] = useState<Record<string, string>>({}); // Objet ID VROOM -> Client ID

    // Charger les chauffeurs disponibles
    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                const API_BASE = `http://${window.location.hostname}:3001`;
                const res = await fetch(`${API_BASE}/api/resources`);
                const data = await res.json();
                const livreurs = data.filter((r: any) => r.type === 'LIVREUR').map((d: any) => ({
                    id: d.id,
                    nom: d.nom,
                    capacite: d.capacite,
                    secteur: d.secteur || ''
                }));
                setDrivers(livreurs);
            } catch (error) {
                console.error('Erreur chargement chauffeurs:', error);
            }
        };
        fetchDrivers();
    }, []);

    // Charger les clients
    useEffect(() => {
        const fetchClients = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('clients').select('*');
                if (error) throw error;
                setClients(data || []);
            } catch (error) {
                console.error('Erreur chargement clients:', error);
                toast.error('Impossible de charger les clients');
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

    // Filtrer les clients pour la date sélectionnée (avec ou sans chauffeur)
    const clientsForDate = clients.filter(c => {
        if (!c.date_livraison_prevue) return false;
        const d = parseSafeDate(c.date_livraison_prevue);
        if (!d) return false;
        const isSameDate = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
        return isSameDate;
    });

    // Initialiser la sélection avec priorité aux clients SANS chauffeur
    useEffect(() => {
        if (clientsForDate.length > 0) {
            const unassignedClients = clientsForDate.filter(c => !c.livreur_id || c.statut_livraison !== 'PLANIFIÉE').map(c => c.id);

            if (unassignedClients.length > 0) {
                // S'il reste des clients à assigner, on ne sélectionne qu'eux par défaut
                setSelectedClientIds(unassignedClients);
            } else {
                // Si tous sont déjà assignés, on sélectionne tout pour permettre la révision
                setSelectedClientIds(clientsForDate.map(c => c.id));
            }
        } else {
            setSelectedClientIds([]);
        }
    }, [clientsForDate.length, selectedDate]); // Trigger on length change or date change

    // Calculer le trajet optimisé basé sur la SÉLECTION
    useEffect(() => {
        const activeClients = clientsForDate.filter(c => selectedClientIds.includes(c.id));

        if (activeClients.length > 0) {
            // Calculer le trajet avec les clients SÉLECTIONNÉS
            const totalLEDs = activeClients.reduce((sum, c) => sum + (c.nb_led || 0), 0);
            const timeCheck = OptimizerService.simulateTour(selectedDate, activeClients as Client[], 9, 0);

            setRouteInfo({
                clients: timeCheck.sortedClients, // L'ordre optimisé des clients sélectionnés
                totalLEDs,
                totalDistance: timeCheck.totalDistance,
                returnTime: timeCheck.returnDate,
                isLate: timeCheck.isLate,
                estimatedDuration: timeCheck.totalDurationMinutes
            });
        } else {
            setRouteInfo(null);
        }
    }, [selectedClientIds, selectedDate, clientsForDate.length]); // Dependencies Updated

    // Appliquer un scénario de coupure spécifique
    const applySplitScenario = (keepIds: string[], returnTime: Date) => {
        if (keepIds.length > 0) {
            setSelectedClientIds(keepIds);
            toast.success(`✂️ Trajet ajusté ! Retour prévu à ${format(returnTime, 'HH:mm')}`);
        }
    };

    // Fonction d'optimisation IA
    const handleVroomOptimization = async () => {
        if (clientsForDate.length === 0) return;

        setIsVroomLoading(true);
        toast.info("🧠 L'IA réfléchit à la meilleure répartition...");

        try {
            // On envoie TOUS les clients du jour à optimiser
            // On considère les chauffeurs dispos + 1 gros camion par défaut si besoin
            let driversToUse = drivers.length > 0 ? drivers : [{ id: 'mock1', capacite: 2500, nom: 'Chauffeur 1' }];

            // Si pas de chauffeurs chargés, on en crée 3 virtuels pour la simulation
            if (driversToUse.length === 0) {
                driversToUse = [
                    { id: 'v1', capacite: 2500, nom: 'Virtuel 1', secteur: '' },
                    { id: 'v2', capacite: 2500, nom: 'Virtuel 2', secteur: '' },
                    { id: 'v3', capacite: 2500, nom: 'Virtuel 3', secteur: '' }
                ];
            }

            const result = await VroomService.optimize(clientsForDate as Client[], driversToUse, selectedDate);

            // VROOM a parlé !
            if (result && result.routes && result.routes.length > 0) {
                // Stocker TOUTES les routes et la map ID
                setVroomRoutes(result.routes);
                setVroomIdMap(result.idMap || {});

                // Pour la compatibilité, on met aussi la première route dans selectedClientIds
                const route1 = result.routes.find((r: any) => r.vehicle === 1);
                if (route1 && result.idMap) {
                    const optimizedIds = route1.steps
                        .filter((s: any) => s.type === 'job')
                        .map((s: any) => result.idMap[s.id]) // Correction : idMap est un objet, pas une Map
                        .filter((id: string | undefined) => id);
                    setSelectedClientIds(optimizedIds);
                }

                // Stats globales
                const totalAssigned = result.routes.reduce((sum: number, r: any) =>
                    sum + r.steps.filter((s: any) => s.type === 'job').length, 0
                );
                const unassignedCount = result.unassigned ? result.unassigned.length : 0;

                toast.success(`✨ Optimisation terminée ! ${result.routes.length} navettes • ${totalAssigned} clients assignés`);
                if (unassignedCount > 0) toast.warning(`${unassignedCount} clients impossibles à caser (trop loin ou hors horaire).`);
            } else {
                toast.warning("VROOM n'a trouvé aucune solution (clients trop éloignés ou contraintes impossibles).");
            }
        } catch (e: any) {
            console.error(e);
            toast.error("Erreur IA: " + e.message);
        } finally {
            setIsVroomLoading(false);
        }
    };

    // Fonction pour valider l'affectation du trajet complet à un chauffeur
    const handleAssignRoute = async () => {
        if (!selectedDriver || !routeInfo) {
            toast.error("Veuillez sélectionner un chauffeur");
            return;
        }

        try {
            // Vérifier la capacité
            const driver = drivers.find(d => d.id === selectedDriver);
            if (!driver) return;

            if (routeInfo.totalLEDs > driver.capacite) {
                toast.error(`Capacité insuffisante ! ${routeInfo.totalLEDs} LEDs > ${driver.capacite} LEDs`);
                return;
            }

            // Affecter tous les clients à ce chauffeur
            for (const client of routeInfo.clients) {
                const { error } = await supabase
                    .from('clients')
                    .update({
                        livreur_id: selectedDriver,
                        statut_client: 'EN COURS',
                        statut_livraison: 'PLANIFIÉ'
                    })
                    .eq('id', client.id);

                if (error) throw error;
            }

            toast.success(`✅ Trajet de ${routeInfo.clients.length} clients affecté à ${driver.nom}`);
            setSelectedDriver('');

            // Recharger les données
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'affectation du trajet");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header avec Date Picker et Bouton IA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Affectation Navettes</h2>
                    <p className="text-slate-500">Choisissez les clients à charger pour ce trajet</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleVroomOptimization}
                        disabled={isVroomLoading || clientsForDate.length === 0}
                        className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-900 transition-colors"
                    >
                        {isVroomLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Calcul en cours...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4" />
                                Auto-Dispatch IA
                            </div>
                        )}

                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn(
                                "justify-start text-left font-normal w-[240px]",
                                !selectedDate && "text-muted-foreground"
                            )}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(d) => d && setSelectedDate(d)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Chargement...</p>
                </div>
            ) : !routeInfo ? (
                <Card className="border-slate-200">
                    <CardContent className="p-12 text-center">
                        <Package className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun trajet à planifier</h3>
                        <p className="text-muted-foreground">
                            Aucun client planifié pour le {format(selectedDate, 'PPP', { locale: fr })}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* TRAJET CALCULÉ */}
                    <Card className="border-2 border-primary/20 shadow-xl">
                        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <Navigation className="h-6 w-6 text-primary" />
                                        Trajet Optimisé - {format(selectedDate, 'PPP', { locale: fr })}
                                    </CardTitle>
                                    <CardDescription className="text-base mt-2">
                                        {routeInfo.clients.length} clients • {routeInfo.totalLEDs} LEDs au total
                                    </CardDescription>
                                </div>
                                <Badge className="text-lg px-4 py-2">
                                    {routeInfo.clients.length} stops
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 space-y-6">
                            {/* Informations du trajet */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="border-blue-200 bg-blue-50/30">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-100">
                                                <Package className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Charge totale</p>
                                                <p className="text-xl font-bold text-blue-900">{routeInfo.totalLEDs} LEDs</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-green-200 bg-green-50/30">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-green-100">
                                                <Clock className="h-5 w-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Durée estimée</p>
                                                <p className="text-xl font-bold text-green-900">
                                                    {Math.floor(routeInfo.estimatedDuration / 60)}h{String(Math.floor(routeInfo.estimatedDuration % 60)).padStart(2, '0')}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className={cn(
                                    "border-2",
                                    routeInfo.isLate ? "border-orange-300 bg-orange-50/30" : "border-emerald-300 bg-emerald-50/30"
                                )}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                routeInfo.isLate ? "bg-orange-100" : "bg-emerald-100"
                                            )}>
                                                <CalendarIcon className={cn(
                                                    "h-5 w-5",
                                                    routeInfo.isLate ? "text-orange-600" : "text-emerald-600"
                                                )} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Retour estimé</p>
                                                <p className={cn(
                                                    "text-xl font-bold",
                                                    routeInfo.isLate ? "text-orange-900" : "text-emerald-900"
                                                )}>
                                                    {format(routeInfo.returnTime, 'HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Suggestion de coupure auto */}
                            {routeInfo.isLate && (() => {
                                const activeClients = clientsForDate.filter(c => selectedClientIds.includes(c.id));
                                // Calculer les 3 scénarios
                                const sMax = OptimizerService.findOptimalCutoff(selectedDate, activeClients as Client[], 9, 0, 20);
                                const sConfort = OptimizerService.findOptimalCutoff(selectedDate, activeClients as Client[], 9, 0, 17);
                                const sMatin = OptimizerService.findOptimalCutoff(selectedDate, activeClients as Client[], 9, 0, 14);

                                const Proposition = ({ title, result, color, icon }: any) => {
                                    const isPossible = result.keepIds.length > 0;
                                    const percentage = Math.round((result.keepIds.length / activeClients.length) * 100);

                                    return (
                                        <div className={cn("border rounded-lg p-3 flex-1 transition-all cursor-pointer hover:shadow-md relative overflow-hidden group", color)}
                                            onClick={() => isPossible && applySplitScenario(result.keepIds, result.returnTime)}>
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-sm flex items-center gap-1.5">{icon} {title}</span>
                                                    <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-xs border-0 shadow-sm">
                                                        {format(result.returnTime, 'HH:mm')}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <p className="text-xs font-medium opacity-90">{result.keepIds.length} stops</p>
                                                    <p className="text-[10px] opacity-75">{percentage}%</p>
                                                </div>
                                            </div>
                                            {/* Progress Bar Background */}
                                            <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 w-full">
                                                <div className="h-full bg-current opacity-50" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 animate-fade-in mb-6">
                                        <div className="flex items-center gap-2 mb-3 text-orange-900 font-bold">
                                            <Scissors className="h-5 w-5" />
                                            <span>Trajet trop long ! Choisissez votre stratégie de coupure :</span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Proposition
                                                title="Maximum (20h)"
                                                result={sMax}
                                                color="bg-orange-100 border-orange-300 text-orange-900 hover:bg-orange-200"
                                                icon={<Clock className="h-4 w-4" />}
                                            />
                                            <Proposition
                                                title="Confort (17h)"
                                                result={sConfort}
                                                color="bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200"
                                                icon={<CheckCircle2 className="h-4 w-4" />}
                                            />
                                            <Proposition
                                                title="Matinée (13h)"
                                                result={sMatin}
                                                color="bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200"
                                                icon={<Truck className="h-4 w-4" />}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Liste des clients du trajet */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Badge className="bg-primary hover:bg-primary/90 text-white border-0 px-3 py-1">NAVETTE 1</Badge>
                                        <span className="text-slate-300 mx-1">|</span>
                                        <MapPin className="h-5 w-5 text-primary" />
                                        Itinéraire ({routeInfo.clients.length} destinations)
                                    </h3>
                                    <div className="text-xs text-muted-foreground">
                                        Décochez les clients pour diviser la tournée
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
                                    {routeInfo.clients.map((client, index) => (
                                        <Card key={client.id} className="border-indigo-100 bg-indigo-50/20 hover:border-indigo-300 transition-colors">
                                            <CardContent className="p-3">
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={true}
                                                        onCheckedChange={() => {
                                                            setSelectedClientIds(prev => prev.filter(id => id !== client.id));
                                                        }}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm truncate">{client.prenom} {client.nom}</h4>
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                            <MapPin className="h-3 w-3 flex-shrink-0" />
                                                            <span className="truncate">
                                                                {(() => {
                                                                    // Extraire la ville depuis adresse_brute
                                                                    const addr = client.adresse_brute || client.adresse || '';
                                                                    const match = addr.match(/\d{5}\s+(.+)$/);
                                                                    return match ? match[1] : addr.split(' ').slice(-1)[0] || 'Ville inconnue';
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <Badge variant="outline" className="mt-1.5 text-[10px] bg-white">
                                                            {client.nb_led || client.nombreLED} LEDs
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* Clients décochés (Reste à quai) - ANALYSE MULTI-CHAUFFEURS */}
                                {clientsForDate.length > routeInfo.clients.length && (() => {
                                    // 1. Récupérer tous les clients en attente
                                    const waitingClients = clientsForDate.filter(c => !selectedClientIds.includes(c.id));

                                    // 2. Simuler si un seul chauffeur suffit pour le reste (Navette 2)
                                    const waitingStats = OptimizerService.simulateTour(selectedDate, waitingClients as Client[], 9, 0);

                                    let shuttle2Clients = waitingClients;
                                    let shuttle3Clients: Client[] = [];
                                    let shuttle2Stats = waitingStats;
                                    let shuttle3Stats = null;

                                    // 3. Si Navette 2 est en retard (> 21h), on simule un 3ème chauffeur
                                    if (waitingStats.isLate) {
                                        // On coupe la Navette 2 à 21h (Max demandé)
                                        const cutResult = OptimizerService.findOptimalCutoff(selectedDate, waitingClients as Client[], 9, 0, 21);

                                        // Navette 2 (Optimisée)
                                        // Si jamais le cutoff renvoie vide (ex: 1er client finit à 21h05), on force au moins le premier pour ne pas avoir de navette vide
                                        let keptIds = cutResult.keepIds;
                                        if (keptIds.length === 0 && waitingClients.length > 0) {
                                            keptIds = [waitingClients[0].id];
                                        }

                                        shuttle2Clients = waitingClients.filter(c => keptIds.includes(c.id));
                                        shuttle2Stats = OptimizerService.simulateTour(selectedDate, shuttle2Clients, 9, 0);

                                        // Navette 3 (Le Reste du Reste)
                                        shuttle3Clients = waitingClients.filter(c => !keptIds.includes(c.id));
                                        if (shuttle3Clients.length > 0) {
                                            shuttle3Stats = OptimizerService.simulateTour(selectedDate, shuttle3Clients, 9, 0);
                                        }
                                    }

                                    const shuttle2Leds = shuttle2Clients.reduce((sum, c) => sum + (c.nombreLED || 0), 0);
                                    const shuttle3Leds = shuttle3Clients.reduce((sum, c) => sum + (c.nombreLED || 0), 0);

                                    // Helper pour afficher une section de Navette Virtuelle
                                    const ShuttleSection = ({ title, clients, stats, colorClass, badgeColor }: any) => {
                                        if (!clients || clients.length === 0) return null;

                                        // Utiliser l'ordre optimisé si disponible, sinon l'ordre par défaut
                                        const orderedClients = stats?.sortedClients || clients;

                                        return (
                                            <div className={cn("rounded-xl border p-4 mb-4", colorClass)}>
                                                {/* Header Stats */}
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className={cn("text-sm px-2 py-1", badgeColor)} variant="outline">{title}</Badge>
                                                        <span className="text-sm font-medium opacity-70">Simulation</span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium opacity-90">
                                                        <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {clients.length} stops</span>
                                                        <div className="w-px h-3 bg-current opacity-30 hidden sm:block"></div>
                                                        <span className="flex items-center gap-1">💡 {clients.reduce((s: number, c: any) => s + (c.nb_led || c.nombreLED || 0), 0)} LEDs</span>
                                                        <div className="w-px h-3 bg-current opacity-30 hidden sm:block"></div>
                                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.floor(stats.totalDurationMinutes / 60)}h{String(Math.floor(stats.totalDurationMinutes % 60)).padStart(2, '0')}</span>
                                                        <div className="w-px h-3 bg-current opacity-30 hidden sm:block"></div>
                                                        <span className={cn("flex items-center gap-1", stats.isLate ? "text-red-700 font-bold" : "")}>
                                                            <CalendarIcon className="h-3 w-3" /> Retour {format(stats.returnDate, 'HH:mm')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Clients Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {orderedClients.map((client: Client, index: number) => (
                                                        <Card key={client.id} className="bg-white/50 border-white/50 shadow-sm hover:shadow-md transition-all">
                                                            <CardContent className="p-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="flex flex-col items-center gap-1 mt-1">
                                                                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white", badgeColor.replace('text-', 'bg-').replace('border-', ''))}>
                                                                            {index + 1}
                                                                        </div>
                                                                        <Checkbox
                                                                            checked={false}
                                                                            onCheckedChange={() => {
                                                                                setSelectedClientIds(prev => [...prev, client.id]);
                                                                            }}
                                                                            className="scale-75"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-semibold text-sm truncate">{client.prenom} {client.nom}</h4>
                                                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                            <MapPin className="h-3 w-3" />
                                                                            {(() => {
                                                                                const addr = client.adresse_brute || client.adresse || '';
                                                                                const match = addr.match(/\d{5}\s+(.+)$/);
                                                                                return match ? match[1] : addr.split(' ').slice(-1)[0] || 'Ville inconnue';
                                                                            })()}
                                                                        </p>
                                                                    </div>
                                                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                                                        {client.nb_led || client.nombreLED} LEDs
                                                                    </Badge>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="mt-8 pt-6 border-t border-dashed relative">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-sm font-bold text-muted-foreground flex items-center gap-2">
                                                <Scissors className="h-4 w-4 rotate-90" />
                                                Estimation du Reste à Quai
                                            </div>

                                            <ShuttleSection
                                                title="NAVETTE 2"
                                                clients={shuttle2Clients}
                                                stats={shuttle2Stats}
                                                colorClass="bg-blue-50/50 border-blue-200"
                                                badgeColor="text-blue-700 border-blue-200 bg-blue-100"
                                            />

                                            <ShuttleSection
                                                title="NAVETTE 3"
                                                clients={shuttle3Clients}
                                                stats={shuttle3Stats}
                                                colorClass="bg-purple-50/50 border-purple-200"
                                                badgeColor="text-purple-700 border-purple-200 bg-purple-100"
                                            />
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Sélection du chauffeur */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    Choisir le chauffeur pour ce trajet
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {drivers.map(driver => {
                                        const canHandle = routeInfo.totalLEDs <= driver.capacite;
                                        const fillRate = Math.round((routeInfo.totalLEDs / driver.capacite) * 100);

                                        return (
                                            <Card
                                                key={driver.id}
                                                className={cn(
                                                    "cursor-pointer transition-all border-2",
                                                    selectedDriver === driver.id
                                                        ? "border-primary bg-primary/5 shadow-lg"
                                                        : "border-slate-200 hover:border-slate-300",
                                                    !canHandle && "opacity-50 cursor-not-allowed"
                                                )}
                                                onClick={() => canHandle && setSelectedDriver(driver.id)}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className={cn(
                                                            "p-3 rounded-xl",
                                                            selectedDriver === driver.id ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600"
                                                        )}>
                                                            <Truck className="h-6 w-6" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-bold text-lg">{driver.nom}</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Capacité: {driver.capacite} LEDs
                                                            </p>
                                                        </div>
                                                        {selectedDriver === driver.id && (
                                                            <CheckCircle2 className="h-6 w-6 text-primary" />
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Remplissage</span>
                                                            <span className={cn(
                                                                "font-bold",
                                                                !canHandle ? "text-destructive" : fillRate > 90 ? "text-orange-600" : "text-green-600"
                                                            )}>
                                                                {fillRate}%
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full transition-all",
                                                                    !canHandle ? "bg-destructive" : fillRate > 90 ? "bg-orange-500" : "bg-green-500"
                                                                )}
                                                                style={{ width: `${Math.min(fillRate, 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground text-center mt-2">
                                                            {routeInfo.totalLEDs} / {driver.capacite} LEDs
                                                        </p>
                                                    </div>

                                                    {!canHandle && (
                                                        <Badge variant="destructive" className="w-full mt-3 justify-center">
                                                            Capacité insuffisante
                                                        </Badge>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <Button
                                        size="lg"
                                        onClick={handleAssignRoute}
                                        disabled={!selectedDriver}
                                        className="gap-2 text-lg px-8 py-6"
                                    >
                                        <CheckCircle2 className="h-5 w-5" />
                                        Valider l'affectation
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
