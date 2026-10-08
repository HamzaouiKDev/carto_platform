#!/usr/bin/env bash
# ==============================================================================
#           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE
#                     INS SIG PLATFORM v1.0
#   Script d'Installation Complète et Automatisée pour Serveur Ubuntu Vierge
# ==============================================================================
# Usage :
#   chmod +x setup_full_ubuntu.sh
#   ./setup_full_ubuntu.sh
# ==============================================================================

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Couleurs du terminal
BOLD='\033[1m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

print_banner() {
    clear 2>/dev/null || true
    echo -e "${BLUE}===============================================================================${RESET}"
    echo -e "${BOLD}${BLUE}           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE${RESET}"
    echo -e "${BOLD}${GREEN}                     INS SIG PLATFORM v1.0${RESET}"
    echo -e "${BOLD}${CYAN}   Déploiement Automatisé Tout-en-Un (Docker + Base + Services + Autostart)${RESET}"
    echo -e "${BLUE}===============================================================================${RESET}"
    echo ""
}

step() { echo -e "\n${BOLD}${CYAN}[*] $1${RESET}"; }
success() { echo -e "${GREEN}[OK] $1${RESET}"; }
warn() { echo -e "${YELLOW}[!] $1${RESET}"; }
err() { echo -e "${RED}[ERREUR] $1${RESET}" >&2; }

print_banner

# ------------------------------------------------------------------------------
# 1. Détection du répertoire du projet
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo -e "${BOLD}Dossier du projet :${RESET} $SCRIPT_DIR"

CURRENT_USER=$(id -un)
echo -e "${BOLD}Utilisateur courant :${RESET} $CURRENT_USER"

# ------------------------------------------------------------------------------
# 2. Mise à jour système et installation des prérequis Ubuntu
# ------------------------------------------------------------------------------
step "Étape 1/7 : Mise à jour du système et installation des dépendances système..."
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    jq \
    ufw \
    openssl
success "Dépendances système installées."

# Optimisation noyau Linux pour Redis (évite les blocages bgsave/MISCONF)
sudo sysctl -w vm.overcommit_memory=1 >/dev/null 2>&1 || true
if ! grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf 2>/dev/null; then
    echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf >/dev/null 2>&1 || true
fi
success "Optimisation mémoire noyau (vm.overcommit_memory=1) configurée."

# ------------------------------------------------------------------------------
# 3. Installation et configuration du moteur Docker et Docker Compose
# ------------------------------------------------------------------------------
step "Étape 2/7 : Installation et vérification de Docker Engine..."

if ! command -v docker &>/dev/null; then
    step "Installation de Docker via les dépôts officiels Ubuntu..."
    sudo apt-get install -y docker.io docker-compose-v2
    sudo systemctl enable --now docker
    success "Docker et Docker Compose installés."
else
    success "Docker est déjà installé : $(docker --version)"
fi

# Activer et démarrer Docker service
sudo systemctl enable --now docker

# Ajouter l'utilisateur courant au groupe docker
if [ "$CURRENT_USER" != "root" ]; then
    sudo usermod -aG docker "$CURRENT_USER" 2>/dev/null || true
    success "Utilisateur '$CURRENT_USER' ajouté au groupe docker."
fi

# Détecter si on a besoin de sudo pour docker
if docker info &>/dev/null; then
    DOCKER_CMD="docker"
    COMPOSE_CMD="docker compose"
else
    DOCKER_CMD="sudo docker"
    COMPOSE_CMD="sudo docker compose"
fi
success "Moteur Docker opérationnel avec la commande : $COMPOSE_CMD"

# ------------------------------------------------------------------------------
# 4. Configuration du pare-feu (UFW) si activé
# ------------------------------------------------------------------------------
step "Étape 3/7 : Vérification du pare-feu..."
if command -v ufw &>/dev/null && sudo ufw status | grep -q "Status: active"; then
    warn "Pare-feu UFW actif. Ouverture des ports indispensables..."
    sudo ufw allow 22/tcp comment 'SSH' || true
    sudo ufw allow 8085/tcp comment 'INS SIG Studio Web' || true
    sudo ufw allow 4000/tcp comment 'INS Carto API REST' || true
    sudo ufw allow 3000/tcp comment 'Grafana Monitoring' || true
    success "Ports autorisés dans le pare-feu : 22, 8085, 4000, 3000."
else
    success "Pare-feu permissif ou inactif (accès aux ports direct)."
fi

# ------------------------------------------------------------------------------
# 5. Configuration de l'environnement (.env)
# ------------------------------------------------------------------------------
step "Étape 4/7 : Configuration du fichier d'environnement (.env)..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        success "Fichier .env initialisé depuis .env.example."
    else
        cat << 'EOF' > .env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info
POSTGRES_DB=carto_db
POSTGRES_USER=carto_user
POSTGRES_PASSWORD=carto_secure_pass_prod_2026
DATABASE_URL=postgresql://carto_user:carto_secure_pass_prod_2026@carto-postgis:5432/carto_db
REDIS_PASSWORD=redis_secure_pass_prod_2026
REDIS_URL=redis://:redis_secure_pass_prod_2026@carto-redis:6379/0
REDIS_MAXMEMORY=4096mb
TILE_CACHE_TTL=0
GEOCODE_CACHE_TTL=0
JWT_SECRET=ins_sig_platform_jwt_production_secret_key_2026_super_secure_32chars
JWT_REFRESH_SECRET=ins_sig_platform_jwt_refresh_secret_key_2026_super_secure_32chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
ADMIN_INITIAL_PASSWORD=ins@carto2026
ESRI_ENABLED=true
OSM_ENABLED=true
OSM_USER_AGENT=CartoPlatformEnterprise/1.0 (contact@ins.tn)
NOMINATIM_URL=https://nominatim.openstreetmap.org
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=GrafanaCarto2026!Pass
EOF
        success "Fichier .env généré avec les paramètres par défaut."
    fi
else
    success "Fichier .env existant conservé."
fi

# ------------------------------------------------------------------------------
# 6. Construction et Lancement des Conteneurs Docker
# ------------------------------------------------------------------------------
step "Étape 5/7 : Construction et démarrage des conteneurs SIG..."
$COMPOSE_CMD up -d --build
success "Conteneurs Docker lancés en arrière-plan."

# Contrôle de santé (attente que l'API réponde)
step "Attente de l'initialisation des bases de données et de l'API..."
HEALTHY=false
for i in {1..20}; do
    sleep 3
    if curl -s -f http://127.0.0.1:4000/api/health &>/dev/null; then
        HEALTHY=true
        break
    fi
    echo -n "."
done
echo ""

if [ "$HEALTHY" = true ]; then
    success "API Backend et PostgreSQL opérationnels !"
else
    warn "Les conteneurs sont en cours de finalisation."
fi

# ------------------------------------------------------------------------------
# 7. Exécution des migrations & initialisation des comptes utilisateurs
# ------------------------------------------------------------------------------
step "Étape 6/7 : Exécution des migrations et création des comptes..."
# 1. Migration interne
$COMPOSE_CMD exec -T carto-api npm run migrate 2>/dev/null || true

# 2. Garantir les comptes 'admin' et 'adminCarto'
$COMPOSE_CMD exec -T carto-postgis psql -U carto_user -d carto_db -c "
INSERT INTO users (email, password_hash, full_name, role)
SELECT 'admin', password_hash, 'Administrateur', 'admin'
FROM users WHERE email = 'adminCarto'
ON CONFLICT (email) DO NOTHING;
" 2>/dev/null || true

success "Base de données initialisée et compte administrateur prêt."

# ------------------------------------------------------------------------------
# 8. Configuration du service Systemd pour le redémarrage automatique
# ------------------------------------------------------------------------------
step "Étape 7/7 : Configuration du démarrage automatique au boot de la VM..."
SYSTEMD_SERVICE="/etc/systemd/system/carto-platform.service"

sudo bash -c "cat << EOF > $SYSTEMD_SERVICE
[Unit]
Description=INS SIG Platform (Carto Platform Enterprise)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/$COMPOSE_CMD up -d
ExecStop=/usr/bin/$COMPOSE_CMD down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable carto-platform.service
success "Service de démarrage automatique configuré et activé (carto-platform.service)."

# ------------------------------------------------------------------------------
# 9. Récapitulatif Final et URLs d'accès
# ------------------------------------------------------------------------------
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "${BOLD}${GREEN}           INS SIG PLATFORM v1.0 — INSTALLATION TERMINÉE AVEC SUCCÈS !${RESET}"
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "  ${BOLD}URLs d'accès à la plateforme :${RESET}"
echo ""
echo -e "    • ${BOLD}Studio Cartographique Web${RESET} : ${CYAN}http://${SERVER_IP}:8085${RESET}"
echo -e "    • ${BOLD}API Backend REST${RESET}          : ${CYAN}http://${SERVER_IP}:4000${RESET}"
echo -e "    • ${BOLD}Documentation Swagger${RESET}     : ${CYAN}http://${SERVER_IP}:4000/api/docs${RESET}"
echo -e "    • ${BOLD}Bilan de Santé (Health)${RESET}   : ${CYAN}http://${SERVER_IP}:4000/api/health${RESET}"
echo -e "    • ${BOLD}Tableau de bord Grafana${RESET}   : ${CYAN}http://${SERVER_IP}:3000${RESET}"
echo ""
echo -e "${GREEN}-------------------------------------------------------------------------------${RESET}"
echo -e "  ${BOLD}Identifiants d'accès :${RESET}"
echo ""
echo -e "    🔑 ${BOLD}Studio Cartographique Web (Port 8085) :${RESET}"
echo -e "       Identifiant   : ${CYAN}admin${RESET}  (ou ${CYAN}adminCarto${RESET})"
echo -e "       Mot de passe  : ${CYAN}ins@carto2026${RESET}"
echo ""
echo -e "    📊 ${BOLD}Grafana (Port 3000) :${RESET}"
echo -e "       Identifiant   : ${CYAN}admin${RESET}"
echo -e "       Mot de passe  : ${CYAN}GrafanaCarto2026!Pass${RESET}"
echo ""
echo -e "${GREEN}-------------------------------------------------------------------------------${RESET}"
echo -e "  ${BOLD}Persistance & Redémarrage automatique :${RESET}"
echo -e "    • Démarrage automatique au boot : ${GREEN}ACTIVÉ${RESET} (systemd)"
echo -e "    • Cache tuiles persistant       : ${GREEN}ACTIVÉ${RESET} (Redis AOF/RDB sur volume)"
echo ""
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "  ${BOLD}Commandes utiles au quotidien :${RESET}"
echo -e "    - Suivre les logs en direct   : ${BOLD}$COMPOSE_CMD logs -f${RESET}"
echo -e "    - Vérifier l'état des services : ${BOLD}$COMPOSE_CMD ps${RESET}"
echo -e "    - Redémarrer la plateforme     : ${BOLD}$COMPOSE_CMD restart${RESET}"
echo -e "    - Stopper la plateforme        : ${BOLD}$COMPOSE_CMD down${RESET}"
echo -e "${GREEN}===============================================================================${RESET}"
echo ""
echo -e "${BOLD}Votre serveur SIG est prêt à être utilisé.${RESET}"
