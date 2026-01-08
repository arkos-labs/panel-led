import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Client } from "@/types/logistics";
import { CheckCircle2, Truck, Wrench, FileSignature, Clock, User, MapPin, Phone, Mail, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ClientHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
}

// Helper to reliably format date/time
const formatDateTime = (dateString?: string) => {
    if (!dateString) return null;

    // 1. Check for standard ISO format (YYYY-MM-DD...) first to avoid mis-parsing
    // This prevents "2025-12-30" from being parsed by the regex as Day=20, Month=25 (invalid) or similar weirdness
    if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: dateString.includes('T') || dateString.includes(':') ? '2-digit' : undefined,
                minute: dateString.includes('T') || dateString.includes(':') ? '2-digit' : undefined,
            }).replace(':', 'h');
        }
    }

    // 2. Custom French format handling "DD/MM/YYYY HH:mm" or similar from Google Sheets
    // Regex for DD/MM/YYYY or DD/MM/YY optionally followed by time
    const regex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2})[:h](\d{2}))?/;
    const match = dateString.match(regex);

    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Months are 0-indexed
        let year = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const min = match[5] ? parseInt(match[5], 10) : 0;

        // Handle short years (e.g., 25 -> 2025, 30 -> 2030)
        // If year is 30, it becomes 2030. If user meant 2030, this is correct.
        if (year < 100) year += 2000;

        const date = new Date(year, month, day, hour, min);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: hour > 0 || min > 0 ? '2-digit' : undefined,
                minute: hour > 0 || min > 0 ? '2-digit' : undefined,
            }).replace(':', 'h');
        }
    }

    // 3. Fallback for any other parses (e.g. "Dec 25 2025")
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(':', 'h');
    }

    return dateString; // Fallback to raw string if parsing fails
};

export function ClientHistoryModal({ isOpen, onClose, client }: ClientHistoryModalProps) {
    if (!client) return null;

    const steps = [
        {
            label: 'Signature du Devis',
            date: client.dateSignature,
            icon: FileSignature,
            color: 'text-blue-600',
            bg: 'bg-blue-100',
            description: 'Validation commerciale du projet',
            completed: !!client.dateSignature
        },
        {
            label: 'Livraison du Matériel',
            date: client.dateLivraison,
            icon: Truck,
            color: 'text-amber-600',
            bg: 'bg-amber-100',
            description: 'Livraison sur site effectuée',
            completed: !!client.dateLivraison
        },
        {
            label: 'Début des Travaux',
            date: client.dateDebutTravaux,
            icon: Wrench,
            color: 'text-purple-600',
            bg: 'bg-purple-100',
            description: 'Démarrage de l\'installation par l\'équipe technique',
            completed: !!client.dateDebutTravaux
        },
        {
            label: 'Fin de Chantier',
            date: client.dateFinTravaux,
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
            description: 'Réception et validation finale',
            completed: !!client.dateFinTravaux
        }
    ];

    // Determine overall status color
    const getStatusColor = () => {
        if (client.logistique?.includes('TERMINÉ') || client.statut === 'TERMINÉ') return 'bg-emerald-500 text-white';
        if (client.logistique?.includes('COURS')) return 'bg-amber-500 text-white';
        return 'bg-secondary text-secondary-foreground';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
                {/* Visual Header */}
                <div className="bg-muted/30 p-6 border-b border-border">
                    <DialogHeader className="mb-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <User className="h-6 w-6 text-primary" />
                                    {client.prenom} {client.nom}
                                </DialogTitle>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    {client.adresse}, {client.codePostal} {client.ville}
                                </div>
                            </div>
                            <Badge className={cn("px-3 py-1 text-sm font-medium hover:bg-opacity-90 transition-colors", getStatusColor())}>
                                {client.statut || 'Dossier Client'}
                            </Badge>
                        </div>
                    </DialogHeader>

                    {/* Quick Stats / Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="bg-background rounded-lg p-3 border shadow-sm flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <CalendarDays className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-medium uppercase">Dossier créé le</p>
                                <p className="text-sm font-semibold whitespace-normal md:whitespace-nowrap">{formatDateTime(client.dateSignature) || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border shadow-sm flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                <Phone className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-medium uppercase">Contact</p>
                                <p className="text-sm font-semibold whitespace-normal md:whitespace-nowrap">{client.telephone || 'Non renseigné'}</p>
                            </div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border shadow-sm flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                                <Mail className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-medium uppercase">Email</p>
                                <p className="text-sm font-semibold whitespace-normal md:whitespace-nowrap" title={client.email}>{client.email || 'Non renseigné'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <span className="bg-primary/10 p-1.5 rounded text-primary"><Clock className="h-5 w-5" /></span>
                        Chronologie du Chantier
                    </h3>

                    <div className="relative border-l-2 border-muted/50 ml-4 pb-10 space-y-10">
                        {steps.map((step, index) => {
                            const formattedDate = formatDateTime(step.date);
                            const isLast = index === steps.length - 1;

                            return (
                                <div key={index} className="relative pl-8 group">
                                    {/* Timeline Dot */}
                                    <div className={cn(
                                        "absolute -left-[11px] top-0 h-5 w-5 rounded-full border-4 transition-all z-10",
                                        step.completed
                                            ? "bg-white border-primary shadow-[0_0_0_4px_rgba(var(--primary),0.2)]"
                                            : "bg-muted border-muted-foreground/30"
                                    )} />

                                    <div className={cn(
                                        "flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 rounded-xl border transition-all duration-200",
                                        step.completed
                                            ? "bg-card border-border shadow-sm hover:shadow-md hover:border-primary/20"
                                            : "bg-muted/10 border-transparent opacity-60 grayscale"
                                    )}>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={cn("p-2 rounded-lg shadow-sm", step.bg)}>
                                                    <step.icon className={cn("h-5 w-5", step.color)} />
                                                </div>
                                                <h4 className="font-bold text-lg">{step.label}</h4>
                                                {step.completed && (
                                                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 ml-auto sm:ml-2">
                                                        Terminé
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed pl-[3.25rem]">
                                                {step.description}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right pl-[3.25rem] sm:pl-0">
                                            {formattedDate ? (
                                                <div className="inline-flex flex-col items-end">
                                                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Date validée</span>
                                                    <span className="text-sm font-medium bg-secondary/50 px-3 py-1.5 rounded-md border border-secondary">
                                                        {formattedDate}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic bg-muted/20 px-3 py-1 rounded-full">
                                                    En attente...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-muted/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                    >
                        Fermer le dossier
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
