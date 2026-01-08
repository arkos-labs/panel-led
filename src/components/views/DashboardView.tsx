import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { isSameDay, isSameMonth, startOfMonth, isAfter } from 'date-fns';
import { getInstallationStatus, isDeliveryActive, parseClientDate, getClientDeliveryDate } from '@/lib/business-logic';
import { mapSupabaseClient } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { supabase } from '@/lib/supabaseClient';
import { Users, Truck, Wrench, AlertTriangle, BarChart3 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { StockAlert } from '@/components/dashboard/StockAlert';
import { ClientsToContact } from '@/components/dashboard/ClientsToContact';
import { DeliveriesInProgress } from '@/components/dashboard/DeliveriesInProgress';
import { DeliverySchedule } from '@/components/dashboard/DeliverySchedule';
import { InstallationProgress } from '@/components/dashboard/InstallationProgress';
import { DateNavigator } from '@/components/common/DateNavigator';
import { format } from 'date-fns';

export function DashboardView() {
  const [data, setData] = useState({
    clients: [],
    livraisons: [],
    installations: [],
    stock: { total: 0, consommees: 0, restantes: 0, pourcentage: 0, critique: false }
  });

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Helper: Retry wrapper
  const retryFetch = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(r => setTimeout(r, delay));
      return retryFetch(fn, retries - 1, delay);
    }
  };

  const fetchData = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url || !url.startsWith('http')) {
      toast.error("Configuration Erreur: URL Supabase invalide.");
      setLoading(false);
      return;
    }

    try {
      // 1. Parallel Fetching: Stock (Legacy API) & Clients (Supabase)
      const [clientsResult, stockResult] = await Promise.allSettled([
        retryFetch(() => supabase.from('clients').select('*'), 3, 1000),
        fetch(`/api/stock/global?zone=${localStorage.getItem('stock_zone') || 'FR'}`)
      ]);

      // --- PROCESS CLIENTS ---
      let clients: any[] = [];
      if (clientsResult.status === 'fulfilled') {
        const { data: rawClients, error } = clientsResult.value;
        if (error) throw error;
        clients = (rawClients || []).map(c => mapSupabaseClient(c));
      } else {
        console.error("❌ Critical: Failed to load clients", clientsResult.reason);
        toast.error("Erreur connexion Supabase (Clients).");
      }

      // --- PROCESS STOCK ---
      let stockData = { total: 0, consommees: 0, restantes: 0, pourcentage: 0, critique: false };
      if (stockResult.status === 'fulfilled' && stockResult.value.ok) {
        try {
          const stockJson = await stockResult.value.json();
          stockData = {
            total: stockJson.total,
            consommees: stockJson.consommees,
            restantes: stockJson.restantes,
            pourcentage: stockJson.pourcentage,
            critique: stockJson.critique
          };
        } catch (e) {
          console.warn("Stock parsing error", e);
        }
      } else {
        console.warn("Stock API unreachable (Backend server may be restarting)");
      }

      // --- COMPUTE DASHBOARD DATA ---
      const deliveriesList = clients
        .filter((c: any) => {
          const log = (c.statut_livraison || '').toUpperCase();
          const s = (c.statut_client || '').toUpperCase();
          if (log.includes('LIVRÉ') || log.includes('LIVREE')) return false;
          return (log.includes('PLANIFI') || s === 'EN_COURS' || c.date_livraison_prevue) && !log.includes('NON');
        })
        .map((c: any, i: number) => {
          const datePrevue = c.date_livraison_prevue || new Date().toISOString();
          let statut = 'PLANIFIÉE';
          const sLiv = (c.statut_livraison || '').toUpperCase();
          if (sLiv.includes('EN_COURS')) statut = 'EN_COURS';

          return {
            id: `liv-${c.id}`,
            clientId: c.id,
            datePrevue: datePrevue,
            heureLivraison: c.heure_livraison,
            statut: statut,
            volumeTotal: (c.nb_led || 0) * 0.05,
            client: c,
            type: 'LIVRAISON',
            ordre: i
          };
        });

      const installationsList = clients
        .filter((c: any) => {
          const installStatus = (c.statut_installation || '').toUpperCase();
          if (installStatus.includes('TERMIN') || installStatus.includes('CLOTUR')) return false;
          return c.date_install_debut || installStatus.includes('PLANIFI') || installStatus === 'EN_COURS';
        })
        .map((c: any, i: number) => {
          const datePrevue = c.date_install_debut || new Date().toISOString();
          let statut = 'PLANIFIÉE';
          const sInst = (c.statut_installation || '').toUpperCase();
          if (sInst.includes('EN_COURS')) statut = 'EN_COURS';

          return {
            id: `inst-${c.id}`,
            clientId: c.id,
            datePrevue: datePrevue,
            heureLivraison: '08:00',
            statut: statut,
            volumeTotal: 0,
            client: c,
            type: 'INSTALLATION',
            ordre: i + 10000
          };
        });

      setData({
        clients: clients,
        livraisons: [...deliveriesList, ...installationsList],
        installations: [],
        stock: stockData
      });

    } catch (e: any) {
      console.error("Dashboard Global Load Error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for socket updates
  useSocketUpdate('clients', fetchData);
  useSocketUpdate('stock', fetchData);



  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const clientsToContactCount = data.clients.filter((c: any) => {
    const s = (c.statut_client || '').toUpperCase();
    const l = (c.logistique || '').toUpperCase();

    // Logic must match ClientsView:
    // Exclude if already planned/active (State 2+)
    const isEnCours = s.includes('EN COURS') || s.includes('CONFIRM') || s.includes('LIVR') || s.includes('INSTALL') || s.includes('2.') || s.includes('3.') || s.includes('4.') || s.includes('5.') || l.includes('PLANIFIÉE') || l.includes('LIVRÉE');

    // But be careful, "À PLANIFIER" contains "PLANIFI"...
    // Let's use negative logic: It counts if it is NOT "En Cours" logic AND is a valid client
    if (isEnCours && !s.includes('À PLANIFIER') && !s.includes('NON PLANIFI')) return false;

    // Explicit inclusions (State 1) or EMPTY/NULL (New clients)
    if (!s || s.trim() === '' || s.includes('1.') || s.includes('SIGN') || s.includes('PLANIFIER') || s === 'A_RAPPELER' || l === 'NON_PLANIFIÉ') return true;

    return false;
  }).length;

  // Deriving Counts from Clients (Single Source of Truth)
  // Derived Counts from Clients (Single Source of Truth)
  const today = new Date();

  // 1. Deliveries for the selected date
  // 1. Deliveries (Global Active)
  // User wants "Commande Client" -> All deliveries that are PLANNED or IN PROGRESS
  const deliveriesActiveList = data.clients.filter((c: any) => {
    const s = (c.statut_livraison || '').toUpperCase();
    // Active = Planifiée (2) or En Cours (2/3) but not yet fully finished (LIVRÉ is done for delivery step)
    // Actually, usually "Commande Client" implies the whole backlog of orders to deliver.
    // If we strictly follow "En cours", it's State 2.
    // Let's count everyone who has a Date Planned (State 2) OR is currently being delivered.
    return (s === 'PLANIFIÉE' || s === 'PLANIFIEE' || s === 'EN_COURS') && isDeliveryActive(c);
  });

  const deliveriesTotal = deliveriesActiveList.length;
  // For the "Done" part, maybe we show "Livrées aujourd'hui" ? 
  // Or just 0/Total to show progress of the backlog?
  // Let's stick to standard "Active vs Today Done" or just "Active Total".
  // User said "Commande Client... réellement". 
  // Let's show Total Active.
  const deliveriesDone = data.clients.filter((c: any) => {
    // Livrées aujourd'hui pour le fun ? Non, restons simple.
    // S'il veut "Commandes", c'est le volume.
    return false;
  }).length;

  // 2. Installations (Global Active)
  const installationsRelevant = data.clients.filter((c: any) => {
    const status = (c.statut_installation || '').toUpperCase();
    return status === 'PLANIFIÉE' || status === 'PLANIFIEE' || status === 'EN_COURS';
  });

  const installationsTotal = installationsRelevant.length;
  const installationsDone = 0; // Reset to 0 for global view clarity unless we count total finished ever (which is history)

  const deliveriesRemaining = deliveriesTotal - deliveriesDone;
  const installationsRemaining = installationsTotal - installationsDone;

  const stockCritique = data.stock?.critique ? 1 : 0;

  // 3. Yearly Stats (REAL INFO)
  const currentYear = new Date().getFullYear();

  const finishedClients = data.clients.filter((c: any) => {
    // 1. Check Status
    const status = getInstallationStatus(c);
    const isFinished = status === 'TERMINEE';

    if (!isFinished) return false;

    // 2. Check Year (Real Date, Planned Date, or Update Date)
    const dateFin = parseClientDate((c as any).date_install_fin_reelle || c.date_install_fin || c.updated_at);
    return dateFin && dateFin.getFullYear() === currentYear;
  });

  const totalLedsYear = finishedClients.reduce((acc: number, c: any) => acc + (c.nb_led || 0), 0);
  const totalProjectsYear = finishedClients.length;

  // LEDs Delivered (all clients marked as delivered in the current year)
  const deliveredClients = data.clients.filter((c: any) => {
    // 1. Check Status
    const s = (c.statut_livraison || '').toUpperCase();
    const isDelivered = s.includes('LIVRÉ') || s.includes('LIVREE');

    if (!isDelivered) return false;

    // 2. Check Year (Real Date, or Planned Date if missing, or Updated At)
    // Priority: date_livraison_reelle > date_livraison_prevue > updated_at
    const dateLiv = parseClientDate((c as any).date_livraison_reelle || c.date_livraison_prevue || c.updated_at);
    return dateLiv && dateLiv.getFullYear() === currentYear;
  });

  const totalLedsDeliveredYear = deliveredClients.reduce((acc: number, c: any) => acc + (c.nb_led || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Sélecteur de Date Global (Style User) */}
      <div className="flex flex-col items-center py-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm -mx-6 px-6 sticky top-0 z-20">
        <DateNavigator
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clients à contacter"
          value={clientsToContactCount}
          subtitle="Projets Validés / À Planifier"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Commandes Clients"
          value={deliveriesTotal}
          subtitle="En attente de livraison"
          icon={Truck}
          variant="success"
        />
        <StatCard
          title="Commandes Chantiers"
          value={installationsTotal}
          subtitle="En cours d'installation"
          icon={Wrench}
          variant="default"
        />
        <StatCard
          title="Stock critique"
          value={stockCritique}
          subtitle="Références en alerte"
          icon={AlertTriangle}
          variant={stockCritique > 0 ? 'destructive' : 'default'}
        />
      </div>

      {/* Annual Summary Section */}
      {/* Annual Summary Section - Dark Theme Specific */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-[#111827] text-white p-6 shadow-sm transition-all">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <BarChart3 className="w-32 h-32 text-white" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-white">Bilan Annuel {new Date().getFullYear()}</h2>
            <p className="text-slate-400">Progression et consommation totale de l'année en cours</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-right md:text-left">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sites Livrés</p>
              <p className="text-3xl font-bold text-success font-mono">{deliveredClients.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total LEDs Posées</p>
              <p className="text-3xl font-bold text-primary font-mono">{totalLedsYear.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chantiers Terminés</p>
              <p className="text-3xl font-bold text-white font-mono">{totalProjectsYear}</p>
            </div>
            <div className="hidden md:block space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Moyenne LED / Chantier</p>
              <p className="text-xl font-bold text-slate-400 font-mono">
                {totalProjectsYear > 0 ? Math.round(totalLedsYear / totalProjectsYear).toLocaleString() : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Note: ClientsToContact might expect legacy fields. If it breaks, we fix it next. Passing mapped data might be better but let's try raw first or map inside. */}
          <ClientsToContact
            clients={data.clients.map((c: any) => ({
              ...c,
              statut: c.statut_client, // Legacy Mapping
              nom: c.nom,
              prenom: c.prenom,
              ville: c.adresse_brute ? c.adresse_brute.split(',').pop()?.trim() : '',
              dateSignature: c.updated_at
            }))}
            onRefresh={fetchData}
          />

          <DeliverySchedule
            livraisons={data.livraisons}
            camionCapacite={15} // Capacité par défaut
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <StockAlert stocks={data.stock} />
          <InstallationProgress installations={
            data.clients
              .filter((c: any) => {
                const log = (c.statut_livraison || '').toUpperCase();
                const installStatus = (c.statut_installation || '').toUpperCase();
                return (log.includes('LIVRÉ') || installStatus !== 'ATTENTE')
                  && installStatus !== 'TERMINÉ';
              })
              .map((c: any) => {
                // Calculate Dates
                const parsedStart = parseClientDate(c.date_install_debut);
                const start = parsedStart && !isNaN(parsedStart.getTime()) ? parsedStart : new Date();
                const nbLed = c.nb_led || 0;
                const duration = Math.ceil(nbLed / 60) || 1;
                const end = new Date(start);
                end.setDate(end.getDate() + duration);
                const now = new Date();

                // Determine Status
                let status = 'PLANIFIÉE';
                const installStatus = (c.statut_installation || '').toUpperCase();

                if (installStatus === 'EN_COURS' || installStatus === 'TERMINÉ') {
                  status = installStatus;
                } else if (now >= start) {
                  status = 'EN_COURS'; // Auto-switch if date passed (optional)
                }

                return {
                  id: `inst-${c.id}`,
                  clientId: c.id,
                  poseurId: c.poseur_id || 'Équipe 1',
                  statut: status as any,
                  dateDebut: start.toISOString(),
                  dateFin: end.toISOString(),
                  dureeJours: duration,
                  client: {
                    ...c,
                    nom: c.nom,
                    prenom: c.prenom,
                    adresse: c.adresse_brute
                  }
                };
              })
          } />
        </div>
      </div>
    </div>
  );
}
