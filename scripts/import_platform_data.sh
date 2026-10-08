#!/usr/bin/env bash
# ==============================================================================
# INS SIG PLATFORM — Restauration Complète des Données (Linux/macOS)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BASE_DIR}/backups"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Dossier backups introuvable ($BACKUP_DIR)"
  exit 1
fi

LATEST_PG=$(ls -t "${BACKUP_DIR}"/carto_postgis_*.sql 2>/dev/null | head -n 1)
LATEST_REDIS=$(ls -t "${BACKUP_DIR}"/carto_redis_tiles_*.tar.gz 2>/dev/null | head -n 1)

if [ -z "$LATEST_PG" ] || [ -z "$LATEST_REDIS" ]; then
  echo "❌ Fichiers de sauvegarde introuvables dans $BACKUP_DIR"
  exit 1
fi

echo "=========================================================="
echo " [INS SIG] Restauration Complète sur Nouveau PC / Serveur"
echo "=========================================================="

echo "1/2. Restauration des tuiles cartographiques dans Redis..."
docker run --rm --volumes-from carto-redis -v "${BACKUP_DIR}:/backup" alpine sh -c "cd /data && tar xzf /backup/$(basename "$LATEST_REDIS")"
docker restart carto-redis
echo "  ✅ Tuiles restaurées et conteneur carto-redis redémarré."

echo "2/2. Restauration de la base PostGIS..."
docker exec -i -e PGPASSWORD=change_this_postgres_password_in_production_99182 carto-postgis psql -U carto_user -d carto_db < "$LATEST_PG"
docker restart carto-api
echo "  ✅ Base PostGIS restaurée et API redémarrée."

echo "=========================================================="
echo " Clônage terminé ! La plateforme est 100% opérationnelle."
echo " Ouvrez : http://localhost:8085"
echo "=========================================================="
