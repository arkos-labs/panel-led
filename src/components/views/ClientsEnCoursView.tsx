import { useState, useEffect, useCallback } from 'react';
import { Package, MapPin, Calendar, Truck, CheckCircle2, Clock, Wrench, ChevronRight } from 'lucide-react';
import { Client } from '@/types/logistics';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getInstallationStatus, parseClientDate, isStatusPlanned } from '@/lib/business-logic';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { mapSupabaseClient, isZoneMatch } from '@/lib/utils';
import { useSocketUpdate } from '@/providers/SocketProvider';

export function ClientsEnCoursView() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedZone, setSelectedZone] = useState<string>('FR'); // ZONE FILTER

    const fetchClients = useCallback(async () => {
        try {
            // Direct Supabase call (Serverless compatible)
            const { data, error } = await supabase.from('clients').select('*');
            if (error) throw error;

            if (Array.isArray(data)) {
                // Use shared mapper
                console.log("Supabase Clients:", data.length);
                const mapped = data.map(mapSupabaseClient);
                setClients(mapped as any);
            }
        } catch (error) {
            console.error("Erreur chargement clients:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    // Listen for realtime updates
    useSocketUpdate('clients', fetchClients);

    // Clients "en cours" = ceux qui ont le statut EN_COURS ou EN COURS
    // (planifiés mais pas encore livrés/terminés)
    const clientsEnCours = clients.filter((c) => {
        const client = c as any;
        const rawStatut = (client.statut_client || client.statut || '');
        const statut = rawStatut.toUpperCase();

        const zoneMatch = isZoneMatch(client.zone_pays, selectedZone);

        if (!zoneMatch) {
            // console.log(`Skipping ${client.nom} (Zone mismatch: ${zone} != ${selectedZone})`);
            return false;
        }

        // EXCLUSION : Si terminé, on ne montre pas ici (c'est pour l'historique ou Installations Terminées)
        // Normaliser pour gérer les variantes d'accents
        const normalized = statut.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (statut.includes('TERMIN') || normalized.includes('TERMIN') || statut === 'CLOS' || statut.includes('ARCHIV')) {
            return false;
        }

        // Afficher uniquement les clients avec statut EN COURS (ou similaire)
        const isEnCours = isStatusPlanned(statut) || isStatusPlanned(client.logistique || '');

        const hasDate = Boolean(
            (client.dateLivraison && client.dateLivraison !== 'null' && client.dateLivraison.trim() !== '') ||
            (client.date_livraison_prevue && client.date_livraison_prevue !== 'null' && client.date_livraison_prevue.length > 5) ||
            (client.dateDebutTravaux && client.dateDebutTravaux !== 'null' && client.dateDebutTravaux.trim() !== '')
        );

        // LOGIQUE : 
        // 1. Si le statut est explicitement "À PLANIFIER" ou "NON PLANIFIÉ" ou STADE 1 ("🔴")
        // MAIS qu'on n'a PAS de date, alors on ne montre pas.
        // Si on a une date, c'est que c'est planifié (le statut texte n'est peut-être pas encore à jour), donc on montre !
        const isExplicitlyToPlanText =
            statut.includes('À PLANIFIER') ||
            statut.includes('A PLANIFIER') ||
            statut.includes('NON PLANIFI') ||
            statut.startsWith('🔴') ||
            statut.startsWith('1.');

        if (isExplicitlyToPlanText && !hasDate) return false;

        // 2. STRICT: Pour être "En cours", il FAUT une date !
        // Sauf si le statut est explicitement "En cours" (au sens chantier démarré)
        // Si pas de date, on dégage, même si le statut dit "Planifié"
        if (!hasDate && !statut.includes('EN COURS') && !statut.includes('EN_COURS') && !statut.includes('CHANTIER')) {
            return false;
        }

        const passed = hasDate || isEnCours;

        if (!passed) {
            // console.log(`[Filtered Out] ${client.nom}: Zone=${zone}, Statut=${rawStatut}, hasDate=${hasDate}`);
        }

        return passed;
    });



    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
            </div>
        );
    }


    // Fonction pour déterminer l'étape actuelle
    const getClientStage = (client: Client) => {
        const c = client as any;
        const statut = (c.statut || '').toUpperCase();
        const statutLiv = (c.statut_livraison || '').toUpperCase();

        const isDelivered =
            statut === 'LIVRÉ' ||
            statut === 'LIVRÉE' ||
            statutLiv === 'LIVRÉE' ||
            client.logistique?.toUpperCase().includes('LIVR');

        const status = getInstallationStatus(client);

        if (!isDelivered) {
            // Si pas livré, on est soit à l'étape 1 (planifiée) soit en cours de livraison (1.5)
            return 1;
        }

        switch (status) {
            case 'TERMINEE': return 4;
            case 'EN_COURS': return 3.5;
            case 'PLANIFIEE': return 3;
            case 'LIVRE': return 2;
            default: return 2;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Clients en cours</h2>
                    <p className="text-muted-foreground">Suivi des livraisons et installations</p>

                    {/* ZONE SELECTOR */}
                    <div className="flex gap-1 overflow-x-auto pt-2">
                        {[
                            { id: 'FR', label: '🇫🇷 France' },
                            { id: 'GP', label: '🏖️ Guadeloupe' },
                            { id: 'MQ', label: '🍌 Martinique' },
                            { id: 'CORSE', label: '🐂 Corse' },
                        ].map((zone) => (
                            <div
                                key={zone.id}
                                className={cn(
                                    "px-3 py-1 rounded text-xs font-medium cursor-pointer transition-all border",
                                    selectedZone === zone.id
                                        ? "bg-primary text-primary-foreground border-primary shadow-glow"
                                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                                )}
                                onClick={() => setSelectedZone(zone.id)}
                            >
                                {zone.label}
                            </div>
                        ))}
                    </div>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2 font-mono">
                    {clientsEnCours.length} client{clientsEnCours.length > 1 ? 's' : ''}
                </Badge>
            </div>

            {/* Clients List */}
            {clientsEnCours.length === 0 ? (
                <Card className="p-12 text-center">
                    <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Aucun client en cours</h3>
                    <p className="text-muted-foreground">
                        Les clients dont la livraison a été planifiée apparaîtront ici
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {clientsEnCours.map((client) => {
                        const c = client as any;
                        const currentStage = getClientStage(client);
                        const isStep2Done =
                            (c.statut === 'LIVRÉ' || c.statut === 'LIVRÉE' || c.statut === 'TERMINÉ') ||
                            (c.statut_client === 'LIVRÉ' || c.statut_client === 'LIVRÉE' || c.statut_client === 'TERMINÉ') ||
                            (c.statut_livraison === 'LIVRÉ' || c.statut_livraison === 'LIVRÉE') ||
                            (c.logistique === 'LIVRÉ' || c.logistique === 'LIVRÉE');

                        // Détection "En cours de livraison" (Aujourd'hui et pas encore livré)
                        let isDeliveryToday = false;
                        const dLiv = parseClientDate(client.dateLivraison);
                        if (dLiv) {
                            const today = new Date();
                            isDeliveryToday = dLiv.getDate() === today.getDate() &&
                                dLiv.getMonth() === today.getMonth() &&
                                dLiv.getFullYear() === today.getFullYear();
                        }
                        const isDeliveringNow = !isStep2Done && isDeliveryToday;

                        // Détection "Installation en cours" (Aujourd'hui et statut planifié OU statut explicitement en cours)
                        let isInstallationToday = false;
                        const dInstall = parseClientDate(client.dateDebutTravaux);
                        if (dInstall) {
                            const now = new Date();
                            isInstallationToday = dInstall.getDate() === now.getDate() &&
                                dInstall.getMonth() === now.getMonth() &&
                                dInstall.getFullYear() === now.getFullYear();
                        }

                        // Installation active si: Statut EN_COURS ou (PLANIFIEE + Date = Aujourd'hui)
                        // Et pas encore terminée
                        const isInstallationDone = currentStage >= 4;
                        const isInstallingNow = !isInstallationDone && (
                            (currentStage === 3.5) ||
                            (currentStage === 3 && isInstallationToday)
                        );

                        return (
                            <Card key={client.id} className="glass-card p-6 hover:shadow-glow">
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-semibold text-lg text-primary">
                                                {(client.prenom || '?')[0]}{(client.nom || '?')[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg text-foreground">
                                                    {client.prenom} {client.nom}
                                                </h3>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>{client.ville}</span>
                                                    <span>•</span>
                                                    <Package className="h-3 w-3" />
                                                    <span>{client.nombreLED} LED</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Steps */}
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            {/* Étape 1: Livraison planifiée / En cours */}
                                            <div className="flex flex-col items-center flex-1">
                                                <div className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                                                    isStep2Done
                                                        ? "bg-green-600 border-green-600 text-white"
                                                        : (isDeliveringNow ? "bg-orange-500 border-orange-500 text-white animate-pulse" : "bg-blue-600 border-blue-600 text-white")
                                                )}>
                                                    {isStep2Done ? <CheckCircle2 className="h-5 w-5" /> : (isDeliveringNow ? <Truck className="h-5 w-5" /> : <Calendar className="h-5 w-5" />)}
                                                </div>
                                                <div className="flex flex-col items-center mt-2">
                                                    <span className={cn(
                                                        "text-xs text-center font-medium",
                                                        isStep2Done ? "text-green-600" : (isDeliveringNow ? "text-orange-600 font-bold" : "text-blue-600")
                                                    )}>
                                                        {isStep2Done ? "Livraison faite" : (isDeliveringNow ? "Livraison\nen cours" : "Livraison\nplanifiée")}
                                                    </span>
                                                    {isStep2Done ? (
                                                        (client.signatureLivraison || client.heureLivraison) && (
                                                            <span className="text-[10px] text-green-600 mt-1 font-bold bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                ✓ {((str) => {
                                                                    if (str.includes('/') || str.includes('-')) {
                                                                        const d = parseClientDate(str);
                                                                        return d ? format(d, "dd/MM à HH:mm", { locale: fr }) : str;
                                                                    }
                                                                    return str;
                                                                })(client.signatureLivraison || client.heureLivraison || '')}
                                                            </span>
                                                        )
                                                    ) : (
                                                        client.dateLivraison && dLiv && (
                                                            <span className="text-[10px] text-muted-foreground mt-1 font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                                                                {format(dLiv, 'dd/MM/yyyy', { locale: fr })}
                                                                {client.heureLivraison ? ` ${client.heureLivraison}` : ''}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Connector 1 */}
                                            <div className={cn(
                                                "h-0.5 flex-1 -mt-6",
                                                isStep2Done ? "bg-green-600" : "bg-white/10"
                                            )} />

                                            {/* Étape 2: Matériel livré */}
                                            <div className="flex flex-col items-center flex-1">
                                                <div className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                                                    isStep2Done
                                                        ? "bg-green-600 border-green-600 text-white"
                                                        : "bg-white/5 border-white/10 text-white/30"
                                                )}>
                                                    {isStep2Done ? <CheckCircle2 className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                                                </div>
                                                <div className="flex flex-col items-center mt-2">
                                                    <span className={cn(
                                                        "text-xs text-center font-medium",
                                                        isStep2Done ? "text-green-600" : "text-white/40"
                                                    )}>
                                                        Matériel<br />livré
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Connector 2 */}
                                            <div className={cn(
                                                "h-0.5 flex-1 -mt-6",
                                                (isStep2Done && (currentStage >= 3 || isInstallingNow)) ? "bg-orange-600" : "bg-white/10"
                                            )} />

                                            {/* Étape 3: Installation planifiée / En cours */}
                                            <div className="flex flex-col items-center flex-1">
                                                <div className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                                                    currentStage >= 4
                                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                                        : (isInstallingNow ? "bg-orange-500 border-orange-500 text-white animate-pulse" : (isStep2Done && currentStage >= 3 ? "bg-orange-600 border-orange-600 text-white" : "bg-white/5 border-white/10 text-white/30"))
                                                )}>
                                                    {currentStage >= 4 ? <CheckCircle2 className="h-5 w-5" /> : (isInstallingNow ? <Wrench className="h-5 w-5" /> : <Clock className="h-5 w-5" />)}
                                                </div>
                                                <div className="flex flex-col items-center mt-2">
                                                    <span className={cn(
                                                        "text-xs text-center font-medium",
                                                        currentStage >= 4 ? "text-emerald-600" : (isInstallingNow ? "text-orange-500 font-bold" : (isStep2Done && currentStage >= 3 ? "text-orange-600" : "text-white/40"))
                                                    )}>
                                                        {currentStage >= 4 ? "Installé" : (isInstallingNow ? "Installation\nen cours" : "Installation\nplanifiée")}
                                                    </span>
                                                    {(isStep2Done && client.dateDebutTravaux) && (
                                                        <div className="flex flex-col items-center gap-1">
                                                            {((d) => d ? (
                                                                <>
                                                                    <span className="text-[10px] text-muted-foreground mt-1 font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                                                                        Début: {format(d, 'dd/MM/yyyy', { locale: fr })}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                                        {format(d, 'HH:mm', { locale: fr })}
                                                                    </span>
                                                                </>
                                                            ) : null)(parseClientDate(client.dateDebutTravaux))}

                                                            {/* Date de fin estimée (si installation en cours) */}
                                                            {isInstallingNow && (c.date_install_fin_reelle || client.dateFinTravaux) && (
                                                                <>
                                                                    {((d) => d ? (
                                                                        <>
                                                                            <span className="text-[10px] text-orange-600 mt-1 font-bold bg-orange-50 px-2 py-0.5 rounded-full">
                                                                                Fin estimée: {format(d, 'dd/MM/yyyy', { locale: fr })}
                                                                            </span>
                                                                            <span className="text-[10px] text-orange-600 font-bold">
                                                                                {format(d, 'HH:mm', { locale: fr })}
                                                                            </span>
                                                                        </>
                                                                    ) : null)(parseClientDate(c.date_install_fin_reelle || client.dateFinTravaux))}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Connector 3 */}
                                            <div className={cn(
                                                "h-0.5 flex-1 -mt-6",
                                                currentStage >= 4 ? "bg-emerald-600" : "bg-white/10"
                                            )} />

                                            {/* Étape 4: Installé */}
                                            <div className="flex flex-col items-center flex-1">
                                                <div className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                                                    currentStage >= 4
                                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                                        : "bg-white/5 border-white/10 text-white/30"
                                                )}>
                                                    {currentStage >= 4 ? <CheckCircle2 className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                                                </div>
                                                <div className="flex flex-col items-center mt-2">
                                                    <span className={cn(
                                                        "text-xs text-center font-medium",
                                                        currentStage >= 4 ? "text-emerald-600" : "text-white/40"
                                                    )}>
                                                        Terminé
                                                    </span>
                                                    {client.dateFinTravaux && (
                                                        <span className="text-[10px] text-muted-foreground mt-1 font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                                                            {((d) => d ? format(d, 'dd/MM/yyyy HH:mm', { locale: fr }) : null)(parseClientDate(client.dateFinTravaux))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                        <div className="text-sm text-muted-foreground">
                                            <span className="font-medium">{client.adresse}</span>
                                            <span className="mx-2">•</span>
                                            <span>{client.codePostal} {client.ville}</span>
                                        </div>
                                        {client.dateLivraison && dLiv && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                <span>{format(dLiv, 'dd/MM/yyyy', { locale: fr })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
