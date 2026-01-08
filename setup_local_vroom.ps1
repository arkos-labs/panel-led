
Write-Host "🚀 Préparation de l'environnement VROOM Local pour la France..." -ForegroundColor Cyan

# 1. Création du dossier de données
$dataDir = "osrm-data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    Write-Host "✅ Dossier '$dataDir' créé." -ForegroundColor Green
}

# 2. Téléchargement de la carte (France)
$url = "https://download.geofabrik.de/europe/france-latest.osm.pbf"
$outputFile = "$dataDir\france-latest.osm.pbf"

if (-not (Test-Path $outputFile)) {
    Write-Host "📥 Téléchargement de la carte de France (~4 Go). Cela peut prendre du temps..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $url -OutFile $outputFile
    Write-Host "✅ Téléchargement terminé." -ForegroundColor Green
}
else {
    Write-Host "✅ Carte déjà présente." -ForegroundColor Green
}

Write-Host "ATTENTION : L'étape suivante (Pré-traitement) va consommer beaucoup de RAM et de CPU pendant environ 10-20 minutes." -ForegroundColor Yellow
Write-Host "Assurez-vous d'avoir Docker Desktop lancé."
Write-Host "Pour lancer le traitement, exécutez :"
Write-Host "docker run -t -v ${PWD}/osrm-data:/data ghcr.io/project-osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/france-latest.osm.pbf" -ForegroundColor Cyan
Write-Host "docker run -t -v ${PWD}/osrm-data:/data ghcr.io/project-osrm/osrm-backend:latest osrm-partition /data/france-latest.osrm" -ForegroundColor Cyan
Write-Host "docker run -t -v ${PWD}/osrm-data:/data ghcr.io/project-osrm/osrm-backend:latest osrm-customize /data/france-latest.osrm" -ForegroundColor Cyan
Write-Host "Une fois terminé, lancez tout avec : docker-compose up -d" -ForegroundColor Green
