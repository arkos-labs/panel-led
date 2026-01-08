-- 0. Cleanup (To ensure clean state based on Master Spec)
DROP TABLE IF EXISTS chantiers;
DROP TABLE IF EXISTS equipes;

-- 1. Table Clients (Miroir enrichi du Sheet)
-- 1. Table Clients (Miroir enrichi du Sheet - Source de Vérité)
CREATE TABLE clients (
  id TEXT PRIMARY KEY, -- ID Composite : 'NOM_TAB_ROWINDEX' (ex: 'GUADELOUPE_14')
  zone_pays TEXT NOT NULL, -- 'FR', 'GP', 'MQ', 'RE', 'YT', 'GF', 'CORSE'
  google_row_index INTEGER, -- Pour savoir où écrire le retour dans le Sheet
  
  -- Données Client (Saisies par Secrétaire : Colonnes A - F)
  nom TEXT,               -- Col A
  prenom TEXT,            -- Col B
  adresse_brute TEXT,     -- Col C
  telephone TEXT,         -- Col D
  email TEXT,             -- Col E
  statut_client TEXT,     -- Col F (ex: 'SIGNÉ')

  -- Données Logistique & Robot (Colonnes G - K)
  date_livraison_prevue TEXT,     -- Col G : Date prévue du RDV / Livraison
  signature_livraison TEXT,       -- Col H : Signature de la livraison
  heure_livraison TEXT,           -- Col I : Heure prévue (ou effective) de livraison
  
  -- Données Installation (Colonnes J - K)
  date_install_debut TEXT,        -- Col J : Date du RDV d'installation (Début)
  date_install_fin TEXT,          -- Col K : Date de fin de chantier (Fin)

  -- Métadonnées Internes App
  nb_led INTEGER,
  statut_livraison TEXT DEFAULT 'NON_PLANIFIÉ', -- État interne dérivé ou synchronisé avec Col F
  statut_installation TEXT DEFAULT 'ATTENTE',   -- État interne dérivé
  livreur_id TEXT,
  lien_validation_livraison TEXT,
  poseur_id TEXT,
  lien_validation_install TEXT,
  
  -- Données Techniques
  gps JSONB,
  rappel_info JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VUES (Pour simuler des tables séparées dans le Dashboard Supabase)
CREATE OR REPLACE VIEW clients_france AS SELECT * FROM clients WHERE zone_pays = 'FR';
CREATE OR REPLACE VIEW clients_guadeloupe AS SELECT * FROM clients WHERE zone_pays = 'GP';
CREATE OR REPLACE VIEW clients_martinique AS SELECT * FROM clients WHERE zone_pays = 'MQ';
CREATE OR REPLACE VIEW clients_guyane AS SELECT * FROM clients WHERE zone_pays = 'GF';
CREATE OR REPLACE VIEW clients_reunion AS SELECT * FROM clients WHERE zone_pays = 'RE';
CREATE OR REPLACE VIEW clients_mayotte AS SELECT * FROM clients WHERE zone_pays = 'YT';
CREATE OR REPLACE VIEW clients_corse AS SELECT * FROM clients WHERE zone_pays = 'CORSE';

-- 2. Table Ressources (Equipes)
CREATE TABLE IF NOT EXISTS equipes (
  id TEXT PRIMARY KEY,
  nom TEXT,
  type TEXT, -- 'LIVREUR' ou 'POSEUR'
  zone_pays TEXT
);
