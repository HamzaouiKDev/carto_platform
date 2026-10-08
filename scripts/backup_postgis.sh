#!/usr/bin/env bash
# ==============================================================================
# CARTO PLATFORM ENTERPRISE — SCRIPT DE SAUVEGARDE POSTGIS AUTOMATISÉ
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="${1:-carto-postgis}"
DB_USER="${2:-carto_user}"
DB_NAME="${3:-carto_db}"
BACKUP_DIR="${4:-/var/backups/carto_platform}"
RETENTION_DAYS=7

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_carto_postgis_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Démarrage de la sauvegarde de ${DB_NAME} depuis ${CONTAINER_NAME}..."

docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc -b -v > "${BACKUP_FILE}"

FILE_SIZE=$(stat -c%s "${BACKUP_FILE}")

if [ "${FILE_SIZE}" -lt 1024 ]; then
  echo "[ERROR] Archive corrompue ou vide. Échec de la sauvegarde."
  rm -f "${BACKUP_FILE}"
  exit 1
fi

echo "[SUCCESS] Sauvegarde terminée avec succès : ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Rétention
find "${BACKUP_DIR}" -type f -name "backup_carto_postgis_*.dump" -mtime +${RETENTION_DAYS} -delete
echo "[INFO] Politique de rétention (${RETENTION_DAYS} jours) appliquée."
