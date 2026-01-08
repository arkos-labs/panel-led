import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parse, isValid } from "date-fns";
import { getRegionFromDept } from "./business-logic";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a date that could be in French format (DD/MM/YYYY) or ISO
 */
export function parseSafeDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  // Try DD/MM/YYYY (French format from Sheets) FIRST
  try {
    const cleanStr = dateStr.trim();
    if (cleanStr.includes('/')) {
      let d;
      if (cleanStr.includes(' ')) {
        d = parse(cleanStr, "dd/MM/yyyy HH:mm", new Date());
      } else {
        d = parse(cleanStr, "dd/MM/yyyy", new Date());
      }
      if (isValid(d)) return d;
    }
  } catch (e) {
    // Continue to fallback
  }

  // Try standard ISO
  let d = new Date(dateStr);
  if (isValid(d)) return d;

  return null;
}

/**
 * Calcule la distance en km entre deux points GPS (Haversine)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper pour extraire ville/CP
function extractCity(addr: string) {
  if (!addr) return '';
  const match = addr.match(/(\d{5})\s+([^,]+)/);
  return match ? match[2].trim() : '';
}
function extractCP(addr: string) {
  if (!addr) return '';
  const match = addr.match(/(\d{5})/);
  return match ? match[1] : '';
}

/**
 * Mapper Supabase -> Frontend Client format
 * Allows frontend to fetch directly without Node server dependency
 */
export function mapSupabaseClient(c: any) {
  return {
    id: c.id,
    nom: c.nom,
    prenom: c.prenom,
    adresse: c.adresse_brute,
    telephone: c.telephone,
    email: c.email,
    zone_pays: (() => {
      const cp = extractCP(c.adresse_brute);
      const dept = cp.substring(0, 2);

      // Si c'est un DOM-TOM (97x)
      if (dept === '97') {
        const dom = cp.substring(0, 3);
        if (dom === '971') return 'GP';
        if (dom === '972') return 'MQ';
        return getRegionFromDept(dom);
      }

      // Si c'est la Corse (20, 2A, 2B)
      if (dept === '20' || dept === '2A' || dept === '2B') return 'CORSE';

      // Sinon on utilise la zone en base
      if (c.zone_pays) return c.zone_pays;

      // FALLBACK : DÃ©duction depuis l'ID (ex: "Guadeloupe_123")
      const idStr = (c.id || '').toLowerCase();
      if (idStr.startsWith('guadeloupe')) return 'GP';
      if (idStr.startsWith('martinique')) return 'MQ';
      if (idStr.startsWith('guyane')) return 'GF';
      if (idStr.startsWith('reunion') || idStr.startsWith('rÃ©union')) return 'RE';
      if (idStr.startsWith('mayotte')) return 'YT';
      if (idStr.startsWith('corse')) return 'CORSE';

      return 'FR'; // Default final
    })(),

    // KEY FIELDS
    statut_client: c.statut_client,
    nb_led: c.nb_led,
    nombreLED: c.nb_led,
    rappel_info: c.rappel_info,

    // Logistics
    dateLivraison: c.date_livraison_prevue,
    heureLivraison: c.heure_livraison,
    signatureLivraison: c.signature_livraison,
    date_livraison_reelle: c.date_livraison_reelle, // ADDED - Date réelle de livraison
    statut: c.statut_client,
    logistique: c.statut_livraison || 'NON_PLANIFIÉ',

    // Installation
    dateDebutTravaux: c.date_install_debut,
    dateFinTravaux: c.date_install_fin,
    installStatut: c.statut_installation,

    // Location
    ville: extractCity(c.adresse_brute),
    codePostal: extractCP(c.adresse_brute),

    // GPS Coordinates
    gps: c.gps,
    lat: c.gps?.lat || c.lat,
    lon: c.gps?.lon || c.lon,
    latitude: c.latitude,
    longitude: c.longitude,

    // Champs bruts pour compatibilité
    livreur_id: c.livreur_id,
    camionId: c.livreur_id,
    date_livraison_prevue: c.date_livraison_prevue,
    statut_livraison: c.statut_livraison, // ADDED
    statut_installation: c.statut_installation, // ADDED
    adresse_brute: c.adresse_brute, // ADDED
    date_install_debut: c.date_install_debut, // ADDED
    date_install_fin: c.date_install_fin, // ADDED
    date_install_fin_reelle: c.date_install_fin_reelle, // ADDED - Date/Heure réelle de fin de chantier
    dateSignature: c.date_signature || c.created_at, // Mapping added

    updated_at: c.updated_at
  };
}
/**
 * Vérifie si une zone client correspond à la zone sélectionnée.
 * Pour le filtre "FR" (France), on inclut uniquement la France métropolitaine 
 * (ce qui correspond à la carte fournie : 12 régions).
 * La Corse et les îles (GP, MQ) ont leurs propres filtres respectifs.
 */
export function isZoneMatch(clientZone: string | null | undefined, selectedZone: string): boolean {
  const zone = (clientZone || 'FR').toUpperCase();
  const selected = (selectedZone || 'FR').toUpperCase();

  // Si "ALL" ou "TOUT" est sélectionné, on accepte tout
  if (selected === 'ALL' || selected === 'TOUT') return true;

  // Liste des zones qui ont leur propre bouton de filtrage
  // et ne doivent pas apparaître dans le filtre "France" principal
  const separateZones = ['GP', 'GUADELOUPE', 'MQ', 'MARTINIQUE', 'CORSE', 'FR-CO'];

  // Cas spécial pour la France (FR)
  if (selected === 'FR' || selected === 'METROPOLE' || selected === 'FRANCE') {
    // Si c'est explicitement marqué FR ou Métropole, c'est bon
    if (zone === 'FR' || zone === 'METROPOLE' || zone === 'UNKNOWN' || zone === 'FRANCE') return true;

    // Si la zone du client n'est pas dans les zones séparées, on l'inclut dans FR (France métropolitaine)
    return !separateZones.includes(zone);
  }

  // Pour les autres filtres spécifiques (GP, MQ, CORSE), match exact
  // On gère les variantes de notations
  if (selected === 'CORSE' && (zone === 'CORSE' || zone === 'FR-CO')) return true;
  if (selected === 'GP' && (zone === 'GP' || zone === 'GUADELOUPE')) return true;
  if (selected === 'MQ' && (zone === 'MQ' || zone === 'MARTINIQUE')) return true;

  return zone === selected;
}
