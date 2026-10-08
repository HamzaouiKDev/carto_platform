@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title Installation & Démarrage — INS SIG PLATFORM (Windows)

echo ===============================================================================
echo                INSTITUT NATIONAL DE LA STATISTIQUE — TUNISIE
echo                          INS SIG PLATFORM v1.0
echo            Installation et Démarrage Automatisé sous Windows
echo ===============================================================================
echo.

:: 1. Vérification du répertoire d'exécution
cd /d "%~dp0"
echo [*] Répertoire du projet : %cd%
echo.

:: 2. Vérification de Docker
echo [*] Étape 1/5 : Vérification de Docker...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Docker n'est pas installé ou n'est pas accessible dans le PATH.
    echo Veuillez installer Docker Desktop pour Windows :
    echo https://docs.docker.com/desktop/install/windows-install/
    echo.
    pause
    exit /b 1
)

:: Vérification si le démon Docker est actif
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [AVERTISSEMENT] Le moteur Docker n'est pas démarré.
    echo Tentative d'attente de Docker Desktop...
    echo Veuillez vérifier que l'icône Docker Desktop est verte dans votre barre des tâches.
    echo.
    set /p RETRY="Appuyez sur [Entrée] une fois Docker Desktop démarré (ou 'Q' pour quitter) : "
    if /i "!RETRY!"=="Q" exit /b 1
    docker info >nul 2>nul
    if !errorlevel! neq 0 (
        echo [ERREUR] Le moteur Docker n'est toujours pas actif. Abandon.
        pause
        exit /b 1
    )
)
echo [OK] Docker est opérationnel.
echo.

:: 3. Détection de Docker Compose (v2 ou v1)
echo [*] Étape 2/5 : Vérification de Docker Compose...
set DOCKER_COMPOSE_CMD=docker compose
docker compose version >nul 2>nul
if %errorlevel% neq 0 (
    where docker-compose >nul 2>nul
    if %errorlevel% equ 0 (
        set DOCKER_COMPOSE_CMD=docker-compose
    ) else (
        echo [ERREUR] Ni 'docker compose' ni 'docker-compose' n'ont été trouvés.
        pause
        exit /b 1
    )
)
echo [OK] Commande Compose détectée : %DOCKER_COMPOSE_CMD%
echo.

:: 4. Vérification et création du fichier de configuration .env
echo [*] Étape 3/5 : Configuration des variables d'environnement...
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Création du fichier .env à partir de .env.example...
        copy ".env.example" ".env" >nul
        echo [OK] Fichier .env initialisé.
    ) else (
        echo [AVERTISSEMENT] Fichier .env.example introuvable. Utilisation des valeurs par défaut.
    )
) else (
    echo [OK] Fichier .env déjà présent.
)
echo.

:: 5. Construction et Démarrage des Conteneurs
echo [*] Étape 4/5 : Téléchargement des images et démarrage des conteneurs...
echo [INFO] Exécution de : %DOCKER_COMPOSE_CMD% up -d --build
echo.
%DOCKER_COMPOSE_CMD% up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Échec du démarrage des conteneurs Docker.
    echo Consultez les messages ci-dessus ou tapez : %DOCKER_COMPOSE_CMD% logs
    pause
    exit /b 1
)
echo.
echo [OK] Conteneurs démarrés avec succès !
echo.

:: 6. Attente et Vérification de Santé (Healthcheck)
echo [*] Étape 5/5 : Vérification de l'état de la plateforme...
echo [INFO] Patientez pendant la vérification des services (max 30 secondes)...

set ATTEMPTS=0
:WAIT_LOOP
set /a ATTEMPTS+=1
timeout /t 3 /nobreak >nul

where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl -s -f http://localhost:4000/api/health >nul 2>nul
    if !errorlevel! equ 0 (
        goto HEALTH_SUCCESS
    )
)

if %ATTEMPTS% lss 10 (
    echo   - Vérification en cours... (!ATTEMPTS!/10)
    goto WAIT_LOOP
)

echo.
echo [INFO] Les conteneurs tournent. L'API termine son initialisation.
goto SHOW_SUMMARY

:HEALTH_SUCCESS
echo [OK] Backend API et Base de données opérationnels !

:SHOW_SUMMARY
echo.
echo ===============================================================================
echo                 INS SIG PLATFORM v1.0 — INSTALLATION TERMINÉE !
echo ===============================================================================
echo.
echo   La plateforme cartographique est prête et accessible :
echo.
echo   - Application SIG Web        : http://localhost:8085
echo   - Backend API REST           : http://localhost:4000
echo   - Documentation Swagger      : http://localhost:4000/api/docs
echo   - Bilan de Santé (Health)    : http://localhost:4000/api/health
echo   - Tableaux Grafana           : http://localhost:3000 (admin / admin)
echo   - Métriques Prometheus       : http://localhost:9090
echo.
echo ===============================================================================
echo   Commandes utiles :
echo     - Voir les logs en direct   : %DOCKER_COMPOSE_CMD% logs -f
echo     - État des conteneurs       : %DOCKER_COMPOSE_CMD% ps
echo     - Arrêter la plateforme     : %DOCKER_COMPOSE_CMD% down
echo     - Redémarrer la plateforme  : %DOCKER_COMPOSE_CMD% restart
echo ===============================================================================
echo.

set /p OPEN_BROWSER="Souhaitez-vous ouvrir la plateforme dans votre navigateur ? (O/N) [O] : "
if /i "!OPEN_BROWSER!"=="" set OPEN_BROWSER=O
if /i "!OPEN_BROWSER!"=="O" (
    start http://localhost:8085
)

echo.
echo Installation terminée. Vous pouvez fermer cette fenêtre.
pause
