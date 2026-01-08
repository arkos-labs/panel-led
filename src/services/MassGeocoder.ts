import { toast } from 'sonner';

export const MassGeocoder = {
    /**
     * Demande au serveur de scanner et corriger les GPS
     */
    async scanAndFixMissingGPS() {
        try {
            toast.info("🛠️ Lancement du réparateur GPS serveur...");

            const API_BASE = `http://${window.location.hostname}:3001`;

            const response = await fetch(`${API_BASE}/api/clients/scan-gps`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Erreur serveur");

            if (result.fixed > 0) {
                toast.success(`✨ Succès ! ${result.fixed} clients ont été localisés et sauvegardés.`);
            } else if (result.total === 0) {
                toast.info("👍 Aucun client sans GPS trouvé. Tout est propre !");
            } else {
                toast.warning(`Scan terminé. ${result.failed} adresses n'ont pas pu être trouvées malgré l'effort.`);
            }

        } catch (e: any) {
            console.error(e);
            toast.error("Erreur lors de la demande de scan: " + e.message);
        }
    }
};
