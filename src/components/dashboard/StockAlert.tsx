import { AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface StockGlobal {
  total: number;
  consommees: number;
  restantes: number;
  pourcentage: number;
  critique: boolean;
  lastUpdated?: string;
}

interface StockAlertProps {
  stocks: StockGlobal;
}

export function StockAlert({ stocks }: StockAlertProps) {
  const { total, consommees, restantes, pourcentage, critique, lastUpdated } = stocks;

  if (!critique) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/20 p-2">
              <Package className="h-5 w-5 text-success" />
            </div>
            <h3 className="font-semibold text-foreground">État du Stock Global</h3>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <RefreshCw className="h-3 w-3" />
              <span>{lastUpdated}</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stock total</span>
            <span className="font-mono font-semibold text-foreground">{total.toLocaleString()} LED</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consommées</span>
            <span className="font-mono font-semibold text-foreground">{consommees.toLocaleString()} LED</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restantes</span>
            <span className="font-mono font-semibold text-success">{restantes.toLocaleString()} LED</span>
          </div>
          <Progress
            value={pourcentage}
            className="h-2 [&>div]:bg-success"
          />
          <p className="text-xs text-center text-muted-foreground">
            {pourcentage}% du stock disponible
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-destructive/20 p-2 alert-pulse">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">⚠️ Stock Critique</h3>
            <p className="text-sm text-muted-foreground">
              Moins de 20% disponible
            </p>
          </div>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1 text-[10px] text-destructive/70 bg-destructive/10 px-2 py-1 rounded-full">
            <RefreshCw className="h-3 w-3" />
            <span>{lastUpdated}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Stock total</span>
          <span className="font-mono font-semibold text-foreground">{total.toLocaleString()} LED</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Consommées</span>
          <span className="font-mono font-semibold text-destructive">{consommees.toLocaleString()} LED</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Restantes</span>
          <span className="font-mono font-semibold text-warning">{restantes.toLocaleString()} LED</span>
        </div>
        <Progress
          value={pourcentage}
          className={cn(
            'h-2',
            pourcentage < 20 ? '[&>div]:bg-destructive' : '[&>div]:bg-warning'
          )}
        />
        <p className="text-xs text-center text-destructive font-semibold">
          ⚠️ Seulement {pourcentage}% du stock disponible
        </p>
      </div>
    </div>
  );
}
