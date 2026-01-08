import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

import { toast } from "sonner";
import {
  Phone,
  MapPin,
  CheckCircle2,
  Filter,
  PhoneIncoming,
  LocateFixed,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import { MassGeocoder } from '@/services/MassGeocoder';
import { QuickPlanningModal } from '@/components/modals/QuickPlanningModal';
import { CallActionModal } from '@/components/modals/CallActionModal';
import { CountdownTimer } from '@/components/common/CountdownTimer';
// import { mockClients } from '@/data/mockData';
import { Client } from '@/types/logistics';
import { ClientSuggestionBadge } from '@/components/scheduler/ClientSuggestionBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, mapSupabaseClient, isZoneMatch } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { getClientCommandoZone, COMMANDO_ZONES } from '@/lib/regions';
import { isStatusPlanned } from '@/lib/business-logic';

function getDaysUntilDeadline(dateSignature: string): number {
  const signature = new Date(dateSignature);
  const deadline = new Date(signature);
  deadline.setDate(deadline.getDate() + 7);
  const today = new Date();
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function ClientsView() {
  const [planningModalOpen, setPlanningModalOpen] = useState(false);
  const [selectedClientForPlanning, setSelectedClientForPlanning] = useState<Client | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedClientForCall, setSelectedClientForCall] = useState<Client | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>(() => {
    return localStorage.getItem('clients_view_zone') || 'FR';
  });
  const [selectedCommandoDay, setSelectedCommandoDay] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('clients_view_zone', selectedZone);
  }, [selectedZone]);

  const fetchClients = useCallback(async () => {
    try {
      const { data: clients, error } = await supabase.from('clients').select('*');
      if (error) throw error;

      const mappedClients = (clients || []).map(mapSupabaseClient);
      setClients(mappedClients);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();

    // Le polling setInterval est supprimé car useSocketUpdate gère déjà le temps réel.
    // Cela évite le rafraîchissement/clignotement inutile de la page.
  }, []);

  // Listen for socket updates
  useSocketUpdate('clients', () => {
    console.log("⚡ ClientsView receiving socket update -> Fetching clients");
    fetchClients();
  });

  const openPlanning = (client: Client) => {
    setSelectedClientForPlanning(client);
    setPlanningModalOpen(true);
  };

  const closePlanning = () => {
    setPlanningModalOpen(false);
    setSelectedClientForPlanning(null);
    setInitialDate(undefined);
  };

  const handlePlanningConfirm = async (data: { date: Date; camionId: string }) => {
    try {
      if (!selectedClientForPlanning) return;

      // FIX: Use YYYY-MM-DD format for consistency
      const dateStr = format(data.date, 'yyyy-MM-dd');

      // Call Backend API to handle everything (Supabase + Google Calendar + Sheets)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/planning/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientForPlanning.id,
          date: dateStr,
          camionId: data.camionId,
          clientName: `${selectedClientForPlanning.prenom} ${selectedClientForPlanning.nom}`,
          address: selectedClientForPlanning.adresse || '',
          nbLed: selectedClientForPlanning.nombreLED || selectedClientForPlanning.nb_led || 0
        })
      });

      if (!response.ok) {
        // Gérer les conflits de planning (409)
        if (response.status === 409) {
          const errorData = await response.json();
          if (errorData.error === 'CONFLIT_PLANNING') {
            toast.error(
              `⚠️ Conflit de planning : ${errorData.message}`,
              { duration: 8000 }
            );
            return;
          }
        }
        throw new Error("Erreur serveur lors de la planification");
      }

      toast.success(`📅 Livraison planifiée pour ${selectedClientForPlanning?.nom} !`);

      // Optimistic update: Remove client immediately from the list
      setClients(prev => prev.map(c =>
        c.id === selectedClientForPlanning?.id
          ? { ...c, date_livraison_prevue: dateStr, statut: 'PLANIFIÉ' as any, logistique: 'PLANIFIÉE' }
          : c
      ));

      closePlanning();

      // Background fetch to ensure consistency
      fetchClients();

    } catch (e: any) {
      console.error("❌ Erreur planification:", e);
      toast.error(`Erreur de sauvegarde: ${e.message || 'Connexion refusée'}`);
    }
  };

  const filteredClients = clients.filter((client) => {
    if (!isZoneMatch(client.zone_pays, selectedZone)) return false;

    // 2. Commando Day Filter (Only for FR)
    if (selectedZone === 'FR' && selectedCommandoDay !== 'all') {
      const commandoZone = getClientCommandoZone(client);
      if (!commandoZone || commandoZone.dayIndex.toString() !== selectedCommandoDay) {
        return false;
      }
    }

    const matchesSearch =
      (client.nom || '').toLowerCase().includes(search.toLowerCase()) ||
      (client.prenom || '').toLowerCase().includes(search.toLowerCase()) ||
      (client.ville || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || client.statut === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Clients View handles ONLY signature and callback contact.
  // Ces clients n'ont PAS encore été planifiés pour la livraison
  const clientsToContact = filteredClients.filter((c: any) => {
    const s = (c.statut_client || c.statut || '').toUpperCase();

    // 1. RULE: Planned clients must DISAPPEAR from this view
    // If they have a delivery date, they are managed in "Livraisons" or "En Cours"
    if (c.date_livraison_prevue && c.date_livraison_prevue.length > 5 && c.date_livraison_prevue !== 'no-date') {
      return false;
    }

    // 2. RULE: Status check
    // MODIF: On relâche la contrainte sur le statut textuel.
    // Si pas de date, on affiche le client, même s'il a un statut "bizarre" (sauf TERMINÉ).
    /*
    if (isStatusPlanned(s) || isStatusPlanned(c.statut_livraison || '')) {
      if (!s.includes('A PLANIFIER') && !s.includes('À PLANIFIER') && !s.includes('1.')) {
        return false;
      }
    }

    // Les clients "EN COURS" sont maintenant dans la vue "En Cours" et ne doivent plus apparaître ici
    if (s.includes('EN COURS') || s.includes('EN_COURS')) {
      return false;
    }
    */

    // Exclure les statuts de fin de parcours ou avancés
    // ARRET : Ne pas exclure "LIVRAISON À PLANIFIER" qui contient "LIVR" !
    if (s === 'LIVRÉ' || s === 'LIVREE' || s.includes('TERM') || s.includes('INSTALL')) {
      return false;
    }

    if (c.nom?.toLowerCase().includes('jen') || c.prenom?.toLowerCase().includes('jen')) {
      // console.log(`🕵️ A CONTACTER - Debug 'jen': Statut="${s}", Logistique="${c.logistique}", Passed=TRUE`);
    }

    // Par défaut, on affiche tout le reste (Backlog : Signé, A planifier, A rappeler, Contacté...)
    return true;
  });

  if (loading) {
    return <div className="p-10 text-center">Chargement des données...</div>;
  }

  return (
    <>
      <div className="space-y-8 animate-fade-in pb-10">
        {/* SECTION: Clients à Contacter */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 border-b pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Clients à Contacter</h2>
                <p className="text-muted-foreground">
                  {clientsToContact.length} client{clientsToContact.length > 1 ? 's' : ''} en attente de planification
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
                    onClick={() => {
                      setSelectedZone(zone.id);
                      setSelectedCommandoDay('all');
                    }}
                  >
                    {zone.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-60"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="A PLANIFIER">À Planifier</SelectItem>
                    <SelectItem value="A_RAPPELER">À Rappeler</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => MassGeocoder.scanAndFixMissingGPS()}
                  title="Scanner et corriger les clients sans GPS"
                  className="text-slate-500 hover:text-blue-600 border-slate-200"
                >
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* COMMANDO SUB-FILTER (ZIG-ZAG) */}
            {selectedZone === 'FR' && (
              <div className="flex gap-2 p-1 bg-muted/30 rounded-lg overflow-x-auto no-scrollbar">
                <Button
                  variant={selectedCommandoDay === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="text-xs h-8 px-4"
                  onClick={() => setSelectedCommandoDay('all')}
                >
                  Toutes Zones
                </Button>
                {Object.values(COMMANDO_ZONES)
                  .filter(z => z.departments.length > 0)
                  .map((zone) => (
                    <Button
                      key={zone.dayIndex}
                      variant={selectedCommandoDay === zone.dayIndex.toString() ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "text-xs h-8 px-4 whitespace-nowrap transition-all",
                        selectedCommandoDay === zone.dayIndex.toString() ? "bg-blue-600 text-white" : "bg-white/50 text-muted-foreground border-transparent hover:bg-white hover:border-gray-200 shadow-sm"
                      )}
                      onClick={() => setSelectedCommandoDay(zone.dayIndex.toString())}
                    >
                      <span className="mr-2 text-sm">{zone.emoji}</span>
                      {zone.name.split(':')[1] || zone.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clientsToContact.map((client: any) => {
              const daysLeft = (client.statut_client || '').includes('SIGN') || (client.statut_client || '').includes('PLANIFIER') ? getDaysUntilDeadline(client.dateSignature || new Date().toISOString()) : null;
              const isUrgent = daysLeft !== null && daysLeft <= 2;

              // Recall Logic (Based on Supabase 'rappel_info' now)
              const recallInfo = client.rappel_info;
              const isRecall = recallInfo?.active === true;

              let recallTargetDate: Date | null = null;
              let lastCall: Date | null = null;

              if (isRecall && recallInfo?.next_recall) {
                recallTargetDate = new Date(recallInfo.next_recall);
                lastCall = new Date(recallInfo.last_attempt);
              }

              const showCountdown = recallTargetDate && recallTargetDate > new Date();

              return (
                <div key={client.id} className={cn('glass-card p-5 hover:shadow-glow hover:border-primary/30', isUrgent ? 'border-destructive/50 bg-destructive/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : '')}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-lg">
                        {(client.prenom || '?')[0]}{(client.nom || '?')[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{client.prenom} {client.nom}</h3>
                        <p className="text-sm text-muted-foreground">{client.ville}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("bg-primary/10 text-primary border-primary/20", isRecall && "bg-orange-100 text-orange-700 border-orange-200")}>
                      {isRecall ? `À Rappeler (${recallInfo?.attempt_count || 1})` : 'À Planifier'}
                    </Badge>
                  </div>

                  <div className="space-y-1 mb-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{client.telephone}</div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {client.adresse}
                    </div>
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      {client.nb_led || 0} LEDs
                    </div>
                    {/* Alerte Adresse Introuvable */}
                    {(!client.gps || (typeof client.gps === 'object' && !client.gps.lat)) && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-red-100 text-red-700 rounded-md font-bold uppercase text-xs border border-red-200 animate-pulse">
                        <AlertTriangle className="h-4 w-4" />
                        ⚠️ Adresse Introuvable (GPS manquant)
                      </div>
                    )}

                    {/* Suggestion Badge */}
                    <ClientSuggestionBadge
                      client={client}
                      onSelectDate={(date) => {
                        setInitialDate(date);
                        setSelectedClientForPlanning(client);
                        setPlanningModalOpen(true);
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    {showCountdown ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-center text-red-500 font-medium">
                          {lastCall && (
                            <>N'a pas répondu le : {lastCall.toLocaleDateString('fr-FR')} à {lastCall.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}</>
                          )}
                        </div>
                        <CountdownTimer targetDate={recallTargetDate!} />
                        <Button
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            // If clicked here, we assume client called back, so we clear recall status first OR just open planning
                            // Ideally we clear it when planning happens or explicitly here.
                            // Let's open planning, and when confirmed, it should clear. 
                            // But wait, user said "il faut metre un truc si le client rappel je doit pouvoir le planifier"
                            // We can add a "Clear & Plan" action.
                            setSelectedClientForPlanning(client); // Just open modal, we'll handle clear in modal confirm or here
                            setPlanningModalOpen(true);
                          }}
                        >
                          <PhoneIncoming className="h-4 w-4 mr-2" />
                          Client a rappelé &rarr; Planifier
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={isRecall ? "destructive" : "outline"}
                          className="flex-1"
                          onClick={() => { setSelectedClientForCall(client); setCallModalOpen(true); }}
                        >
                          <Phone className={cn("h-4 w-4 mr-2", isRecall && "animate-pulse")} />
                          {isRecall ? "Rappeler (Urgent)" : "Appeler"}
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => openPlanning(client)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Planifier Livraison
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {clientsToContact.length === 0 && <div className="text-center p-8 text-muted-foreground bg-secondary/10 rounded-lg">Aucun client à planifier.</div>}
          </div>
        </div>
      </div>

      <QuickPlanningModal
        client={selectedClientForPlanning}
        allClients={clients}
        isOpen={planningModalOpen}
        onClose={closePlanning}
        onConfirm={handlePlanningConfirm}
      />

      <CallActionModal
        client={selectedClientForCall!}
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        isRecallMode={selectedClientForCall?.rappel_info?.active === true}
        onNoAnswer={async () => {
          if (!selectedClientForCall) return;
          try {
            // Logic de Rappel Frontend (Replique Backend)
            const currentRappel: any = selectedClientForCall.rappel_info || {};
            const count = (currentRappel.attempt_count || 0) + 1;
            const now = new Date();

            // Prochain rappel dans 4h (ou demain 9h si > 17h) ? Simple: +4h
            const nextRecall = new Date(now.getTime() + 4 * 60 * 60 * 1000);

            const newRappelInfo = {
              active: true,
              count: count, // Legacy naming compatibility if needed
              attempt_count: count,
              last_attempt: now.toISOString(),
              next_recall: nextRecall.toISOString(),
              history: [
                ...(currentRappel.history || []),
                { date: now.toISOString(), status: 'NO_ANSWER' }
              ]
            };

            const { error } = await supabase
              .from('clients')
              .update({
                statut_client: 'A_RAPPELER',
                rappel_info: newRappelInfo
              })
              .eq('id', selectedClientForCall.id);

            if (error) throw error;

            toast.success("Rappel programmé !");
            await fetchClients();
          } catch (e) { toast.error("Erreur"); }
        }}
        onAnswered={() => {
          if (selectedClientForCall) openPlanning(selectedClientForCall);
        }}
        onCancelRecall={async () => {
          if (!selectedClientForCall) return;
          try {
            const currentRappel: any = selectedClientForCall.rappel_info || {};
            const newRappelInfo = {
              ...currentRappel,
              active: false
            };

            const { error } = await supabase
              .from('clients')
              .update({
                statut_client: 'A PLANIFIER', // Reset to default pool
                rappel_info: newRappelInfo
              })
              .eq('id', selectedClientForCall.id);

            if (error) throw error;

            toast.success("Rappel annulé");
            await fetchClients();
          } catch (e) { toast.error("Erreur"); }
        }}
      />
    </>
  );
}
