import { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingDown, RefreshCw, BarChart3, Plus } from 'lucide-react';
import { supabase } from "@/lib/supabaseClient";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import { toast } from "sonner";
import { Skeleton } from '@/components/ui/skeleton';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { ExportButton } from '@/components/common/ExportButton';
import { useOfflineAction } from '@/hooks/useOffline';

interface StockItem {
  id: string;
  marque: string;
  reference: string;
  stockInitial: number;
  stockActuel: number;
  conso: number;
  seuilAlerte: number;
  volumeCarton: number;
}

export function StockView() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [selectedZone, setSelectedZone] = useState<string>('FR'); // ZONE FILTER
  const { execute } = useOfflineAction();

  const fetchStock = async () => {
    setLoading(true);
    try {
      // 1. Fetch Real Global Stock from Backend (Google Sheet B1/D1/F1)
      const response = await fetch(`/api/stock/global?zone=${selectedZone}`);
      const data = await response.json();

      // 2. Map API data to StockItem
      // API returns: { total, consommees, restantes, pourcentage, critique }
      const mainStockItem: StockItem = {
        id: '1',
        marque: 'LED Principale',
        reference: `REF-001-${selectedZone}`,
        stockInitial: data.total,
        stockActuel: data.restantes,
        conso: data.consommees,
        seuilAlerte: selectedZone === 'FR' ? 1000 : 100,
        volumeCarton: 0.5
      };

      // 3. Keep Accessoires as secondary mock (Sheet doesn't seem to track them in header)
      const accessoriesItem: StockItem = {
        id: '2',
        marque: 'Accessoires',
        reference: 'KIT-INSTAL',
        stockInitial: selectedZone === 'FR' ? 200 : 50,
        stockActuel: (selectedZone === 'FR' ? 200 : 50) - (data.consommees > 0 ? Math.round(data.consommees / 50) : 0), // Estimate
        conso: (data.consommees > 0 ? Math.round(data.consommees / 50) : 0),
        seuilAlerte: 10,
        volumeCarton: 0.1
      };

      setStock([mainStockItem, accessoriesItem]);

    } catch (e) {
      console.error("Erreur Stock", e);
      // Fallback if API fails (e.g. offline)
      toast.error("Impossible de charger le stock en temps réel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [selectedZone]); // Depend on selectedZone

  // Listen for socket updates
  useSocketUpdate('stock', fetchStock);
  useSocketUpdate('clients', fetchStock);

  const handleAddStock = async () => {
    const amount = Number(addAmount);
    if (!addAmount || isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un nombre valide > 0");
      return;
    }

    try {
      await execute('ADD_STOCK', { zone: selectedZone, quantite: amount }, async () => {
        const res = await fetch(`/api/stock/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zone: selectedZone, quantite: amount })
        });

        if (!res.ok) throw new Error("Erreur serveur");
        return res;
      });

      toast.success(`Stock ajouté avec succès pour la zone ${selectedZone} (+${amount})`);
      setIsAddStockOpen(false);
      setAddAmount("");
      fetchStock();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du stock Google Sheets");
    }
  };



  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestion des Stocks</h2>
          <p className="text-muted-foreground">
            Synchronisé avec Google Sheets (Colonnes L)
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
        <div className="flex gap-2">
          <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4" />
                Réception Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Réception de Marchandise</DialogTitle>
                <DialogDescription>
                  Ajouter la quantité reçue au stock initial. Cela augmentera le stock disponible.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    Quantité
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="col-span-3"
                    placeholder="Ex: 5000"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddStockOpen(false)}>Annuler</Button>
                <Button onClick={handleAddStock}>Confirmer l'ajout</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2" onClick={fetchStock}>
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stock Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stock.map((item) => {
          const percentage = Math.round(
            (item.stockActuel / item.stockInitial) * 100
          );
          const isCritical = percentage <= item.seuilAlerte;
          const isWarning = percentage <= 40 && !isCritical;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border p-6 transition-all duration-300 hover:shadow-lg',
                isCritical
                  ? 'border-destructive/30 bg-destructive/5'
                  : isWarning
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-border bg-card'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'rounded-lg p-3',
                      isCritical
                        ? 'bg-destructive/20'
                        : isWarning
                          ? 'bg-warning/20'
                          : 'bg-primary/20'
                    )}
                  >
                    <Package
                      className={cn(
                        'h-6 w-6',
                        isCritical
                          ? 'text-destructive'
                          : isWarning
                            ? 'text-warning'
                            : 'text-primary'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{item.marque}</h3>
                    <p className="text-sm text-muted-foreground">{item.reference}</p>
                  </div>
                </div>
                {isCritical && (
                  <Badge variant="destructive" className="gap-1 alert-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    Critique
                  </Badge>
                )}
              </div>

              {/* Stats Grid */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-3xl font-bold text-foreground font-mono">
                      {/* SAFEGUARD: stockActuel might be undefined */}
                      {(item.stockActuel || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Restant</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-3xl font-bold text-muted-foreground font-mono">
                      {/* SAFEGUARD: conso might be undefined */}
                      {((item.conso !== undefined ? item.conso : (item.stockInitial || 0) - (item.stockActuel || 0))).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Consommé</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Niveau Disponible</span>
                    <span
                      className={cn(
                        'font-mono font-bold',
                        isCritical
                          ? 'text-destructive'
                          : isWarning
                            ? 'text-warning'
                            : 'text-success'
                      )}
                    >
                      {percentage}%
                    </span>
                  </div>
                  <Progress
                    value={percentage}
                    className={cn(
                      'h-4',
                      isCritical
                        ? '[&>div]:bg-destructive'
                        : isWarning
                          ? '[&>div]:bg-warning'
                          : '[&>div]:bg-success'
                    )}
                  />
                </div>

                {/* Footer Info */}
                <div className="flex justify-between items-center pt-4 border-t border-border text-sm text-muted-foreground">
                  <span>Stock Initial: {(item.stockInitial || 0).toLocaleString()}</span>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-4 h-4" />
                    <span>Vol: {item.volumeCarton} m³</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        {stock.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            Aucun article en stock trouvé.
          </div>
        )}
      </div>
    </div>
  );
}
