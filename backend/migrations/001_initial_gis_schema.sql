-- ============================================================================
-- CARTO PLATFORM ENTERPRISE - INITIAL POSTGRESQL + POSTGIS SCHEMA
-- ============================================================================

-- Enable PostGIS & cryptographic extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. API TOKENS (Scoped & One-time reveal, stored with SHA-256 hash)
CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(16) NOT NULL, -- First 8 chars for identification (e.g. "cpt_live_...")
    token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 of the plain token
    allowed_domains TEXT[] DEFAULT '{}',
    allowed_ips TEXT[] DEFAULT '{}',
    allowed_endpoints TEXT[] DEFAULT '{}',
    allowed_methods TEXT[] DEFAULT '{"GET"}',
    rate_limit_per_min INT NOT NULL DEFAULT 120,
    daily_quota INT NOT NULL DEFAULT 50000,
    current_day_usage INT NOT NULL DEFAULT 0,
    quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_revoked ON api_tokens(is_revoked);

-- 3. CARTOGRAPHIC PROVIDERS (Google, Esri, MapTiler, OSM, Internal COG/WMS)
CREATE TABLE IF NOT EXISTS providers (
    id VARCHAR(64) PRIMARY KEY, -- e.g. "esri-satellite", "osm-standard", "google-hybrid"
    display_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('xyz', 'wmts', 'wms', 'cog', 'vector')),
    base_url TEXT NOT NULL,
    api_key_encrypted TEXT,
    attribution TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 10, -- Lower number = higher priority
    min_zoom INT NOT NULL DEFAULT 0,
    max_zoom INT NOT NULL DEFAULT 20,
    max_resolution_m NUMERIC(10,2) DEFAULT 0.5,
    cost_per_1000_tiles NUMERIC(10,4) DEFAULT 0.0000,
    key_expiration_date DATE,
    health_status VARCHAR(20) NOT NULL DEFAULT 'HEALTHY' CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
    last_health_check_at TIMESTAMPTZ,
    coverage_geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_providers_active_prio ON providers(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_providers_coverage ON providers USING GIST (coverage_geom);

-- 4. MAP STYLES (Street, Satellite, Hybrid, Terrain, Dark, Light, 3D)
CREATE TABLE IF NOT EXISTS carto_styles (
    id VARCHAR(64) PRIMARY KEY, -- "streets", "satellite", "hybrid", "topo", "dark", "light"
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    primary_provider_id VARCHAR(64) REFERENCES providers(id) ON DELETE SET NULL,
    fallback_provider_id VARCHAR(64) REFERENCES providers(id) ON DELETE SET NULL,
    style_json JSONB DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CUSTOM GEOGRAPHIC LAYERS (PostGIS Vector Features & Raster Metadata)
CREATE TABLE IF NOT EXISTS custom_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    layer_type VARCHAR(50) NOT NULL DEFAULT 'geojson' CHECK (layer_type IN ('geojson', 'shapefile', 'wms', 'wmts', 'cog')),
    source_url TEXT,
    geom GEOMETRY(Geometry, 4326),
    properties JSONB DEFAULT '{}',
    opacity NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (opacity >= 0.0 AND opacity <= 1.0),
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    min_zoom INT NOT NULL DEFAULT 0,
    max_zoom INT NOT NULL DEFAULT 22,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_layers_geom ON custom_layers USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_custom_layers_user ON custom_layers(user_id);

-- 6. SAVED MAPS & PROJECTS
CREATE TABLE IF NOT EXISTS custom_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    center_lon NUMERIC(9,6) NOT NULL DEFAULT 10.1815,
    center_lat NUMERIC(9,6) NOT NULL DEFAULT 36.8065,
    zoom NUMERIC(4,2) NOT NULL DEFAULT 12.0,
    pitch NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    bearing NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    active_style_id VARCHAR(64) REFERENCES carto_styles(id) ON DELETE SET NULL,
    active_layers JSONB DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    share_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_maps_user ON custom_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_maps_share ON custom_maps(share_token);

-- 7. USAGE AUDIT & METRICS LOGS (Partitioning ready)
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    http_status INT NOT NULL,
    response_time_ms INT NOT NULL,
    provider_used VARCHAR(64),
    is_cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_created_at ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_token ON api_usage_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_usage_status ON api_usage_logs(http_status);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON api_usage_logs(provider_used);

-- 8. SECURITY AUDIT LOGS
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g. "AUTH_LOGIN", "TOKEN_CREATE", "TOKEN_REVOKE", "BLOCKED_IP"
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_audit_created ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_severity ON security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_sec_audit_action ON security_audit_logs(action);

-- 9. SYSTEM QUOTAS & BUDGETS
CREATE TABLE IF NOT EXISTS system_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('global', 'user', 'token')),
    entity_id VARCHAR(64) NOT NULL,
    monthly_tile_limit BIGINT NOT NULL DEFAULT 1000000,
    monthly_geocode_limit BIGINT NOT NULL DEFAULT 50000,
    current_month_tiles BIGINT NOT NULL DEFAULT 0,
    current_month_geocodes BIGINT NOT NULL DEFAULT 0,
    billing_cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
    alert_threshold_percent INT NOT NULL DEFAULT 85,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_entity UNIQUE (entity_type, entity_id)
);

-- ============================================================================
-- SEED ESSENTIAL BASELINE DATA (Default Providers & Styles)
-- ============================================================================

INSERT INTO providers (id, display_name, provider_type, base_url, attribution, is_active, priority, min_zoom, max_zoom, cost_per_1000_tiles)
VALUES
('esri-imagery', 'Esri World Imagery HD (Satellite)', 'xyz', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Tiles &copy; Esri, Maxar, Earthstar Geographics', TRUE, 1, 0, 19, 0.0000),
('esri-streets', 'Esri World Street Map', 'xyz', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', 'Tiles &copy; Esri & Contributors', TRUE, 2, 0, 19, 0.0000),
('esri-topo', 'Esri National Geographic / Topo', 'xyz', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 'Tiles &copy; Esri & Topo Partners', TRUE, 3, 0, 19, 0.0000),
('osm-standard', 'OpenStreetMap Standard (Strict Rate Limit)', 'xyz', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; OpenStreetMap contributors', TRUE, 10, 0, 19, 0.0000),
('google-satellite', 'Google Maps Tiles API (Satellite)', 'xyz', 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={session}&key={key}', '&copy; Google Maps Data', FALSE, 20, 0, 22, 0.0070),
('maptiler-satellite', 'MapTiler Satellite', 'xyz', 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key={key}', '&copy; MapTiler &copy; OpenStreetMap contributors', FALSE, 25, 0, 20, 0.0050)
ON CONFLICT (id) DO NOTHING;

INSERT INTO carto_styles (id, display_name, description, primary_provider_id, fallback_provider_id, is_default, is_public)
VALUES
('satellite', 'Vue Satellite HD', 'Photographies spatiales haute résolution', 'esri-imagery', 'osm-standard', TRUE, TRUE),
('streets', 'Vue Rues & Plan', 'Cartographie urbaine claire et vectorielle', 'esri-streets', 'osm-standard', FALSE, TRUE),
('topo', 'Vue Terrain & Relief', 'Courbes topographiques et élévation', 'esri-topo', 'osm-standard', FALSE, TRUE),
('dark', 'Mode Sombre Spatial', 'Fond de carte sombre optimisé pour les nuits et opérations', 'esri-streets', 'osm-standard', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;
