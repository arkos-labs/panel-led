/**
 * ITINÉRAIRE COMMANDO : 7 JOURS / 12 RÉGIONS
 * Logic de boucle continue sur 7 jours.
 */

export type CommandoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CommandoZone {
    dayIndex: CommandoDay; // 1 = Lundi, 7 = Dimanche
    name: string;
    description: string;
    departments: string[];
    emoji: string;
}

export const COMMANDO_ZONES: Record<CommandoDay, CommandoZone> = {
    1: {
        dayIndex: 1,
        name: "SERPENT J1: NORD & EST",
        description: "Lille ➡️ Reims ➡️ Strasbourg",
        emoji: "🥨",
        departments: ['59', '62', '02', '80', '60', '08', '51', '55', '54', '57', '67', '68', '88', '10', '52']
    },
    2: {
        dayIndex: 2,
        name: "SERPENT J2: BOURGOGNE & RHÔNE-ALPES",
        description: "Dijon ➡️ Lyon ➡️ Annecy",
        emoji: "🏔️",
        departments: ['21', '71', '89', '58', '25', '39', '70', '90', '69', '01', '73', '74', '38', '42', '03']
    },
    3: {
        dayIndex: 3,
        name: "SERPENT J3: SUD & MÉDITERRANÉE",
        description: "Marseille ➡️ Nice ➡️ Montpellier",
        emoji: "☀️",
        departments: ['04', '05', '06', '13', '83', '84', '2A', '2B', '09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82', '07', '26', '43', '15', '63']
    },
    4: {
        dayIndex: 4,
        name: "SERPENT J4: GRAND OUEST & ATLANTIQUE",
        description: "Bordeaux ➡️ Nantes ➡️ Brest",
        emoji: "🌊",
        departments: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87', '44', '49', '53', '72', '85', '35', '22', '29', '56', '36', '18']
    },
    5: {
        dayIndex: 5,
        name: "SERPENT J5: BASSIN PARISIEN",
        description: "IDF ➡️ Normandie ➡️ Centre",
        emoji: "🗼",
        departments: ['75', '77', '78', '91', '92', '93', '94', '95', '14', '27', '50', '61', '76', '28', '45', '41', '37']
    },
    6: {
        dayIndex: 6,
        name: "Week-end",
        description: "(Repos)",
        emoji: "🏠",
        departments: []
    },
    7: {
        dayIndex: 7,
        name: "Week-end",
        description: "(Repos)",
        emoji: "🏠",
        departments: []
    }
};

/**
 * Utilitaires de compatibilité pour le reste de l'app 
 * (Garde les anciens types exportés pour éviter de tout casser)
 */
export type RegionCode = 'IDF_HDF' | 'NOR_BRE' | 'GES_BFC' | 'ARA' | 'PACA_OCC' | 'AUTRES' | 'COMMANDO';

export function getClientCommandoZone(client: any): CommandoZone | null {
    const postalCode = client.codePostal || client.code_postal;
    if (!postalCode) return null;

    const dept = postalCode.substring(0, 2);

    for (const [day, zone] of Object.entries(COMMANDO_ZONES)) {
        if (zone.departments.includes(dept)) {
            return zone;
        }
    }

    // Cas spécial Corse (2A/2B) souvent géré comme 20
    if (dept === '20' || dept === '2A' || dept === '2B') return COMMANDO_ZONES[3];

    return null;
}

// --- Wrappers de compatibilité (pour QuickPlanningModal) ---

export function getClientRegion(client: any): RegionCode {
    return 'COMMANDO'; // On force le mode Commando
}

export function getRegionName(code: RegionCode): string {
    return "Zone Commando";
}

export function getRegionEmoji(code: RegionCode): string {
    return "🎗️";
}


/**
 * Convertit un Department en Jour de cycle (1-7)
 */
export function getCommandoDayForDept(dept: string): number {
    for (const [day, zone] of Object.entries(COMMANDO_ZONES)) {
        if (zone.departments.includes(dept)) {
            return parseInt(day);
        }
    }
    return 1; // Default Jour 1
}

export const ZONE_DEPOTS: Record<string, { name: string; location: [number, number] }> = {
    'FR': {
        name: 'Paris (France Métropolitaine)',
        location: [2.3522, 48.8566]
    },
    'CORSE': {
        name: 'Ajaccio (Corse)',
        location: [8.7386, 41.9268]
    },
    'GP': {
        name: 'Pointe-à-Pitre (Guadeloupe)',
        location: [-61.5332, 16.2410]
    },
    'MQ': {
        name: 'Fort-de-France (Martinique)',
        location: [-61.0594, 14.6160]
    },
    'GF': {
        name: 'Cayenne (Guyane)',
        location: [-52.3261, 4.9227]
    },
    'RE': {
        name: 'Saint-Denis (Réunion)',
        location: [55.4504, -20.8824]
    }
};
