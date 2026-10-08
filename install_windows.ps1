<#
.SYNOPSIS
    INS SIG PLATFORM v1.0 — Installation automatisée sous Windows avec Docker Desktop
.DESCRIPTION
    Vérifie Docker Desktop, configure .env, construit et démarre les conteneurs,
    exécute les migrations BDD, puis affiche les liens d'accès.
.NOTES
    Prérequis : Docker Desktop for Windows installé et démarré.
    Exécution  : Clic droit > "Exécuter avec PowerShell" (en tant qu'administrateur)
                 OU dans un terminal : .\install_windows.ps1
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# ── Fonctions d'affichage ──
function Write-Step    { param([string]$M) Write-Host "`n[*] $M" -ForegroundColor Cyan }
function Write-Success { param([string]$M) Write-Host "[OK] $M" -ForegroundColor Green }
function Write-Warn    { param([string]$M) Write-Host "[!]  $M" -ForegroundColor Yellow }
function Write-Err     { param([string]$M) Write-Host "[ERREUR] $M" -ForegroundColor Red; Exit 1 }

# ── Bannière ──
Clear-Host
Write-Host "===============================================================================" -ForegroundColor Blue
Write-Host "           INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE" -ForegroundColor Blue
Write-Host "                     INS SIG PLATFORM v1.0" -ForegroundColor Green
Write-Host "         Installation Docker automatisée sous Windows (PowerShell)" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Blue

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $ScriptDir
Write-Host "`nRépertoire cible : $ScriptDir" -ForegroundColor Gray

# ── Étape 1 : Vérification Docker Desktop ──
Write-Step "Étape 1/6 : Vérification de Docker Desktop..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Docker Desktop n'est pas détecté dans le PATH." -ForegroundColor Red
    Write-Host "  Téléchargez et installez Docker Desktop ici :" -ForegroundColor Yellow
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Cyan
    Write-Err "Docker Desktop requis. Installation annulée."
}

# Vérification que le démon Docker est actif
try {
    $null = docker info 2>&1
    Write-Success "Docker Desktop actif et opérationnel."
    Write-Host "  Version : $(docker version --format '{{.Server.Version}}' 2>$null)" -ForegroundColor Gray
} catch {
    Write-Warn "Le démon Docker ne répond pas."
    Write-Host "  Veuillez démarrer Docker Desktop, puis appuyez sur [Entrée]" -ForegroundColor Yellow
    Read-Host "  → Appuyez sur [Entrée] une fois Docker démarré (ou 'Q' pour quitter)"
    if ($LASTEXITCODE -eq 81) { Exit 1 }
    try {
        $null = docker info 2>&1
        Write-Success "Docker Desktop maintenant actif."
    } catch {
        Write-Err "Impossible de joindre le démon Docker. Vérifiez que Docker Desktop est démarré."
    }
}

# ── Étape 2 : Vérification Docker Compose ──
Write-Step "Étape 2/6 : Vérification de Docker Compose..."
$ComposeCmd = $null
$null = docker compose version 2>&1
if ($LASTEXITCODE -eq 0) {
    $ComposeCmd = "docker compose"
    Write-Success "Docker Compose plugin disponible : $(docker compose version --short 2>$null)"
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $ComposeCmd = "docker-compose"
    Write-Success "docker-compose standalone disponible."
} else {
    Write-Err "Aucune version de Docker Compose trouvée. Mettez à jour Docker Desktop."
}

# ── Étape 3 : Configuration .env ──
Write-Step "Étape 3/6 : Configuration des variables d'environnement..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Success "Fichier .env créé depuis .env.example."
    } else {
        Write-Warn "Pas de .env.example — les valeurs par défaut seront utilisées."
    }
} else {
    Write-Success "Fichier .env existant détecté."
}

# Sécurisation automatique des JWT secrets si encore en valeur par défaut
$EnvContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if ($EnvContent -match "generate_a_very_long_secure") {
    Write-Warn "JWT Secrets par défaut détectés — régénération sécurisée..."
    $NewJwt = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
    $NewRef = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
    $EnvContent = $EnvContent `
        -replace "generate_a_very_long_secure_jwt_secret_key_minimum_32_chars_prod", $NewJwt `
        -replace "generate_a_very_long_secure_refresh_secret_key_minimum_32_chars_prod", $NewRef
    Set-Content ".env" $EnvContent -Encoding UTF8
    Write-Success "JWT Secrets régénérés."
}

# ── Étape 4 : Construction et démarrage des conteneurs ──
Write-Step "Étape 4/6 : Construction et lancement des conteneurs Docker..."
Write-Host "  Cette opération peut prendre 5 à 15 minutes selon votre connexion..." -ForegroundColor Yellow
Write-Host ""

$proc = Start-Process -FilePath "docker" -ArgumentList "compose up -d --build" `
    -WorkingDirectory $ScriptDir -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) {
    Write-Host ""
    Write-Warn "Erreur lors du lancement des conteneurs. Consultez les logs :"
    Write-Host "  $ComposeCmd logs" -ForegroundColor Gray
    Write-Err "Échec du démarrage des conteneurs (code: $($proc.ExitCode))."
}
Write-Success "Tous les conteneurs construits et démarrés."

# ── Étape 5 : Migration BDD + seed admin ──
Write-Step "Étape 5/6 : Migration de la base de données et initialisation admin..."
Write-Host "  Attente du démarrage de l'API..." -ForegroundColor Gray
Start-Sleep -Seconds 6

# Attente que l'API soit prête (max 90s)
$MaxWait = 90; $Elapsed = 0; $ApiReady = $false
while ($Elapsed -lt $MaxWait) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        $ApiReady = $true
        break
    } catch {
        Write-Host "  ... attente API ($Elapsed/${MaxWait}s)" -ForegroundColor Gray
        Start-Sleep -Seconds 5
        $Elapsed += 5
    }
}

# Exécution de la migration (idempotente)
Write-Host "  Application des migrations..." -ForegroundColor Gray
$migProc = Start-Process -FilePath "docker" `
    -ArgumentList "exec carto-api node src/database/migrate.js" `
    -NoNewWindow -PassThru -Wait
if ($migProc.ExitCode -eq 0) {
    Write-Success "Migrations appliquées. Compte administrateur initialisé."
} else {
    Write-Warn "La migration a retourné une erreur (non bloquant). Vérifiez avec : docker logs carto-api"
}

# ── Étape 6 : Vérification santé des services ──
Write-Step "Étape 6/6 : Vérification de l'état des services..."
Start-Sleep -Seconds 3

$Services = @(
    @{ Name = "carto-postgis";  Label = "PostgreSQL + PostGIS" }
    @{ Name = "carto-redis";    Label = "Redis Cache" }
    @{ Name = "carto-api";      Label = "API Gateway (Node.js)" }
    @{ Name = "carto-frontend"; Label = "Studio SIG Web (Nginx)" }
    @{ Name = "carto-prometheus"; Label = "Prometheus" }
    @{ Name = "carto-grafana";  Label = "Grafana" }
)

foreach ($svc in $Services) {
    $status = docker inspect --format "{{.State.Status}}" $svc.Name 2>$null
    $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}" $svc.Name 2>$null
    if ($status -eq "running") {
        $healthStr = if ($health -ne "n/a") { " (health: $health)" } else { "" }
        Write-Success "$($svc.Label)$healthStr"
    } else {
        Write-Warn "$($svc.Label) — statut: $status"
    }
}

# ── Résumé final ──
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "         INS SIG PLATFORM v1.0 — INSTALLATION RÉUSSIE !" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Accès aux interfaces :" -ForegroundColor White
Write-Host "    • Studio SIG Web        : " -NoNewline; Write-Host "http://localhost:8085" -ForegroundColor Cyan
Write-Host "    • API REST / Swagger    : " -NoNewline; Write-Host "http://localhost:4000/api/docs" -ForegroundColor Cyan
Write-Host "    • Healthcheck API       : " -NoNewline; Write-Host "http://localhost:4000/api/health" -ForegroundColor Cyan
Write-Host "    • Grafana (supervision) : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "    • Prometheus (métriques): " -NoNewline; Write-Host "http://localhost:9090" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Identifiants par défaut :" -ForegroundColor Yellow
Write-Host "    • Plateforme SIG : Login = " -NoNewline; Write-Host "adminCarto" -ForegroundColor Green -NoNewline
Write-Host "   MDP = " -NoNewline; Write-Host "AdminCarto2026!Secure" -ForegroundColor Green
Write-Host "    • Grafana        : Login = " -NoNewline; Write-Host "admin" -ForegroundColor Green -NoNewline
Write-Host "        MDP = " -NoNewline; Write-Host "GrafanaCarto2026!Pass" -ForegroundColor Green
Write-Host ""
Write-Host "  Commandes d'administration :" -ForegroundColor White
Write-Host "    docker compose ps              # état des services" -ForegroundColor Gray
Write-Host "    docker compose logs -f         # logs en direct" -ForegroundColor Gray
Write-Host "    docker compose down            # arrêter la plateforme" -ForegroundColor Gray
Write-Host "    docker compose restart         # redémarrer" -ForegroundColor Gray
Write-Host ""
Write-Host "  Consultez CREDENTIALS.md pour la liste complète des identifiants." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""

$open = Read-Host "Ouvrir la plateforme dans le navigateur ? (O/N) [O]"
if ($open -eq "" -or $open -eq "O" -or $open -eq "o") {
    Start-Process "http://localhost:8085"
}
