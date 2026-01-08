
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    MapPin,
    Phone,
    Navigation,
    CheckCircle2,
    Package,
    Truck,
    Calendar as CalendarIcon,
    Loader2,
    RefreshCw,
    ChevronRight,
    ExternalLink,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn, mapSupabaseClient } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { DriverChat } from "@/components/driver/DriverChat";

// Mock mapping for demo - in real app, fetch from /api/resources
const DRIVERS: Record<string, string> = {
    '1': 'Nicolas',
    '2': 'David',
    '3': 'Gros Camion',
    'camion-1000': 'Nicolas',
    'camion-500': 'David',
    'camion-2000': 'Gros Camion'
};

export default function DriverDashboard() {
    const { driverId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const driverName = DRIVERS[driverId || ''] || "Chauffeur";

    const fetchDeliveries = async (silent = false) => {
        if (!silent) setLoading(true);
        setIsRefreshing(true);
        try {
            const { data: allClients, error } = await supabase
                .from('clients')
                .select('*')
                .order('date_livraison_prevue', { ascending: true });

            if (error) throw error;

            const mappedClients = (allClients || []).map(mapSupabaseClient);

            // Filter for this driver and active delivery statuses
            const myDeliveries = mappedClients.filter((c: any) => {
                const cLivreurId = (c.livreur_id || '').toLowerCase();
                const dId = (driverId || '').toLowerCase();

                // Flexible match: 1 -> camion-1000, 2 -> camion-500, 3 -> camion-2000
                const isMatchManual = (dId === '1' && cLivreurId.includes('1000')) ||
                    (dId === '2' && cLivreurId.includes('500')) ||
                    (dId === '3' && cLivreurId.includes('2000'));

                const isMyTruck = cLivreurId === dId ||
                    cLivreurId.includes(dId) ||
                    isMatchManual;

                const status = (c.statut_livraison || '').toUpperCase();
                const isActive = ['PLANIFIÉE', 'PLANIFIE', 'EN COURS', 'EN_COURS', 'LIVRÉ', 'LIVRÉE'].some(s => status.includes(s));

                return isMyTruck && isActive;
            });

            setDeliveries(myDeliveries);
        } catch (error) {
            console.error("Erreur chargement", error);
            toast.error("Erreur de connexion");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('driver-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
                fetchDeliveries(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [driverId]);

    const handleStatusUpdate = async (clientId: string, newStatus: string) => {
        try {
            const now = new Date();
            const nowStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const isoStr = now.toISOString();

            const updatePayload: any = {
                statut_livraison: newStatus,
                statut_client: newStatus === 'LIVRÉ' ? 'LIVRÉ' : (newStatus === 'A_VALIDER' ? 'A_VALIDER' : undefined),
                heure_livraison: newStatus === 'LIVRÉ' || newStatus === 'A_VALIDER' ? nowStr : undefined,
                date_livraison_reelle: newStatus === 'LIVRÉ' || newStatus === 'A_VALIDER' ? isoStr : undefined,
                logistique: newStatus === 'LIVRÉ' ? 'LIVRÉE' : undefined,
            };

            const { error } = await supabase
                .from('clients')
                .update(updatePayload)
                .eq('id', clientId);

            if (error) throw error;

            toast.success(newStatus === 'LIVRÉ' ? "Livraison confirmée ! ✅" : "Statut mis à jour");
            fetchDeliveries(true);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la validation");
        }
    };

    const todoList = deliveries.filter(d => d.statut_livraison !== 'LIVRÉ' && d.statut_livraison !== 'LIVRÉE');
    const doneList = deliveries.filter(d => d.statut_livraison === 'LIVRÉ' || d.statut_livraison === 'LIVRÉE');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                <p className="text-slate-400 font-medium">Chargement de votre tournée...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            {/* HEADER PWA STYLE */}
            <div className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-lg flex justify-between items-center border-b border-slate-800">
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        Tournée {driverName}
                    </h1>
                    <p className="text-xs text-slate-400 capitalize">
                        {format(new Date(), 'EEEE d MMMM', { locale: fr })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchDeliveries()}
                        className={cn("p-2 rounded-full bg-slate-800 text-slate-300", isRefreshing && "animate-spin")}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                        <i className="fas fa-truck mr-1"></i> {todoList.length} RESTANTS
                    </div>
                </div>
            </div>

            {/* LISTE DES LIVRAISONS */}
            <div className="p-4 space-y-4 max-w-2xl mx-auto">

                {/* PROCHAINE ÉTAPE (Le premier de la liste TO-DO) */}
                {todoList.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Prochaine étape</h2>
                        {todoList.slice(0, 1).map(client => (
                            <DeliveryCard
                                key={client.id}
                                client={client}
                                isNext={true}
                                onValidate={() => handleStatusUpdate(client.id, 'A_VALIDER')}
                            />
                        ))}
                    </div>
                )}

                {/* LA SUITE DE LA TOURNEE */}
                {todoList.length > 1 && (
                    <div className="space-y-4 pt-2">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">À suivre</h2>
                        {todoList.slice(1).map(client => (
                            <DeliveryCard
                                key={client.id}
                                client={client}
                            />
                        ))}
                    </div>
                )}

                {/* LIVRAISONS TERMINÉES */}
                {doneList.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-slate-200 mt-8">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Terminées</h2>
                        {doneList.map(client => (
                            <DeliveryCard
                                key={client.id}
                                client={client}
                                isDone={true}
                            />
                        ))}
                    </div>
                )}

                {deliveries.length === 0 && (
                    <div className="text-center py-20 px-6">
                        <div className="bg-slate-100 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Truck className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Aucune livraison</h3>
                        <p className="text-slate-500 text-sm mt-1">Vous n'avez pas de tournée prévue pour aujourd'hui.</p>
                    </div>
                )}
            </div>

            {/* BARRE DE STATUT BASSE */}
            {todoList.length === 0 && doneList.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-green-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-bounce">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6" />
                        <span className="font-bold">Tournée terminée ! Bravo.</span>
                    </div>
                </div>
            )}

            <DriverChat driverId={driverId || 'unknown'} driverName={driverName} />
        </div>
    );
}

interface DeliveryCardProps {
    client: any;
    isNext?: boolean;
    isDone?: boolean;
    onValidate?: () => void;
}

function DeliveryCard({ client, isNext, isDone, onValidate }: DeliveryCardProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        if (onValidate) await onValidate();
        setIsSubmitting(false);
    };

    const handleWaze = () => {
        const address = client.adresse_brute || `${client.adresse}, ${client.ville}`;
        const query = client.gps?.lat ? `${client.gps.lat},${client.gps.lon}` : address;
        window.open(`https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`, '_blank');
    };

    const handleCall = () => {
        if (client.telephone) {
            window.location.href = `tel:${client.telephone}`;
        } else {
            toast.error("Numéro de téléphone manquant");
        }
    };

    if (isDone) {
        return (
            <div className="bg-emerald-50/50 border-l-4 border-emerald-500 p-4 rounded-xl shadow-sm opacity-75 relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0 px-1.5 h-5 font-bold uppercase">
                                Livré • {client.heure_livraison || 'Check'}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-slate-800">{client.prenom} {client.nom}</h3>
                        <p className="text-xs text-slate-500">{client.ville} ({client.codePostal})</p>
                    </div>
                    <div className="text-emerald-500">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                </div>
            </div>
        );
    }

    if (isNext) {
        return (
            <div className="bg-white p-5 rounded-2xl shadow-xl border-2 border-blue-600 relative overflow-hidden ring-4 ring-blue-600/10">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Truck className="h-16 w-16" />
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-blue-600 text-white border-0 font-bold px-3 py-1 text-xs rounded-lg animate-pulse">
                            DESTINATION ACTUELLE
                        </Badge>
                        <span className="text-blue-600 font-bold text-sm">{client.nombreLED || client.nb_led} LED</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900">{client.prenom} {client.nom}</h2>
                    <div className="flex items-start gap-1.5 text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <MapPin className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                        <span className="text-sm font-medium leading-snug">{client.adresse_brute || `${client.adresse}, ${client.ville}`}</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-6">
                    <Button
                        onClick={handleWaze}
                        variant="secondary"
                        className="col-span-1 h-16 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 active:scale-95 transition-all"
                    >
                        <Navigation className="h-6 w-6 text-blue-500" />
                        <span className="text-[10px] font-black uppercase">GPS</span>
                    </Button>

                    <Button
                        onClick={handleCall}
                        variant="secondary"
                        className="col-span-1 h-16 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 active:scale-95 transition-all"
                        disabled={!client.telephone}
                    >
                        <Phone className="h-6 w-6 text-green-600" />
                        <span className="text-[10px] font-black uppercase">TÉL</span>
                    </Button>

                    <Button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="col-span-2 h-16 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-6 w-6 group-hover:scale-110 transition-transform" />
                        )}
                        <span className="text-[11px] font-black uppercase">Vérifier</span>
                    </Button>
                </div>
            </div>
        );
    }

    // Standard Pending Step
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between group active:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                    {client.nombreLED || client.nb_led}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{client.prenom} {client.nom}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {client.ville}
                    </p>
                </div>
            </div>
            <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
                <ChevronRight className="h-5 w-5" />
            </div>
        </div>
    );
}
