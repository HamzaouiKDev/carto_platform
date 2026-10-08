<#
.SYNOPSIS
  Téléchargement et pré-remplissage du cache cartographique (CartoPlatform).
.DESCRIPTION
  Lance le seeder Node.js pour télécharger les tuiles de la Tunisie (ou région personnalisée).
#>

param(
    [string]$Provider = "esri-imagery", # esri-imagery (satellite), esri-streets (plan), osm-standard
    [int]$MinZoom = 6,
    [int]$MaxZoom = 11,
    [int]$Concurrency = 8
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [CARTO] Lancement du téléchargement des cartes" -ForegroundColor Cyan
Write-Host " Fournisseur : $Provider" -ForegroundColor Yellow
Write-Host " Zoom        : $MinZoom à $MaxZoom" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Exécution directe via node
node "d:\app_emploi\carto_platform\scripts\seed_tiles.js" --provider=$Provider --minZoom=$MinZoom --maxZoom=$MaxZoom --concurrency=$Concurrency
