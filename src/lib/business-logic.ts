
import { Client } from '@/types/logistics';
import { differenceInDays, isSameDay } from 'date-fns';

export type InstallationStatus =
    | 'A_PLANIFIER'
    | 'LIVRAISON_PLANIFIEE'
    | 'LIVRE'
    | 'PLANIFIEE'
    | 'EN_COURS'
    | 'TERMINEE';

export function getInstallationStatus(client: Client): InstallationStatus {
    const logistique = (client.logistique || '').toUpperCase();
    const installStatut = (client.installStatut || '').toUpperCase();
    const globalStatut = (client.statut || '').toUpperCase();

    // 1. Terminé (Priorité absolue)
    // 1. Terminé (Priorité absolue)
    const isTermine = (s: string) => {
        // Must include TERMIN but NOT 'DETERMIN' (e.g. "À DÉTERMINER")
        // Check for standardized keys first
        if (s === 'TERMINÉ' || s === 'TERMINÉE') return true;

        if (s.includes('TERMIN') && !s.includes('DETERMIN')) return true;
        if (s.includes('CLOS')) return true;
        if (s.includes('ARCHIV')) return true;
        if (s === 'COMPLET') return true;
        if (s.includes('POSÉ')) return true;
        // Strict check for INSTALLE to avoid "A INSTALLER"
        if (s === 'INSTALLE' || s === 'INSTALLÉ' || s.includes('EST INSTALLÉ')) return true;
        return false;
    };

    if (isTermine(globalStatut) || isTermine(installStatut)) {
        return 'TERMINEE'; // Normalized internal status string
    }

    // 2. Installation En Cours (Explicite dans DB)
    // Accepte "EN COURS", "EN_COURS" (format DB), ou "CHANTIER..."
    if (installStatut.includes('EN COURS') || installStatut.includes('EN_COURS') || installStatut.includes('CHANTIER')) {
        return 'EN_COURS'; // Normalized status
    }

    // 3. Installation Planifiée
    // Si on a une date, c'est planifié, même si le statut textuel est bizarre.
    // On vérifie la présence de "PLANIFI" ou d'une date. 
    // "INSTALL" tout seul est trop vague (souvent présent dans "À INSTALLER" qui est l'état précédent).
    if ((installStatut.includes('PLANIFI') && !installStatut.includes('NON')) || client.dateDebutTravaux) {
        return 'PLANIFIEE'; // Normalized status
    }

    // 4. Livré (Prêt pour install) - PRIORITÉ SUR PLANIFIÉ
    // Si validé ou matériel reçu, on considère livré même si des restes de "Planifié" traînent
    const isLivreString = (s: string) => {
        const up = s.toUpperCase();

        // Explicit standard checks - exact matches first
        if (up === 'LIVRÉ' || up === 'LIVRÉE' || up === 'LIVRE') return true;

        // Exclusions strictes pour la phase de livraison en cours
        if (up.includes('PLANIFI') || up.includes('EN COURS') || up.includes('A PLANIFIER')) return false;

        // Mots-clés de livraison effectuée
        if (up.includes('LIVRÉ') || up.includes('LIVREE')) return true;

        // Autres indicateurs de réception (State 3/4 dans le workflow)
        return up.includes('RECU') || up.includes('REÇU') || up.includes('MATERIEL') || up.includes('VALID');
    };

    if (isLivreString(logistique) || isLivreString(globalStatut)) {
        return 'LIVRE'; // Normalized status
    }

    // 5. Livraison Planifiée
    const isPlanifieIncluded = (s: string) => {
        const up = s.toUpperCase();
        if (up.includes('NON PLANIFI') || up.includes('NON_PLANIFI')) return false;
        if (up.includes('À PLANIFIER') || up.includes('A PLANIFIER')) return false;

        // On vérifie le numéro 2 (Livraison confirmée) ou la présence du mot sans "À" devant
        return (up.includes('PLANIFI') && !up.includes('À PLANIFIER') && !up.includes('A PLANIFIER')) ||
            up.includes('EN COURS') ||
            up.includes('2.');
    };

    if (isPlanifieIncluded(globalStatut) || isPlanifieIncluded(logistique)) {
        return 'LIVRAISON_PLANIFIEE';
    }

    // 6. Défaut
    return 'A_PLANIFIER';
}

/**
 * Robust check to see if a status string indicates a client should be in "In Progress"
 */
export function isStatusPlanned(s: string): boolean {
    if (!s) return false;
    const up = s.toUpperCase();
    if (up.includes('NON PLANIFI') || up.includes('NON_PLANIFI')) return false;
    if (up.includes('À PLANIFIER') || up.includes('A PLANIFIER')) return false;
    if (up.includes('1.')) return false;

    return up.includes('PLANIFI') ||
        up.includes('EN COURS') ||
        up.includes('2.') ||
        up.includes('LIVRÉ') ||
        up.includes('LIVREE') ||
        up.includes('RECU') ||
        up.includes('REÇU') ||
        up.includes('CONFIRM') ||
        up.includes('MATERIEL');
}

/**
 * Determines if a client should appear in the Delivery View/Lists
 * Un client est "actif en livraison" s'il a une date de livraison planifiée
 */
export function isDeliveryActive(client: any): boolean {
    return !!getClientDeliveryDate(client);
}

/**
 * Helper to safely parse dates from Sheet format or ISO
 */
export function parseClientDate(dateStr?: string): Date | null {
    if (!dateStr || dateStr === 'null' || dateStr.trim() === '') return null;

    // FIX: Try DD/MM/YYYY HH:mm manually FIRST to prevent US Date interpretation (MM/DD/YYYY)
    if (dateStr.includes('/')) {
        const parts = dateStr.trim().split(/\s+/);
        const dateParts = parts[0].split('/');

        // Assume DD/MM/YYYY
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const yearPart = dateParts[2];
            const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);

            let hours = 12;
            let minutes = 0;

            if (parts.length > 1) {
                const timeParts = parts[1].split(':');
                if (timeParts.length >= 2) {
                    hours = parseInt(timeParts[0], 10);
                    minutes = parseInt(timeParts[1], 10);
                }
            }

            const d = new Date(year, month, day, hours, minutes);
            if (!isNaN(d.getTime())) return d;
        }
    }

    // Try ISO/Standard fallback
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    return null;
}

/**
 * Unified helper to get the delivery date from a client, handling both legacy and new fields.
 * Priority: date_livraison_prevue (Supabase) > dateLivraison (Legacy)
 */
export function getClientDeliveryDate(client: any): Date | null {
    const d1 = parseClientDate(client.date_livraison_prevue);
    if (d1) return d1;

    const d2 = parseClientDate(client.dateLivraison);
    if (d2) return d2;

    return null;
}

/**
 * Maps a department code (2 digits) to a French Region name.
 */
export function getRegionFromDept(dept: string): string {
    const mapping: Record<string, string> = {
        '75': 'IDF', '77': 'IDF', '78': 'IDF', '91': 'IDF', '92': 'IDF', '93': 'IDF', '94': 'IDF', '95': 'IDF',
        '69': 'ARA', '01': 'ARA', '03': 'ARA', '07': 'ARA', '15': 'ARA', '26': 'ARA', '38': 'ARA', '42': 'ARA', '43': 'ARA', '63': 'ARA', '73': 'ARA', '74': 'ARA',
        '13': 'PACA', '04': 'PACA', '05': 'PACA', '06': 'PACA', '83': 'PACA', '84': 'PACA',
        '33': 'NAQ', '16': 'NAQ', '17': 'NAQ', '19': 'NAQ', '23': 'NAQ', '24': 'NAQ', '40': 'NAQ', '47': 'NAQ', '64': 'NAQ', '79': 'NAQ', '86': 'NAQ', '87': 'NAQ',
        '31': 'OCC', '09': 'OCC', '11': 'OCC', '12': 'OCC', '30': 'OCC', '32': 'OCC', '34': 'OCC', '46': 'OCC', '48': 'OCC', '65': 'OCC', '66': 'OCC', '81': 'OCC', '82': 'OCC',
        '44': 'PDL', '49': 'PDL', '53': 'PDL', '72': 'PDL', '85': 'PDL',
        '35': 'BRE', '22': 'BRE', '29': 'BRE', '56': 'BRE',
        '59': 'HDF', '02': 'HDF', '60': 'HDF', '62': 'HDF', '80': 'HDF',
        '67': 'GES', '08': 'GES', '10': 'GES', '51': 'GES', '52': 'GES', '54': 'GES', '55': 'GES', '57': 'GES', '68': 'GES', '88': 'GES',
        '21': 'BFC', '25': 'BFC', '39': 'BFC', '58': 'BFC', '70': 'BFC', '71': 'BFC', '89': 'BFC', '90': 'BFC',
        '45': 'CVL', '18': 'CVL', '28': 'CVL', '36': 'CVL', '37': 'CVL', '41': 'CVL',
        '76': 'NOR', '14': 'NOR', '27': 'NOR', '50': 'NOR', '61': 'NOR',
        '2A': 'CORSE', '2B': 'CORSE', '20': 'CORSE',
        '971': 'GP', '972': 'MQ', '973': 'GY', '974': 'RE', '976': 'YT'
    };
    return mapping[dept] || 'AUTRE';
}

/**
 * Ligne de démarcation Nord/Sud pour la règle du "Dormir sur place".
 * Au-dessus (Nord) : Le livreur rentre à Paris (Dépôt).
 * En-dessous (Sud) : Le livreur dort sur place (Pas de retour dépôt requis ce soir-là).
 * Basé sur une latitude approximative (La Rochelle / Mâcon / Genève).
 */
export const LATITUDE_SLEEP_LINE = 46.5;

export function isSouthOfSleepLine(lat: number): boolean {
    return lat < LATITUDE_SLEEP_LINE;
}
