<#
.SYNOPSIS
  Sauvegarde automatisée de la base spatiale PostGIS (CartoPlatform).
.DESCRIPTION
  Exécute pg_dump à l'intérieur du conteneur carto-postgis avec compression,
  vérifie l'intégrité de l'archive et applique une politique de rétention (7 jours).
#>

param(
    [string]$ContainerName = "carto-postgis",
    [string]$DbUser = "carto_user",
    [string]$DbName = "carto_db",
    [string]$BackupDir = "D:\app_emploi\carto_platform\backups",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFileName = "backup_carto_postgis_${Timestamp}.dump"
$BackupFilePath = Join-Path -Path $BackupDir -ChildPath $BackupFileName

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [SIG BACKUP] Début de sauvegarde PostGIS : $DbName" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

try {
    # Exécution pg_dump binaire compressé avec géométries et métadonnées PostGIS
    $cmd = "docker exec -e PGPASSWORD=carto_secure_pass $ContainerName pg_dump -U $DbUser -d $DbName -Fc -b -v"
    Invoke-Expression "$cmd > `"$BackupFilePath`""

    $fileInfo = Get-Item $BackupFilePath
    $sizeMb = [math]::Round($fileInfo.Length / 1MB, 2)

    if ($fileInfo.Length -lt 1024) {
        throw "L'archive générée est anormalement petite ($($fileInfo.Length) octets). Échec probable."
    }

    Write-Host "✅ Sauvegarde réussie : $BackupFileName ($sizeMb Mo)" -ForegroundColor Green

    # Nettoyage des anciennes sauvegardes au-delà de RetentionDays
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "backup_carto_postgis_*.dump" | Where-Object { $_.LastWriteTime -lt $CutoffDate } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "🧹 Rétention appliquée : Suppression ancienne sauvegarde $($_.Name)" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ ERREUR lors de la sauvegarde : $_" -ForegroundColor Red
    exit 1
}
