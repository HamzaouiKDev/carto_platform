#!/usr/bin/env bash
# ==============================================================================
#  INS SIG PLATFORM v1.0 — Installation native Ubuntu (SANS Docker)
#  Stack : Node.js 20 + PostgreSQL 16 + PostGIS 3.4 + Redis 7 + Nginx
#  Usage : chmod +x install_native_ubuntu.sh && sudo ./install_native_ubuntu.sh
# ==============================================================================
set -euo pipefail

# ── Couleurs ──
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step()    { echo -e "\n${CYAN}[*] $1${NC}"; }
success() { echo -e "${GREEN}[OK] $1${NC}"; }
warn()    { echo -e "${YELLOW}[!]  $1${NC}"; }
error()   { echo -e "${RED}[ERREUR] $1${NC}"; exit 1; }

# ── Configuration ──
APP_USER="carto"
APP_DIR="/opt/carto_platform"
POSTGRES_DB="carto_db"
POSTGRES_USER="carto_user"
POSTGRES_PASS="CartoPostgres2026!Secure"
REDIS_PASS="CartoRedis2026!Secure"
ADMIN_PASS="AdminCarto2026!Secure"
JWT_SECRET="$(openssl rand -hex 48)"
JWT_REFRESH_SECRET="$(openssl rand -hex 48)"
API_PORT=4000
FRONTEND_PORT=8085

# ── Bannière ──
clear
echo -e "${BLUE}===============================================================================${NC}"
echo -e "${BLUE}           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE${NC}"
echo -e "${GREEN}                     INS SIG PLATFORM v1.0${NC}"
echo -e "${NC}        Installation Native (sans Docker) sous Ubuntu/Debian${NC}"
echo -e "${BLUE}===============================================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "\nSource du projet : ${CYAN}$SCRIPT_DIR${NC}"
echo -e "Répertoire d'installation : ${CYAN}$APP_DIR${NC}"

# ── Étape 1 : Droits root ──
step "Étape 1/10 : Vérification des droits administrateur..."
[[ $EUID -ne 0 ]] && error "Relancez avec : sudo $0"
success "Droits root confirmés."

# ── Étape 2 : Mise à jour système ──
step "Étape 2/10 : Mise à jour des paquets système..."
apt-get update -qq
apt-get install -y -qq \
  curl wget gnupg lsb-release ca-certificates \
  software-properties-common apt-transport-https \
  openssl git build-essential python3 make g++
success "Paquets système installés."

# ── Étape 3 : Node.js 20 ──
step "Étape 3/10 : Installation de Node.js 20 LTS..."
if command -v node &>/dev/null && [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -ge 20 ]]; then
  success "Node.js déjà installé : $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  success "Node.js installé : $(node --version)"
fi

# ── Étape 4 : PostgreSQL 16 + PostGIS 3.4 ──
step "Étape 4/10 : Installation de PostgreSQL 16 + PostGIS 3.4..."
if ! command -v psql &>/dev/null; then
  # Ajout du dépôt PostgreSQL officiel
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/postgresql.gpg] \
    https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    | tee /etc/apt/sources.list.d/postgresql.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq postgresql-16 postgresql-16-postgis-3
  systemctl enable postgresql --now
  success "PostgreSQL 16 + PostGIS 3.4 installés."
else
  success "PostgreSQL déjà installé : $(psql --version)"
fi

# Création base de données et utilisateur
step "  Configuration de la base de données..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${POSTGRES_USER}'" \
  | grep -q 1 || sudo -u postgres psql -c \
  "CREATE USER ${POSTGRES_USER} WITH ENCRYPTED PASSWORD '${POSTGRES_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" \
  | grep -q 1 || sudo -u postgres psql -c \
  "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"
sudo -u postgres psql -d "${POSTGRES_DB}" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null || true
sudo -u postgres psql -d "${POSTGRES_DB}" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
sudo -u postgres psql -d "${POSTGRES_DB}" -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};" 2>/dev/null || true
sudo -u postgres psql -d "${POSTGRES_DB}" -c "GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};" 2>/dev/null || true
success "Base de données '${POSTGRES_DB}' configurée."

# Application du schéma initial
if [[ -f "$SCRIPT_DIR/backend/migrations/001_initial_gis_schema.sql" ]]; then
  sudo -u postgres psql -d "${POSTGRES_DB}" -f "$SCRIPT_DIR/backend/migrations/001_initial_gis_schema.sql" 2>/dev/null || true
  success "Schéma GIS initial appliqué."
fi

# ── Étape 5 : Redis 7 ──
step "Étape 5/10 : Installation de Redis 7..."
if ! command -v redis-server &>/dev/null; then
  curl -fsSL https://packages.redis.io/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/redis.gpg
  echo "deb [signed-by=/etc/apt/keyrings/redis.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/redis.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq redis-server
fi

# Configuration Redis avec mot de passe
REDIS_CONF="/etc/redis/redis.conf"
sed -i "s/^# requirepass .*/requirepass ${REDIS_PASS}/" "$REDIS_CONF"
sed -i "s/^requirepass .*/requirepass ${REDIS_PASS}/" "$REDIS_CONF"
if ! grep -q "^requirepass" "$REDIS_CONF"; then
  echo "requirepass ${REDIS_PASS}" >> "$REDIS_CONF"
fi
sed -i "s/^maxmemory .*/maxmemory 512mb/" "$REDIS_CONF"
if ! grep -q "^maxmemory " "$REDIS_CONF"; then
  echo "maxmemory 512mb" >> "$REDIS_CONF"
  echo "maxmemory-policy allkeys-lru" >> "$REDIS_CONF"
fi
systemctl enable redis-server --now
systemctl restart redis-server
success "Redis configuré avec authentification."

# ── Étape 6 : Nginx ──
step "Étape 6/10 : Installation et configuration de Nginx..."
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
fi
systemctl enable nginx
success "Nginx installé."

# ── Étape 7 : Déploiement de l'application ──
step "Étape 7/10 : Déploiement de l'application..."

# Création de l'utilisateur système applicatif
id "$APP_USER" &>/dev/null || useradd --system --shell /bin/bash --create-home "$APP_USER"
success "Utilisateur système '${APP_USER}' prêt."

# Copie du projet
mkdir -p "$APP_DIR"
cp -r "$SCRIPT_DIR/backend" "$APP_DIR/"
cp -r "$SCRIPT_DIR/frontend" "$APP_DIR/"
cp -r "$SCRIPT_DIR/docker" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Création du fichier .env
cat > "$APP_DIR/backend/.env" <<EOF
NODE_ENV=production
PORT=${API_PORT}
HOST=0.0.0.0
LOG_LEVEL=info

POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASS}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASS}@127.0.0.1:5432/${POSTGRES_DB}
DB_POOL_MIN=2
DB_POOL_MAX=20

REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://:${REDIS_PASS}@127.0.0.1:6379/0
TILE_CACHE_TTL=86400
GEOCODE_CACHE_TTL=604800

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
ADMIN_INITIAL_PASSWORD=${ADMIN_PASS}

ESRI_ENABLED=true
OSM_ENABLED=true
OSM_USER_AGENT=CartoPlatformEnterprise/1.0
NOMINATIM_URL=https://nominatim.openstreetmap.org
EOF
chmod 600 "$APP_DIR/backend/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
success "Fichier .env de l'API créé."

# Installation des dépendances Node.js
cd "$APP_DIR/backend"
sudo -u "$APP_USER" npm install --omit=dev --silent
success "Dépendances Node.js installées."

# Migration BDD + seed admin
sudo -u "$APP_USER" bash -c "cd $APP_DIR/backend && node src/database/migrate.js"
success "Migrations BDD et compte admin initialisés."

# ── Étape 8 : Configuration Nginx ──
step "Étape 8/10 : Configuration Nginx (reverse proxy + frontend)..."

cat > /etc/nginx/sites-available/carto_platform <<NGINXEOF
server {
    listen ${FRONTEND_PORT};
    server_name localhost;

    root ${APP_DIR}/frontend/public;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    client_max_body_size 50M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location ~* \.(css|js)$ {
        expires -1;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location ~* \.(jpg|jpeg|png|gif|ico|woff2|svg)$ {
        expires 30d;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/carto_platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
success "Nginx configuré et rechargé."

# ── Étape 9 : Service systemd pour l'API ──
step "Étape 9/10 : Création du service systemd pour l'API..."

cat > /etc/systemd/system/carto-api.service <<EOF
[Unit]
Description=INS SIG Platform — API Gateway (Node.js)
Documentation=http://localhost:${FRONTEND_PORT}/api/docs
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=carto-api
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable carto-api --now
success "Service carto-api démarré et activé au démarrage."

# ── Étape 10 : Vérification finale ──
step "Étape 10/10 : Vérification de santé des services..."
sleep 4

SERVICES=("postgresql" "redis-server" "nginx" "carto-api")
for svc in "${SERVICES[@]}"; do
  if systemctl is-active --quiet "$svc"; then
    success "$svc : ACTIF"
  else
    warn "$svc : INACTIF — vérifiez avec : journalctl -u $svc -n 50"
  fi
done

# Test HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${API_PORT}/api/health 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  success "API répond correctement (HTTP 200)."
else
  warn "L'API n'est pas encore prête (HTTP: $HTTP_CODE). Attendez quelques secondes."
fi

# ── Résumé ──
echo ""
echo -e "${GREEN}===============================================================================${NC}"
echo -e "${GREEN}         INS SIG PLATFORM v1.0 — INSTALLATION NATIVE RÉUSSIE !${NC}"
echo -e "${GREEN}===============================================================================${NC}"
echo -e "  Accès aux interfaces :"
echo -e "    • Studio SIG Web     : ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "    • API REST / Swagger : ${CYAN}http://localhost:${API_PORT}/api/docs${NC}"
echo -e "    • Healthcheck        : ${CYAN}http://localhost:${API_PORT}/api/health${NC}"
echo ""
echo -e "  ${YELLOW}Identifiants par défaut :${NC}"
echo -e "    • Plateforme SIG     : Login=${GREEN}adminCarto${NC}  MDP=${GREEN}${ADMIN_PASS}${NC}"
echo ""
echo -e "  Commandes d'administration :"
echo -e "    systemctl status carto-api         # état API"
echo -e "    journalctl -u carto-api -f         # logs API"
echo -e "    systemctl restart carto-api        # redémarrer API"
echo -e "    systemctl restart nginx            # redémarrer Nginx"
echo ""
echo -e "  Fichiers importants :"
echo -e "    Config API : ${CYAN}${APP_DIR}/backend/.env${NC}"
echo -e "    Config Nginx : ${CYAN}/etc/nginx/sites-available/carto_platform${NC}"
echo -e "${GREEN}===============================================================================${NC}"
