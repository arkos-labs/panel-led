import { Truck, Package, Clock, MapPin } from 'lucide-react';
import { Livraison } from '@/types/logistics';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { parseSafeDate, cn } from '@/lib/utils';
import { isSameMonth, parseISO, startOfMonth, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DeliveryScheduleProps {
  livraisons: Livraison[];
  camionCapacite: number;
}

const statusColors = {
  PLANIFIÉE: 'bg-primary/20 text-primary',
  EN_COURS: 'bg-warning/20 text-warning',
  LIVRÉE: 'bg-success/20 text-success',
  REPORTÉE: 'bg-destructive/20 text-destructive',
};

const statusLabels = {
  PLANIFIÉE: 'Planifiée',
  EN_COURS: 'En cours',
  LIVRÉE: 'Livrée',
  REPORTÉE: 'Reportée',
};

export function DeliverySchedule({ livraisons, camionCapacite }: DeliveryScheduleProps) {
  // Logic removed for unused capacity calculation in monthly view

  return (
    <div className="rounded-xl border border-border bg-card p-0 flex flex-col h-full shadow-sm">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shadow-sm text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Planning du Mois</h3>
              <p className="text-sm text-muted-foreground">Vues globale des tournées</p>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border overflow-auto max-h-[500px]">
        {livraisons
          .filter(l => {
            const d = parseSafeDate(l.datePrevue);
            const startOfCurrentMonth = startOfMonth(new Date());
            return d && (isSameMonth(d, new Date()) || isAfter(d, new Date()) || d >= startOfCurrentMonth);
          })
          .sort((a, b) => {
            const dA = parseSafeDate(a.datePrevue)?.getTime() || 0;
            const dB = parseSafeDate(b.datePrevue)?.getTime() || 0;
            return dA - dB;
          })
          .map((livraison, index) => {
            const dateObj = parseSafeDate(livraison.datePrevue);
            const isDone = livraison.statut === 'LIVRÉE';

            return (
              <div
                key={livraison.id}
                className={cn(
                  "flex items-center gap-4 p-4 transition-colors hover:bg-muted/50",
                  isDone ? "opacity-75 bg-muted/20" : ""
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-medium",
                  isDone ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                )}>
                  {index + 1}
                </div>

                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {livraison.client.prenom} {livraison.client.nom}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {livraison.client.ville}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {dateObj ? dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Date invalide'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(livraison.client as any).heureLivraison || ''}
                    </p>
                  </div>

                  {/* TYPE BADGE */}
                  {(livraison as any).type === 'INSTALLATION' ? (
                    <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-200">
                      Installation
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200">
                      Livraison
                    </Badge>
                  )}

                  <Badge className={statusColors[livraison.statut] || 'bg-secondary'}>
                    {statusLabels[livraison.statut] || livraison.statut}
                  </Badge>
                </div>
              </div>
            );
          })}
      </div>
    </div >
  );
}
