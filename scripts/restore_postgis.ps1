<#
.SYNOPSIS
  Restauration sécurisée d'une sauvegarde PostGIS (CartoPlatform).
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "carto-postgis",
    [string]$DbUser = "carto_user",
    [string]$DbName = "carto_db"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $BackupFile)) {
    throw "Fichier de sauvegarde introuvable : $BackupFile"
}

Write-Host "⚠️ ATTENTION : La restauration va écraser les données existantes de '$DbName'." -ForegroundColor Yellow
$confirm = Read-Host "Confirmez-vous la restauration ? (oui/non)"
if ($confirm -ne "oui") {
    Write-Host "Restauration annulée."
    exit 0
}

Write-Host "📦 Début de la restauration depuis $BackupFile..." -ForegroundColor Cyan

# Copie temporaire dans le conteneur et restauration via pg_restore
docker cp "$BackupFile" "${ContainerName}:/tmp/restore.dump"
docker exec -e PGPASSWORD=carto_secure_pass $ContainerName pg_restore -U $DbUser -d $DbName -c -v /tmp/restore.dump
docker exec $ContainerName rm -f /tmp/restore.dump

Write-Host "✅ Base PostGIS '$DbName' restaurée avec succès." -ForegroundColor Green
