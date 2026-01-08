import { Truck, Calendar, MapPin, ChevronRight, Package } from 'lucide-react';
import { Client } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DeliveriesInProgressProps {
    clients: Client[];
    onClientClick?: (client: Client) => void;
}

export function DeliveriesInProgress({ clients, onClientClick }: DeliveriesInProgressProps) {
    // Filter clients with EN_COURS or LIVRÉ status
    // Enhanced filter: Include LIVRÉ only if it's relevant (e.g. today or recently).
    // For now, we trust the parent to pass relevant list or we filter broadly.
    // Let's assume we want valid active deliveries + today's completed ones.
    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) =>
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    const deliveriesInProgress = clients.filter((c) => {
        // 1. Check strict Status En Cours
        if (c.statut === 'EN_COURS' || (c.logistique && c.logistique.includes('EN COURS'))) return true;

        // 2. Check Date Match (Today) for ANY status (Planifié, Livré, En cours)
        if (c.dateLivraison) {
            const d = new Date(c.dateLivraison);
            if (isSameDay(d, today)) return true;
        }

        return false;
    });

    const completedCount = deliveriesInProgress.filter(c => c.statut === 'LIVRÉ' || (c.logistique && c.logistique.includes('LIVRÉ'))).length;
    const totalCount = deliveriesInProgress.length;

    return (
        <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/20 p-2">
                            <Truck className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Livraisons Matériel</h3>
                            <p className="text-sm text-muted-foreground">Acheminement des LED</p>
                        </div>
                    </div>
                    <Badge variant="secondary" className="font-mono bg-blue-500/10 text-blue-600">
                        {completedCount}/{totalCount}
                    </Badge>
                </div>
            </div>

            <div className="divide-y divide-border">
                {deliveriesInProgress.length === 0 ? (
                    <div className="p-8 text-center">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Aucune livraison aujourd'hui</p>
                    </div>
                ) : (
                    deliveriesInProgress.map((client) => {
                        const isDelivered = client.statut === 'LIVRÉ' || (client.logistique && client.logistique.includes('LIVRÉ'));

                        let isToday = false;
                        if (client.dateLivraison) {
                            const d = new Date(client.dateLivraison);
                            const today = new Date();
                            isToday = d.getDate() === today.getDate() &&
                                d.getMonth() === today.getMonth() &&
                                d.getFullYear() === today.getFullYear();
                        }

                        let badgeLabel = "0/1 Planifié";
                        let badgeColor = "bg-blue-600"; // Default Planifié

                        if (isDelivered) {
                            badgeLabel = "1/1 Livré";
                            badgeColor = "bg-green-600 shadow-sm";
                        } else if (isToday) {
                            // If it's today and not delivered, it's either "En cours" or just "Planifié" waiting to start
                            // If user wants 'En cours' for everything today:
                            badgeLabel = "0/1 En cours";
                            badgeColor = "bg-orange-500 hover:bg-orange-600 animate-pulse";
                        }

                        return (
                            <div
                                key={client.id}
                                className={cn(
                                    "p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                                    isDelivered && "bg-green-50/50",
                                    isToday && !isDelivered && "bg-orange-50/30"
                                )}
                                onClick={() => onClientClick?.(client)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium text-foreground">
                                                {client.prenom} {client.nom}
                                            </h4>
                                            <Badge
                                                className={cn(
                                                    "text-xs text-white border-0",
                                                    badgeColor
                                                )}
                                            >
                                                {badgeLabel}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5" />
                                                <span>{client.ville}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Package className="h-3.5 w-3.5" />
                                                <span>{client.nombreLED} LED ({client.marqueLED})</span>
                                            </div>
                                            {client.dateLivraison && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{new Date(client.dateLivraison).toLocaleDateString('fr-FR')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClientClick?.(client);
                                        }}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
