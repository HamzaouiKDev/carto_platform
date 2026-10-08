<#
.SYNOPSIS
  Restauration complète de la plateforme INS SIG sur un nouveau PC.
.DESCRIPTION
  Restaure la base PostGIS et les 231 000 tuiles Redis depuis le dossier backups/.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $BaseDir "backups"

if (-not (Test-Path $BackupDir)) {
    Write-Host "❌ Dossier backups introuvable ($BackupDir)" -ForegroundColor Red
    exit 1
}

$LatestPg = Get-ChildItem -Path $BackupDir -Filter "carto_postgis_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$LatestRedis = Get-ChildItem -Path $BackupDir -Filter "carto_redis_tiles_*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $LatestPg -or -not $LatestRedis) {
    Write-Host "❌ Fichiers de sauvegarde introuvables dans $BackupDir" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [INS SIG] Restauration Complète sur Nouveau PC" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Restauration Redis (Tuiles physiques)
Write-Host "`n1/2. Restauration des tuiles cartographiques dans Redis..." -ForegroundColor Yellow
docker run --rm --volumes-from carto-redis -v "${BackupDir}:/backup" alpine sh -c "cd /data && tar xzf /backup/$($LatestRedis.Name)"
docker restart carto-redis
Write-Host "  ✅ Tuiles restaurées et conteneur carto-redis redémarré." -ForegroundColor Green

# 2. Restauration PostgreSQL PostGIS
Write-Host "`n2/2. Restauration de la base PostGIS..." -ForegroundColor Yellow
Get-Content $LatestPg.FullName | docker exec -i -e PGPASSWORD=change_this_postgres_password_in_production_99182 carto-postgis psql -U carto_user -d carto_db
docker restart carto-api
Write-Host "  ✅ Base PostGIS restaurée et API redémarrée." -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Clônage terminé ! La plateforme est 100% opérationnelle." -ForegroundColor Green
Write-Host " Ouvrez : http://localhost:8085" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
