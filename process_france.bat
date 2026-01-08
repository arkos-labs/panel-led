@echo off
setlocal
set DATA_DIR=%cd%\osrm-data
echo [1/3] Extraction France...
docker run -t -v "%DATA_DIR%":/data ghcr.io/project-osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/france-latest.osm.pbf
if %errorlevel% neq 0 exit /b %errorlevel%

echo [2/3] Partitionnement France...
docker run -t -v "%DATA_DIR%":/data ghcr.io/project-osrm/osrm-backend:latest osrm-partition /data/france-latest.osrm
if %errorlevel% neq 0 exit /b %errorlevel%

echo [3/3] Customisation France...
docker run -t -v "%DATA_DIR%":/data ghcr.io/project-osrm/osrm-backend:latest osrm-customize /data/france-latest.osrm
if %errorlevel% neq 0 exit /b %errorlevel%

echo [FINAL] Redemarrage Service...
docker-compose restart osrm-fr
echo --- FRANCE OK ---
