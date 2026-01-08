-- ================================================
-- TABLE ANALYTICS EVENTS
-- Stockage des événements d'analytics et métriques
-- ================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_properties JSONB DEFAULT '{}'::jsonb,
  user_id TEXT,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;

-- Commentaires
COMMENT ON TABLE analytics_events IS 'Événements d''analytics et métriques de performance';
COMMENT ON COLUMN analytics_events.event_name IS 'Nom de l''événement (ex: page_view, delivery_completed)';
COMMENT ON COLUMN analytics_events.event_category IS 'Catégorie (ex: navigation, logistics, performance)';
COMMENT ON COLUMN analytics_events.event_properties IS 'Propriétés additionnelles en JSON';
COMMENT ON COLUMN analytics_events.session_id IS 'ID unique de session utilisateur';

-- ================================================
-- VUES UTILES POUR ANALYTICS
-- ================================================

-- Vue : Événements par jour
CREATE OR REPLACE VIEW analytics_daily_events AS
SELECT 
  DATE(timestamp) as date,
  event_category,
  event_name,
  COUNT(*) as count
FROM analytics_events
GROUP BY DATE(timestamp), event_category, event_name
ORDER BY date DESC, count DESC;

-- Vue : Sessions actives par jour
CREATE OR REPLACE VIEW analytics_daily_sessions AS
SELECT 
  DATE(timestamp) as date,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Vue : Performance moyenne par opération
CREATE OR REPLACE VIEW analytics_performance_avg AS
SELECT 
  event_name,
  COUNT(*) as count,
  AVG((event_properties->>'duration')::numeric) as avg_duration_ms,
  MIN((event_properties->>'duration')::numeric) as min_duration_ms,
  MAX((event_properties->>'duration')::numeric) as max_duration_ms
FROM analytics_events
WHERE event_category = 'performance'
  AND event_properties->>'duration' IS NOT NULL
GROUP BY event_name
ORDER BY avg_duration_ms DESC;

-- ================================================
-- FONCTION : Nettoyer les vieux événements
-- ================================================

CREATE OR REPLACE FUNCTION cleanup_old_analytics(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM analytics_events
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_analytics IS 'Supprime les événements analytics plus vieux que X jours (défaut: 90)';

-- ================================================
-- POLITIQUE RLS (Row Level Security)
-- ================================================

-- Activer RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Politique : Tout le monde peut insérer (pour le tracking)
CREATE POLICY "Allow insert for all" ON analytics_events
  FOR INSERT
  WITH CHECK (true);

-- Politique : Seuls les admins peuvent lire
CREATE POLICY "Allow read for authenticated" ON analytics_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ================================================
-- TRIGGER : Mise à jour automatique de created_at
-- ================================================

CREATE OR REPLACE FUNCTION update_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_created_at
  BEFORE INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION update_created_at();

-- ================================================
-- DONNÉES DE TEST (OPTIONNEL)
-- ================================================

-- Insérer quelques événements de test
INSERT INTO analytics_events (event_name, event_category, event_properties, session_id) VALUES
  ('page_view', 'navigation', '{"page": "Dashboard"}'::jsonb, 'test-session-1'),
  ('delivery_planned', 'logistics', '{"client_id": "test-123", "zone": "FR"}'::jsonb, 'test-session-1'),
  ('api_call', 'performance', '{"name": "get_clients", "duration": 150}'::jsonb, 'test-session-1'),
  ('stock_added', 'inventory', '{"zone": "FR", "quantity": 5000}'::jsonb, 'test-session-2');

-- ================================================
-- REQUÊTES UTILES
-- ================================================

-- Top 10 événements (24h)
-- SELECT event_name, COUNT(*) as count
-- FROM analytics_events
-- WHERE timestamp > NOW() - INTERVAL '24 hours'
-- GROUP BY event_name
-- ORDER BY count DESC
-- LIMIT 10;

-- Sessions par jour (30 derniers jours)
-- SELECT * FROM analytics_daily_sessions
-- WHERE date > CURRENT_DATE - 30
-- ORDER BY date DESC;

-- Performance moyenne
-- SELECT * FROM analytics_performance_avg;

-- Nettoyer les événements > 90 jours
-- SELECT cleanup_old_analytics(90);
