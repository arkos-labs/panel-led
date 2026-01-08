import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  Wrench,
  Calendar as CalendarIcon,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, parseSafeDate, isZoneMatch, mapSupabaseClient } from '@/lib/utils';
import { getClientCommandoZone, getCommandoDayForDept, COMMANDO_ZONES } from '@/lib/regions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlanningModal } from '@/components/modals/PlanningModal';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { getClientDeliveryDate } from '@/lib/business-logic';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Couleurs fixes des zones (identiques au Modal)
// Couleurs fixes des zones (identiques au Modal)
const ZONE_BG_COLORS: Record<number, string> = {
  1: "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20",
  2: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20",
  3: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20",
  4: "bg-orange-500/10 border-orange-500/20 text-orange-300 hover:bg-orange-500/20",
  5: "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20",
  6: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20",
  7: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"
};

const ZONE_TEXT_KEY_COLORS: Record<number, string> = {
  1: "text-blue-700",
  2: "text-cyan-700",
  3: "text-yellow-700",
  4: "text-orange-700",
  5: "text-red-700",
  6: "text-indigo-700",
  7: "text-emerald-700"
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Convert to Monday = 0
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [planningClient, setPlanningClient] = useState<any | null>(null);
  const [syncStatus, setSyncStatus] = useState({ sheets: false, calendar: false });
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedZone, setSelectedZone] = useState<string>('FR'); // NEW: Zone Filter

  // Calcul de la zone dominante par jour pour le coloriage
  const [dayZones, setDayZones] = useState<Record<string, number>>({});

  // Camions pour l'assignation en masse
  const [camions, setCamions] = useState<any[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchClients = async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/api/clients`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setClients(data.map(mapSupabaseClient));
      }
    } catch (e) {
      console.error("Erreur chargement calendrier", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => isZoneMatch(c.zone_pays, selectedZone));

  // Détermine la couleur de fond de chaque jour en fonction des clients
  const calculateDayZones = (clientList: any[]) => {
    const counts: Record<string, Record<number, number>> = {};

    clientList.forEach(c => {
      const d = getClientDeliveryDate(c);
      if (!d) return;
      const dateStr = format(d, 'yyyy-MM-dd');

      const dept = (c.codePostal || c.code_postal || "75").substring(0, 2);
      const zoneId = getCommandoDayForDept(dept);

      if (!counts[dateStr]) counts[dateStr] = {};
      counts[dateStr][zoneId] = (counts[dateStr][zoneId] || 0) + 1;
    });

    const mapping: Record<string, number> = {};
    Object.keys(counts).forEach(date => {
      let max = 0;
      let win = 0;
      Object.entries(counts[date]).forEach(([z, n]) => {
        if (n > max) { max = n; win = parseInt(z); }
      });
      if (win > 0) mapping[date] = win;
    });
    setDayZones(mapping);
  };

  // RE-CALCULATE ZONES WHEN FILTER CHANGES
  useEffect(() => {
    calculateDayZones(filteredClients);
  }, [clients, selectedZone]);


  useEffect(() => {
    fetchClients();
    fetch(`http://${window.location.hostname}:3001/api/status/google`)
      .then(res => res.json())
      .then(data => setSyncStatus(data))
      .catch(() => { });

    // Fetch trucks for bulk assign
    fetch(`http://${window.location.hostname}:3001/api/resources`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          // Replicate logic from FleetMonitorView to get valid trucks
          const trucks = data
            .filter((r: any) => r.type === 'LIVREUR' && !r.nom.includes('Gros'))
            .sort((a: any, b: any) => b.nom.localeCompare(a.nom)) // Nicolas (N) First
            .slice(0, 2);

          if (trucks.length > 0) {
            setCamions(trucks);
            return;
          }
        }
        // Fallback if data is empty or filtered out
        throw new Error("No trucks found");
      })
      .catch((err) => {
        console.warn("Using fallback trucks due to error:", err);
        setCamions([
          { id: '1', nom: 'Nicolas (Fallback)', type: 'LIVREUR' },
          { id: '2', nom: 'David (Fallback)', type: 'LIVREUR' }
        ]);
      });
  }, []);

  const handleBulkAssign = async (clientsToAssign: any[], truckId: string) => {
    if (!clientsToAssign.length) return;
    const truck = camions.find(c => c.id === truckId);
    if (!truck) return;

    const promise = new Promise(async (resolve, reject) => {
      try {
        const clientIds = clientsToAssign.map(c => c.client.id);
        if (clientIds.length === 0) {
          resolve("Aucun client à assigner.");
          return;
        }

        // Utiliser l'API Bulk pour s'assurer que l'agenda Google est mis à jour
        const response = await fetch(`http://${window.location.hostname}:3001/api/livraisons/bulk-planifier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientIds: clientIds,
            date: selectedDate ? format(new Date(selectedDate), 'yyyy-MM-dd') : undefined, // Ensure selectedDate is handled
            camionId: truckId
          })
        });

        if (!response.ok) {
          throw new Error("Erreur lors de l'assignation");
        }

        toast.success(`${clientIds.length} livraisons assignées !`);

        // Refresh data
        fetchClients();
        resolve(`${clientIds.length} clients assignés à ${truck.nom}`);
      } catch (err) {
        console.error(err);
        reject("Erreur lors de l'assignation");
      }
    });

    toast.promise(promise, {
      loading: "Assignation en cours...",
      success: (msg: any) => `✅ ${msg}`,
      error: "Erreur lors de l'assignation"
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForDate = (date: string) => {
    const livraisons = filteredClients.filter((c) => {
      // Supporte les deux champs de date (App > Legacy) via helper unifié
      const d = getClientDeliveryDate(c);
      return d && format(d, 'yyyy-MM-dd') === date;
    }).map(c => ({ id: c.id, client: c }));

    // Installations (Similaire)
    const installations = filteredClients.filter((c) => {
      if (!c.dateDebutTravaux) return false;
      const start = parseSafeDate(c.dateDebutTravaux);
      if (!start) return false;

      const startStr = format(start, 'yyyy-MM-dd');
      let endStr = startStr;

      if (c.dateFinTravaux) {
        const end = parseSafeDate(c.dateFinTravaux);
        if (end) endStr = format(end, 'yyyy-MM-dd');
      }

      return date >= startStr && date <= endStr;
    }).map(c => ({ id: c.id, client: c, statut: c.statut, dureeJours: 1 }));

    return { livraisons, installations };
  };

  const days = [];
  // Previous month days
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: null, date: null });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ day: i, date: dateStr });
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : null;

  const handleConfirmPlanning = async (data: { date: Date; camionId: string }, optimizationPlan?: any) => {
    if (!planningClient) return;
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          statut_livraison: 'PLANIFIÉ',
          date_livraison_prevue: format(data.date, 'yyyy-MM-dd'),
          livreur_id: data.camionId
        })
        .eq('id', planningClient.id);

      if (error) throw error;

      toast.success("Livraison planifiée avec succès");
      setPlanningClient(null);
      fetchClients(); // Refresh data
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la planification");
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Calendrier Global</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            Supervision des tournées par zone géographique
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
        {/* Légende Rapide */}
        <div className="flex gap-2 text-[10px]">
          {Object.entries(COMMANDO_ZONES).map(([id, z]) => (
            <div key={id} className={`px-2 py-1 rounded border ${ZONE_BG_COLORS[parseInt(id)]} flex items-center gap-1`}>
              <span>{z.emoji}</span> <span className="hidden xl:inline text-current font-medium">{z.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Calendar */}
        <div className="lg:col-span-3 glass-card p-0 overflow-hidden shadow-premium">
          {/* Month Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="text-xl font-bold text-foreground capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h3>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="hover:bg-white/10">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
            {DAYS.map((day) => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-transparent gap-px border border-white/5">
            {days.map((item, index) => {
              const events = item.date ? getEventsForDate(item.date) : null;
              const isToday = item.date === new Date().toISOString().split('T')[0];
              const isSelected = item.date === selectedDate;
              const zoneId = item.date ? dayZones[item.date] : 0;

              // Style de la case
              const bgClass = zoneId > 0 ? ZONE_BG_COLORS[zoneId] : "bg-card/30 hover:bg-card/50";

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-[140px] p-2 transition-all relative flex flex-col gap-1 group border border-white/5',
                    item.day ? 'cursor-pointer hover:border-primary/30' : 'bg-transparent',
                    item.day && bgClass,
                    isSelected && 'ring-2 ring-primary ring-inset z-10 shadow-glow'
                  )}
                  onClick={() => item.date && setSelectedDate(item.date)}
                >
                  {item.day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                            isToday ? 'bg-primary text-black shadow-glow' : 'text-muted-foreground'
                          )}>
                            {item.day}
                          </span>
                          {/* Indicateur Fully Assigned - Seulement si assigné à un vrai camion (Nicolas/David) */}
                          {events &&
                            events.livraisons.length > 0 &&
                            events.livraisons.every(l => l.client.livreur_id && camions.some(t => t.id === l.client.livreur_id)) && (
                              <div className="bg-green-100 text-green-700 rounded-full p-0.5" title="Journée entièrement dispatchée">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </div>
                            )}
                        </div>
                        {/* Badge Zone (Emoji) */}
                        {zoneId > 0 && (
                          <span className="text-lg" title={COMMANDO_ZONES[zoneId as any]?.name}>
                            {COMMANDO_ZONES[zoneId as any]?.emoji}
                          </span>
                        )}
                      </div>

                      {/* Liste Clients Compacte */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                        {events?.livraisons.slice(0, 3).map((l, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-[10px] bg-black/40 border border-white/5 px-1.5 py-0.5 rounded shadow-sm truncate text-white/90">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${zoneId > 0 ? 'bg-current opacity-70' : 'bg-primary'}`}></div>
                            <span className="font-semibold truncate">{l.client.prenom} {l.client.nom}</span>
                            <span className="opacity-70 text-[9px] truncate ml-auto">{l.client.ville}</span>
                          </div>
                        ))}
                        {events && events.livraisons.length > 3 && (
                          <div className="text-[10px] font-medium text-center text-slate-500 bg-white/40 rounded px-1">
                            + {events.livraisons.length - 3} autres
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Details */}
        <div className="space-y-4 h-full flex flex-col">
          <div className="glass-card p-4 flex-1 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg text-foreground capitalize">
                {selectedDate
                  ? format(new Date(selectedDate), 'EEEE d MMMM', { locale: fr })
                  : 'Détails du jour'}
              </h3>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              {selectedEvents ? (
                <div className="space-y-4">
                  {selectedEvents.livraisons.length > 0 && (
                    <div>
                      {/* En-tête avec Actions de Groupe */}
                      <div className="flex flex-col gap-2 mb-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Truck className="h-3 w-3" /> Livraisons ({selectedEvents.livraisons.length})
                        </p>

                        {/* BULK ACTIONS */}
                        {camions.length > 0 && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase">Tout affecter à :</p>
                            <div className="grid grid-cols-2 gap-2">
                              {camions.map(truck => {
                                const isFullyAssigned = selectedEvents.livraisons.every(l => l.client.livreur_id === truck.id);
                                return (
                                  <Button
                                    key={truck.id}
                                    size="sm"
                                    variant={isFullyAssigned ? "secondary" : "outline"}
                                    disabled={isFullyAssigned}
                                    className={cn(
                                      "h-8 text-xs font-medium transition-colors",
                                      isFullyAssigned
                                        ? "bg-green-100 text-green-700 border-green-200 cursor-default opacity-100"
                                        : "hover:bg-slate-900 hover:text-white"
                                    )}
                                    onClick={() => handleBulkAssign(selectedEvents.livraisons, truck.id)}
                                  >
                                    {isFullyAssigned ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                        Déjà assigné
                                      </>
                                    ) : (
                                      truck.nom.split(' ')[0]
                                    )}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {selectedEvents.livraisons.map((livraison) => (
                          <div
                            key={livraison.id}
                            className="rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                {livraison.client.prenom} {livraison.client.nom}
                              </span>
                              <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-muted-foreground">
                                {livraison.client.nombreLED || 0} LEDs
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                              <span>📍 {livraison.client.ville}</span>
                              <span>•</span>
                              <span>{livraison.client.codePostal}</span>
                            </div>
                            {livraison.client.livreur_id ? (
                              <div className="mt-2 flex items-center gap-2">
                                <Badge variant="secondary" className="w-full justify-center bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                                  <Truck className="h-3 w-3 mr-1.5" />
                                  {camions.find(c => c.id === livraison.client.livreur_id)?.nom || "Assigné"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-600"
                                  onClick={() => setPlanningClient(livraison.client)}
                                  title="Modifier"
                                >
                                  <Wrench className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full text-xs h-7"
                                onClick={() => setPlanningClient(livraison.client)}
                              >
                                <Truck className="h-3 w-3 mr-2" />
                                Gérer / Dispatcher
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEvents.livraisons.length === 0 && selectedEvents.installations.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <p>Rien de prévu pour cette date.</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Cliquez sur une case pour voir le détail de la journée.
                </p>
              )}
            </div>
          </div>



          <div className="glass-card p-4">
            <h4 className="font-bold text-foreground mb-2 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Synchronisation
            </h4>
            {syncStatus.calendar ? (
              <div className="text-xs text-green-700 font-medium">
                ✅ Google Calendar connecté
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Connexion Google en attente...
              </div>
            )}
          </div>
        </div>
      </div>

      {
        planningClient && (
          <PlanningModal
            client={planningClient}
            allClients={clients}
            isOpen={!!planningClient}
            onClose={() => setPlanningClient(null)}
            onConfirm={handleConfirmPlanning}
            initialDate={selectedDate ? new Date(selectedDate) : undefined}
          />
        )
      }
    </div >
  );
}
