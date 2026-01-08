import { Wrench, Calendar, User, CheckCircle2 } from 'lucide-react';
import { Installation } from '@/types/logistics';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface InstallationProgressProps {
  installations: Installation[];
}

const statusColors = {
  PLANIFIÉE: 'bg-primary/20 text-primary',
  EN_COURS: 'bg-warning/20 text-warning',
  TERMINÉE: 'bg-success/20 text-success',
  REPORTÉE: 'bg-destructive/20 text-destructive',
};

const statusLabels = {
  PLANIFIÉE: 'Planifiée',
  EN_COURS: 'En cours',
  TERMINÉE: 'Terminée',
  REPORTÉE: 'Reportée',
};

function calculateProgress(dateDebut: string, dateFin: string): number {
  const start = new Date(dateDebut).getTime();
  const end = new Date(dateFin).getTime();
  const now = Date.now();

  if (now < start) return 0;
  if (now > end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}

// Helper to check if date is today
const isToday = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

export function InstallationProgress({ installations }: InstallationProgressProps) {
  // Filter to include active and recently completed (today)
  const visibleInstallations = installations.filter(
    (i) => i.statut === 'EN_COURS' || i.statut === 'PLANIFIÉE' || (i.statut === 'TERMINÉE' && i.dateFin && isToday(i.dateFin))
  );

  const completedCount = visibleInstallations.filter(i => i.statut === 'TERMINÉE').length;
  const totalCount = visibleInstallations.length;

  return (
    <div className="rounded-xl border border-border bg-card p-0 shadow-sm">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shadow-sm text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Installations (Poseurs)</h3>
              <p className="text-sm text-muted-foreground">Pose des LED sur site</p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            {completedCount}/{totalCount}
          </Badge>
        </div>
      </div>

      <div className="divide-y divide-border">
        {visibleInstallations.slice(0, 4).map((installation) => {
          const progress =
            installation.statut === 'TERMINÉE'
              ? 100
              : installation.statut === 'EN_COURS'
                ? calculateProgress(installation.dateDebut, installation.dateFin)
                : 0;

          const displayStatus = installation.statut === 'TERMINÉE' ? '1/1 Terminé' :
            installation.statut === 'EN_COURS' ? '0/1 En cours' : `0/1 ${statusLabels[installation.statut]}`;

          return (
            <div
              key={installation.id}
              className="p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">
                    {installation.client.prenom} {installation.client.nom}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {installation.client.nombreLED} LED • {installation.dureeJours} jour
                    {installation.dureeJours > 1 ? 's' : ''}
                  </p>
                </div>
                <Badge className={statusColors[installation.statut]}>
                  {displayStatus}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(installation.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' → '}
                  {new Date(installation.dateFin).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
