#!/usr/bin/env bash
# ==============================================================================
#  INS SIG PLATFORM v1.0 — Installation automatisée sous Ubuntu avec Docker
#  Usage : chmod +x install_docker_ubuntu.sh && sudo ./install_docker_ubuntu.sh
# ==============================================================================
set -euo pipefail

# ── Couleurs ──
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step()    { echo -e "\n${CYAN}[*] $1${NC}"; }
success() { echo -e "${GREEN}[OK] $1${NC}"; }
warn()    { echo -e "${YELLOW}[!]  $1${NC}"; }
error()   { echo -e "${RED}[ERREUR] $1${NC}"; exit 1; }

# ── Bannière ──
clear
echo -e "${BLUE}===============================================================================${NC}"
echo -e "${BLUE}           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE${NC}"
echo -e "${GREEN}                     INS SIG PLATFORM v1.0${NC}"
echo -e "${NC}          Installation Docker automatisée sous Ubuntu/Debian${NC}"
echo -e "${BLUE}===============================================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo -e "\nRépertoire cible : ${CYAN}$SCRIPT_DIR${NC}"

# ── Étape 1 : Vérification droits root ──
step "Étape 1/6 : Vérification des droits administrateur..."
if [[ $EUID -ne 0 ]]; then
  warn "Ce script doit être exécuté en tant que root."
  error "Relancez avec : sudo $0"
fi
success "Droits root confirmés."

# ── Étape 2 : Installation de Docker Engine ──
step "Étape 2/6 : Vérification / Installation de Docker Engine..."
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version)
  success "Docker déjà installé : $DOCKER_VER"
else
  warn "Docker non détecté. Installation en cours..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable docker --now
  success "Docker Engine installé et démarré."
fi

# ── Étape 3 : Vérification Docker Compose ──
step "Étape 3/6 : Vérification de Docker Compose..."
if docker compose version &>/dev/null; then
  success "Docker Compose plugin disponible : $(docker compose version --short)"
elif command -v docker-compose &>/dev/null; then
  success "docker-compose standalone disponible."
else
  apt-get install -y -qq docker-compose-plugin
  success "Docker Compose plugin installé."
fi

# ── Étape 4 : Configuration .env ──
step "Étape 4/6 : Configuration des variables d'environnement..."
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    success "Fichier .env créé depuis .env.example."
  else
    warn "Pas de .env.example trouvé — le .env existant sera utilisé."
  fi
else
  success "Fichier .env existant détecté."
fi

# Vérification que le JWT_SECRET est sécurisé
if grep -q "generate_a_very_long_secure" .env 2>/dev/null; then
  warn "JWT_SECRET par défaut détecté — génération d'un secret sécurisé..."
  NEW_JWT=$(openssl rand -hex 48)
  NEW_REF=$(openssl rand -hex 48)
  sed -i "s|generate_a_very_long_secure_jwt_secret_key_minimum_32_chars_prod|${NEW_JWT}|g" .env
  sed -i "s|generate_a_very_long_secure_refresh_secret_key_minimum_32_chars_prod|${NEW_REF}|g" .env
  success "Secrets JWT régénérés de manière sécurisée."
fi

# ── Étape 5 : Construction et démarrage des conteneurs ──
step "Étape 5/6 : Construction et lancement des conteneurs Docker..."
echo -e "${YELLOW}Cela peut prendre 3 à 10 minutes selon votre connexion...${NC}\n"
docker compose up -d --build
success "Conteneurs construits et démarrés."

# ── Étape 6 : Healthcheck + Migration ──
step "Étape 6/6 : Vérification de santé et migration de la base de données..."
echo "Attente du démarrage des services..."
sleep 5

# Attendre que l'API soit prête (max 60s)
MAX_WAIT=60
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    success "API opérationnelle (HTTP 200)."
    break
  fi
  echo -e "  ... attente API ($ELAPSED/${MAX_WAIT}s) [HTTP: $HTTP_CODE]"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [[ "$HTTP_CODE" != "200" ]]; then
  warn "L'API initialise encore. Tentative de migration manuelle..."
fi

# Exécution de la migration et seed admin
echo -e "\nApplication des migrations de base de données..."
docker exec carto-api node src/database/migrate.js
success "Migrations appliquées et compte administrateur initialisé."

# ── Résumé final ──
echo ""
echo -e "${GREEN}===============================================================================${NC}"
echo -e "${GREEN}            INS SIG PLATFORM v1.0 — INSTALLATION RÉUSSIE !${NC}"
echo -e "${GREEN}===============================================================================${NC}"
echo -e "  ${NC}Accès aux interfaces :${NC}"
echo -e "    • Studio SIG Web        : ${CYAN}http://localhost:8085${NC}"
echo -e "    • API REST / Swagger    : ${CYAN}http://localhost:4000/api/docs${NC}"
echo -e "    • Healthcheck           : ${CYAN}http://localhost:4000/api/health${NC}"
echo -e "    • Grafana               : ${CYAN}http://localhost:3000${NC}"
echo -e "    • Prometheus            : ${CYAN}http://localhost:9090${NC}"
echo ""
echo -e "  ${YELLOW}Identifiants par défaut :${NC}"
echo -e "    • Plateforme SIG        : Login=${GREEN}adminCarto${NC}  MDP=${GREEN}AdminCarto2026!Secure${NC}"
echo -e "    • Grafana               : Login=${GREEN}admin${NC}        MDP=${GREEN}GrafanaCarto2026!Pass${NC}"
echo ""
echo -e "  ${NC}Commandes d'administration :${NC}"
echo -e "    docker compose ps            # état des services"
echo -e "    docker compose logs -f       # logs en direct"
echo -e "    docker compose down          # arrêter la plateforme"
echo -e "${GREEN}===============================================================================${NC}"
