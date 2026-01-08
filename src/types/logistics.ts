export interface Client {
  id: string;
  nom: string;
  prenom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string;
  email: string;
  nombreLED: number;
  nb_led?: number; // Legacy / Supabase mapping
  marqueLED?: string;
  statut: 'SIGNÉ' | 'A PLANIFIER' | 'LIVRÉ' | 'LIVRÉE' | 'EN_COURS' | 'TERMINÉ' | 'ANNULÉ' | 'A_RAPPELER' | 'A_VALIDER';
  statut_client?: string; // Supabase raw field
  dateSignature: string;
  dateLivraison?: string;
  heureLivraison?: string;
  signatureLivraison?: string;
  dateDebutTravaux?: string;
  dateFinTravaux?: string;
  dureeEstimee?: number;
  priorite?: 'haute' | 'moyenne' | 'basse';
  infoDivers?: string;
  adresse_brute?: string; // Adresse complète brute
  logistique?: string; // Colonne I - Statut logistique
  installStatut?: string; // Colonne L - Statut installation
  isReal?: boolean;
  camionId?: string;
  livreur_id?: string;
  date_livraison_prevue?: string;
  rappel_info?: {
    attempt_count: number;
    last_attempt: string;
    next_recall: string;
    active: boolean;
  } | null;
  gps?: { lat: number; lon: number };
  lat?: number;
  lon?: number;
  zone_pays?: string; // e.g. 'FR', 'GP', 'MQ', 'RE'
  estimatedArrival?: Date;
}

export interface StockItem {
  id: string;
  marque: string;
  reference: string;
  stockInitial: number;
  stockActuel: number;
  stockTech: number;
  volumeCarton: number; // m³
  seuilAlerte: number; // pourcentage
}

export interface Camion {
  id: string;
  nom: string;
  volumeMax: number; // m³
  disponible: boolean;
}

export interface Installer {
  id: string;
  nom: string;
  telephone: string;
  region: string;
  disponible: boolean;
}

export interface Livraison {
  id: string;
  clientId: string;
  client: Client;
  datePrevue: string;
  camionId: string;
  volumeTotal: number;
  statut: 'PLANIFIÉE' | 'EN_COURS' | 'LIVRÉE' | 'REPORTÉE' | 'A_VALIDER';
  ordre: number;
}

export interface Installation {
  id: string;
  clientId: string;
  client: Client;
  dateDebut: string;
  dateFin: string;
  dureeJours: number;
  poseurId: string;
  statut: 'PLANIFIÉE' | 'EN_COURS' | 'TERMINÉE' | 'REPORTÉE';
}

export interface KPIs {
  clientsAContacter: number;
  livraisonsAujourdhui: number;
  installationsEnCours: number;
  stockCritique: number;
  tauxRemplissage: number;
}
