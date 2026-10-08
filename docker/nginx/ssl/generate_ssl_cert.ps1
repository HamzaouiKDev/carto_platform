# ==============================================================================
#  INS SIG PLATFORM -- Generation certificat SSL auto-signe (Windows / PowerShell)
#  Usage : .\docker\nginx\ssl\generate_ssl_cert.ps1 [-Domain "localhost"]
# ==============================================================================
param (
    [string]$Domain = "localhost"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  INS SIG PLATFORM -- Generateur Certificat SSL Intranet" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[*] Domaine cible : $Domain" -ForegroundColor Yellow
Write-Host "[*] Repertoire    : $ScriptDir" -ForegroundColor Yellow

$keyFile = Join-Path $ScriptDir "carto-selfsigned.key"
$crtFile = Join-Path $ScriptDir "carto-selfsigned.crt"
$dhFile  = Join-Path $ScriptDir "dhparam.pem"

Write-Host "[*] Generation du certificat via Docker (alpine/openssl)..." -ForegroundColor Cyan

docker run --rm -v "${ScriptDir}:/certs" alpine/openssl req -x509 -nodes -newkey rsa:4096 -keyout "/certs/carto-selfsigned.key" -out "/certs/carto-selfsigned.crt" -days 3650 -subj "/C=TN/ST=Tunis/L=Tunis/O=Institut National de la Statistique/OU=DSI/CN=$Domain" -addext "subjectAltName=DNS:$Domain,DNS:localhost,IP:127.0.0.1"

if (-not (Test-Path $dhFile)) {
    Write-Host "[*] Generation dhparam.pem 2048 bits (patientez quelques secondes)..." -ForegroundColor Cyan
    docker run --rm -v "${ScriptDir}:/certs" alpine/openssl dhparam -out "/certs/dhparam.pem" 2048
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [OK] Certificats SSL generes avec succes !" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  - Cle privee   : $keyFile"
Write-Host "  - Certificat   : $crtFile"
Write-Host "  - DH Param     : $dhFile"
Write-Host "  - Validite     : 10 ans (3650 jours)"
Write-Host ""
Write-Host "Pour lancer la plateforme en HTTPS Intranet :" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.https-intranet.yml up -d --build" -ForegroundColor Cyan
