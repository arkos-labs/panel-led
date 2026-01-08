import { useState } from 'react';
import { Phone, Clock, MapPin, ChevronRight, AlertCircle, Filter, Zap } from 'lucide-react';
import { Client } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getClientCommandoZone, COMMANDO_ZONES } from '@/lib/regions';
import { GlobalOptimizerModal } from '../modals/GlobalOptimizerModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientsToContactProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
  onRefresh?: () => void;
}

function getDaysUntilDeadline(dateSignature: string): number {
  const signature = new Date(dateSignature);
  const deadline = new Date(signature);
  deadline.setDate(deadline.getDate() + 7);
  const today = new Date();
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function ClientsToContact({ clients, onClientClick, onRefresh }: ClientsToContactProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

  const clientsToCall = clients.filter((c) => {
    const s = (c.statut || c.statut_client || '').toUpperCase();
    const matchesStatut = s.includes('SIGN') || s.includes('A RAPPELER') || s === 'A_RAPPELER';
    if (!matchesStatut) return false;

    // Exclude if already planned (has a delivery date)
    const hasDate = (c.date_livraison_prevue && c.date_livraison_prevue !== 'no-date');
    if (hasDate) return false;

    if (selectedRegion === 'all') return true;
    const zone = getClientCommandoZone(c);
    return zone?.dayIndex.toString() === selectedRegion;
  });

  return (
    <div className="glass-card bg-card p-0">
      <div className="border-b border-border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shadow-sm text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">Clients à Contacter</h3>
                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-4">
                  {clientsToCall.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Devis signés en attente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-[11px] gap-1.5 shadow-lg shadow-blue-100 px-3 transition-all hover:scale-105"
              onClick={() => setIsGlobalModalOpen(true)}
            >
              <Zap className="h-3.5 w-3.5 fill-white" />
              Optimiser toute la file
            </Button>

            <div className="h-8 w-[1px] bg-border mx-1" />

            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-[140px] h-8 text-[11px]">
                <SelectValue placeholder="Région" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.values(COMMANDO_ZONES)
                  .filter(z => z.departments.length > 0)
                  .map((zone) => (
                    <SelectItem key={zone.dayIndex} value={zone.dayIndex.toString()}>
                      {zone.emoji} {zone.name.split(':')[1] || zone.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <GlobalOptimizerModal
        isOpen={isGlobalModalOpen}
        onClose={() => setIsGlobalModalOpen(false)}
        onSuccess={onRefresh}
      />

      <div className="divide-y divide-border">
        {clientsToCall.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Aucun client à contacter</p>
          </div>
        ) : (
          clientsToCall.map((client) => {
            const daysLeft = getDaysUntilDeadline(client.dateSignature);
            const isUrgent = daysLeft <= 2;

            return (
              <div
                key={client.id}
                className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => onClientClick?.(client)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full font-semibold',
                      isUrgent
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {(client.prenom || '?')[0]}{(client.nom || '?')[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {client.prenom || 'Prénom inconnu'} {client.nom || 'Nom inconnu'}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {client.ville}
                      </span>
                      <span className="font-mono text-primary">
                        {client.nombreLED} LED
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={cn(
                        'flex items-center gap-1 text-sm font-medium',
                        isUrgent ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {isUrgent && <AlertCircle className="h-4 w-4" />}
                      <Clock className="h-4 w-4" />
                      <span>
                        {daysLeft > 0 ? `${daysLeft}j restants` : 'Délai dépassé'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{client.telephone}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
