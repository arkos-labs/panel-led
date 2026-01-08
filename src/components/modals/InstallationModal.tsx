import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Client } from '@/types/logistics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, User, Clock, Sparkles, Loader2, MapPin, Package, Check, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartScheduler } from '../scheduler/SmartScheduler';
import { OptimizerService, SlotSuggestion } from '@/services/optimizer';
import { parseSafeDate } from '@/lib/utils';

interface InstallationModalProps {
    client: Client | null;
    allClients?: Client[];
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { date: Date; poseurId: string }) => void;
}

export function InstallationModal({ client, allClients, isOpen, onClose, onConfirm }: InstallationModalProps) {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState("08:00");
    const [poseurId, setPoseurId] = useState('');
    const [isAutoSelected, setIsAutoSelected] = useState(false);
    const [equipes, setEquipes] = useState<any[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchResources = async () => {
            try {
                const res = await fetch(`/api/resources`);
                const data = await res.json();
                // Filtrer pour ne garder que les 'POSEUR'
                const poseurs = data.filter((r: any) => r.type === 'POSEUR').map((c: any) => ({
                    id: c.id,
                    nom: c.nom,
                    capacite: c.capacite,
                    secteurs: [c.secteur]
                }));
                setEquipes(poseurs);
                if (poseurs.length > 0 && !poseurId) {
                    setPoseurId(poseurs[0].id);
                }
            } catch (e) {
                console.error("Erreur chargement équipes", e);
            }
        };
        fetchResources();
    }, [isOpen]);

    // Auto-sélection de l'équipe par secteur (Ville)
    useEffect(() => {
        if (!client || !date || !allClients) return;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Rechercher si un client a déjà un chantier ce jour-là dans la même ville
        const existingInSector = allClients.find(c => {
            if (!c.dateDebutTravaux || !c.codePostal) return false;
            const parsedDebut = parseSafeDate(c.dateDebutTravaux);
            if (!parsedDebut) return false;
            const cDate = format(parsedDebut, 'yyyy-MM-dd');
            const getDept = (cp: string) => cp.startsWith('97') ? cp.substring(0, 3) : cp.substring(0, 2);
            const cDept = getDept(c.codePostal || '');
            const targetDept = getDept(client.codePostal || '');
            return cDate === dateStr && cDept === targetDept;
        });

        if (existingInSector) {
            // Si un chantier existe déjà dans ce secteur, on assigne la même équipe par défaut
            // (Simulé ici par equipe-1 si trouvé)
            setPoseurId((existingInSector as any).poseurId || (equipes[0]?.id || ''));
            setIsAutoSelected(true);
        } else {
            setIsAutoSelected(false);
        }
    }, [date, client, allClients]);


    const handleConfirm = () => {
        if (date) {
            const [hours, minutes] = time.split(':').map(Number);
            const finalDate = new Date(date);
            finalDate.setHours(hours, minutes);
            onConfirm({ date: finalDate, poseurId });
        }
    };

    if (!client) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-6xl w-[95vw] h-[90vh] bg-slate-50 border-0 p-0 flex flex-col overflow-hidden">
                {/* HEADLINE */}
                <div className="bg-slate-900 px-6 py-5 shrink-0">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-col">
                            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                                Installation LED
                            </DialogTitle>
                            <p className="text-sm text-slate-400">
                                Dossier : <span className="text-white font-medium">{client.prenom} {client.nom}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                <MapPin className="h-4 w-4" />
                                {client.adresse}
                            </div>
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded text-white text-sm">
                                <Package className="h-4 w-4" />
                                <span className="font-bold text-amber-400">{client.nombreLED}</span> LEDs
                            </div>
                        </div>
                    </div>

                    {/* Timeline complète : 4 étapes */}
                    <div className="grid grid-cols-4 gap-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        {/* 1. Livraison planifiée */}
                        <div className={`flex flex-col gap-1 rounded px-2 py-2 border ${(client as any).date_livraison_reelle
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-blue-500/10 border-blue-500/30'
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${(client as any).date_livraison_reelle ? 'bg-green-500' : 'bg-blue-500'
                                    }`}>
                                    {(client as any).date_livraison_reelle ? (
                                        <Check className="h-4 w-4 text-white" />
                                    ) : (
                                        <CalendarIcon className="h-3 w-3 text-white" />
                                    )}
                                </div>
                                <div className={`text-[10px] font-medium ${(client as any).date_livraison_reelle ? 'text-green-300' : 'text-blue-300'
                                    }`}>
                                    Livraison planifiée
                                </div>
                            </div>
                            <div className="text-xs text-white font-bold ml-7">
                                {(() => {
                                    const parsed = parseSafeDate(client.dateLivraison);
                                    return parsed ? format(parsed, 'dd/MM/yy', { locale: fr }) : '-';
                                })()}
                            </div>
                        </div>

                        {/* 2. Livraison faite */}
                        <div className={`flex flex-col gap-1 rounded px-2 py-2 border ${(client as any).date_livraison_reelle
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-slate-700/30 border-slate-600/50'
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${(client as any).date_livraison_reelle ? 'bg-green-500' : 'bg-slate-600'
                                    }`}>
                                    <Check className={`h-4 w-4 ${(client as any).date_livraison_reelle ? 'text-white' : 'text-slate-400'}`} />
                                </div>
                                <div className={`text-[10px] font-medium ${(client as any).date_livraison_reelle ? 'text-green-300' : 'text-slate-400'
                                    }`}>
                                    Livraison faite
                                </div>
                            </div>
                            <div className={`text-xs font-bold ml-7 ${(client as any).date_livraison_reelle ? 'text-white' : 'text-slate-500'
                                }`}>
                                {(() => {
                                    // Priorité 1 : Date réelle de livraison
                                    const parsed = parseSafeDate((client as any).date_livraison_reelle);
                                    if (parsed) {
                                        return (
                                            <>
                                                {format(parsed, 'dd/MM/yy', { locale: fr })}
                                                {(client as any).heure_livraison && (
                                                    <div className="text-[10px] text-green-300">{(client as any).heure_livraison}</div>
                                                )}
                                            </>
                                        );
                                    }

                                    // Priorité 2 : Date planifiée (si pas encore livrée)
                                    const parsedPlanned = parseSafeDate(client.dateLivraison);
                                    if (parsedPlanned) {
                                        return (
                                            <>
                                                <div className="text-slate-400">{format(parsedPlanned, 'dd/MM/yy', { locale: fr })}</div>
                                                <div className="text-[10px] text-slate-500">Prévue</div>
                                            </>
                                        );
                                    }

                                    return 'En attente';
                                })()}
                            </div>
                        </div>

                        {/* 3. Installation planifiée */}
                        <div className={`flex flex-col gap-1 rounded px-2 py-2 border ${(client as any).date_install_fin
                            ? 'bg-green-500/5 border-green-500/20'
                            : (date || (client as any).date_install_debut)
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : 'bg-slate-700/30 border-slate-600/50'
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${(client as any).date_install_fin
                                    ? 'bg-green-500'
                                    : (date || (client as any).date_install_debut)
                                        ? 'bg-orange-500'
                                        : 'bg-slate-600'
                                    }`}>
                                    {(client as any).date_install_fin ? (
                                        <Check className="h-4 w-4 text-white" />
                                    ) : (
                                        <CalendarIcon className={`h-3 w-3 ${(date || (client as any).date_install_debut) ? 'text-white' : 'text-slate-400'
                                            }`} />
                                    )}
                                </div>
                                <div className={`text-[10px] font-medium ${(client as any).date_install_fin
                                    ? 'text-green-300'
                                    : (date || (client as any).date_install_debut)
                                        ? 'text-orange-300'
                                        : 'text-slate-400'
                                    }`}>
                                    Installation planifiée
                                </div>
                            </div>
                            <div className={`text-xs font-bold ml-7 ${(client as any).date_install_fin || date || (client as any).date_install_debut
                                ? 'text-white'
                                : 'text-slate-500'
                                }`}>
                                {(() => {
                                    const installDate = parseSafeDate((client as any).date_install_debut) || date;
                                    return installDate ? (
                                        <>
                                            {format(installDate, 'dd/MM/yy', { locale: fr })}
                                            {time && <div className="text-[10px] text-orange-300">{time}</div>}
                                        </>
                                    ) : 'À définir';
                                })()}
                            </div>
                        </div>

                        {/* 4. Chantier terminé */}
                        <div className={`flex flex-col gap-1 rounded px-2 py-2 border ${(client as any).date_install_fin
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-slate-700/30 border-slate-600/50'
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${(client as any).date_install_fin ? 'bg-green-500' : 'bg-slate-600'
                                    }`}>
                                    <Check className={`h-4 w-4 ${(client as any).date_install_fin ? 'text-white' : 'text-slate-400'}`} />
                                </div>
                                <div className={`text-[10px] font-medium ${(client as any).date_install_fin ? 'text-green-300' : 'text-slate-400'
                                    }`}>
                                    Chantier terminé
                                </div>
                            </div>
                            <div className={`text-xs font-bold ml-7 ${(client as any).date_install_fin ? 'text-white' : 'text-slate-500'
                                }`}>
                                {(() => {
                                    const parsed = parseSafeDate((client as any).date_install_fin);
                                    return parsed ? format(parsed, 'dd/MM/yy', { locale: fr }) : 'En attente';
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL: SMART SCHEDULER (MAIN CONTENT) */}
                    <div className="flex-1 bg-white p-6 border-r border-slate-200 flex flex-col h-full overflow-hidden">
                        <div className="mb-4 shrink-0">
                            <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-blue-600" />
                                Recommandations IA
                            </h3>
                            <p className="text-slate-500 text-sm">L'optimiseur analyse les tournées existantes pour proposer les meilleurs créneaux.</p>
                        </div>

                        <div className="flex-1 min-h-0 relative">
                            {/* Embed Smart Scheduler here, filling the space */}
                            <div className="absolute inset-0 overflow-hidden">
                                <SmartScheduler
                                    defaultAddress={client.adresse}
                                    clientId={client.id}
                                    nbLed={client.nombreLED}
                                    type="INSTALLATION"
                                    compact={true}
                                    autoSearch={true}
                                    hideInput={true} // Clean Look
                                    deliveryDate={(client as any).date_livraison_reelle || client.dateLivraison}
                                    onDateSelect={(dateStr, eta) => {
                                        const d = parseSafeDate(dateStr);
                                        if (d) setDate(d);
                                        if (eta) setTime(eta);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: MANUAL FORM + CALENDAR */}
                    <div className="w-[420px] bg-slate-50 p-6 flex flex-col gap-6 shrink-0 border-l border-slate-100 overflow-y-auto">

                        {/* Section Calendrier */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-3 text-slate-700 font-medium">
                                <CalendarIcon className="h-4 w-4 text-slate-400" />
                                Date sélectionnée
                            </div>
                            <div className="flex justify-center">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    locale={fr}
                                    className="border-0"
                                    numberOfMonths={1} // Just 1 month here for cleaner layout
                                    disabled={(day) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        if (day <= today) return true;

                                        // Utiliser date_livraison_reelle en priorité
                                        const deliveryDateStr = (client as any).date_livraison_reelle || client.dateLivraison;
                                        const parsedLiv = parseSafeDate(deliveryDateStr);
                                        if (!parsedLiv) return false;

                                        const deliveryDate = new Date(parsedLiv);
                                        deliveryDate.setHours(0, 0, 0, 0);

                                        // Bloquer le jour de livraison ET les jours avant
                                        return day <= deliveryDate;
                                    }}
                                />
                            </div>

                            {/* Indicateur de délai livraison → installation */}
                            {date && (() => {
                                // Utiliser la date de livraison RÉELLE en priorité
                                const deliveryDateStr = (client as any).date_livraison_reelle || client.dateLivraison;
                                if (!deliveryDateStr) return null;
                                const parsedLiv = parseSafeDate(deliveryDateStr);
                                if (!parsedLiv) return null;

                                const deliveryDate = new Date(parsedLiv);
                                deliveryDate.setHours(0, 0, 0, 0);
                                const selectedDate = new Date(date);
                                selectedDate.setHours(0, 0, 0, 0);

                                const diffDays = Math.ceil((selectedDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));

                                let badgeColor = "";
                                let badgeText = "";
                                let icon = null;

                                if (diffDays === 0) {
                                    badgeColor = "bg-red-100 text-red-700 border-red-300";
                                    badgeText = "⚠️ Jour de livraison";
                                } else if (diffDays < 0) {
                                    badgeColor = "bg-red-100 text-red-700 border-red-300";
                                    badgeText = "⚠️ Avant livraison";
                                } else if (diffDays === 1) {
                                    badgeColor = "bg-green-100 text-green-700 border-green-300";
                                    badgeText = `✓ Parfait (J+1)`;
                                } else if (diffDays >= 2 && diffDays <= 3) {
                                    badgeColor = "bg-green-100 text-green-700 border-green-300";
                                    badgeText = `✓ OK (J+${diffDays})`;
                                } else if (diffDays >= 4 && diffDays <= 7) {
                                    badgeColor = "bg-orange-100 text-orange-700 border-orange-300";
                                    badgeText = `⚠ Long (J+${diffDays})`;
                                } else {
                                    badgeColor = "bg-red-100 text-red-700 border-red-300";
                                    badgeText = `❌ Trop long (J+${diffDays})`;
                                }

                                return (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500">Délai après livraison</span>
                                            <Badge className={`${badgeColor} border font-medium`}>
                                                {badgeText}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Section Détails (Heure, Equipe) */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                            <div className="flex items-center gap-2 mb-1 text-slate-700 font-medium">
                                <User className="h-4 w-4 text-slate-400" />
                                Affectation
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Heure</label>
                                    <Input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="bg-slate-50 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Équipe</label>
                                        {isAutoSelected && <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded animate-pulse">Auto</span>}
                                    </div>
                                    <Select value={poseurId} onValueChange={(val) => {
                                        setPoseurId(val);
                                        setIsAutoSelected(false);
                                    }}>
                                        <SelectTrigger className="bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Choisir" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {equipes.map((equipe) => (
                                                <SelectItem key={equipe.id} value={equipe.id}>
                                                    {equipe.nom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 flex flex-col gap-3">
                            <Button
                                onClick={handleConfirm}
                                disabled={!date}
                                size="lg"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                            >
                                <Check className="mr-2 h-5 w-5" />
                                Confirmer Installation
                            </Button>

                            <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                Annuler
                            </Button>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
