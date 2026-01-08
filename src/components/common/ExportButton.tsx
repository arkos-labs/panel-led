import { useState } from 'react';
import { FileDown, FileSpreadsheet, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { ReportService } from '@/services/reportService';
import { supabase } from '@/lib/supabaseClient';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface ExportButtonProps {
    type: 'deliveries' | 'installations' | 'stock';
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    zone?: string;
}

export function ExportButton({ type, variant = 'outline', size = 'default', className, zone }: ExportButtonProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [isExporting, setIsExporting] = useState(false);

    const getLabel = () => {
        switch (type) {
            case 'deliveries': return 'Livraisons';
            case 'installations': return 'Installations';
            case 'stock': return 'Stock';
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let data: any[] = [];
            let dateFilter: { start?: Date; end?: Date } = {};

            // Calculer la plage de dates
            const now = new Date();
            switch (dateRange) {
                case 'today':
                    dateFilter = { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date(now.setHours(23, 59, 59, 999)) };
                    break;
                case 'week':
                    dateFilter = { start: subDays(now, 7), end: now };
                    break;
                case 'month':
                    dateFilter = { start: startOfMonth(now), end: endOfMonth(now) };
                    break;
            }

            // Récupérer les données selon le type
            if (type === 'stock') {
                // Récupérer le stock pour toutes les zones
                const zones = ['FR', 'GP', 'MQ', 'CORSE', 'RE', 'YT', 'GF'];
                const stockPromises = zones.map(async (z) => {
                    const response = await fetch(`/api/stock/global?zone=${z}`);
                    return response.json();
                });
                data = await Promise.all(stockPromises);

                // Export
                if (exportFormat === 'pdf') {
                    const filename = ReportService.generateStockPDF(data, {
                        title: `Rapport de Stock - ${format(new Date(), 'dd/MM/yyyy')}`
                    });
                    toast.success(`Rapport PDF généré : ${filename}`);
                } else {
                    const filename = ReportService.generateStockExcel(data);
                    toast.success(`Fichier Excel généré : ${filename}`);
                }
            } else {
                // Récupérer les clients depuis Supabase
                let query = supabase.from('clients').select('*');

                // Filtrer par zone si spécifié
                if (zone) {
                    query = query.eq('zone_pays', zone);
                }

                // Filtrer par date si nécessaire
                if (dateFilter.start && type === 'deliveries') {
                    query = query.gte('date_livraison_prevue', dateFilter.start.toISOString());
                }
                if (dateFilter.end && type === 'deliveries') {
                    query = query.lte('date_livraison_prevue', dateFilter.end.toISOString());
                }

                if (dateFilter.start && type === 'installations') {
                    query = query.gte('date_install_debut', dateFilter.start.toISOString());
                }
                if (dateFilter.end && type === 'installations') {
                    query = query.lte('date_install_debut', dateFilter.end.toISOString());
                }

                const { data: clients, error } = await query;

                if (error) throw error;

                // Filtrer selon le type
                if (type === 'deliveries') {
                    data = clients?.filter(c =>
                        c.statut_livraison || c.date_livraison_prevue
                    ) || [];
                } else if (type === 'installations') {
                    data = clients?.filter(c =>
                        c.statut_installation && c.statut_installation !== 'ATTENTE'
                    ) || [];
                }

                // Export
                if (exportFormat === 'pdf') {
                    const filename = type === 'deliveries'
                        ? ReportService.generateDeliveryPDF(data, {
                            title: `Rapport des Livraisons - ${format(new Date(), 'dd/MM/yyyy')}`,
                            dateRange: dateFilter.start ? dateFilter as any : undefined,
                            zone
                        })
                        : ReportService.generateInstallationPDF(data, {
                            title: `Rapport des Installations - ${format(new Date(), 'dd/MM/yyyy')}`,
                            dateRange: dateFilter.start ? dateFilter as any : undefined,
                            zone
                        });
                    toast.success(`Rapport PDF généré : ${filename}`);
                } else {
                    const filename = type === 'deliveries'
                        ? ReportService.generateDeliveryExcel(data, { zone })
                        : ReportService.generateInstallationExcel(data, { zone });
                    toast.success(`Fichier Excel généré : ${filename}`);
                }
            }

            setIsDialogOpen(false);
        } catch (error: any) {
            console.error('Erreur export:', error);
            toast.error(`Erreur lors de l'export : ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant={variant} size={size} className={className}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Exporter
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setExportFormat('pdf'); setIsDialogOpen(true); }}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setExportFormat('excel'); setIsDialogOpen(true); }}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Exporter {getLabel()}</DialogTitle>
                        <DialogDescription>
                            Générer un rapport {exportFormat === 'pdf' ? 'PDF' : 'Excel'} des {getLabel().toLowerCase()}.
                        </DialogDescription>
                    </DialogHeader>

                    {type !== 'stock' && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-3">
                                <Label>Période</Label>
                                <RadioGroup value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="all" id="all" />
                                        <Label htmlFor="all" className="font-normal cursor-pointer">
                                            Tout l'historique
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="today" id="today" />
                                        <Label htmlFor="today" className="font-normal cursor-pointer">
                                            Aujourd'hui
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="week" id="week" />
                                        <Label htmlFor="week" className="font-normal cursor-pointer">
                                            7 derniers jours
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="month" id="month" />
                                        <Label htmlFor="month" className="font-normal cursor-pointer">
                                            Ce mois-ci
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isExporting}>
                            Annuler
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? 'Export en cours...' : 'Exporter'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
