import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Phone, MapPin, CheckCircle2, Play, StopCircle, Loader2, Navigation, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
    gps?: {
        lat: number;
        lon: number;
    };
}

export default function App() {
    const [id, setId] = useState<string | null>(null);
    const [action, setAction] = useState<string | null>(null);
    const [chantier, setChantier] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // Parse URL parameters manually since we don't have react-router setup in the simplest form, 
        // or we can just use window.location.search
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("id");
        const urlAction = params.get("action");

        if (urlId) setId(urlId);
        if (urlAction) setAction(urlAction);
    }, []);

    useEffect(() => {
        if (!id) return;
        fetchChantier();

        // Realtime Subscription
        const channel = supabase
            .channel(`chantier-standalone-${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${id}` },
                (payload) => {
                    setChantier(payload.new as Client);
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
            setChantier(data);
        } catch (error) {
            console.error(error);
            toast.error("Impossible de charger les données.");
        } finally {
            setLoading(false);
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

    const updateStatus = async (updates: Partial<Client>, successMessage: string) => {
        if (!id) return;
        setProcessing(true);
        try {
            // Direct Supabase Update
            const { error } = await supabase
                .from('clients')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            toast.success(successMessage);
            // Refresh local state immediately
            if (chantier) {
                setChantier({ ...chantier, ...updates });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur de mise à jour. Vérifiez votre connexion.");
        } finally {
            setProcessing(false);
        }
    };

    const confirmLivraison = () => {
        updateStatus(
            {
                statut_livraison: 'LIVRÉ',
                // We rely on backend bridge to timestamp based on the status change event if needed, 
                // or we can send a Date if the schema supports it. keeping it simple.
            },
            "Livraison confirmée !"
        );
    };

    const startInstallation = () => {
        updateStatus(
            {
                statut_installation: 'EN_COURS',
                date_install_debut: new Date().toISOString()
            },
            "Début des travaux enregistré."
        );
    };

    const finishInstallation = () => {
        updateStatus(
            {
                statut_installation: 'TERMINÉ',
                date_install_fin: new Date().toISOString()
            },
            "Installation terminée. Bravo !"
        );
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
                <div className="w-full max-w-md bg-white border border-red-200 rounded-xl p-6 shadow-sm">
                    <div className="text-center text-red-600 font-medium flex flex-col items-center">
                        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                        <p>ID introuvable ou lien invalide.</p>
                        <p className="text-sm text-gray-400 mt-2">Vérifiez le lien dans votre agenda.</p>
                    </div>
                </div>
            </div>
        );
    }

    const isLivraison = action === 'livraison';
    const isInstallation = action === 'installation';

    if (!isLivraison && !isInstallation) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-xl shadow text-center">Action inconnue.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

                {/* HEADER */}
                <div className={`p-6 text-white text-center ${isLivraison ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-orange-500 to-pink-600'}`}>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">
                        {isLivraison ? "LIVRAISON" : "INSTALLATION"}
                    </h1>
                    <p className="opacity-90 font-light text-lg">
                        {chantier.nom ? `${chantier.nom} ${chantier.prenom}` : "Client Inconnu"}
                    </p>
                    {chantier.nb_led > 0 && (
                        <span className="inline-block mt-3 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            {chantier.nb_led} LEDS
                        </span>
                    )}
                </div>

                <div className="p-6 space-y-6">

                    {/* ADDRESS CARD */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-4">
                        <MapPin className="h-6 w-6 text-slate-400 mt-1 shrink-0" />
                        <div>
                            <p className="text-slate-900 font-medium leading-snug">{chantier.adresse_brute}</p>
                            <p className="text-slate-500 text-sm mt-1">Zone: {chantier.zone_pays}</p>
                        </div>
                    </div>

                    {/* ACTIONS: WAZE & CALL */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleOpenWaze}
                            className="flex items-center justify-center gap-2 h-12 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 active:scale-95 transition-all"
                        >
                            <Navigation className="h-4 w-4 text-blue-500" />
                            Waze
                        </button>
                        <button
                            onClick={handleCall}
                            disabled={!chantier.telephone}
                            className="flex items-center justify-center gap-2 h-12 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <Phone className="h-4 w-4 text-green-500" />
                            Appeler
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 my-4" />

                    {/* MAIN ACTION AREA */}

                    {/* --- LIVRAISON --- */}
                    {isLivraison && (
                        <div className="text-center">
                            {chantier.statut_livraison === 'LIVRÉ' ? (
                                <div className="p-6 bg-green-50 border border-green-100 rounded-xl animate-in zoom-in duration-300">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                                    <h3 className="text-xl font-bold text-green-700">Livraison Validée</h3>
                                    <p className="text-green-600 text-sm mt-1">Merci pour votre travail.</p>
                                </div>
                            ) : (
                                <button
                                    onClick={confirmLivraison}
                                    disabled={processing}
                                    className="w-full h-16 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {processing ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                                    VALIDER LA LIVRAISON
                                </button>
                            )}
                        </div>
                    )}

                    {/* --- INSTALLATION --- */}
                    {isInstallation && (
                        <div className="space-y-4">
                            {chantier.statut_installation === 'TERMINÉ' ? (
                                <div className="p-6 bg-green-50 border border-green-100 rounded-xl text-center animate-in zoom-in duration-300">
                                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                                    <h3 className="text-xl font-bold text-green-700">Installation Terminée</h3>
                                    <p className="text-green-600 text-sm mt-1">
                                        Fin: {chantier.date_install_fin ? format(new Date(chantier.date_install_fin), 'HH:mm', { locale: fr }) : '-'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* START BUTTON */}
                                    {chantier.statut_installation !== 'EN_COURS' && (
                                        <button
                                            onClick={startInstallation}
                                            disabled={processing}
                                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
                                        >
                                            {processing ? <Loader2 className="animate-spin h-6 w-6" /> : <Play className="h-6 w-6" />}
                                            DÉBUT TRAVAUX
                                        </button>
                                    )}

                                    {/* FINISH BUTTON */}
                                    {chantier.statut_installation === 'EN_COURS' && (
                                        <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in">
                                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-center">
                                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">En cours depuis</p>
                                                <p className="text-2xl font-mono font-bold text-blue-900">
                                                    {chantier.date_install_debut ? format(new Date(chantier.date_install_debut), 'HH:mm', { locale: fr }) : '--:--'}
                                                </p>
                                            </div>

                                            <button
                                                onClick={finishInstallation}
                                                disabled={processing}
                                                className="w-full h-16 bg-slate-800 hover:bg-slate-900 text-white text-lg font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
                                            >
                                                {processing ? <Loader2 className="animate-spin h-6 w-6" /> : <StopCircle className="h-6 w-6" />}
                                                FIN TRAVAUX
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>

            <div className="fixed bottom-4 text-center w-full pointer-events-none opacity-30">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Arkos Field App v1.0</p>
            </div>
        </div>
    );
}
