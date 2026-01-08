import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlanningModal } from "@/components/modals/PlanningModal"; // Import PlanningModal
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Truck, Calendar as CalendarIcon, Package, AlertCircle, CheckCircle2, Navigation, UserPlus, Wrench, Phone, MapPin as MapPinIcon, BrainCircuit } from 'lucide-react';
import { OptimizerService } from '@/services/optimizer';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
// import { mockCamions } from '@/data/mockData';
import { Client, Livraison, Installer } from '@/types/logistics';
import { cn, parseSafeDate } from '@/lib/utils';
import { isDeliveryActive, parseClientDate, getRegionFromDept } from '@/lib/business-logic';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/lib/supabaseClient';

export function FleetMonitorView() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [livraisons, setLivraisons] = useState<Livraison[]>([]);
    const [allClients, setAllClients] = useState<any[]>([]);
    const [installers, setInstallers] = useState<Installer[]>([
        { id: 'equipe-1', nom: 'Équipe Lyon 1', telephone: '06 12 34 56 78', region: 'ARA', disponible: true },
        { id: 'equipe-2', nom: 'Équipe IDF 1', telephone: '07 89 45 61 23', region: 'IDF', disponible: true },
        { id: 'equipe-3', nom: 'Équipe Est', telephone: '06 00 00 00 00', region: 'EST', disponible: true }
    ]);
    const [loading, setLoading] = useState(true);
    const [isAddInstallerOpen, setIsAddInstallerOpen] = useState(false);
    const [newInstaller, setNewInstaller] = useState({ nom: '', telephone: '', region: '' });
    const [resources, setResources] = useState<any[]>([]);
    const [planningClient, setPlanningClient] = useState<Client | null>(null); // State for modal client
    const [isOptimizationMode, setIsOptimizationMode] = useState(false); // Mode Optimisation Globale


    useEffect(() => {
        const fetchResources = async () => {
            try {
                const API_BASE = `http://${window.location.hostname}:3001`;
                const res = await fetch(`${API_BASE}/api/resources`);
                const data = await res.json();
                setResources(data);
            } catch (e) {
                console.error("Error fetching resources", e);
            }
        };
        fetchResources();
    }, []);

    const camions = resources
        .filter(r => r.type === 'LIVREUR' && !r.nom.includes('Gros'))
        .sort((a: any, b: any) => b.nom.localeCompare(a.nom)) // Nicolas (N) avant David (D)
        .slice(0, 2)
        .map(c => {
            let vol = c.capacite;
            if (c.nom.toLowerCase().includes('david')) vol = 1000;
            if (c.nom.toLowerCase().includes('nicolas')) vol = 600;
            return {
                id: c.id,
                nom: c.nom,
                volumeMax: vol,
                secteur: c.secteur,
                disponible: true
            };
        });

    const handleBulkAssign = async (clientsToAssign: any[], truckId: string) => {
        if (!clientsToAssign.length) return;
        const truck = camions.find(c => c.id === truckId);
        if (!truck) return;

        // toast.promise permet de suivre l'état (loading, success, error)
        const promise = new Promise(async (resolve, reject) => {
            try {
                const clientIds = clientsToAssign.map(c => c.id);
                // Assign via NEW API to trigger Calendar Sync
                const response = await fetch(`http://${window.location.hostname}:3001/api/livraisons/bulk-planifier`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientIds: clientIds,
                        date: selectedDate,
                        camionId: truckId
                    })
                });

                if (!response.ok) throw new Error('Erreur API Bulk Assign');

                toast.success(`${clientIds.length} clients assignés à ${truckId === '1' ? 'Nicolas' : truckId === '2' ? 'David' : 'Gros Camion'}`);
                fetchLivraisons();
                resolve(`${clientsToAssign.length} clients assignés à ${truck.nom}`);
            } catch (e) {
                reject(e);
            }
        });

        toast.promise(promise, {
            loading: `Assignation de ${clientsToAssign.length} clients à ${truck.nom}...`,
            success: (msg: any) => `✅ ${msg}`,
            error: "Erreur lors de l'assignation"
        });
    };

    const fetchLivraisons = async () => {
        try {
            setLoading(true);
            const { data: clients, error } = await supabase
                .from('clients')
                .select('*');

            if (error) {
                console.error('Error fetching clients:', error);
                toast.error("Erreur chiffrement données Supabase");
                return;
            }

            if (clients) {
                setAllClients(clients);
                const active = clients
                    .filter(c => c.statut_livraison === 'PLANIFIÉ' || c.statut_livraison === 'LIVRÉ')
                    .map((c: any) => {
                        return {
                            id: c.id,
                            clientId: c.id,
                            camionId: c.livreur_id || '1',
                            datePrevue: parseSafeDate(c.date_livraison_prevue || c.dateLivraison) ? format(parseSafeDate(c.date_livraison_prevue || c.dateLivraison)!, 'yyyy-MM-dd') : '',
                            volumeTotal: (c.nb_led || 0) * 0.05,
                            statut: c.statut_livraison === 'LIVRÉ' ? 'LIVRÉE' : 'PLANIFIÉE',
                            client: {
                                ...c,
                                nom: c.nom,
                                ville: c.adresse_brute?.split(' ').pop() || '', // Simplistic city extraction
                                nombreLED: c.nb_led,
                                dateDebutTravaux: c.date_install_debut,
                                dateFinTravaux: c.date_install_fin,
                                poseurId: c.poseur_id
                            }
                        } as Livraison;
                    });
                setLivraisons(active);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLivraisons();

        // Subscribe to Realtime updates for live status changes
        const channel = supabase
            .channel('fleet_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'clients' },
                () => {
                    fetchLivraisons();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useSocketUpdate('clients', fetchLivraisons);

    const handleAddInstaller = () => {
        if (!newInstaller.nom || !newInstaller.telephone) {
            toast.error("Veuillez remplir les informations de l'installateur");
            return;
        }

        const installer: Installer = {
            id: `equipe-${Math.random().toString(36).substr(2, 4)}`,
            nom: newInstaller.nom,
            telephone: newInstaller.telephone,
            region: newInstaller.region || 'IDF',
            disponible: true
        };

        setInstallers([...installers, installer]);
        setNewInstaller({ nom: '', telephone: '', region: '' });
        setIsAddInstallerOpen(false);
        toast.success("Installateur ajouté avec succès");
    };

    // Extension de la plage de dates à 2 ans (730 jours) pour permettre la planification à long terme
    const nextDays = Array.from({ length: 730 }).map((_, i) => addDays(new Date(), i));

    const getInstallerPlanning = (poseurId: string) => {
        return allClients.filter(c => {
            if (!c.dateDebutTravaux || !c.poseurId || c.poseurId !== poseurId) return false;
            try {
                const start = parseSafeDate(c.dateDebutTravaux);
                if (!start) return false;
                // Si pas de date de fin, on considère 1 jour par défaut
                const end = c.dateFinTravaux ? parseSafeDate(c.dateFinTravaux) : start;
                if (!end) return false;
                const current = new Date(selectedDate);

                // Normalisation des dates pour comparaison par jour
                const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
                const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
                const curr = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();

                return curr >= s && curr <= e;
            } catch (e) {
                return false;
            }
        });
    };

    const handleConfirmPlan = async (data: { date: Date; camionId: string }, optimizationPlan?: any) => {
        // --- CAS 1: OPTIMISATION VROOM (BULK ou INDIVIDUELLE AVEC IA) ---
        if (optimizationPlan && optimizationPlan.routes) {
            const loadingToastId = toast.loading("Application du planning optimisé...");
            try {
                // Pour chaque route (chaque camion)
                for (const route of optimizationPlan.routes) {
                    const vehicleIndex = route.vehicle - 1; // VROOM ID (1-based) -> Array Index (0-based)
                    const assignedTruck = camions[vehicleIndex];

                    if (!assignedTruck) continue;

                    // Pour chaque étape (step) qui est un JOB (livraison)
                    if (route.steps) {
                        for (const step of route.steps) {
                            if (step.type === 'job') {
                                // Retrouver le vrai ID Client grâce à la Map
                                const realClientId = optimizationPlan.idMap ? optimizationPlan.idMap[String(step.id)] : null;

                                if (realClientId) {
                                    /*
                                       Mise à jour Supabase :
                                       - On assigne le camion
                                       - On fixe la date
                                       - On passe en PLANIFIÉ
                                    */
                                    const { error } = await supabase
                                        .from('clients')
                                        .update({
                                            livreur_id: assignedTruck.id,
                                            date_livraison_prevue: format(data.date, 'yyyy-MM-dd'),
                                            statut_livraison: 'PLANIFIÉ'
                                        })
                                        .eq('id', realClientId);

                                    if (error) console.error("Erreur update client", realClientId, error);
                                }
                            }
                        }
                    }
                }

                toast.dismiss(loadingToastId);
                toast.success("Planning appliqué avec succès !");
                setPlanningClient(null);
                setIsOptimizationMode(false);
                fetchLivraisons(); // Rafraîchir l'affichage

            } catch (error) {
                console.error(error);
                toast.dismiss(loadingToastId);
                toast.error("Erreur lors de l'application du planning");
            }
            return;
        }

        // --- CAS 2: PLANIFICATION MANUELLE SIMPLE ---
        if (!planningClient) return;
        try {
            // Update client in Supabase
            // Utiliser l'API Bulk pour la synchro Agenda
            const clientIds = [planningClient.id];
            const dateStr = format(data.date, 'yyyy-MM-dd');
            const truckId = data.camionId;

            const response = await fetch(`http://${window.location.hostname}:3001/api/livraisons/bulk-planifier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientIds: clientIds,
                    date: dateStr,
                    camionId: truckId
                })
            });

            if (!response.ok) throw new Error("Erreur assignation");

            toast.success(`${clientIds.length} clients assignés !`);
            toast.success("Livraison planifiée avec succès");
            setPlanningClient(null);
            fetchLivraisons(); // Refresh data
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la planification");
        }
    };

    // List clients planned for the selected date (to optimize assignment)
    const scheduledClients = allClients.filter(c => {
        if (c.statut_livraison === 'LIVRÉ') return false;
        const rawDate = c.date_livraison_prevue || c.dateLivraison;
        if (!rawDate) return false;
        const d = parseSafeDate(rawDate);
        return d && format(d, 'yyyy-MM-dd') === selectedDate;
    });

    // Clients planifiés (EN COURS ou A PLANIFIER) qui n'ont pas encore de chauffeur assigné
    // ou qui doivent être réaffectés à un autre chauffeur
    const unplannedClients = allClients.filter(c => {
        // Inclure les clients avec statut EN COURS ou A PLANIFIER
        const isPlanned = c.statut_client === 'EN COURS' || c.statut_client === 'A PLANIFIER';
        // Exclure les clients déjà livrés
        const notDelivered = c.statut_livraison !== 'LIVRÉ';
        // Inclure tous les clients planifiés pour permettre la réaffectation
        return isPlanned && notDelivered;
    });



    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Monitor Dispatch</h2>
                    <p className="text-muted-foreground">Coordination centralisée de la logistique et des installations</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(format(d, 'yyyy-MM-dd'));
                    }}>
                        <Navigation className="h-4 w-4 rotate-[-90deg]" />
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(new Date(selectedDate), 'PPP', { locale: fr }) : <span>Choisir une date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={new Date(selectedDate)}
                                onSelect={(date) => date && setSelectedDate(format(date, 'yyyy-MM-dd'))}
                                locale={fr}
                                modifiers={{
                                    hasDelivery: (date) => livraisons.some(l => l.datePrevue === format(date, 'yyyy-MM-dd')),
                                    hasInstallation: (date) => allClients.some(c => {
                                        if (!c.dateDebutTravaux) return false;
                                        const start = parseSafeDate(c.dateDebutTravaux);
                                        if (!start) return false;
                                        const end = c.dateFinTravaux ? parseSafeDate(c.dateFinTravaux) : start;
                                        if (!end) return false;
                                        return date >= new Date(start.setHours(0, 0, 0, 0)) && date <= new Date(end.setHours(23, 59, 59, 999));
                                    })
                                }}
                                modifiersStyles={{
                                    hasDelivery: { borderBottom: '2px solid #3b82f6' }, // Blue underline
                                    hasInstallation: { borderBottom: '2px solid #22c55e' } // Green underline
                                }}
                                components={{
                                    DayContent: ({ date, activeModifiers }) => (
                                        <div className="relative flex items-center justify-center w-full h-full">
                                            {date.getDate()}
                                            <div className="absolute bottom-1 flex gap-0.5">
                                                {activeModifiers.hasDelivery && <div className="h-1 w-1 rounded-full bg-blue-500" />}
                                                {activeModifiers.hasInstallation && <div className="h-1 w-1 rounded-full bg-green-500" />}
                                            </div>
                                        </div>
                                    )
                                }}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="icon" onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(format(d, 'yyyy-MM-dd'));
                    }}>
                        <Navigation className="h-4 w-4 rotate-90" />
                    </Button>
                </div>


                {/* Bouton Optimisation Globale */}
                <Button
                    variant="default"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2"
                    onClick={() => setIsOptimizationMode(true)}
                >
                    <BrainCircuit className="h-4 w-4" />
                    Optimiser Journée
                </Button>
            </div>

            <Tabs defaultValue="logistique" className="w-full">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="logistique" className="gap-2 px-6">
                            <Truck className="h-4 w-4" />
                            Logistique & Flotte
                        </TabsTrigger>
                        <TabsTrigger value="poseurs" className="gap-2 px-6">
                            <Wrench className="h-4 w-4" />
                            Installations & Poseurs
                        </TabsTrigger>
                    </TabsList>

                    <Dialog open={isAddInstallerOpen} onOpenChange={setIsAddInstallerOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Nouveau Poseur
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nouvelle Équipe de Pose</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nom / Entreprise</Label>
                                    <Input id="name" placeholder="ex: SAS Plomberie 75" value={newInstaller.nom} onChange={(e) => setNewInstaller({ ...newInstaller, nom: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tel">Téléphone</Label>
                                    <Input id="tel" placeholder="06..." value={newInstaller.telephone} onChange={(e) => setNewInstaller({ ...newInstaller, telephone: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="region">Région</Label>
                                    <Input id="region" placeholder="ex: IDF" value={newInstaller.region} onChange={(e) => setNewInstaller({ ...newInstaller, region: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddInstaller}>Enregistrer</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <TabsContent value="logistique" className="mt-0 outline-none">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Package className="h-5 w-5 text-primary" />
                                Tournées Chauffeurs ({format(new Date(selectedDate), 'd MMMM', { locale: fr })})
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {camions.map(camion => {
                                const dailyLivraisons = livraisons.filter(l =>
                                    l.datePrevue === selectedDate &&
                                    l.camionId === camion.id &&
                                    l.statut !== 'LIVRÉE'
                                );

                                const totalVolume = dailyLivraisons.reduce((acc, l) => acc + l.volumeTotal, 0);
                                const totalLEDs = dailyLivraisons.reduce((acc, l) => acc + (l.client.nombreLED || 0), 0);
                                const fillPercentage = (totalVolume / camion.volumeMax) * 100;
                                const availablePercentage = Math.max(0, 100 - fillPercentage);
                                const isOverloaded = fillPercentage > 100;
                                const isFull = fillPercentage >= 95;

                                return (
                                    <Card key={camion.id} className={cn(
                                        "overflow-hidden transition-all duration-300 hover:shadow-xl border-none shadow-premium",
                                        isOverloaded ? "ring-2 ring-destructive" : ""
                                    )}>
                                        <div className={cn("h-1.5 w-full", isOverloaded ? "bg-destructive" : isFull ? "bg-orange-400" : "bg-primary")} />
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                                        <Truck className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                                            {camion.nom}
                                                            {camion.secteur && <Badge className="text-[9px] h-4 px-1 bg-slate-700">{camion.secteur}</Badge>}
                                                        </CardTitle>
                                                        <CardDescription className="text-[10px]">Cap : {camion.volumeMax}m³ | {totalLEDs} LEDs</CardDescription>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] bg-slate-50">{Math.round(availablePercentage)}% Libre</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span>Chargement</span>
                                                    <span>{totalVolume.toFixed(1)} / {camion.volumeMax} m³</span>
                                                </div>
                                                <Progress value={fillPercentage} className="h-1.5" />
                                            </div>

                                            {/* Résumé du Parcours (Villes) */}
                                            {dailyLivraisons.length > 0 && (
                                                <div className="mb-3 px-2 py-1.5 bg-blue-50/50 rounded-md border border-blue-100 hidden md:block">
                                                    <div className="flex items-center gap-1.5 text-[10px] text-blue-700 font-medium overflow-x-auto whitespace-nowrap scrollbar-hide">
                                                        <MapPinIcon className="h-3 w-3 shrink-0" />
                                                        {Array.from(new Set(dailyLivraisons.map(l => l.client.ville))).filter(Boolean).map((ville, idx) => (
                                                            <span key={idx} className="flex items-center">
                                                                {idx > 0 && <span className="mx-1 text-slate-300">→</span>}
                                                                {ville}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-1.5 mt-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Destinations ({dailyLivraisons.length})</p>

                                                    {/* Bouton Voir Itinéraire */}
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                                <Navigation className="h-3 w-3 mr-1" /> Détails & Horaires
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2">
                                                                    <Truck className="h-5 w-5 text-primary" />
                                                                    Itinéraire {camion.nom}
                                                                </DialogTitle>
                                                                <p className="text-sm text-muted-foreground">Planning du {format(new Date(selectedDate), 'd MMMM yyyy', { locale: fr })}</p>
                                                            </DialogHeader>

                                                            {/* TIMELINE ITINÉRAIRE OPTIMISÉ */}
                                                            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-4">
                                                                {/* DÉPART */}
                                                                <div className="relative pl-6">
                                                                    <div className="absolute -left-[9px] bg-slate-100 border-2 border-slate-400 h-4 w-4 rounded-full" />
                                                                    <p className="text-xs font-bold text-slate-500">09:00</p>
                                                                    <p className="font-semibold text-sm">🏢 Départ Dépôt Paris</p>
                                                                    <p className="text-xs text-muted-foreground">5 rue des Champs-Élysées, 75008 Paris</p>
                                                                </div>

                                                                {/* CLIENTS (ORDRE OPTIMISÉ PAR IA) */}
                                                                {(() => {
                                                                    // Calcul d'itinéraire optimisé à la volée
                                                                    // Cela évite l'ordre arbitraire de la DB et montre la vraie faisabilité
                                                                    const clientsList = dailyLivraisons.map(l => l.client);
                                                                    const tourData = OptimizerService.simulateTour(
                                                                        new Date(selectedDate),
                                                                        clientsList,
                                                                        9, 0 // Départ 9h00
                                                                    );

                                                                    return tourData.sortedClients.map((client, index) => {
                                                                        // simulateTour attache 'estimatedArrival' au client (via mutation ou clonage)
                                                                        // On le récupère ici.
                                                                        const arrivalDate = (client as any).estimatedArrival || new Date();
                                                                        const arrivalTimeStr = format(arrivalDate, 'HH:mm');

                                                                        // Check limit 20h00
                                                                        const isLate = arrivalDate.getHours() >= 20;

                                                                        return (
                                                                            <div key={client.id} className="relative pl-6">
                                                                                <div className={cn(
                                                                                    "absolute -left-[9px] border-2 border-white shadow-sm h-4 w-4 rounded-full",
                                                                                    isLate ? "bg-red-500 animate-pulse" : "bg-blue-500"
                                                                                )} />
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className={cn("text-xs font-bold", isLate ? "text-red-600" : "text-blue-600")}>
                                                                                        {arrivalTimeStr}
                                                                                    </p>
                                                                                    {isLate && (
                                                                                        <Badge variant="destructive" className="h-4 px-1 text-[9px] uppercase">
                                                                                            ❌ Trop Tard
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                <p className={cn("font-semibold text-sm", isLate ? "text-red-700" : "")}>
                                                                                    {client.nom}
                                                                                </p>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    <p>{client.adresse_brute || `${client.codePostal} ${client.ville}`}</p>
                                                                                    <p className="mt-0.5 font-medium text-slate-600">📦 {client.nombreLED} LEDs • 📞 {client.telephone}</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}

                                                                {/* RETOUR */}
                                                                <div className="relative pl-6">
                                                                    <div className="absolute -left-[9px] bg-slate-800 border-2 border-white h-4 w-4 rounded-full" />
                                                                    <p className="text-xs font-bold text-slate-500">
                                                                        {(() => {
                                                                            const clientsList = dailyLivraisons.map(l => l.client);
                                                                            // Recalcul rapide pour l'heure de fin (ou on pourrait l'extraire du tourData ci-dessus si on refactorisait)
                                                                            const tourData = OptimizerService.simulateTour(new Date(selectedDate), clientsList, 9, 0);
                                                                            return format(tourData.returnDate, 'HH:mm');
                                                                        })()}
                                                                    </p>
                                                                    <p className="font-semibold text-sm">🏁 Retour Dépôt Paris</p>
                                                                    <p className="text-xs text-muted-foreground">Fin de tournée estimée</p>
                                                                </div>
                                                            </div>

                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                {dailyLivraisons.length > 0 ? dailyLivraisons.map((l, i) => (
                                                    <div key={l.id} className="flex flex-col text-[11px] p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-colors group">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold text-slate-800 truncate pr-2">{l.client.nom}</span>
                                                            <Badge variant="outline" className="h-4 text-[9px] bg-slate-50 border shrink-0 font-mono">{l.client.nombreLED} LED</Badge>
                                                        </div>

                                                        {/* Adresse Complète Affichée */}
                                                        <div className="flex items-start gap-1.5 text-slate-500">
                                                            <MapPinIcon className="h-3 w-3 shrink-0 mt-0.5 text-blue-400 group-hover:text-blue-600" />
                                                            <span className="leading-tight break-words">
                                                                {l.client.adresse_brute || `${l.client.adresse || ''}, ${l.client.codePostal} ${l.client.ville}`}
                                                            </span>
                                                        </div>

                                                        {/* Ville en évidence */}
                                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between items-center">
                                                            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-slate-100 text-slate-600 font-bold tracking-tight">
                                                                {(l.client.ville || 'Ville inconnue').toUpperCase()}
                                                            </Badge>
                                                            <span className="text-[9px] text-slate-400 font-mono">#{i + 1}</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-6 text-[10px] text-muted-foreground italic border border-dashed rounded-lg bg-slate-50/50">
                                                        Aucune destination planifiée<br />
                                                        <span className="text-[9px] opacity-70">Le camion reste au dépôt</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* SECTION NAVETTES À VALIDER / ASSIGNER */}
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Navettes à Valider / Assigner ({scheduledClients.length})</h3>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">Prévues le {format(new Date(selectedDate), 'd MMMM', { locale: fr })}</Badge>
                            </div>

                            {scheduledClients.length > 0 ? (
                                <div className="space-y-8">
                                    {Object.entries(
                                        scheduledClients.reduce((acc, client) => {
                                            const dept = client.codePostal ? client.codePostal.substring(0, 2) : '00';
                                            const region = getRegionFromDept(dept);
                                            if (!acc[region]) acc[region] = [];
                                            acc[region].push(client);
                                            return acc;
                                        }, {} as Record<string, any[]>)
                                    ).sort((a, b) => a[0].localeCompare(b[0])).map(([region, clients]: [string, any[]]) => (
                                        <div key={region} className="space-y-3">
                                            <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold text-sm h-7 px-3">
                                                    {region}
                                                </Badge>
                                                <span className="text-muted-foreground text-xs font-medium">
                                                    {clients.length} client{clients.length > 1 ? 's' : ''}
                                                </span>

                                                {/* ACTIONS DE GROUPE (ASSIGNATION RAPIDE) */}
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span className="text-[10px] text-muted-foreground hidden lg:inline">Affecter le groupe ({region}) à :</span>
                                                    <div className="flex gap-1">
                                                        {camions.map(truck => {
                                                            const isFullyAssigned = clients.every(c => c.livreur_id === truck.id);
                                                            return (
                                                                <Button
                                                                    key={truck.id}
                                                                    size="sm"
                                                                    variant={isFullyAssigned ? "secondary" : "outline"}
                                                                    disabled={isFullyAssigned}
                                                                    className={cn(
                                                                        "h-7 text-[10px] px-2.5 font-semibold border-slate-300 transition-colors",
                                                                        isFullyAssigned
                                                                            ? "bg-green-100 text-green-700 border-green-200 cursor-default opacity-100"
                                                                            : "hover:bg-slate-800 hover:text-white"
                                                                    )}
                                                                    onClick={() => handleBulkAssign(clients, truck.id)}
                                                                    title={isFullyAssigned ? "Déjà assigné" : `Assigner les ${clients.length} clients de ${region} à ${truck.nom}`}
                                                                >
                                                                    {isFullyAssigned ? (
                                                                        <>
                                                                            <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                                                            Déjà assigné
                                                                        </>
                                                                    ) : (
                                                                        truck.nom.split(' ')[0]
                                                                    )}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {clients.map((client) => {
                                                    // Find if currently assigned
                                                    const assignedTruck = camions.find(c => c.id === client.livreur_id);
                                                    return (
                                                        <Card key={client.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h4 className="font-bold text-sm text-slate-900 truncate">{client.nom}</h4>
                                                                        <div className="flex gap-1">
                                                                            <Badge variant="outline" className="text-[10px] h-5">{client.nb_led || 0} LEDs</Badge>
                                                                            {assignedTruck && <Badge className="text-[9px] h-5 bg-slate-800">{assignedTruck.nom}</Badge>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
                                                                        <MapPinIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400 group-hover:text-primary transition-colors" />
                                                                        <span className="line-clamp-2 leading-tight">
                                                                            {client.adresse_brute || `${client.code_postal} ${client.ville}`}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-2">
                                                                        <Badge className="text-[10px] h-5 bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium border-0">
                                                                            {(client.ville || client.adresse_brute?.split(' ').pop() || 'Ville inc.').toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    className="shrink-0 h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                                                    onClick={() => setPlanningClient(client)}
                                                                >
                                                                    <Truck className="h-3 w-3 mr-1" />
                                                                    Affectation
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-slate-50/50 rounded-lg border border-dashed text-muted-foreground text-sm">
                                    Aucune livraison prévue pour cette date. 🎉
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* MODAL DE PLANIFICATION (Individuelle ou Globale) */}
                {(planningClient || isOptimizationMode) && (
                    <PlanningModal
                        client={planningClient}
                        allClients={allClients}
                        isOpen={!!planningClient || isOptimizationMode}
                        onClose={() => {
                            setPlanningClient(null);
                            setIsOptimizationMode(false);
                            fetchLivraisons(); // Refresh après fermeture
                        }}
                        onConfirm={handleConfirmPlan} // Sera adapté si Bulk
                        initialDate={new Date(selectedDate)}
                    />
                )}

                <TabsContent value="poseurs" className="mt-0 outline-none">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Wrench className="h-5 w-5 text-primary" />
                                Planning Poseurs ({format(new Date(selectedDate), 'd MMMM', { locale: fr })})
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {installers.map(installer => {
                                const missions = getInstallerPlanning(installer.id);
                                const LED_CAPACITY = 70;

                                // Calculer la charge réelle pour le jour sélectionné
                                const totalLEDs = missions.reduce((acc, m) => {
                                    const nbTotal = m.nombreLED || 0;
                                    if (nbTotal <= LED_CAPACITY) return acc + nbTotal;

                                    // Pour les chantiers multi-jours
                                    const start = new Date(m.dateDebutTravaux);
                                    const current = new Date(selectedDate);
                                    const diffDays = Math.floor((current.getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / (1000 * 60 * 60 * 24));

                                    if (diffDays < 0) return acc; // Ne devrait pas arriver avec le filtre

                                    const LEDsDoneBefore = diffDays * LED_CAPACITY;
                                    const LEDsRemaining = Math.max(0, nbTotal - LEDsDoneBefore);

                                    return acc + Math.min(LED_CAPACITY, LEDsRemaining);
                                }, 0);

                                const fillPercentage = (totalLEDs / LED_CAPACITY) * 100;
                                const isFull = fillPercentage >= 95;
                                const isOverloaded = fillPercentage > 100;

                                return (
                                    <Card key={installer.id} className={cn(
                                        "shadow-premium border-none overflow-hidden hover:shadow-xl transition-all",
                                        isOverloaded ? "ring-2 ring-destructive" : ""
                                    )}>
                                        <div className={cn("h-1.5 w-full", isOverloaded ? "bg-destructive" : isFull ? "bg-orange-400" : "bg-primary")} />
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <Wrench className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 leading-none">{installer.nom}</h4>
                                                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                            <MapPinIcon className="h-3 w-3" /> {installer.region}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant={missions.length > 0 ? "default" : "success"} className="text-[9px] h-5 px-1.5 shrink-0">
                                                    {missions.length > 0 ? `${missions.length} Chantier${missions.length > 1 ? 's' : ''}` : 'Disponible'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-2 space-y-4">
                                            {/* Workload Section */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="flex items-center gap-1">
                                                        Charge de travail : <span className={cn(isOverloaded ? "text-destructive" : "text-primary")}>{totalLEDs}</span> / {LED_CAPACITY} LEDs
                                                    </span>
                                                    <span>{Math.round(fillPercentage)}%</span>
                                                </div>
                                                <Progress value={fillPercentage} className="h-1.5" />
                                            </div>

                                            {missions.length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Planning du jour :</p>
                                                    <div className="space-y-2">
                                                        {missions.map((m, idx) => (
                                                            <div key={m.id} className="flex items-start gap-2 text-[11px] p-2.5 rounded-xl bg-blue-50/50 border border-blue-100/50 group hover:border-blue-200 transition-colors">
                                                                <div className="h-5 w-5 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center mt-0.5 shadow-sm shrink-0">{idx + 1}</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center bg-white/50 px-2 py-0.5 rounded-md mb-1">
                                                                        <span className="font-bold text-slate-800 truncate">{m.nom} {m.prenom}</span>
                                                                        <span className="text-[10px] text-blue-600 font-extrabold ml-1">{m.nombreLED} LED</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground italic flex items-center gap-1.5 px-1">
                                                                        <MapPinIcon className="h-2.5 w-2.5 text-blue-400" /> {m.ville}
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="text-[9px] font-medium">{m.codePostal}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30">
                                                    <CheckCircle2 className="h-8 w-8 text-emerald-200 mx-auto mb-2" />
                                                    <p className="text-xs text-emerald-600 font-medium">Libre pour intervention</p>
                                                    <p className="text-[10px] text-emerald-500/70 mt-1">Aucune pose planifiée</p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] flex-1 gap-1.5 font-bold hover:bg-slate-50">
                                                    <Phone className="h-3 w-3" /> Appeler
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 text-[10px] flex-1 hover:bg-slate-100 text-slate-600 font-medium">
                                                    Historique
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </TabsContent>

            </Tabs>
        </div >
    );
}
