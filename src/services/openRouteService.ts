
export interface RouteResult {
    distance: number; // meters
    duration: number; // seconds
}

export const OpenRouteService = {
    apiKey: import.meta.env.VITE_ORS_API_KEY || '',

    /**
     * Get route between two coordinates (lon, lat)
     * @param start [lon, lat]
     * @param end [lon, lat]
     */
    async getRoute(start: [number, number], end: [number, number]): Promise<RouteResult | null> {
        if (!this.apiKey) {
            console.warn("OpenRouteService: No API Key provided.");
            return null;
        }

        try {
            const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${this.apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error("ORS API Error:", response.statusText);
                return null;
            }

            const data = await response.json();
            const summary = data.features[0]?.properties?.summary;

            if (summary) {
                return {
                    distance: summary.distance,
                    duration: summary.duration
                };
            }
        } catch (error) {
            console.error("OpenRouteService execution error:", error);
        }
        return null;
    }
};
