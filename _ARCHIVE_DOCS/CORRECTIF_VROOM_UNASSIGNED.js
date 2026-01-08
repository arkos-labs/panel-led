// CORRECTIF TEMPORAIRE - À appliquer dans PlanningModal.tsx ligne 559

// ANCIEN CODE (ligne 559):
const unassignedDetails = result.unassigned.map((unassignedId: number) => {
    const clientId = result.idMap[unassignedId];
    // ...
});

// NOUVEAU CODE (remplacer par):
const unassignedDetails = result.unassigned.map((unassignedItem: any) => {
    // VROOM peut retourner soit un nombre, soit un objet {id: number}
    const vroomId = typeof unassignedItem === 'object' ? unassignedItem.id : unassignedItem;

    console.log(`🔍 Traitement unassigned:`, unassignedItem);
    console.log(`   → VROOM ID: ${vroomId}`);
    console.log(`   → idMap:`, result.idMap);

    const clientId = result.idMap[vroomId];
    console.log(`   → Client ID: ${clientId}`);

    if (!clientId) {
        return `VROOM ID ${vroomId} - Mapping introuvable`;
    }

    const client = allTripClients.find(c => String(c.id) === String(clientId));

    if (!client) {
        return `Client ID ${clientId} - Données introuvables`;
    }

    // Vérifier les coordonnées GPS
    let gpsStatus = "✅ GPS OK";
    let gpsDetails = "";
    const gps = client.gps;

    if (!gps) {
        gpsStatus = "❌ GPS MANQUANT";
        gpsDetails = " (aucune coordonnée)";
    } else if (typeof gps === 'object' && (!gps.lat || !gps.lon)) {
        gpsStatus = "❌ GPS INCOMPLET";
        gpsDetails = ` (lat: ${gps.lat}, lon: ${gps.lon})`;
    } else if (typeof gps === 'object' && (gps.lat === 0 && gps.lon === 0)) {
        gpsStatus = "❌ GPS INVALIDE";
        gpsDetails = " (0,0)";
    } else if (typeof gps === 'object') {
        gpsDetails = ` (${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})`;
    }

    return `${client.prenom} ${client.nom} - ${gpsStatus}${gpsDetails} - ${client.ville || client.adresse || 'Adresse inconnue'}`;
});
