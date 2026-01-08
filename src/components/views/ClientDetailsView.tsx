import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Client } from "@/types/logistics";
import { CheckCircle2, Truck, Wrench, FileSignature, Clock, User, MapPin, Phone, Mail, CalendarDays, ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClientDetailsViewProps {
    client: Client | null;
    onBack: () => void;
}

// Helper to reliably format date/time
const formatDateTime = (dateString?: string) => {
    if (!dateString) return null;

    // 1. Check for standard ISO format first
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

    // 2. Custom French format handling (Google Sheets)
    const regex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2})[:h](\d{2}))?/;
    const match = dateString.match(regex);

    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        let year = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const min = match[5] ? parseInt(match[5], 10) : 0;

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

    // 3. Fallback
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

    return dateString;
};

export function ClientDetailsView({ client, onBack }: ClientDetailsViewProps) {
    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                <p>Aucun client sélectionné.</p>
                <Button onClick={onBack} variant="link">Retour</Button>
            </div>
        );
    }

    // Cascading completion logic
    const isTerminated = !!client.dateFinTravaux || (client.statut && client.statut.toUpperCase().includes('TERM')) || (client.logistique && client.logistique.toUpperCase().includes('TERM'));
    const isStarted = !!client.dateDebutTravaux || isTerminated || (client.installStatut && client.installStatut.toUpperCase().includes('EN COURS'));
    const isDelivered = !!client.dateLivraison || isStarted || ((client as any).statut_livraison && (client as any).statut_livraison.toUpperCase().includes('LIVR')) || (client.statut && client.statut.toUpperCase().includes('LIVR'));
    const isSigned = !!client.dateSignature || isDelivered || ((client as any).created_at); // Fallback to created_at existence

    const steps = [
        {
            label: 'Signature du Devis',
            date: client.dateSignature,
            icon: FileSignature,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border border-blue-500/20',
            description: 'Validation commerciale du projet',
            completed: isSigned
        },
        {
            label: 'Livraison du Matériel',
            date: client.dateLivraison,
            icon: Truck,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border border-amber-500/20',
            description: 'Livraison sur site effectuée',
            completed: isDelivered
        },
        {
            label: 'Début des Travaux',
            date: client.dateDebutTravaux,
            icon: Wrench,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border border-purple-500/20',
            description: 'Démarrage de l\'installation par l\'équipe technique',
            completed: isStarted
        },
        {
            label: 'Fin de Chantier',
            date: client.dateFinTravaux,
            icon: CheckCircle2,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border border-emerald-500/20',
            description: 'Réception et validation finale. Le dossier est clos.',
            completed: isTerminated
        }
    ];

    const getStatusColor = () => {
        const s = (client.statut || '').toUpperCase();
        const l = (client.logistique || '').toUpperCase();
        if (l.includes('TERM') || s.includes('TERM')) return 'bg-emerald-500 text-white';
        if (l.includes('COURS') || s.includes('COURS')) return 'bg-amber-500 text-white';
        return 'bg-secondary text-secondary-foreground';
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10 max-w-5xl mx-auto">
            {/* Header / Navigation */}
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la liste
                </Button>
            </div>

            {/* Main Client Card */}
            <div className="glass-card overflow-hidden shadow-premium">
                <div className="p-6 md:p-8 border-b border-white/10 bg-white/5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <User className="h-8 w-8 text-primary" />
                                {client.prenom} {client.nom}
                            </h1>
                            <div className="flex items-center gap-2 text-muted-foreground text-lg">
                                <MapPin className="h-5 w-5" />
                                {client.adresse}, {client.codePostal} {client.ville}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" className="hidden md:flex border-white/10 hover:bg-white/10 hover:text-white">
                                <Download className="h-4 w-4 mr-2" />
                                Exporter PDF
                            </Button>
                            <Badge className={cn("px-4 py-1.5 text-base font-medium", getStatusColor())}>
                                {client.statut || 'Dossier Client'}
                            </Badge>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                <CalendarDays className="h-6 w-6 text-blue-400" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Dossier créé le</p>
                                <p className="text-base font-semibold whitespace-normal text-white">{formatDateTime(client.dateSignature) || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Phone className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Contact</p>
                                <p className="text-base font-semibold whitespace-normal text-white">{client.telephone || 'Non renseigné'}</p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                <Mail className="h-6 w-6 text-amber-400" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Email</p>
                                <p className="text-base font-semibold whitespace-normal text-white">{client.email || 'Non renseigné'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Section */}
                <div className="p-6 md:p-8 bg-transparent">
                    <h3 className="text-xl font-semibold mb-8 flex items-center gap-2">
                        <span className="bg-primary/10 p-2 rounded-lg text-primary"><Clock className="h-5 w-5" /></span>
                        Chronologie Détaillée du Chantier
                    </h3>

                    <div className="relative border-l-2 border-white/10 ml-4 md:ml-6 pb-2 space-y-12">
                        {steps.map((step, index) => {
                            const formattedDate = formatDateTime(step.date);

                            return (
                                <div key={index} className="relative pl-8 md:pl-12 group">
                                    {/* Timeline Dot */}
                                    <div className={cn(
                                        "absolute -left-[11px] top-0 h-5 w-5 rounded-full border-4 transition-all z-10",
                                        step.completed
                                            ? "bg-white border-primary shadow-[0_0_0_4px_rgba(var(--primary),0.2)]"
                                            : "bg-muted border-muted-foreground/30"
                                    )} />

                                    <div className={cn(
                                        "flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 rounded-2xl border transition-all duration-200",
                                        step.completed
                                            ? "bg-white/5 border-primary/30 shadow-glow"
                                            : "bg-white/5 border-white/5 opacity-40 grayscale"
                                    )}>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={cn("p-2.5 rounded-xl shadow-sm", step.bg)}>
                                                    <step.icon className={cn("h-6 w-6", step.color)} />
                                                </div>
                                                <h4 className="font-bold text-xl">{step.label}</h4>
                                                {step.completed && (
                                                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 ml-auto md:ml-3">
                                                        Terminé
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-base text-muted-foreground leading-relaxed pl-[3.75rem]">
                                                {step.description}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right pl-[3.75rem] md:pl-0">
                                            {formattedDate ? (
                                                <div className="inline-flex flex-col items-end">
                                                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1.5">Date validée</span>
                                                    <span className="text-base font-medium bg-primary/10 px-4 py-2 rounded-lg border border-primary/30 text-primary">
                                                        {formattedDate}
                                                    </span>
                                                </div>
                                            ) : (
                                                step.completed ? (
                                                    <div className="inline-flex flex-col items-end">
                                                        <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider mb-1.5 opacity-90">Statut Validé</span>
                                                        <span className="text-sm text-emerald-400 italic bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                                            Date non renseignée
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex flex-col items-end">
                                                        <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1.5 opacity-50">Statut</span>
                                                        <span className="text-sm text-muted-foreground italic bg-muted/20 px-3 py-1.5 rounded-full">
                                                            En attente...
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
