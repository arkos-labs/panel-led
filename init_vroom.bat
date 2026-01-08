@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo   INSTALLATION MULTI-ZONE VROOM / OSRM LOCAL
echo   (Version Debug avec Pause)
echo ===================================================
echo.
echo 1. France Metropolitaine (Tres long, 4GB RAM requis)
echo 2. Guadeloupe (Rapide)
echo 3. Martinique (Rapide)
echo 4. Corse (Rapide)
echo 5. TOUT INSTALLER
echo.
set /p zone="Choisissez une zone a initialiser (1-5) : "

if "%zone%"=="1" set regions=france
if "%zone%"=="2" set regions=guadeloupe
if "%zone%"=="3" set regions=martinique
if "%zone%"=="4" set regions=corse
if "%zone%"=="5" set regions=france guadeloupe martinique corse

cd /d "%~dp0"
if not exist "osrm-data" mkdir "osrm-data"

for %%r in (%regions%) do (
    echo.
    echo ---------------------------------------------------
    echo Traitement de la zone : %%r
    echo ---------------------------------------------------
    
    set pbf=%%r-latest.osm.pbf
    set osrm=%%r-latest.osrm
    
    if not exist "osrm-data\!pbf!" (
        if "%%r"=="france" set url=https://download.geofabrik.de/europe/france-latest.osm.pbf
        if "%%r"=="guadeloupe" set url=https://download.geofabrik.de/europe/france/guadeloupe-latest.osm.pbf
        if "%%r"=="martinique" set url=https://download.geofabrik.de/europe/france/martinique-latest.osm.pbf
        if "%%r"=="corse" set url=https://download.geofabrik.de/europe/france/corse-latest.osm.pbf
        
        echo [📥] Telechargement de %%r (via curl)...
        curl -L !url! -o "osrm-data\!pbf!"
        if !errorlevel! neq 0 (
            echo [!] Erreur de telechargement pour %%r.
            pause
            exit /b 1
        )
    )

    echo [1/3] Extraction...
    docker run -t -v "%cd%\osrm-data:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/!pbf!
    if !errorlevel! neq 0 (
        echo [!] L'extraction de %%r a echoue.
        pause
    ) else (
        echo [2/3] Partitionnement...
        docker run -t -v "%cd%\osrm-data:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-partition /data/!osrm!
        
        echo [3/3] Customisation...
        docker run -t -v "%cd%\osrm-data:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-customize /data/!osrm!
    )
)

echo.
echo [FINAL] Lancement des conteneurs...
docker-compose down
docker-compose up -d

echo ===================================================
echo   SUCCES ! Les services sont actifs en local.
echo ===================================================
pause
