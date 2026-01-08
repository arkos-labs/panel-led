
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, MapPin, CheckCircle2, Play, StopCircle, Loader2, Navigation, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DriverChat } from "@/components/driver/DriverChat";
import { cn, mapSupabaseClient, calculateDistance } from "@/lib/utils";
import { Truck, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { useOfflineAction } from "@/hooks/useOffline";

// Type definition for Client
interface Client {
    id: string;
    nom: string;
    prenom: string;
    adresse_brute: string;
    telephone: string;
    zone_pays: string;
    nb_led: number;
    statut_livraison: string;
    statut_installation: string;
    date_install_debut: string;
    date_install_fin: string;
    date_livraison_reelle?: string; // Optional field
    gps?: {
        lat: number;
        lon: number;
    };
    heure_livraison?: string;
    livreur_id?: string;
}

export default function Validation() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    const [chantier, setChantier] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const [tournee, setTournee] = useState<Client[]>([]);
    const [showTournee, setShowTournee] = useState(false);
    const { execute } = useOfflineAction();

    useEffect(() => {
        if (!id) return;
        fetchChantier();

        // Realtime Subscription
        const channel = supabase
            .channel(`chantier-page-${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${id}` },
                (payload) => {
                    const newClient = payload.new as Client;
                    setChantier(newClient);
                    // If we have a driver ID now, fetch tour
                    if (newClient.livreur_id) fetchTournee(newClient.livreur_id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    async function fetchChantier() {
        if (!id) return;
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            const client = data as Client;
            setChantier(client);
            if (client.livreur_id) {
                fetchTournee(client.livreur_id);
            }
        } catch (error) {
            console.error(error);
            toast.error("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    }

    async function fetchTournee(driverId: string) {
        if (!driverId) return;
        try {
            // Fetch ALL clients for this driver slightly broadly to ensure we catch today's stuff
            // We'll filter client-side or assume if they are assigned they are relevant.
            // Actually, let's just look for anything "PLANIFIE" or "EN_COURS" or "LIVRE" for this driver.
            // Simplest is to get everything for this driver efficiently.
            const { data: allClients, error } = await supabase
                .from('clients')
                .select('*')
                .eq('livreur_id', driverId)
            // .eq('date_livraison_prevue', ...) // Dates are strings in this DB ("DD/MM/YYYY"), hard to filter in SQL exactly without exact match. 
            // Let's filtered locally to be safe or rely on the fact that drivers usually only have 'current' stuff assigned? 
            // Actually stock/history remains.
            // Let's filter for "status contains PLANIF or LIVR or EN_COURS"
            // Or simply rely on mapped logic.

            if (error) throw error;

            const mapped = (allClients || []).map(mapSupabaseClient);
            const activeTour = mapped.filter((c: any) => {
                // Show everything for this driver for now to debug
                const s = (c.statut_livraison || '').toUpperCase();
                // Filter out obviously done/cancelled things if needed, but for now show all assigned work.
                // Assuming 'PLANIFIE', 'EN_COURS', 'LIVRE' etc.
                return s.length > 2 && !s.includes('ARCHIV') && !s.includes('ANNUL');
            });

            // Exclude current one to avoid duplication? No, list should have all.
            setTournee(activeTour);
            setShowTournee(true);
        } catch (e) {
            console.error(e);
        }
    }

    const handleOpenWaze = () => {
        if (!chantier) return;
        if (!chantier.gps?.lat) {
            const address = chantier.adresse_brute || "";
            window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}`, '_blank');
            return;
        }
        const { lat, lon } = chantier.gps;
        window.open(`https://waze.com/ul?ll=${lat},${lon}&navigate=yes`, '_blank');
    };

    const handleCall = () => {
        if (chantier?.telephone) {
            window.location.href = `tel:${chantier.telephone}`;
        } else {
            toast.error("Numéro de téléphone introuvable.");
        }
    };

    const callBackendValidation = async (type: string, successMessage: string) => {
        if (!id) return;
        setProcessing(true);

        const now = new Date();
        const heureActuelle = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const dateComplete = now.toISOString();

        try {
            // Utilisation du hook hors ligne
            // L'action sera stockée localement si déconnecté et rejouée plus tard
            await execute(
                type === 'livraison' ? 'CONFIRM_DELIVERY' :
                    type === 'chantier-debut' ? 'START_INSTALLATION' : 'COMPLETE_INSTALLATION',
                { clientId: id }, // Payload pour le queue
                async () => {
                    // Handler en ligne
                    const response = await fetch(`/api/valider/${id}/${type}`);
                    if (!response.ok) throw new Error("Erreur serveur");
                    return response;
                }
            );

            toast.success(successMessage);

            // Mise à jour visuelle optimiste/immédiate
            if (type === 'livraison') {
                setChantier(prev => prev ? ({
                    ...prev,
                    statut_livraison: 'LIVRÉ',
                    heure_livraison: heureActuelle,
                    date_livraison_reelle: dateComplete
                }) : null);
            } else if (type === 'chantier-debut') {
                setChantier(prev => prev ? ({ ...prev, statut_installation: 'EN_COURS' }) : null);
            } else if (type === 'chantier') {
                setChantier(prev => prev ? ({ ...prev, statut_installation: 'TERMINÉ' }) : null);
            }

        } catch (error: any) {
            console.error(error);
            // Le toast d'erreur est déjà géré par execute() si besoin,
            // ou on peut ajouter un message spécifique ici.
        } finally {
            setProcessing(false);
        }
    };

    const confirmLivraison = () => {
        callBackendValidation('livraison', "Livraison confirmée !");
    };

    const startInstallation = () => {
        callBackendValidation('chantier-debut', "Début des travaux enregistré.");
    };

    const finishInstallation = () => {
        callBackendValidation('chantier', "Installation terminée. Bravo !");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!chantier || !id) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200 bg-red-50">
                    <CardContent className="pt-6 text-center text-red-600 font-medium">
                        <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        ID introuvable ou lien invalide.
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isLivraison = action === 'livraison';
    const isInstallation = action === 'installation';

    if (!isLivraison && !isInstallation) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center text-slate-500">
                        Type d'action inconnu (ni livraison, ni installation).
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex flex-col items-center justify-start font-sans overflow-y-auto">
            <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden ring-1 ring-slate-900/5">

                {/* HEADER */}
                <div className={`p-6 text-white text-center ${isLivraison ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-orange-500 to-pink-600'}`}>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">
                        {isLivraison ? "LIVRAISON" : "INSTALLATION"}
                    </h1>
                    <p className="opacity-90 font-light max-w-[80%] mx-auto text-lg">
                        {chantier.nom ? `${chantier.nom} ${chantier.prenom}` : "Client Inconnu"}
                    </p>
                    {chantier.nb_led > 0 && (
                        <Badge variant="secondary" className="mt-3 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                            {chantier.nb_led} LEDS
                        </Badge>
                    )}
                </div>

                <CardContent className="pt-8 space-y-6">

                    {/* INFO ADRESSE */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <MapPin className="h-5 w-5 text-gray-400 mt-1 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-slate-900 leading-snug">
                                    {chantier.adresse_brute}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Zone: {chantier.zone_pays}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-12 w-full gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                onClick={handleOpenWaze}
                            >
                                <Navigation className="h-4 w-4 text-blue-500" />
                                Waze
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 w-full gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                onClick={handleCall}
                                disabled={!chantier.telephone}
                            >
                                <Phone className="h-4 w-4 text-green-500" />
                                Appeler
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    {/* ACTION ZONE */}
                    <div className="pt-2 pb-4">
                        {isLivraison && (
                            <div className="text-center space-y-4">
                                {chantier.statut_livraison === 'LIVRÉ' ? (
                                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100 animate-in fade-in zoom-in duration-300">
                                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                                        <h3 className="text-xl font-bold text-green-700">Livraison Validée</h3>
                                        <div className="py-4">
                                            <p className="text-green-800 text-4xl font-extrabold font-mono tracking-wider">
                                                {(chantier.heure_livraison || "À l'instant").replace(':', 'h')}
                                            </p>
                                        </div>
                                        <p className="text-green-600 text-sm mt-1">Merci pour votre travail.</p>
                                    </div>
                                ) : (
                                    <Button
                                        size="lg"
                                        className="w-full h-14 text-base font-bold bg-[#007f73] hover:bg-[#00665c] text-white shadow-md rounded-md transition-all active:scale-95" // Couleur Teal spécifique capture
                                        onClick={confirmLivraison}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                        Marquer livrée
                                    </Button>
                                )}
                            </div>
                        )}

                        {isInstallation && (
                            <div className="space-y-4">
                                {chantier.statut_installation === 'TERMINÉ' ? (
                                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-center animate-in fade-in zoom-in duration-300">
                                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                                        <h3 className="text-xl font-bold text-green-700">Installation Terminée</h3>
                                        <p className="text-green-600 text-sm mt-1">
                                            Fin: {chantier.date_install_fin ? format(new Date(chantier.date_install_fin), 'HH:mm', { locale: fr }) : '-'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {/* START BUTTON */}
                                        {chantier.statut_installation !== 'EN_COURS' && (
                                            <Button
                                                size="lg"
                                                className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 rounded-xl transition-all active:scale-95"
                                                onClick={startInstallation}
                                                disabled={processing}
                                            >
                                                {processing ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 h-6 w-6" />}
                                                DÉBUT TRAVAUX
                                            </Button>
                                        )}

                                        {/* FINISH BUTTON */}
                                        {chantier.statut_installation === 'EN_COURS' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center text-blue-700">
                                                    <div className="text-xs uppercase tracking-wider font-bold opacity-70 mb-1">En cours depuis</div>
                                                    <div className="text-2xl font-mono font-bold">
                                                        {chantier.date_install_debut ? format(new Date(chantier.date_install_debut), 'HH:mm', { locale: fr }) : '--:--'}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="lg"
                                                    className="w-full h-16 text-lg font-bold bg-slate-900 hover:bg-slate-800 shadow-xl rounded-xl transition-all active:scale-95"
                                                    onClick={finishInstallation}
                                                    disabled={processing}
                                                >
                                                    {processing ? <Loader2 className="animate-spin mr-2" /> : <StopCircle className="mr-2 h-6 w-6" />}
                                                    FIN TRAVAUX
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </CardContent>
            </Card>

            {/* TOUR LIST SECTION */}
            {showTournee && (
                <div className="w-full max-w-md mt-8 pb-32 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <Truck className="h-5 w-5 text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                            Reste de la tournée ({tournee.filter((c: any) => c.id !== id).length})
                        </h2>
                    </div>

                    {tournee.filter((c: any) => c.id !== id).length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-400 text-sm">Aucune autre livraison trouvée pour ce chauffeur.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tournee
                                .filter((c: any) => c.id !== id) // Exclude current
                                .sort((a, b) => {
                                    // Sort: Pending first, then Done.
                                    const isDoneA = a.statut_livraison?.includes('LIVR');
                                    const isDoneB = b.statut_livraison?.includes('LIVR');
                                    if (isDoneA === isDoneB) return 0;
                                    return isDoneA ? 1 : -1;
                                })
                                .map((client: any) => {
                                    const isDone = client.statut_livraison?.includes('LIVR');

                                    // Calculate distance from CURRENT viewed chantier
                                    let distanceStr = "";
                                    if (chantier?.gps?.lat && chantier?.gps?.lon && client.gps?.lat && client.gps?.lon) {
                                        const dist = calculateDistance(
                                            chantier.gps.lat,
                                            chantier.gps.lon,
                                            client.gps.lat,
                                            client.gps.lon
                                        );
                                        if (dist < 1) {
                                            distanceStr = `${Math.round(dist * 1000)}m`;
                                        } else {
                                            distanceStr = `${dist.toFixed(1)} km`;
                                        }
                                    }

                                    return (
                                        <div
                                            key={client.id}
                                            onClick={() => window.location.href = `/validate?id=${client.id}&action=livraison`}
                                            className={cn(
                                                "bg-white p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
                                                isDone ? "border-emerald-200 bg-emerald-50/50 opacity-70" : "border-slate-200 shadow-sm"
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                                                        isDone ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                                                    )}>
                                                        {client.nb_led || client.nombreLED}
                                                    </div>
                                                    <div>
                                                        <h3 className={cn("font-bold text-sm leading-tight", isDone ? "text-emerald-900" : "text-slate-800")}>
                                                            {client.prenom} {client.nom}
                                                        </h3>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" /> {client.ville || 'Ville inconnue'}
                                                            </span>
                                                            {!isDone && distanceStr && (
                                                                <span className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                                    {distanceStr}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isDone && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )
            }

            {/* Driver Chat Integration */}
            {/* Driver Chat Integration - Force Render */}
            <div className="fixed bottom-24 right-6 z-[9999]">
                <DriverChat
                    driverId={chantier?.livreur_id || 'unknown'}
                    driverName="Bureau"
                />
            </div>

            {/* Footer Branding */}
            <div className="fixed bottom-4 text-center w-full pointer-events-none">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Powered by Arkos Bridge</p>
            </div>
        </div >
    );
}
