import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarCheck, MapPin } from 'lucide-react';
import { Client } from '@/types/logistics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Suggestion {
    date: string;
    distance: number;
    duration?: number;
    status: 'GREEN' | 'ORANGE' | 'RED';
    rank?: number;
    eta?: string;
    label?: string;
}

export function ClientSuggestionBadge({ client, onSelectDate }: { client: Client; onSelectDate?: (date: Date) => void }) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const localizeAndRetry = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoading(true);
        setError(null);
        try {
            // 1. Appel API Adresse Gouv
            const q = encodeURIComponent(client.adresse || "");
            const geoRes = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${q}&limit=1`);
            const geoJson = await geoRes.json();

            if (geoJson.features && geoJson.features.length > 0) {
                const coords = geoJson.features[0].geometry.coordinates; // [lon, lat]
                const newLon = coords[0];
                const newLat = coords[1];

                // 2. Sauvegarde
                const API_BASE = `http://${window.location.hostname}:3001`;
                await fetch(`${API_BASE}/api/clients/${client.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        latitude: newLat,
                        longitude: newLon,
                        gps: { lat: newLat, lon: newLon }
                    })
                });

                // 3. Update local client object (hacky but enables immediate retry effect)
                (client as any).latitude = newLat;
                (client as any).longitude = newLon;
                (client as any).gps = { lat: newLat, lon: newLon };

                // 4. Force Reload to re-trigger effect (simplest way to ensure consistent state)
                window.location.reload();
            } else {
                setError("Adresse introuvable");
            }
        } catch (err) {
            console.error(err);
            setError("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!client.adresse) return;

        const fetchBestSlots = async () => {
            setLoading(true);
            setError(null);

            try {
                let lat = 0, lon = 0;
                if (typeof client.gps === 'object' && client.gps) {
                    lat = (client.gps as any).lat || 0;
                    lon = (client.gps as any).lon || 0;
                } else if (typeof client.gps === 'string') {
                    const parts = (client.gps as string).split(',');
                    if (parts.length === 2) {
                        lat = parseFloat(parts[0]);
                        lon = parseFloat(parts[1]);
                    }
                } else {
                    lat = (client as any).latitude || 0;
                    lon = (client as any).longitude || 0;
                }

                if (lat === 0 && lon === 0) {
                    setError("Adresse non géolocalisée");
                    setSuggestions([]);
                    return;
                }

                const API_BASE = `http://${window.location.hostname}:3001`;
                const res = await fetch(`${API_BASE}/api/scheduler/suggestions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: client.adresse,
                        clientId: client.id,
                        nbLed: client.nombreLED,
                        type: 'LIVRAISON',
                        lat: lat, // Pass explicit coords
                        lon: lon
                    })
                });

                if (!res.ok) throw new Error("Erreur serveur");

                const data = await res.json();
                let items: Suggestion[] = [];
                if (data.suggestions && Array.isArray(data.suggestions)) items = data.suggestions;
                else if (Array.isArray(data)) items = data;

                if (items.length === 0) {
                    setSuggestions([]);
                    return;
                }

                const final = items.sort((a, b) => (b.rank || 0) - (a.rank || 0)).slice(0, 3);
                setSuggestions(final);
            } catch (e: any) {
                console.error("Suggestion error", e);
                setError(null);
            } finally {
                setLoading(false);
            }
        };

        fetchBestSlots();
    }, [client.adresse, client.id]);

    const safeDate = (d: string) => {
        try {
            if (!d) return "--";
            const date = new Date(d);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        } catch (e) { return "?"; }
    };

    if (loading) return <div className="mt-2 text-[10px] text-blue-600 flex items-center gap-1 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> IA calcule le dispatch...</div>;

    // Gestion Erreur : Adresse non géolocalisée -> Bouton Localiser
    if (error === "Adresse non géolocalisée") return (
        <div className="mt-2 flex flex-col items-start gap-1 p-2 bg-orange-50/50 rounded border border-orange-100">
            <div className="text-[10px] text-orange-600 flex items-center gap-1 font-medium">
                ⚠️ Adresse non localisée
            </div>
            <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] bg-white hover:bg-orange-50 border-orange-200 text-orange-700 w-full justify-start"
                onClick={localizeAndRetry}
            >
                <MapPin className="h-3 w-3 mr-1" /> Localiser maintenant
            </Button>
        </div>
    );

    if (error) return (
        <div className="mt-2 p-1 bg-red-50 border border-red-100 rounded">
            <div className="text-[10px] text-red-500 leading-tight font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={error}>
                ⚠️ {error}
            </div>
        </div>
    );

    if (suggestions.length === 0) return (
        <div className="mt-2 text-[10px] text-slate-400 italic flex items-center gap-1">
            Pas de suggestion automatique
        </div>
    );

    return (
        <div className="flex flex-col items-start gap-2 mt-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100 w-full transition-colors">
            <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] uppercase text-blue-600 font-bold tracking-wider flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" /> DISPATCH CONSEILLÉ
                </span>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
                {suggestions.map((s, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSelectDate?.(new Date(s.date))}
                        className={cn(
                            "flex items-center justify-between text-xs w-full text-left p-2 rounded border shadow-sm transition-all group relative overflow-hidden",
                            s.status === 'GREEN' ? "bg-white border-green-200 hover:border-green-400 hover:bg-green-50" :
                                s.status === 'ORANGE' ? "bg-white border-orange-200 hover:border-orange-400 hover:bg-orange-50" :
                                    "bg-white border-red-100 opacity-70"
                        )}
                    >
                        <div className="flex items-center gap-2 relative z-10">
                            <div className={cn("w-2 h-2 rounded-full",
                                s.status === 'GREEN' ? "bg-green-500" : s.status === 'ORANGE' ? "bg-orange-500" : "bg-red-400"
                            )} />
                            <span className="font-bold text-slate-800 capitalize">
                                {safeDate(s.date)}
                            </span>
                        </div>

                        <div className="flex flex-col items-end leading-none">
                            {s.label ? (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-green-50 text-green-700 border-green-200">
                                    {s.label}
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px] font-bold border",
                                    s.status === 'GREEN' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                        "bg-slate-100 text-slate-600 border-slate-200")}>
                                    {s.distance < 10 ? "⭐ Idéal (Sur route)" : s.distance < 30 ? "✅ Bon chemin" : "⚠️ Détour"}
                                </Badge>
                            )}
                            <span className="text-[9px] text-slate-400 mt-0.5">
                                {s.distance === 0 ? 'Départ tournée' : `+${s.distance} km`}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div >
    );
}
