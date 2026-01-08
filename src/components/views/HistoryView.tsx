import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { Clock, CheckCircle2 } from 'lucide-react';

import { Client } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, mapSupabaseClient, isZoneMatch } from '@/lib/utils';
import { getInstallationStatus } from '@/lib/business-logic';

function formatSafeDate(dateValue: string | null | undefined): string {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');

        let displayYear = year.toString();
        if (year > 2100 && displayYear.startsWith('2020')) {
            displayYear = displayYear.substring(2);
        }

        return `${day}/${month}/${displayYear} ${hours} h ${minutes}`;
    }

    const match = dateValue.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (match) {
        let [_, day, month, year] = match;
        if (year.length === 2) year = `20${year}`;
        const timeMatch = dateValue.match(/(\d{2})[:h](\d{2})/);
        const timeStr = timeMatch ? ` ${timeMatch[1]} h ${timeMatch[2]}` : ' 00 h 00';
        return `${day}/${month}/${year}${timeStr}`;
    }

    return dateValue;
}

// Add props interface
interface HistoryViewProps {
    onViewDetails?: (client: Client) => void;
}

export function HistoryView({ onViewDetails }: HistoryViewProps) {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedZone, setSelectedZone] = useState<string>('FR'); // ZONE FILTER

    const fetchClients = async () => {
        try {
            const API_BASE = `http://${window.location.hostname}:3001`;
            const response = await fetch(`${API_BASE}/api/clients`);
            const data = await response.json();
            if (Array.isArray(data)) {
                // Map data to ensure consistent structure and zone inference
                setClients(data.map(mapSupabaseClient));
            }
        } catch (error) {
            console.error("Erreur chargement clients:", error);
            setClients([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const clientsFinished = clients.filter((c) => {
        if (!isZoneMatch(c.zone_pays, selectedZone)) return false;
        return getInstallationStatus(c) === 'TERMINEE';
    });

    if (loading) {
        return <div className="p-10 text-center">Chargement de l'historique...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div>
                <div className="flex flex-col gap-2 mb-4">
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-success" />
                        Clients Terminés
                    </h2>
                    <p className="text-muted-foreground">
                        Liste des clients terminés (plus d'actions requises) ({clientsFinished.length})
                    </p>

                    {/* ZONE SELECTOR */}
                    <div className="flex gap-1 overflow-x-auto pt-2">
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
                                className={cn("whitespace-nowrap transition-all h-7 text-xs", selectedZone === zone.id ? "bg-primary text-primary-foreground shadow-glow" : "bg-white text-muted-foreground hover:bg-gray-50 border-gray-200")}
                                onClick={() => setSelectedZone(zone.id)}
                            >
                                {zone.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {clientsFinished.map((client) => (
                    <div key={client.id} className="glass-card p-5 hover:shadow-glow transition-all">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="font-bold text-lg text-foreground bg-success/10 px-2 rounded">{client.prenom} {client.nom}</h3>
                            <Badge className="bg-success/20 text-success">Terminé</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{client.adresse}, {client.ville}</p>

                        <div className="flex items-center gap-2 text-sm text-success bg-success/10 p-2 rounded-md mb-4 border border-success/20">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>
                                Fini le : {formatSafeDate((client as any).date_install_fin_reelle || client.dateFinTravaux)}
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full border-primary/20 text-primary hover:bg-primary/5"
                            onClick={() => {
                                if (onViewDetails) {
                                    onViewDetails(client);
                                }
                            }}
                        >
                            <Clock className="h-4 w-4 mr-2" />
                            Voir dossier complet
                        </Button>
                    </div>
                ))}
                {clientsFinished.length === 0 && <div className="text-center p-8 text-muted-foreground bg-secondary/10 rounded-lg">Aucun client terminé pour le moment.</div>}
            </div>
        </div >
    );
}
