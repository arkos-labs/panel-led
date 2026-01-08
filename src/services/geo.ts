/**
 * Service pour la géolocalisation et le calcul d'itinéraires
 * Utilise l'API BAN (France) pour le géocodage car c'est gratuit et ultra-fluide pour les adresses françaises.
 */

export const GeoService = {
    /**
     * RECHERCHE D'ADRESSE (Géocodage)
     * @param query L'adresse tapée par l'utilisateur
     * @returns Liste d'adresses trouvées avec leurs coordonnées
     */
    async searchAddress(query: string) {
        if (!query || query.length < 3) return [];

        try {
            const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();

            return data.features.map((f: any) => ({
                label: f.properties.label,
                city: f.properties.city,
                postcode: f.properties.postcode,
                coordinates: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number], // Leaflet attend [Lat, Lon]
            }));
        } catch (e) {
            console.error("Erreur Geocoding:", e);
            return [];
        }
    },

    /**
     * GÉOCODAGE INVERSE (Position -> Adresse)
     */
    async reverseGeocode(lat: number, lon: number) {
        try {
            const response = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`);
            const data = await response.json();
            return data.features[0]?.properties?.label || "Adresse inconnue";
        } catch (e) {
            return "Adresse inconnue";
        }
    }
};
