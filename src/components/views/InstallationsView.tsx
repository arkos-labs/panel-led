import { useState, useEffect } from 'react';
import { toast } from "sonner";
import {
  Wrench,
  MapPin,
  Calendar,
  Clock,
  User,
  Camera,
  CheckCircle2,
  AlertCircle,
  Truck,
  PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, mapSupabaseClient, parseSafeDate, isZoneMatch } from '@/lib/utils';
import { Client } from '@/types/logistics';
import { PlanningModal } from '@/components/modals/PlanningModal';
import { InstallationModal } from '@/components/modals/InstallationModal';
import { getInstallationStatus } from '@/lib/business-logic';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { supabase } from "@/lib/supabaseClient";


const statusConfig = {
  A_PLANIFIER: { label: 'À Planifier', color: 'bg-slate-100 text-slate-700 border border-slate-200' },
  LIVRAISON_PLANIFIEE: { label: 'Livraison Planifiée', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
  LIVRE: { label: 'Livré / À Installer', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  PLANIFIEE: { label: 'Install. Planifiée', color: 'bg-sky-100 text-sky-700 border border-sky-200' },
  EN_COURS: { label: 'En cours', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
  TERMINEE: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
};



// Extends Client but with specific presentation properties
interface InstallationViewItem extends Client {
  viewStatus: 'A_PLANIFIER' | 'LIVRAISON_PLANIFIEE' | 'LIVRE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | string;
  dureeJours: number;
  poseurId?: string;
}

export function InstallationsView() {
  const [filter, setFilter] = useState<string>('A_FAIRE'); // Default to Actionable items
  const [selectedZone, setSelectedZone] = useState<string>('FR'); // Default Zone: France Metropole
  const [rawClients, setClients] = useState<InstallationViewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Modals
  const [planningModalOpen, setPlanningModalOpen] = useState(false);
  const [selectedClientForPlanning, setSelectedClientForPlanning] = useState<Client | null>(null);

  const [installationModalOpen, setInstallationModalOpen] = useState(false);
  const [selectedClientForInstallation, setSelectedClientForInstallation] = useState<Client | null>(null);

  // State for simulation (Debug/Demo)
  const [simulatedIds, setSimulatedIds] = useState<Set<string>>(new Set());

  const toggleSimulation = (clientId: string) => {
    setSimulatedIds(prev => {
      const next = new Set(prev);
      next.add(clientId);
      return next;
    });
  };

  // Chargement API via Supabase (Source of Truth)
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*');

      if (error) throw error;

      if (data) {
        // Filter and Map clients relevant to the whole process
        // We EXCLUDE 'SIGNÉ' and 'A_RAPPELER' because they are managed in ClientsView
        const mappedClients: InstallationViewItem[] = data
          .map(mapSupabaseClient)
          .filter(c => c.statut !== 'SIGNÉ' && c.statut !== 'A PLANIFIER' && c.statut !== 'A_RAPPELER')
          .map(client => {
            const viewStatus = getInstallationStatus(client);

            // Calculate duration
            const nbLed = client.nombreLED || 0;
            const estimatedDuration = Math.ceil(nbLed / 70) || 1;

            return {
              ...client,
              viewStatus,
              dureeJours: estimatedDuration
            };
          }).filter(c => c.viewStatus !== 'A_PLANIFIER' && c.viewStatus !== 'LIVRAISON_PLANIFIEE'); // Exclude Delivery Phase

        // On garde tout pour les stats, le filtrage visuel se fera plus bas
        setClients(mappedClients);
      }
    } catch (e) {
      console.error("Erreur chargement installations", e);
      toast.error("Erreur chargement données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Listen for socket updates
  useSocketUpdate('clients', fetchClients);
  useSocketUpdate('stock', fetchClients); // Stock changes might be linked to installs completion


  // PLANNING DELIVERY
  const openPlanning = (client: Client) => {
    setSelectedClientForPlanning(client);
    setPlanningModalOpen(true);
  };

  const handlePlanningConfirm = async (data: { date: Date; camionId: string }) => {
    try {
      // Use ISO string to preserve time if present (for accurate calendar sync)
      const dateVal = data.date.toISOString();

      const { error } = await supabase
        .from('clients')
        .update({
          statut_client: 'EN COURS',
          statut_livraison: 'PLANIFIÉE',
          date_livraison_prevue: dateVal,
          livreur_id: data.camionId
        })
        .eq('id', selectedClientForPlanning?.id);

      if (error) throw error;

      toast.success(`📅 Livraison planifiée pour ${selectedClientForPlanning?.nom} !`);
      setPlanningModalOpen(false);
      fetchClients();
    } catch (e: any) {
      toast.error("Erreur de sauvegarde: " + e.message);
    }
  };

  // PLANNING INSTALLATION
  const openInstallation = (client: Client) => {
    setSelectedClientForInstallation(client);
    setInstallationModalOpen(true);
  };

  const handleInstallationConfirm = async (data: { date: Date; poseurId: string }) => {
    try {
      // 1. Optimistic Update
      const updatedClientId = selectedClientForInstallation?.id;
      if (updatedClientId) {
        setClients(prev => prev.map(c => {
          if (c.id === updatedClientId) {
            return {
              ...c,
              viewStatus: 'PLANIFIEE',
              installStatut: 'PLANIFIÉE', // Force update here to match view logic
              dateDebutTravaux: data.date.toISOString(),
              poseurId: data.poseurId
            };
          }
          return c;
        }));
      }

      // 2. Supabase Update
      const { error } = await supabase
        .from('clients')
        .update({
          statut_installation: 'PLANIFIÉE',
          date_install_debut: data.date.toISOString(),
          // date_install_fin is usually calculated by backend, but we can leave it empty or estimate it
          poseur_id: data.poseurId
        })
        .eq('id', updatedClientId);

      if (error) throw error;

      toast.success("Installation planifiée !");
      setInstallationModalOpen(false);

      // 3. Background Refresh (to be sure)
      setTimeout(fetchClients, 1000);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la planification");
      fetchClients(); // Revert on error
    }
  };

  const handleStartInstallation = async (client: Client) => {
    try {
      // 1. Optimistic Update & Force Local State
      setClients(prev => prev.map(c => {
        if (c.id === client.id) {
          return { ...c, viewStatus: 'EN_COURS', installStatut: 'EN_COURS' };
        }
        return c;
      }));
      // On force l'état simulé pour contrer la latence du serveur
      setSimulatedIds(prev => new Set(prev).add(client.id));

      // 2. Supabase Update
      const nowStr = new Date().toISOString();
      await supabase
        .from('clients')
        .update({
          statut_client: 'EN COURS', // Global status
          statut_installation: 'EN_COURS',
          date_install_debut: nowStr
        })
        .eq('id', client.id);

      toast.success("🚀 Chantier démarré manuellement !");

      // 3. Background Refresh
      setTimeout(fetchClients, 1000);
    } catch (e) {
      toast.error("Erreur démarrage chantier");
      fetchClients();
    }
  };

  const handleFinishInstallation = async (client: Client) => {
    try {
      // 1. CLEAR SIMULATION FLAG (CRITICAL FIX)
      // Si on ne fait pas ça, le statut reste forcé à "EN_COURS" à cause de la logique de map plus bas
      setSimulatedIds(prev => {
        const next = new Set(prev);
        next.delete(client.id);
        return next;
      });

      // 2. Optimistic Update (Remove from view or mark as finished)
      // On passe le statut à TERMINEE, ce qui va l'exclure du filtre d'affichage ci-dessous.
      setClients(prev => prev.map(c => {
        if (c.id === client.id) {
          return { ...c, viewStatus: 'TERMINEE', statut: 'TERMINÉ', installStatut: 'TERMINÉE' };
        }
        return c;
      }));

      // 3. Supabase Call
      const nowStr = new Date().toISOString();
      await supabase
        .from('clients')
        .update({
          statut_client: 'TERMINÉ',
          statut_installation: 'TERMINÉ', // Note: Check consistency (TERMINÉ vs TERMINÉE)
          date_install_fin: nowStr
        })
        .eq('id', client.id);

      toast.success("✅ Chantier terminé avec succès !");

      // 4. Background Refresh
      setTimeout(fetchClients, 1000);
    } catch (e) {
      toast.error("Erreur mise à jour chantier");
      fetchClients();
    }
  };

  // Logic to dynamically update status based on date/time (Real-time "En cours")
  // MODIF : ON NE TOUCHE PLUS AU STATUT AUTOMATIQUEMENT.
  // Seul le serveur (Google Sheets) ou une simulation MANUELLE (simulatedIds) décide.

  const clients = rawClients
    .map(client => {
      let viewStatus = client.viewStatus;

      if (simulatedIds.has(client.id)) {
        viewStatus = 'EN_COURS';
      }
      return { ...client, viewStatus };
    })
    .filter(c => isZoneMatch(c.zone_pays, selectedZone));

  const filteredClients = clients.filter((c) => {
    if (filter === 'all') return c.viewStatus !== 'TERMINEE'; // Vue globale (sauf archives)

    // "À Planifier" = Livré mais pas encore planifié en install
    if (filter === 'A_FAIRE') return c.viewStatus === 'LIVRE';

    // "Planning" = Planifié ou En Cours
    if (filter === 'PLANNING') return c.viewStatus === 'PLANIFIEE' || c.viewStatus === 'EN_COURS';

    // "Terminée" = Archives
    if (filter === 'TERMINEE') return c.viewStatus === 'TERMINEE';

    return c.viewStatus === filter; // Fallback
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse pb-10">
        <div className="flex gap-4 items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Planning Installations</h2>
            <p className="text-muted-foreground">
              Gestion des chantiers et équipes de pose
            </p>
          </div>
          {/* ZONE SELECTOR */}
          <div className="flex gap-1 overflow-x-auto pb-2">
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
                className={cn("whitespace-nowrap transition-all", selectedZone === zone.id ? "bg-primary text-primary-foreground shadow-glow" : "bg-white text-muted-foreground hover:bg-gray-50 border-gray-200")}
                onClick={() => setSelectedZone(zone.id)}
              >
                {zone.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('all')}>Tout</Button>
          <Button variant={filter === 'A_FAIRE' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('A_FAIRE')} className={filter === 'A_FAIRE' ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"}>
            À Planifier (Livrés: {clients.filter(c => c.viewStatus === 'LIVRE').length})
          </Button>
          <Button variant={filter === 'PLANNING' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('PLANNING')}>
            Planning ({clients.filter(c => c.viewStatus === 'PLANIFIEE' || c.viewStatus === 'EN_COURS').length})
          </Button>
          <Button variant={filter === 'TERMINEE' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('TERMINEE')}>Historique</Button>
        </div>
      </div>

      {/* Stats */}
      {/* Stats - 4 Colonnes maintenant */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* 1. À Planifier (LIVRÉ mais pas de date install) */}
        <div className="glass-card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">À Planifier</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {clients.filter((c) => c.viewStatus === 'LIVRE').length}
              </p>
            </div>
            <div className="rounded-lg bg-indigo-100 p-2 border border-indigo-200">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* 2. Planifiées (Date calée) */}
        <div className="glass-card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Planifiées</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {clients.filter((c) => c.viewStatus === 'PLANIFIEE').length}
              </p>
            </div>
            <div className="rounded-lg bg-sky-100 p-2 border border-sky-200">
              <Clock className="h-5 w-5 text-sky-600" />
            </div>
          </div>
        </div>

        {/* 3. En Cours (Démarrées) */}
        <div className="glass-card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">En cours</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {clients.filter((c) => c.viewStatus === 'EN_COURS').length}
              </p>
            </div>
            <div className="rounded-lg bg-amber-100 p-2 border border-amber-200">
              <Wrench className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>

        {/* 4. Terminées */}
        <div className="glass-card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terminées</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {clients.filter((c) => c.viewStatus === 'TERMINEE').length}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-100 p-2 border border-emerald-200">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

      </div>

      {/* Main List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredClients.length === 0 && (
          <div className="col-span-2 text-center p-8 bg-muted/20 rounded-xl">
            Aucun client dans cette catégorie.
          </div>
        )}

        {filteredClients.map((client) => {
          const statusInfo = statusConfig[client.viewStatus as keyof typeof statusConfig] || { label: client.viewStatus, color: 'bg-gray-100' };

          let dateInfo = '';
          const d = parseSafeDate(client.dateLivraison);
          if (client.viewStatus === 'LIVRAISON_PLANIFIEE') {
            if (d) {
              // Format: "Jeudi 12 Janvier"
              const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
              dateInfo = `Livraison: ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
            } else {
              dateInfo = 'Livraison: Date inconnue';
            }
          }
          else if (client.viewStatus === 'PLANIFIEE' || client.viewStatus === 'EN_COURS') {
            const startDate = parseSafeDate(client.dateDebutTravaux) || new Date();
            dateInfo = `Début: ${startDate.toLocaleDateString()} `;
            // FIX: Ensure this branch returns string properly
          }

          return (
            <div
              key={client.id}
              className={cn(
                'glass-card p-6 transition-all duration-300 hover:shadow-glow animate-fade-in',
                client.viewStatus === 'EN_COURS' ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-full font-semibold text-lg bg-primary/20 text-primary')}>
                    {client.prenom?.[0]}{client.nom?.[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {client.prenom} {client.nom}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {client.nombreLED || 0} LED • {client.ville}
                    </p>
                  </div>
                </div>
                <Badge className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{client.adresse}, {client.codePostal} {client.ville}</span>
                </div>
                {dateInfo && (
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{dateInfo}</span>
                  </div>
                )}
                {client.poseurId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Poseur : {client.poseurId}</span>
                  </div>
                )}
              </div>

              {/* Actions - The Core Workflow */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                {/* Step 1: Need Planning - REMOVED from this view as per user request */}
                {/* client.viewStatus === 'A_PLANIFIER' block deleted */}

                {/* Step 2: Delivery Planned - Show Status Only (No Action here) */}
                {/* Step 2: Delivery Planned - Show Status Only (No Action here) */}
                {client.viewStatus === 'LIVRAISON_PLANIFIEE' && (
                  (() => {
                    const d = parseSafeDate(client.dateLivraison); // Use robust parsing
                    const isToday = d ? new Date().toDateString() === d.toDateString() : false;

                    const now = new Date();
                    const diff = d ? d.getTime() - now.getTime() : 0;

                    if (isToday) {
                      return (
                        <div className="w-full text-center p-3 bg-orange-500/10 text-orange-400 rounded-lg text-sm font-bold border border-orange-500/30 flex items-center justify-center animate-pulse shadow-glow">
                          <Truck className="h-5 w-5 mr-2" /> Livraison Aujourd'hui !
                        </div>
                      );
                    }

                    if (!d) {
                      return (
                        <div className="w-full text-center p-2 bg-white/5 text-muted-foreground rounded-md text-xs border border-white/10 italic">
                          Date inconnue
                        </div>
                      );
                    }

                    // Calculate delay
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    // Add 1 to days if it's tomorrow but math.floor makes it 0 (e.g. 23h left) ?? 
                    // Actually standard logic: 
                    // If diff is positive:
                    // < 24h = 'Demain' or 'Dans X h' ? 
                    // Let's keep simpler: J-X if positive, Retard if negative.

                    return (
                      <div className={`w-full text-center py-3 rounded-lg border flex flex-col items-center justify-center backdrop-blur-sm ${diff < 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-muted-foreground'}`}>
                        {diff < 0 ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle className="h-5 w-5" />
                              <span className="font-bold uppercase tracking-wider text-xs">Retard</span>
                            </div>
                            <span className="font-bold text-lg">de {Math.abs(days)} jours</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Livraison prévue dans</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-white">{days}</span>
                              <span className="text-sm font-medium text-white/50">jours</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                )
                }


                {/* Step 3: Delivered - Plan Installation */}
                {client.viewStatus === 'LIVRE' && (
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white" onClick={() => openInstallation(client)}>
                    <Wrench className="h-4 w-4 mr-2" /> Planifier Installation
                  </Button>
                )}

                {/* Step 4 & 5: Installation Planned -> Waiting -> In Progress -> Finish */}
                {(client.viewStatus === 'PLANIFIEE' || client.viewStatus === 'EN_COURS') && (
                  (() => {
                    // Si le statut est VRAIMENT "EN_COURS" (via le clic du poseur) ou si la date est passée
                    const isStartedReal = client.viewStatus === 'EN_COURS';

                    const start = client.dateDebutTravaux ? new Date(client.dateDebutTravaux).getTime() : 0;
                    const now = Date.now();
                    // MODIF : On ne passe plus en "forcé" si l'heure est dépassée.
                    // On attend EXPLICITEMENT que le poseur clique sur le lien (isStartedReal)
                    const isStartedTime = simulatedIds.has(client.id);

                    if (!isStartedReal && !isStartedTime) {
                      // Waiting for start
                      const diff = start - now;

                      // Check if it is TODAY (ignoring time)
                      const startDate = new Date(start);
                      const nowDate = new Date();
                      const isToday = startDate.toDateString() === nowDate.toDateString();

                      // Si jour J : Affichage Spécial
                      if (isToday) {
                        return (
                          <div className="w-full flex flex-col gap-3">
                            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center shadow-glow animate-pulse">
                              <p className="text-blue-400 font-bold text-lg">📅 C'est le jour J !</p>
                              <p className="text-blue-300 text-sm">L'installation est prévue aujourd'hui.</p>
                            </div>
                            <Button
                              className="w-full text-white shadow-sm font-semibold bg-blue-600 hover:bg-blue-700"
                              onClick={() => handleStartInstallation(client)}
                            >
                              ▶️ Démarrer l'Installation
                            </Button>
                          </div>
                        );
                      }

                      // Si l'heure est passée (diff < 0) mais pas démarré : RETARD / ATTENTE ACTION
                      // Calcul du temps restant (même si négatif)
                      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                      return (
                        <div className="w-full flex flex-col gap-3">
                          {/* Info Panel */}
                          <div className={`w-full text-center py-3 rounded-lg border flex flex-col items-center justify-center backdrop-blur-sm ${diff < 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-muted-foreground'}`}>
                            {diff < 0 ? (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <AlertCircle className="h-5 w-5" />
                                  <span className="font-bold uppercase tracking-wider text-xs">Retard</span>
                                </div>
                                <span className="font-bold text-lg">de {Math.abs(days)} jours</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Installation prévue dans</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-white">{days}</span>
                                  <span className="text-sm font-medium text-white/50">jours</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
                                  onClick={() => handleStartInstallation(client)}
                                >
                                  🚀 Avancer à aujourd'hui
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Action Button - Only if Late (or Today handled above) */}
                          {diff < 0 && (
                            <Button
                              className="w-full text-white shadow-sm font-semibold"
                              variant="default"
                              style={{ backgroundColor: '#dc2626' }}
                              onClick={() => handleStartInstallation(client)}
                            >
                              🚨 Démarrer en retard
                            </Button>
                          )}
                        </div>
                      );
                    } else {
                      // Started - Show Finish Button AND Status
                      return (
                        <div className="w-full space-y-3">
                          <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/30 animate-pulse shadow-glow">
                            <Wrench className="h-5 w-5" />
                            <span className="font-bold">🚧 Chantier Démarré !</span>
                          </div>
                          <Button className="w-full bg-success hover:bg-success/90 text-white"
                            onClick={() => handleFinishInstallation(client)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Terminer Chantier
                          </Button>
                        </div>
                      );
                    }
                  })()
                )}

                {/* Legacy En Cours Block Removed to merge with above logic */}
              </div>

            </div>
          );
        })}
      </div>

      {/* MODALS */}
      <PlanningModal
        client={selectedClientForPlanning}
        isOpen={planningModalOpen}
        onClose={() => setPlanningModalOpen(false)}
        onConfirm={handlePlanningConfirm}
      />

      <InstallationModal
        client={selectedClientForInstallation}
        allClients={clients}
        isOpen={installationModalOpen}
        onClose={() => setInstallationModalOpen(false)}
        onConfirm={handleInstallationConfirm}
      />

    </div>
  );
}
