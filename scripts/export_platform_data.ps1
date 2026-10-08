<#
.SYNOPSIS
  Sauvegarde complète de la plateforme INS SIG (Base PostGIS + 231 000 Tuiles Redis).
.DESCRIPTION
  Exporte en une seule archive portable toutes les données pour cloner la plateforme sur un autre PC.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $BaseDir "backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$PgDumpFile = Join-Path $BackupDir "carto_postgis_${Timestamp}.sql"
$RedisArchive = Join-Path $BackupDir "carto_redis_tiles_${Timestamp}.tar.gz"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [INS SIG] Exportation Complète pour Déploiement Portable" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Sauvegarde PostGIS
Write-Host "`n1/2. Exportation de la base PostgreSQL PostGIS..." -ForegroundColor Yellow
docker exec -e PGPASSWORD=change_this_postgres_password_in_production_99182 carto-postgis pg_dump -U carto_user -d carto_db -F p > $PgDumpFile

if (Test-Path $PgDumpFile) {
    $pgSize = [math]::Round((Get-Item $PgDumpFile).Length / 1MB, 2)
    Write-Host "  ✅ Base PostGIS exportée : $pgSize Mo" -ForegroundColor Green
} else {
    Write-Host "  ❌ Échec export PostgreSQL" -ForegroundColor Red
}

# 2. Sauvegarde Redis (Tuiles physiques)
Write-Host "`n2/2. Exportation des tuiles cartographiques Redis..." -ForegroundColor Yellow
docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 bgsave
Start-Sleep -Seconds 3

docker run --rm --volumes-from carto-redis -v "${BackupDir}:/backup" alpine tar czf "/backup/carto_redis_tiles_${Timestamp}.tar.gz" -C /data .

if (Test-Path $RedisArchive) {
    $redisSize = [math]::Round((Get-Item $RedisArchive).Length / 1MB, 2)
    Write-Host "  ✅ Tuiles Redis exportées : $redisSize Mo" -ForegroundColor Green
} else {
    Write-Host "  ❌ Échec export Redis" -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Exportation terminée avec succès dans : $BackupDir" -ForegroundColor Green
Write-Host " Pour cloner sur un autre PC :" -ForegroundColor White
Write-Host " 1. Copiez le dossier complet 'carto_platform' avec le dossier 'backups/'" -ForegroundColor White
Write-Host " 2. Lancez 'docker compose up -d' sur le nouveau PC" -ForegroundColor White
Write-Host " 3. Exécutez 'powershell ./scripts/import_platform_data.ps1'" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
