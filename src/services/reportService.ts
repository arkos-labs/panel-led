/**
 * Service d'export de rapports (PDF et Excel)
 * Génère des rapports pour les livraisons, installations, et stock
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Client {
    id: string;
    nom: string;
    prenom: string;
    adresse?: string;
    ville?: string;
    telephone?: string;
    nb_led?: number;
    statut_client?: string;
    statut_livraison?: string;
    statut_installation?: string;
    date_livraison_prevue?: string;
    date_livraison_reelle?: string;
    heure_livraison?: string;
    date_install_debut?: string;
    date_install_fin?: string;
    livreur_id?: string;
    poseur_id?: string;
}

interface StockData {
    total: number;
    consommees: number;
    restantes: number;
    pourcentage: number;
    critique: boolean;
    zone: string;
}

export class ReportService {

    /**
     * Génère un rapport PDF des livraisons
     */
    static generateDeliveryPDF(clients: Client[], options: {
        title?: string;
        dateRange?: { start: Date; end: Date };
        zone?: string;
    } = {}) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // En-tête
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(options.title || 'Rapport des Livraisons', pageWidth / 2, 20, { align: 'center' });

        // Sous-titre
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const subtitle = options.dateRange
            ? `Période: ${format(options.dateRange.start, 'dd/MM/yyyy', { locale: fr })} - ${format(options.dateRange.end, 'dd/MM/yyyy', { locale: fr })}`
            : `Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`;
        doc.text(subtitle, pageWidth / 2, 28, { align: 'center' });

        if (options.zone) {
            doc.text(`Zone: ${options.zone}`, pageWidth / 2, 33, { align: 'center' });
        }

        // Statistiques
        const stats = this.calculateDeliveryStats(clients);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Statistiques', 14, 45);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total clients: ${stats.total}`, 14, 52);
        doc.text(`Livrés: ${stats.delivered} (${stats.deliveredPercent}%)`, 14, 57);
        doc.text(`En cours: ${stats.pending}`, 14, 62);
        doc.text(`LEDs totales: ${stats.totalLEDs.toLocaleString()}`, 14, 67);

        // Tableau des livraisons
        const tableData = clients.map(c => [
            `${c.nom} ${c.prenom}`,
            c.ville || '',
            c.nb_led?.toLocaleString() || '0',
            c.statut_livraison || c.statut_client || '',
            c.date_livraison_prevue ? format(new Date(c.date_livraison_prevue), 'dd/MM/yyyy') : '',
            c.heure_livraison || '',
            c.livreur_id || ''
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Client', 'Ville', 'LEDs', 'Statut', 'Date prévue', 'Heure', 'Livreur']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 14, right: 14 }
        });

        // Pied de page
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(
                `Page ${i} sur ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        // Téléchargement
        const filename = `rapport_livraisons_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
        doc.save(filename);

        return filename;
    }

    /**
     * Génère un rapport PDF des installations
     */
    static generateInstallationPDF(clients: Client[], options: {
        title?: string;
        dateRange?: { start: Date; end: Date };
        zone?: string;
    } = {}) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // En-tête
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(options.title || 'Rapport des Installations', pageWidth / 2, 20, { align: 'center' });

        // Sous-titre
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const subtitle = options.dateRange
            ? `Période: ${format(options.dateRange.start, 'dd/MM/yyyy', { locale: fr })} - ${format(options.dateRange.end, 'dd/MM/yyyy', { locale: fr })}`
            : `Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`;
        doc.text(subtitle, pageWidth / 2, 28, { align: 'center' });

        if (options.zone) {
            doc.text(`Zone: ${options.zone}`, pageWidth / 2, 33, { align: 'center' });
        }

        // Statistiques
        const stats = this.calculateInstallationStats(clients);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Statistiques', 14, 45);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total chantiers: ${stats.total}`, 14, 52);
        doc.text(`Terminés: ${stats.completed} (${stats.completedPercent}%)`, 14, 57);
        doc.text(`En cours: ${stats.inProgress}`, 14, 62);
        doc.text(`Planifiés: ${stats.planned}`, 14, 67);
        doc.text(`LEDs installées: ${stats.totalLEDs.toLocaleString()}`, 14, 72);

        // Tableau des installations
        const tableData = clients.map(c => {
            const duration = c.date_install_debut && c.date_install_fin
                ? this.calculateDuration(c.date_install_debut, c.date_install_fin)
                : '';

            return [
                `${c.nom} ${c.prenom}`,
                c.ville || '',
                c.nb_led?.toLocaleString() || '0',
                c.statut_installation || '',
                c.date_install_debut ? format(new Date(c.date_install_debut), 'dd/MM/yyyy') : '',
                c.date_install_fin ? format(new Date(c.date_install_fin), 'dd/MM/yyyy') : '',
                duration,
                c.poseur_id || ''
            ];
        });

        autoTable(doc, {
            startY: 80,
            head: [['Client', 'Ville', 'LEDs', 'Statut', 'Début', 'Fin', 'Durée', 'Poseur']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [168, 85, 247], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 14, right: 14 }
        });

        // Pied de page
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(
                `Page ${i} sur ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        // Téléchargement
        const filename = `rapport_installations_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
        doc.save(filename);

        return filename;
    }

    /**
     * Génère un rapport PDF du stock
     */
    static generateStockPDF(stockData: StockData[], options: {
        title?: string;
    } = {}) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // En-tête
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(options.title || 'Rapport de Stock', pageWidth / 2, 20, { align: 'center' });

        // Sous-titre
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, pageWidth / 2, 28, { align: 'center' });

        // Tableau du stock
        const tableData = stockData.map(stock => [
            stock.zone,
            stock.total.toLocaleString(),
            stock.consommees.toLocaleString(),
            stock.restantes.toLocaleString(),
            `${stock.pourcentage}%`,
            stock.critique ? '⚠️ OUI' : 'Non'
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Zone', 'Total', 'Consommées', 'Restantes', 'Disponible', 'Critique']],
            body: tableData,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
                // Colorer en rouge les lignes critiques
                if (data.row.index >= 0 && stockData[data.row.index].critique) {
                    if (data.column.index === 5) {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Statistiques globales
        const totalStock = stockData.reduce((sum, s) => sum + s.total, 0);
        const totalConsumed = stockData.reduce((sum, s) => sum + s.consommees, 0);
        const totalRemaining = stockData.reduce((sum, s) => sum + s.restantes, 0);
        const globalPercent = totalStock > 0 ? Math.round((totalRemaining / totalStock) * 100) : 0;

        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Global', 14, finalY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Stock total: ${totalStock.toLocaleString()} LEDs`, 14, finalY + 7);
        doc.text(`Consommées: ${totalConsumed.toLocaleString()} LEDs`, 14, finalY + 12);
        doc.text(`Restantes: ${totalRemaining.toLocaleString()} LEDs (${globalPercent}%)`, 14, finalY + 17);

        // Pied de page
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
            'Page 1 sur 1',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );

        // Téléchargement
        const filename = `rapport_stock_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
        doc.save(filename);

        return filename;
    }

    /**
     * Génère un fichier Excel des livraisons
     */
    static generateDeliveryExcel(clients: Client[], options: {
        sheetName?: string;
        zone?: string;
    } = {}) {
        const data = clients.map(c => ({
            'Nom': c.nom,
            'Prénom': c.prenom,
            'Adresse': c.adresse || '',
            'Ville': c.ville || '',
            'Téléphone': c.telephone || '',
            'Nb LEDs': c.nb_led || 0,
            'Statut': c.statut_livraison || c.statut_client || '',
            'Date prévue': c.date_livraison_prevue ? format(new Date(c.date_livraison_prevue), 'dd/MM/yyyy') : '',
            'Heure': c.heure_livraison || '',
            'Date réelle': c.date_livraison_reelle ? format(new Date(c.date_livraison_reelle), 'dd/MM/yyyy HH:mm') : '',
            'Livreur': c.livreur_id || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Livraisons');

        // Ajuster la largeur des colonnes
        const colWidths = [
            { wch: 15 }, // Nom
            { wch: 15 }, // Prénom
            { wch: 30 }, // Adresse
            { wch: 20 }, // Ville
            { wch: 15 }, // Téléphone
            { wch: 10 }, // Nb LEDs
            { wch: 20 }, // Statut
            { wch: 12 }, // Date prévue
            { wch: 8 },  // Heure
            { wch: 18 }, // Date réelle
            { wch: 15 }  // Livreur
        ];
        worksheet['!cols'] = colWidths;

        // Téléchargement
        const filename = `livraisons_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
        XLSX.writeFile(workbook, filename);

        return filename;
    }

    /**
     * Génère un fichier Excel des installations
     */
    static generateInstallationExcel(clients: Client[], options: {
        sheetName?: string;
        zone?: string;
    } = {}) {
        const data = clients.map(c => ({
            'Nom': c.nom,
            'Prénom': c.prenom,
            'Adresse': c.adresse || '',
            'Ville': c.ville || '',
            'Téléphone': c.telephone || '',
            'Nb LEDs': c.nb_led || 0,
            'Statut': c.statut_installation || '',
            'Date début': c.date_install_debut ? format(new Date(c.date_install_debut), 'dd/MM/yyyy') : '',
            'Date fin': c.date_install_fin ? format(new Date(c.date_install_fin), 'dd/MM/yyyy') : '',
            'Durée (jours)': c.date_install_debut && c.date_install_fin
                ? this.calculateDuration(c.date_install_debut, c.date_install_fin)
                : '',
            'Poseur': c.poseur_id || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Installations');

        // Ajuster la largeur des colonnes
        const colWidths = [
            { wch: 15 }, // Nom
            { wch: 15 }, // Prénom
            { wch: 30 }, // Adresse
            { wch: 20 }, // Ville
            { wch: 15 }, // Téléphone
            { wch: 10 }, // Nb LEDs
            { wch: 20 }, // Statut
            { wch: 12 }, // Date début
            { wch: 12 }, // Date fin
            { wch: 12 }, // Durée
            { wch: 15 }  // Poseur
        ];
        worksheet['!cols'] = colWidths;

        // Téléchargement
        const filename = `installations_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
        XLSX.writeFile(workbook, filename);

        return filename;
    }

    /**
     * Génère un fichier Excel du stock
     */
    static generateStockExcel(stockData: StockData[], options: {
        sheetName?: string;
    } = {}) {
        const data = stockData.map(stock => ({
            'Zone': stock.zone,
            'Stock Total': stock.total,
            'Consommées': stock.consommees,
            'Restantes': stock.restantes,
            'Disponible (%)': stock.pourcentage,
            'Critique': stock.critique ? 'OUI' : 'Non'
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Stock');

        // Ajuster la largeur des colonnes
        const colWidths = [
            { wch: 15 }, // Zone
            { wch: 15 }, // Stock Total
            { wch: 15 }, // Consommées
            { wch: 15 }, // Restantes
            { wch: 15 }, // Disponible
            { wch: 10 }  // Critique
        ];
        worksheet['!cols'] = colWidths;

        // Téléchargement
        const filename = `stock_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
        XLSX.writeFile(workbook, filename);

        return filename;
    }

    // ===== HELPERS =====

    private static calculateDeliveryStats(clients: Client[]) {
        const total = clients.length;
        const delivered = clients.filter(c =>
            c.statut_livraison?.toUpperCase().includes('LIVR') ||
            c.statut_client?.toUpperCase().includes('LIVR')
        ).length;
        const pending = total - delivered;
        const totalLEDs = clients.reduce((sum, c) => sum + (c.nb_led || 0), 0);
        const deliveredPercent = total > 0 ? Math.round((delivered / total) * 100) : 0;

        return { total, delivered, pending, totalLEDs, deliveredPercent };
    }

    private static calculateInstallationStats(clients: Client[]) {
        const total = clients.length;
        const completed = clients.filter(c =>
            c.statut_installation?.toUpperCase().includes('TERMIN')
        ).length;
        const inProgress = clients.filter(c =>
            c.statut_installation?.toUpperCase().includes('EN_COURS') ||
            c.statut_installation?.toUpperCase().includes('EN COURS')
        ).length;
        const planned = clients.filter(c =>
            c.statut_installation?.toUpperCase().includes('PLANIFI')
        ).length;
        const totalLEDs = clients.reduce((sum, c) => sum + (c.nb_led || 0), 0);
        const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, inProgress, planned, totalLEDs, completedPercent };
    }

    private static calculateDuration(start: string, end: string): string {
        try {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return `${diffDays}j`;
        } catch {
            return '';
        }
    }
}
