-- Ajout de la colonne rappel_info si elle n'existe pas
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rappel_info JSONB;

-- Index pour accélérer les recherches de clients à rappeler
CREATE INDEX IF NOT EXISTS idx_clients_rappel_info ON clients USING gin (rappel_info);
