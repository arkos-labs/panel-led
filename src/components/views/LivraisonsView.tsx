import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { OptimizerService } from '@/services/optimizer';
import {
  Calendar as CalendarIcon,
  Truck,
  MapPin,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Navigation,
  Wrench,
  UserPlus,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
// import { mockCamions } from '@/data/mockData';
import { Livraison } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InstallationModal } from '@/components/modals/InstallationModal';
import { isDeliveryActive, parseClientDate, getClientDeliveryDate } from '@/lib/business-logic';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { supabase } from '@/lib/supabaseClient';
import { mapSupabaseClient, parseSafeDate, isZoneMatch } from '@/lib/utils';
import { DateNavigator } from '@/components/common/DateNavigator';
import { GlobalOptimizerModal } from '@/components/modals/GlobalOptimizerModal';

const statusConfig = {
  PLANIFIÉE: { label: 'Planifiée', color: 'bg-primary/20 text-primary' },
  EN_COURS: { label: 'En route', color: 'bg-warning/20 text-warning' },
  LIVRÉE: { label: 'Livrée', color: 'bg-success/20 text-success' },
  REPORTÉE: { label: 'Reportée', color: 'bg-destructive/20 text-destructive' },
  A_VALIDER: { label: 'Validation Chauffeur', color: 'bg-orange-500/20 text-orange-700 animate-pulse border-orange-500' },
};

// Helper pour formater la date
const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'EEEE d MMMM yyyy', { locale: fr });
};

// Configuration des Dépôts par Zone
const ZONE_DEPOTS: Record<string, { lat: number, lon: number, id: string }> = {
  'FR': { lat: 48.8566, lon: 2.3522, id: 'DEPOT_PARIS' },
  'GP': { lat: 16.24125, lon: -61.53614, id: 'DEPOT_PAP' }, // Pointe-à-Pitre
  'MQ': { lat: 14.61606, lon: -61.05878, id: 'DEPOT_FDF' }, // Fort-de-France
  'CORSE': { lat: 41.9192, lon: 8.7386, id: 'DEPOT_AJA' },   // Ajaccio
};

export function LivraisonsView() {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCamion, setSelectedCamion] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('FR'); // Default Zone
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day'); // New View Mode

  // State pour les données API
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [rawClients, setRawClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [camions, setCamions] = useState<any[]>([]);

  useEffect(() => {
    const fetchResources = async () => {
      const camionsReels = [
        { id: 'camion-fr', nom: 'Chauffeur France', type: 'LIVREUR', volumeMax: 20000, disponible: true, zone: 'FR' },
        { id: 'camion-corse', nom: 'Chauffeur Corse', type: 'LIVREUR', volumeMax: 15000, disponible: true, zone: 'CORSE' },
        { id: 'camion-gp', nom: 'Chauffeur Guadeloupe', type: 'LIVREUR', volumeMax: 12000, disponible: true, zone: 'GP' },
        { id: 'camion-mq', nom: 'Chauffeur Martinique', type: 'LIVREUR', volumeMax: 12000, disponible: true, zone: 'MQ' }
      ];
      setCamions(camionsReels);
    };
    fetchResources();
  }, []);

  // States pour la modale d'installation
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedLivraisonForInstall, setSelectedLivraisonForInstall] = useState<Livraison | null>(null);

  // Chargement des données depuis l'API Clients (Source unique de vérité)
  const fetchLivraisonsFromClients = useCallback(async () => {
    try {
      setLoading(true);
      // Direct Supabase call for Vercel compatibility
      const { data: clients, error } = await supabase.from('clients').select('*');
      if (error) throw error;

      if (Array.isArray(clients)) {
        // Map fields to match what the frontend expects (using our util if possible, or mapping inline to keep context)
        // Here we need 'rawClients' to be the mapped version actually, or compatible.
        // Let's use the helper we created in utils.ts to be consistent.
        // But LivraisonsView uses 'rawClients' then maps again.
        // Let's just store the mapped clients in 'rawClients' so the rest works.
        const mappedRaw = clients.map(mapSupabaseClient);
        setRawClients(mappedRaw);

        // Filtrer les clients qui ont une livraison planifiée ou en cours
        // On se base sur le statut global 'EN_COURS' ou la colonne Logistique
        const activeDeliveries = mappedRaw
          .filter((client: any) => isDeliveryActive(client))
          .map((client: any, index: number) => {
            const d = getClientDeliveryDate(client);
            const datePrevue = d ? format(d, 'yyyy-MM-dd') : 'no-date';

            return {
              id: `liv-${client.id}`,
              clientId: client.id,
              camionId: client.livreur_id || client.camionId || '1',
              datePrevue: datePrevue,
              heureLivraison: client.heureLivraison || '', // Map time
              statut: (
                (client.logistique && (client.logistique.toUpperCase().includes('RECU') || client.logistique.toUpperCase().includes('MATERIEL'))) ||
                (client.statut && (client.statut.toUpperCase() === 'LIVRÉ' || client.statut.toUpperCase() === 'LIVREE' || client.statut.toUpperCase().includes('RECU'))) ||
                (client.statut_client && (client.statut_client.toUpperCase() === 'LIVRÉ' || client.statut_client.toUpperCase() === 'LIVREE' || client.statut_client.toUpperCase().includes('MATERIEL RECU'))) ||
                (client.statut_livraison && (client.statut_livraison.toUpperCase() === 'LIVRÉ' || client.statut_livraison.toUpperCase() === 'LIVREE')) ||
                (client.installStatut && (client.installStatut.toUpperCase().includes('TERMIN') || client.installStatut.toUpperCase().includes('EN COURS')))
              ) ? 'LIVRÉE'
                : (client.statut_livraison === 'A_VALIDER' || client.statut_client === 'A_VALIDER') ? 'A_VALIDER'
                  : 'PLANIFIÉE',
              volumeTotal: (client.nombreLED || 0) * 0.05,
              ordreTournee: index + 1,
              ordre: index + 1,
              client: client
            } as Livraison;
          });

        // console.log("Livraisons dérivées des clients:", activeDeliveries);
        setLivraisons(activeDeliveries);
      }
    } catch (error) {
      console.error("Erreur chargement livraisons:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivraisonsFromClients();

    // Auto-refresh every 30 seconds (sync with bridge.js)
    const interval = setInterval(() => {
      fetchLivraisonsFromClients();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for socket updates
  useSocketUpdate('clients', fetchLivraisonsFromClients);

  const activeCamion =
    selectedCamion === 'all'
      ? {
        id: 'all',
        nom: 'Flotte Globale',
        volumeMax: camions
          .filter(c => selectedZone === 'FR' ? c.zone === 'FR' : c.zone === selectedZone)
          .reduce((acc, c) => acc + c.volumeMax, 0),
        disponible: true
      }
      : camions.find((c) => c.id === selectedCamion)!;

  const uniqueDates = [...new Set(
    livraisons
      .filter(l => isZoneMatch(l.client.zone_pays, selectedZone))
      .map((l) => l.datePrevue)
  )]
    .filter((d) => d !== 'no-date')
    .sort();

  const filteredLivraisons = livraisons.filter((l) => {
    if (!isZoneMatch(l.client.zone_pays, selectedZone)) return false;

    // 2. Date Filter
    if (selectedDate === 'all') return true;

    if (viewMode === 'week') {
      // Logic for Week View
      const currentDate = parseISO(selectedDate);
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });     // Sunday

      const deliveryDate = l.datePrevue !== 'no-date' ? parseISO(l.datePrevue) : null;
      if (!deliveryDate) return false;

      const matchesDate = isWithinInterval(deliveryDate, { start, end });

      // 3. Truck Filter (inside week logic)
      const matchesCamion = selectedCamion === 'all' || l.camionId === selectedCamion;
      return matchesDate && matchesCamion;
    } else {
      // Logic for Day View
      const matchesDate = l.datePrevue === selectedDate;
      const matchesCamion = selectedCamion === 'all' || l.camionId === selectedCamion;
      return matchesDate && matchesCamion;
    }
  }).sort((a, b) => {
    // Sort by Date then Order
    if (a.datePrevue !== b.datePrevue) return a.datePrevue.localeCompare(b.datePrevue);
    return (a.ordre || 0) - (b.ordre || 0);
  });

  // Local helper for capacity calculation (m3)
  const calculateLoad = (items: Livraison[], truck: any) => {
    const volumeUtilise = items.reduce((acc, item) => {
      // On compte tout ce qui est planifié ou livré dans le camion pour la journée
      return acc + (item.volumeTotal || 0);
    }, 0);

    return {
      success: volumeUtilise <= truck.volumeMax,
      volumeCharge: volumeUtilise,
      volumeUtilise: volumeUtilise,
      tauxCharge: Math.round((volumeUtilise / truck.volumeMax) * 100) || 0,
      message: volumeUtilise > truck.volumeMax ? 'Surcharge détectée' : 'Capacité OK'
    };
  };

  const capacityCheck = activeCamion
    ? calculateLoad(filteredLivraisons, activeCamion)
    : { success: true, volumeUtilise: 0, volumeCharge: 0, tauxCharge: 0, message: '' };

  const [showGlobalOptimizer, setShowGlobalOptimizer] = useState(false);

  // New Global Optimization Handler (Opens Modal)
  const handleOptimize = async () => {
    setShowGlobalOptimizer(true);
  };

  // Deprecated Legacy Local Optimize (Kept for reference if needed, but unused by button now)
  const handleLegacyOptimize = async () => {
    if (selectedDate === 'all') {
      toast.error("Veuillez sélectionner une date spécifique pour optimiser.");
      return;
    }

    if (filteredLivraisons.length === 0) {
      toast.error("Aucune livraison à optimiser pour cette date.");
      return;
    }

    const toastId = toast.loading("Optimisation et synchronisation...");

    try {
      console.log("Starting Optimization for date:", selectedDate);
      // 1. Prepare data
      const clientsToOptimize = filteredLivraisons.map(l => l.client);
      const dateObj = new Date(selectedDate); // 'yyyy-MM-dd' is parsed as UTC midnight usually or local depending on browser. Safer to assume local date string processing by optimizer.

      // 2. Run local optimization (Sync)
      const startLocation = ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR'];
      const result = OptimizerService.simulateTourSync(
        dateObj,
        clientsToOptimize,
        8, 0, 22,
        { returnToDepot: true, preserveOrder: false },
        startLocation
      );

      console.log("Optimization Result:", result);

      // 3. Update State
      const livraisonMap = new Map(filteredLivraisons.map(l => [l.clientId, l]));
      const optimizedLivraisons: Livraison[] = [];
      result.sortedClients.forEach((client, index) => {
        const originalWrapper = livraisonMap.get(client.id);
        if (originalWrapper) {
          optimizedLivraisons.push({
            ...originalWrapper,
            ordre: index + 1
          });
        }
      });

      const otherLivraisons = livraisons.filter(l => !optimizedLivraisons.find(opt => opt.id === l.id));
      setLivraisons([...otherLivraisons, ...optimizedLivraisons]);

      // 4. SYNC TO GOOGLE AGENDA
      // Ensure we extract times correctly, providing a fallback for clients without GPS (unrouted)
      let lastRefTime = new Date(selectedDate);
      lastRefTime.setHours(8, 0, 0, 0);

      const clientsPayload = result.sortedClients.map(c => {
        const arrival = (c as any).estimatedArrival;
        const arrivalDate = arrival ? new Date(arrival) : null;

        let timeStr = "";
        if (arrivalDate) {
          timeStr = format(arrivalDate, 'HH:mm');
          lastRefTime = arrivalDate;
        } else {
          // Fallback: Increment by 30m from last known time for unrouted clients
          lastRefTime = new Date(lastRefTime.getTime() + 30 * 60000);
          timeStr = format(lastRefTime, 'HH:mm');
        }

        return {
          id: c.id,
          nom: c.nom,
          adresse: c.adresse_brute || c.adresse || "",
          time: timeStr
        };
      });

      console.log("Sync Payload:", clientsPayload);

      if (clientsPayload.some(c => c.time)) {
        // Use hardcoded localhost as requested/observed
        const apiUrl = 'http://localhost:3001/api/tour/update';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            clients: clientsPayload
          })
        });

        if (response.ok) {
          const jsonRes = await response.json();
          console.log("Sync Response:", jsonRes);
          toast.success(`Optimisation terminée et Agenda synchronisé ! (${result.totalDistance.toFixed(1)} km)`, { id: toastId });
        } else {
          const textRes = await response.text();
          console.error("Sync Failed:", textRes);
          throw new Error(`Erreur Serveur: ${response.status}`);
        }
      } else {
        console.warn("No times generated from optimization");
        toast.success("Optimisation terminée (Sans horaires)", { id: toastId });
      }

    } catch (e: any) {
      console.error("Optimize Error:", e);
      toast.error("Erreur: " + e.message, { id: toastId });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      // On récupère l'objet livraison complet pour avoir le clientId
      const livraison = livraisons.find(l => l.id === id);
      if (!livraison) return;

      const now = new Date();
      const formattedDate = format(now, 'dd/MM/yyyy');
      const formattedTime = format(now, 'HH:mm');

      // Mise à jour directe Supabase (plus fiable que l'API intermédiaire)
      const { error } = await supabase
        .from('clients')
        .update({
          statut_client: 'LIVRÉ',
          statut_livraison: 'LIVRÉE',
          date_livraison_validee: now.toISOString(), // Correct DB Column (was reelle)
          signature_livraison: `${formattedDate} à ${formattedTime}`, // Format lisible pour affichage
          heure_livraison: formattedTime
        })
        .eq('id', livraison.clientId);

      if (error) throw error;

      // Mise à jour locale pour effet immédiat
      setLivraisons(prev => prev.map(l =>
        l.id === id ? { ...l, statut: newStatus as any } : l
      ));

      toast.success(`Livraison validée ! Heure : ${formattedTime}`);

    } catch (e: any) {
      console.error("Erreur update status", e);
      toast.error("Erreur lors de la mise à jour: " + e.message);
    }
  };

  const handleDriverAssignment = async (livraisonId: string, driverId: string) => {
    try {
      const livraison = livraisons.find(l => l.id === livraisonId);
      if (!livraison) return;

      const { error } = await supabase
        .from('clients')
        .update({ livreur_id: driverId })
        .eq('id', livraison.clientId);

      if (error) throw error;

      const driverName = camions.find(c => c.id === driverId)?.nom || 'Chauffeur';
      toast.success(`Assigné à ${driverName}`);

      // Optimistic UI update
      setLivraisons(prev => prev.map(l =>
        l.id === livraisonId ? { ...l, camionId: driverId } : l
      ));

    } catch (e: any) {
      console.error("Erreur assignation", e);
      toast.error("Erreur assignation: " + e.message);
    }
  };

  const openInstallModal = (livraison: Livraison) => {
    console.log("🛠️ Tentative d'ouverture modale pour :", livraison);
    if (!livraison) return;

    // On force la mise à jour des états
    setSelectedLivraisonForInstall(livraison);
    setTimeout(() => setInstallModalOpen(true), 10); // Petit délai pour s'assurer que le state livraison est pris en compte
  };

  const handleInstallConfirm = async (data: { date: Date; poseurId: string }) => {
    if (!selectedLivraisonForInstall) return;

    try {
      await fetch('/api/installations/creer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedLivraisonForInstall.clientId,
          dateDebut: data.date.toISOString(),
          poseurId: data.poseurId
        })
      });
      toast.success(`✅ Installation planifiée pour ${selectedLivraisonForInstall.client.nom} !`);
    } catch (e) {
      toast.error("Erreur lors de la création de l'installation");
    }
  };

  const handleOptimizeWeekOrder = () => {
    if (viewMode !== 'week') return;

    const toastId = toast.loading("Optimisation de la semaine en cours..."); // Loading start

    // Group by date
    const groups = livraisons.reduce((acc, curr) => {
      const date = curr.datePrevue;
      if (!acc[date]) acc[date] = [];
      acc[date].push(curr);
      return acc;
    }, {} as Record<string, Livraison[]>);

    let updatedLivraisons = [...livraisons];
    let totalOptis = 0;

    Object.keys(groups).forEach(date => {
      if (date === 'no-date') return;
      const dailyLivraisons = groups[date];
      if (dailyLivraisons.length < 2) return; // Need at least 2 to sort

      // Optimization
      const startLocation = ZONE_DEPOTS[selectedZone] || ZONE_DEPOTS['FR'];
      const clientsToOpti = dailyLivraisons.map(l => l.client);

      // Run sync optimization for this day
      const result = OptimizerService.simulateTourSync(
        new Date(date),
        clientsToOpti,
        8, 0, 22,
        { returnToDepot: true, preserveOrder: false },
        startLocation
      );

      // Re-assign order based on result
      result.sortedClients.forEach((sortedClient, idx) => {
        const indexInMain = updatedLivraisons.findIndex(l => l.clientId === sortedClient.id);
        if (indexInMain !== -1) {
          updatedLivraisons[indexInMain] = {
            ...updatedLivraisons[indexInMain],
            ordre: idx + 1
          };
        }
      });
      totalOptis++;
    });

    setLivraisons(updatedLivraisons);
    toast.success(`Optimisation terminée pour ${totalOptis} jours !`, { id: toastId });
  };

  const handleMassAssign = async (driverId: string) => {
    if (!filteredLivraisons.length) return;
    const driverName = camions.find(c => c.id === driverId)?.nom || 'Chauffeur';

    if (!confirm(`Confirmer l'assignation de ${filteredLivraisons.length} livraisons à ${driverName} ?`)) return;

    const toastId = toast.loading(`Assignation à ${driverName}...`);

    try {
      const clientIds = filteredLivraisons.map(l => l.clientId);

      const { error } = await supabase
        .from('clients')
        .update({ livreur_id: driverId })
        .in('id', clientIds);

      if (error) throw error;

      // Optimistic Update
      setLivraisons(prev => prev.map(l =>
        clientIds.includes(l.clientId) ? { ...l, camionId: driverId } : l
      ));

      toast.success(`Assignation terminée !`, { id: toastId });

    } catch (e: any) {
      console.error(e);
      toast.error("Erreur assignation massive", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec DateNavigator */}
      <div className="flex flex-col gap-6 items-center w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Planning Livraisons</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  fetchLivraisonsFromClients();
                  toast.success("Données actualisées");
                }}
                className="hover:bg-slate-100 rounded-full"
                title="Actualiser les données"
              >
                <RefreshCw className="h-5 w-5 text-slate-400" />
              </Button>
            </div>
            <p className="text-muted-foreground">Optimisation des tournées et suivi en temps réel</p>
          </div>

          <div className="flex items-center gap-3">
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
                className={cn("whitespace-nowrap h-8 text-xs font-semibold px-4", selectedZone === zone.id ? "bg-slate-800 text-white" : "opacity-70")}
                onClick={() => {
                  setSelectedZone(zone.id);
                  setSelectedCamion('all');
                }}
              >
                {zone.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Le Sélecteur de Date Stylisé (Image User) */}
        <DateNavigator
          selectedDate={selectedDate === 'all' ? new Date() : new Date(selectedDate)}
          onDateChange={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
        />

        {/* View Mode Toggle */}
        <div className="flex bg-muted/50 p-1 rounded-lg">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="px-6"
          >
            Jour
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="px-6"
          >
            Semaine
          </Button>
        </div>

        <div className="flex items-center gap-4 w-full justify-end border-b pb-4">
          {/* Mass Assign Dropdown */}
          {filteredLivraisons.length > 0 && (
            <Select onValueChange={handleMassAssign}>
              <SelectTrigger className="w-56 bg-purple-50 border-purple-200 text-purple-700 font-medium">
                <UserPlus className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tout assigner à..." />
              </SelectTrigger>
              <SelectContent>
                {camions
                  .filter(c => selectedZone === 'FR' ? c.zone === 'FR' : c.zone === selectedZone)
                  .map((camion) => (
                    <SelectItem key={camion.id} value={camion.id}>
                      {camion.nom}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedCamion} onValueChange={setSelectedCamion}>
            <SelectTrigger className="w-44 bg-white/50 border-slate-200">
              <Truck className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Camion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les livreurs</SelectItem>
              {camions
                .filter(c => selectedZone === 'FR' ? c.zone === 'FR' : c.zone === selectedZone)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" onClick={handleOptimize}>
            <Navigation className="h-4 w-4" />
            Optimiser la tournée
          </Button>
          <GlobalOptimizerModal
            isOpen={showGlobalOptimizer}
            onClose={() => setShowGlobalOptimizer(false)}
            defaultZone={selectedZone}
            targetDate={new Date(selectedDate)} // Pass current view date as Date object
            onSuccess={fetchLivraisonsFromClients}
          />
          <Button variant="outline" className="gap-2 border-slate-300" onClick={() => window.open(`/t/${selectedCamion === 'all' ? '1' : selectedCamion}`, '_blank')}>
            <ExternalLink className="h-4 w-4" />
            Voir App Chauffeur
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne Gauche: Calendrier & Filtres */}
        <div className="space-y-6">
          <Card className="glass-card shadow-premium p-0 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Calendrier de la Flotte
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex justify-center py-4">
              <Calendar
                mode="single"
                selected={selectedDate === 'all' ? undefined : new Date(selectedDate)}
                onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : 'all')}
                className="rounded-md border-none"
                locale={fr}
                modifiers={{
                  booked: (date) => uniqueDates.includes(format(date, 'yyyy-MM-dd')),
                }}
                modifiersStyles={{
                  booked: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--primary)' }
                }}
              />
            </CardContent>
          </Card>

          {/* SÉCTION : SURVEILLANCE DE LA FLOTTE (Même jour) */}
          {selectedDate !== 'all' && (
            <Card className="glass-card shadow-premium">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  État de la Flotte
                </CardTitle>
                <CardDescription>Remplissage par véhicule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {camions.map(camion => {
                  const items = livraisons.filter(l => l.datePrevue === selectedDate && l.camionId === camion.id);
                  const res = calculateLoad(items, camion);
                  const vol = res.volumeCharge;
                  const perc = res.tauxCharge;
                  const isOverloaded = res.volumeUtilise > camion.volumeMax;

                  return (
                    <div key={camion.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{camion.nom}</span>
                        <span className={cn("font-mono", isOverloaded ? "text-destructive" : "text-muted-foreground")}>
                          {vol.toFixed(1)} / {camion.volumeMax} m³ ({perc}%)
                        </span>
                      </div>
                      <Progress
                        value={perc > 100 ? 100 : perc}
                        className={cn("h-1.5",
                          isOverloaded ? "[&>div]:bg-destructive" :
                            perc > 85 ? "[&>div]:bg-warning" : "[&>div]:bg-success"
                        )}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Filtre Camion Rapide */}
          <Card className="glass-card shadow-premium">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Focus Véhicule</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCamion} onValueChange={setSelectedCamion}>
                <SelectTrigger className="w-full bg-background/50 border-border/50">
                  <Truck className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Camion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les camions</SelectItem>
                  {camions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite: Capacité & Liste */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">
              {selectedDate === 'all'
                ? "Toutes les livraisons à venir"
                : formatDate(selectedDate)
              }
            </h3>

            {viewMode === 'day' ? (
              <Button className="gap-2" onClick={handleOptimize} variant="outline">
                <Navigation className="h-4 w-4" />
                Optimiser & Sync
              </Button>
            ) : (
              <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleOptimizeWeekOrder}>
                <Wrench className="h-4 w-4" />
                Optimiser l'Ordre Semaine
              </Button>
            )}
          </div>

          {/* Capacity Card */}
          <div className={cn(
            "rounded-xl border p-6 transition-colors shadow-glow",
            !capacityCheck.success ? "border-destructive/50 bg-destructive/10" : "glass-card"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/20 p-2">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{activeCamion.nom}</h3>
                  <p className="text-sm text-foreground/80">
                    {capacityCheck.message}
                  </p>
                </div>
              </div>
              <Badge
                className={cn(
                  capacityCheck.tauxCharge >= 100
                    ? 'bg-destructive text-destructive-foreground'
                    : capacityCheck.tauxCharge >= 90
                      ? 'bg-destructive/20 text-destructive'
                      : capacityCheck.tauxCharge >= 70
                        ? 'bg-warning/20 text-warning'
                        : 'bg-success/20 text-success'
                )}
              >
                {capacityCheck.tauxCharge}% chargé
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Volume actuel (dans le camion)</span>
                <span className="font-mono font-medium text-foreground">
                  {capacityCheck.volumeCharge} / {activeCamion.volumeMax} m³
                </span>
              </div>
              <Progress
                value={capacityCheck.tauxCharge > 100 ? 100 : capacityCheck.tauxCharge}
                className={cn(
                  'h-4',
                  capacityCheck.tauxCharge >= 100
                    ? '[&>div]:bg-destructive'
                    : capacityCheck.tauxCharge >= 90
                      ? '[&>div]:bg-destructive'
                      : capacityCheck.tauxCharge >= 70
                        ? '[&>div]:bg-warning'
                        : '[&>div]:bg-success'
                )}
              />
              <p className="text-xs text-muted-foreground">
                {capacityCheck.success
                  ? `Espace disponible réel : ${(activeCamion.volumeMax - capacityCheck.volumeCharge).toFixed(1)} m³`
                  : `⚠️ SURCHARGE TOTALE : ${(capacityCheck.volumeUtilise - activeCamion.volumeMax).toFixed(2)} m³`
                }
              </p>
            </div>
          </div>

          {/* Deliveries Timeline */}
          <div className="glass-card">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold text-foreground">Ordre de livraison</h3>
              <p className="text-sm text-muted-foreground">
                Itinéraire optimisé par proximité géographique {viewMode === 'week' ? '(Vue Semaine)' : ''}
              </p>
            </div>

            <div className="p-4">
              <div className="relative space-y-4">
                {/* Conditional Rendering for Week View Grouping */}
                {viewMode === 'week' ? (
                  Array.from(new Set(filteredLivraisons.map(l => l.datePrevue))).map(dateGroup => (
                    <div key={dateGroup} className="mb-8">
                      <h4 className="text-md font-bold mb-4 flex items-center gap-2 text-primary border-b border-primary/20 pb-2">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDate(dateGroup)}
                      </h4>
                      <div className="space-y-4 pl-4 border-l-2 border-primary/10">
                        {filteredLivraisons.filter(l => l.datePrevue === dateGroup).map((livraison, index) => (
                          <LivraisonItem
                            key={livraison.id}
                            livraison={livraison}
                            index={index}
                            camions={camions}
                            statusConfig={statusConfig}
                            handleStatusChange={handleStatusChange}
                            onAssignDriver={handleDriverAssignment}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                    {filteredLivraisons.map((livraison, index) => (
                      <LivraisonItem
                        key={livraison.id}
                        livraison={livraison}
                        index={index}
                        camions={camions}
                        statusConfig={statusConfig}
                        handleStatusChange={handleStatusChange}
                        onAssignDriver={handleDriverAssignment}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale d'Installation (hors des boucles) */}
      <InstallationModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        client={selectedLivraisonForInstall?.client || null}
        allClients={rawClients}
        onConfirm={handleInstallConfirm}
      />
    </div >
  );
}

// Extracted Component for cleaner loop
function LivraisonItem({ livraison, index, camions, statusConfig, handleStatusChange, onAssignDriver }: any) {
  return (
    <div
      className="relative flex items-start gap-4 rounded-lg p-4 transition-colors hover:bg-muted/50"
    >
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-mono font-semibold text-sm border-2',
          livraison.statut === 'LIVRÉE'
            ? 'bg-success border-success text-success-foreground'
            : livraison.statut === 'EN_COURS'
              ? 'bg-warning border-warning text-warning-foreground'
              : 'bg-card border-border text-muted-foreground'
        )}
      >
        {livraison.statut === 'LIVRÉE' ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          index + 1
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">
                {livraison.client.prenom} {livraison.client.nom}
              </h4>

              {/* Driver Selector */}
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={camions.some((c: any) => c.id === livraison.camionId) ? livraison.camionId : undefined}
                  onValueChange={(val: string) => onAssignDriver(livraison.id, val)}
                >
                  <SelectTrigger className="h-6 text-[11px] w-[130px] bg-blue-50/50 border-blue-200 text-blue-700 gap-1 px-2 focus:ring-0 focus:ring-offset-0">
                    <Truck className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Assigner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {camions.map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {livraison.client.adresse}, {livraison.client.ville}
              </span>
            </div>
          </div>
          <Badge className={statusConfig[livraison.statut].color}>
            {statusConfig[livraison.statut].label}
          </Badge>
        </div>

        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-foreground">
              {livraison.client.nombreLED} LED
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-foreground">
              {livraison.volumeTotal} m³
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {new Date(livraison.datePrevue).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
              {(livraison as any).heureLivraison ? ` à ${(livraison as any).heureLivraison}` : ''}
            </span>
          </div>
        </div>

        {/* Actions */}
        {livraison.statut !== 'LIVRÉE' ? (
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" className="gap-2">
              <Navigation className="h-4 w-4" />
              Waze
            </Button>
            <Button
              size="sm"
              className={cn(
                "gap-2 transition-all",
                livraison.statut === 'A_VALIDER'
                  ? "bg-orange-500 hover:bg-orange-600 animate-pulse shadow-md"
                  : "bg-primary"
              )}
              onClick={() => handleStatusChange(livraison.id, 'LIVRÉE')}
            >
              <CheckCircle2 className="h-4 w-4" />
              {livraison.statut === 'A_VALIDER' ? "CONFIRMER LA LIVRAISON" : "Marquer livrée"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 text-sm text-green-600 font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Livraison terminée
            {(livraison as any).heureLivraison ? ` à ${(livraison as any).heureLivraison}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// End of Component - Placeholder to eat up the old map logic
const _OLD_CODE = null;
