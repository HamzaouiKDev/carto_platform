#!/usr/bin/env bash
# ==============================================================================
# INS SIG PLATFORM — Exportation Complète des Données (Linux/macOS)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BASE_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "=========================================================="
echo " [INS SIG] Exportation Complète pour Déploiement Portable"
echo "=========================================================="

echo "1/2. Exportation de la base PostgreSQL PostGIS..."
docker exec -e PGPASSWORD=change_this_postgres_password_in_production_99182 carto-postgis pg_dump -U carto_user -d carto_db -F p > "${BACKUP_DIR}/carto_postgis_${TIMESTAMP}.sql"
echo "  ✅ Base PostGIS exportée."

echo "2/2. Exportation des tuiles cartographiques Redis..."
docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 bgsave || true
sleep 3
docker run --rm --volumes-from carto-redis -v "${BACKUP_DIR}:/backup" alpine tar czf "/backup/carto_redis_tiles_${TIMESTAMP}.tar.gz" -C /data .
echo "  ✅ Tuiles Redis exportées."

echo "=========================================================="
echo " Archive prête dans : $BACKUP_DIR"
echo "=========================================================="
