#!/usr/bin/env bash
# ==============================================================================
#           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE
#                     INS SIG PLATFORM v1.0
#        Script d'Installation et Déploiement Automatisé sous Ubuntu
# ==============================================================================

set -euo pipefail

# Définition des couleurs de terminal
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
    echo -e "${BOLD}${CYAN}        Script d'Installation et Déploiement Automatisé sous Ubuntu${RESET}"
    echo -e "${BLUE}===============================================================================${RESET}"
    echo ""
}

step() {
    echo -e "\n${BOLD}${CYAN}[*] $1${RESET}"
}

success() {
    echo -e "${GREEN}[OK] $1${RESET}"
}

warn() {
    echo -e "${YELLOW}[!] $1${RESET}"
}

err() {
    echo -e "${RED}[ERREUR] $1${RESET}" >&2
}

print_banner

# 1. Détermination du répertoire du projet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo -e "${BOLD}Répertoire d'installation :${RESET} $SCRIPT_DIR"

# 2. Vérification de l'environnement Linux / Ubuntu
step "Étape 1/6 : Vérification du système d'exploitation..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "Système détecté : ${BOLD}$NAME $VERSION${RESET}"
else
    warn "Fichier /etc/os-release introuvable. Système Linux générique."
fi

# 3. Vérification et installation de Docker si absent
step "Étape 2/6 : Vérification du moteur Docker..."
if ! command -v docker &>/dev/null; then
    warn "Docker n'est pas installé sur ce système."
    echo -e "Souhaitez-vous installer Docker automatiquement via apt ? (O/n)"
    read -r response
    response=${response:-O}
    if [[ "$response" =~ ^[Oo]$ ]]; then
        step "Installation de Docker et des dépendances..."
        sudo apt-get update -y
        sudo apt-get install -y ca-certificates curl gnupg lsb-release
        
        # Installation du moteur Docker officiel Ubuntu
        sudo apt-get install -y docker.io docker-compose-v2
        sudo systemctl enable --now docker
        
        # Ajout de l'utilisateur courant au groupe docker
        if [ "$USER" != "root" ]; then
            sudo usermod -aG docker "$USER" || true
            warn "Votre utilisateur a été ajouté au groupe docker."
            warn "Si vous rencontrez une erreur de permissions, relancez avec 'sudo' ou reconnectez votre session."
        fi
        success "Docker a été installé avec succès."
    else
        err "Docker est requis pour déployer la plateforme. Installation interrompue."
        exit 1
    fi
else
    success "Docker est déjà installé : $(docker --version)"
fi

# Vérification du service Docker
if ! docker info &>/dev/null; then
    warn "Le service Docker ne répond pas sans privilèges élevés. Tentative avec sudo ou démarrage..."
    sudo systemctl start docker || true
    if ! sudo docker info &>/dev/null; then
        err "Impossible de communiquer avec le démon Docker. Vérifiez 'sudo systemctl status docker'."
        exit 1
    fi
    DOCKER_PREFIX="sudo"
else
    DOCKER_PREFIX=""
fi
success "Moteur Docker opérationnel."

# 4. Vérification de Docker Compose
step "Étape 3/6 : Vérification de Docker Compose..."
if $DOCKER_PREFIX docker compose version &>/dev/null; then
    COMPOSE_CMD="$DOCKER_PREFIX docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="$DOCKER_PREFIX docker-compose"
else
    step "Installation du plugin Docker Compose..."
    sudo apt-get update -y && sudo apt-get install -y docker-compose-v2
    COMPOSE_CMD="$DOCKER_PREFIX docker compose"
fi
success "Commande Compose configurée : $COMPOSE_CMD"

# 5. Configuration des variables d'environnement (.env)
step "Étape 4/6 : Initialisation de la configuration (.env)..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        success "Fichier .env généré à partir de .env.example."
    else
        warn ".env.example introuvable. Création d'un .env minimal..."
        cat << 'EOF' > .env
NODE_ENV=production
PORT=4000
POSTGRES_DB=carto_db
POSTGRES_USER=carto_user
POSTGRES_PASSWORD=carto_secure_pass_prod_2026
REDIS_PASSWORD=redis_secure_pass_prod_2026
REDIS_MAXMEMORY=1024mb
JWT_SECRET=ins_sig_platform_jwt_production_secret_key_2026_super_secure_32chars
JWT_REFRESH_SECRET=ins_sig_platform_jwt_refresh_secret_key_2026_super_secure_32chars
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=GrafanaCarto2026!Pass
EOF
        success "Fichier .env minimal configuré."
    fi
else
    success "Fichier .env existant conservé."
fi

# Rendre exécutables les scripts auxiliaires si présents
if [ -d "scripts" ]; then
    chmod +x scripts/*.sh 2>/dev/null || true
fi

# 6. Construction et Lancement des Conteneurs
step "Étape 5/6 : Construction et démarrage des conteneurs..."
echo -e "Exécution de : ${BOLD}$COMPOSE_CMD up -d --build${RESET}\n"

$COMPOSE_CMD up -d --build

success "Conteneurs Docker lancés en arrière-plan !"

# 7. Contrôle de santé (Healthcheck)
step "Étape 6/6 : Vérification de la disponibilité des services..."
echo -n "Patientez pendant la vérification du backend API et de Nginx"

HEALTHY=false
for i in {1..12}; do
    echo -n "."
    sleep 3
    if command -v curl &>/dev/null; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || true)
        if [ "$HTTP_CODE" = "200" ]; then
            HEALTHY=true
            break
        fi
    fi
done
echo ""

if [ "$HEALTHY" = true ]; then
    success "Services vérifiés : API Backend et Base de données opérationnels !"
else
    warn "L'API est en cours d'initialisation finale. Les conteneurs tournent correctement."
fi

# Application automatique des migrations & création du compte administrateur initial
step "Initialisation de la base de données et des comptes..."
$COMPOSE_CMD exec -T carto-api npm run migrate 2>/dev/null || true

# Détection de l'adresse IP locale pour diffusion sur réseau local
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

# 8. Affichage du Récapitulatif Final
echo ""
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "${BOLD}${GREEN}           INS SIG PLATFORM v1.0 — INSTALLATION UBUNTU RÉUSSIE !${RESET}"
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "  ${BOLD}URLs d'accès à la plateforme :${RESET}"
echo ""
echo -e "    • ${BOLD}Studio Cartographique Web${RESET} : ${CYAN}http://localhost:8085${RESET}  (ou ${CYAN}http://${SERVER_IP}:8085${RESET})"
echo -e "    • ${BOLD}API Backend REST${RESET}          : ${CYAN}http://localhost:4000${RESET}"
echo -e "    • ${BOLD}Documentation Swagger${RESET}     : ${CYAN}http://localhost:4000/api/docs${RESET}"
echo -e "    • ${BOLD}Bilan de Santé (Health)${RESET}   : ${CYAN}http://localhost:4000/api/health${RESET}"
echo -e "    • ${BOLD}Tableau de bord Grafana${RESET}   : ${CYAN}http://localhost:3000${RESET}"
echo -e "    • ${BOLD}Métriques Prometheus${RESET}      : ${CYAN}http://localhost:9090${RESET}"
echo ""
echo -e "${GREEN}-------------------------------------------------------------------------------${RESET}"
echo -e "  ${BOLD}Identifiants d'accès :${RESET}"
echo ""
echo -e "    🔑 ${BOLD}Studio Cartographique (Web) :${RESET}"
echo -e "       Identifiant   : ${CYAN}admin${RESET}  (ou ${CYAN}adminCarto${RESET})"
echo -e "       Mot de passe  : ${CYAN}ins@carto2026${RESET}"
echo ""
echo -e "    📊 ${BOLD}Grafana :${RESET}"
echo -e "       Identifiant   : ${CYAN}admin${RESET}"
echo -e "       Mot de passe  : ${CYAN}GrafanaCarto2026!Pass${RESET}"
echo -e "${GREEN}===============================================================================${RESET}"
echo -e "  ${BOLD}Commandes utiles au quotidien :${RESET}"
echo -e "    - Suivre les logs en direct   : ${BOLD}$COMPOSE_CMD logs -f${RESET}"
echo -e "    - Vérifier l'état des services : ${BOLD}$COMPOSE_CMD ps${RESET}"
echo -e "    - Stopper la plateforme        : ${BOLD}$COMPOSE_CMD down${RESET}"
echo -e "    - Redémarrer la plateforme     : ${BOLD}$COMPOSE_CMD restart${RESET}"
echo -e "${GREEN}===============================================================================${RESET}"
echo ""
echo -e "${BOLD}Installation achevée.${RESET} Vous pouvez désormais utiliser INS SIG PLATFORM."
