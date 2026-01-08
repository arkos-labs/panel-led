import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, MapPin, Truck } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { cn, parseSafeDate } from '@/lib/utils';
import { isSouthOfSleepLine } from '@/lib/business-logic';

interface Suggestion {
    date: string;
    distance: number;
    status: 'GREEN' | 'ORANGE' | 'RED';
    existingClient: string;
    type: 'LIVRAISON' | 'INSTALLATION';
    duration?: number;
    isReal?: boolean;
    sourceCoords?: { lat: number; lon: number };
    tour?: { lat: number; lon: number; client: string; type: string; time?: string }[];
    rank?: number;
    eta?: string;
    positionInTour?: number;
    totalClients?: number;
}

interface SmartSchedulerProps {
    defaultAddress?: string;
    clientId?: string;
    onDateSelect?: (date: string, eta?: string) => void;
    compact?: boolean;
    autoSearch?: boolean;
    nbLed?: number;
    type?: 'LIVRAISON' | 'INSTALLATION';
    hideInput?: boolean;
    deliveryDate?: string; // Date de livraison réelle pour calculer le délai
}

export function SmartScheduler({ defaultAddress = '', clientId, onDateSelect, compact = false, autoSearch = false, nbLed, type = 'LIVRAISON', hideInput = false, deliveryDate }: SmartSchedulerProps) {
    const [address, setAddress] = useState(defaultAddress);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [targetCoords, setTargetCoords] = useState<{ lat: number, lon: number } | null>(null);

    React.useEffect(() => {
        if (autoSearch && (address || clientId)) {
            handleSearch();
        }
    }, []); // Run once on mount if autoSearch is true

    const handleSearch = async () => {
        if (!clientId && !address) return;
        setLoading(true);
        setSuggestions([]);
        setTargetCoords(null);

        try {
            let lat, lon;

            // 1. Priorité: Données Supabase (Déjà géocodées par le robot)
            if (clientId) {
                const { data, error } = await supabase
                    .from('clients')
                    .select('gps, adresse_brute')
                    .eq('id', clientId)
                    .single();

                if (data?.gps && data.gps.lat) {
                    lat = data.gps.lat;
                    lon = data.gps.lon;
                    setTargetCoords({ lat, lon });
                }
            }

            if (!lat) {
                if (!lat) {
                    // Fallback: Use OpenStreetMap Nominatim (Public API) instead of local backend
                    // Warning: Rate limited. For production, consider a proper API key (Google/Mapbox).
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
                            headers: {
                                'User-Agent': 'LED-Route-Planner/1.0'
                            }
                        });

                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.length > 0) {
                                lat = parseFloat(data[0].lat);
                                lon = parseFloat(data[0].lon);
                                setTargetCoords({ lat, lon });
                            } else {
                                throw new Error("Addresse non trouvée");
                            }
                        } else {
                            throw new Error("Geocoding failed");
                        }
                    } catch (e) {
                        console.error("Geocoding Error", e);
                        toast.error("Impossible de localiser l'adresse (Service indisponible)");
                        setLoading(false);
                        return;
                    }
                }
            }

            // 2. Trouver des tournées compatibles via Supabase (ex: clients proches)
            // UPDATE: Support "Single Pass" logic with Paris Depot Return.
            // Constraint: Start 9h - End 20h max.

            const PARIS_DEPOT = { lat: 48.8698, lon: 2.3075 }; // Approx 5 rue des Champs-Elysées (User Req)
            const MAX_WORK_HOURS = 11; // 9h to 20h
            const SERVICE_TIME_PER_STOP = 0.75; // 45 mins per client (Requested update)
            const AVG_SPEED_KMH = 50; // Average speed mixed urban/highway

            const startRange = new Date();
            const endRange = new Date();
            endRange.setDate(endRange.getDate() + 14); // 2 semaines

            const { data: nearbyClients } = await supabase
                .from('clients')
                .select('*')
                .neq('id', clientId || '')
                .not('gps', 'is', null);

            const simulatedSuggestions: Suggestion[] = [];

            // Groupe par date
            const neighborMap = new Map<string, string>();

            if (nearbyClients) {
                // Grouper par date existante
                const toursByDate: Record<string, any[]> = {};

                nearbyClients.forEach(c => {
                    const parsed = parseSafeDate(c.date_livraison_prevue);
                    if (parsed) {
                        const dStr = parsed.toISOString().split('T')[0];
                        if (!toursByDate[dStr]) toursByDate[dStr] = [];
                        toursByDate[dStr].push(c);
                    }
                });

                // Evaluate each existing tour
                Object.keys(toursByDate).forEach(dateStr => {
                    const tourClients = toursByDate[dateStr];

                    // Populate Neighbor Map for Adjacent Days
                    const currentDate = new Date(dateStr);
                    const prevDate = addDays(currentDate, -1);
                    const nextDate = addDays(currentDate, 1);
                    const prevStr = prevDate.toISOString().split('T')[0];
                    const nextStr = nextDate.toISOString().split('T')[0];

                    const refClientName = tourClients[0]?.nom || 'Client';

                    if (!neighborMap.has(prevStr)) neighborMap.set(prevStr, `Veille de tour. (${refClientName})`);
                    if (!neighborMap.has(nextStr)) neighborMap.set(nextStr, `Lendemain tour. (${refClientName})`);

                    // TSP Heuristic: Nearest Neighbor
                    // Pool includes: Depot (Start), Existing Clients, Target Client
                    // We want path: Depot -> (Nearest) -> ... -> (Nearest) -> Depot

                    const pointsToVisit = [
                        ...tourClients.map(c => ({ lat: c.gps.lat, lon: c.gps.lon, id: c.id, name: c.nom })),
                        { lat: targetCoords?.lat || lat, lon: targetCoords?.lon || lon, id: 'TARGET', name: 'Nouveau Client' }
                    ];

                    let currentPos = PARIS_DEPOT;
                    let totalDistKm = 0;
                    const optimizedPath: typeof pointsToVisit = [];
                    const unvisited = [...pointsToVisit];

                    // Build Path
                    while (unvisited.length > 0) {
                        let nearestIdx = -1;
                        let minD = Infinity;

                        unvisited.forEach((pt, idx) => {
                            // Haversine dist
                            const R = 6371;
                            const dLat = (pt.lat - currentPos.lat) * Math.PI / 180;
                            const dLon = (pt.lon - currentPos.lon) * Math.PI / 180;
                            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(currentPos.lat * Math.PI / 180) * Math.cos(pt.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            const d = R * c;

                            if (d < minD) {
                                minD = d;
                                nearestIdx = idx;
                            }
                        });

                        if (nearestIdx !== -1) {
                            const nextPoint = unvisited[nearestIdx];
                            totalDistKm += minD;
                            currentPos = nextPoint;
                            optimizedPath.push(nextPoint);
                            unvisited.splice(nearestIdx, 1);
                        } else {
                            break;
                        }
                    }

                    // Return to Depot (ONLY ON FRIDAY)
                    // The driver leaves Monday 8h and returns Friday night.
                    if (currentDate.getDay() === 5) {
                        const R_EARTH = 6371;
                        const dLat = (PARIS_DEPOT.lat - currentPos.lat) * Math.PI / 180;
                        const dLon = (PARIS_DEPOT.lon - currentPos.lon) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(currentPos.lat * Math.PI / 180) * Math.cos(PARIS_DEPOT.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        totalDistKm += (R_EARTH * c);
                    }

                    const driveTimeHours = totalDistKm / AVG_SPEED_KMH;
                    const serviceTimeHours = pointsToVisit.length * SERVICE_TIME_PER_STOP;
                    const totalTime = driveTimeHours + serviceTimeHours;

                    if (totalTime <= MAX_WORK_HOURS) {
                        simulatedSuggestions.push({
                            date: new Date(dateStr).toISOString(),
                            distance: totalDistKm,
                            status: totalTime < (MAX_WORK_HOURS - 1) ? 'GREEN' : 'ORANGE',
                            existingClient: `Tournée ${tourClients.length} clients`,
                            type: type,
                            duration: Math.round(totalTime * 60),
                            isReal: true,
                            positionInTour: optimizedPath.findIndex(p => p.id === 'TARGET') + 1,
                            totalClients: pointsToVisit.length,
                            eta: `Fin: ${Math.floor(9 + totalTime)}h${Math.round((totalTime % 1) * 60)}`
                        });
                    }


                });
            }

            // Générer des suggestions pour TOUS les jours sur 4 mois (120 jours)
            const existingDates = new Set(simulatedSuggestions.map(s => s.date.split('T')[0]));
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 120 jours = environ 4 mois
            // On génère une suggestion pour CHAQUE jour
            for (let i = 1; i <= 120; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i); // Commence à demain (i=1)
                if (d.getDay() === 0 || d.getDay() === 6) continue; // Exclure Samedi/Dimanche
                const dStr = d.toISOString().split('T')[0];

                if (!existingDates.has(dStr)) {
                    // Calculate Solo Tour Cost
                    const targetLat = targetCoords?.lat || lat;
                    const targetLon = targetCoords?.lon || lon;

                    let soloDist = 0;
                    // Paris -> Client
                    const R_EARTH = 6371;
                    const dLat1 = (targetLat - PARIS_DEPOT.lat) * Math.PI / 180;
                    const dLon1 = (targetLon - PARIS_DEPOT.lon) * Math.PI / 180;
                    const a1 = Math.sin(dLat1 / 2) * Math.sin(dLat1 / 2) + Math.cos(PARIS_DEPOT.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) * Math.sin(dLon1 / 2) * Math.sin(dLon1 / 2);
                    const c1 = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
                    soloDist += (R_EARTH * c1);

                    // Client -> Paris (IF NOT SOUTH)
                    if (!isSouthOfSleepLine(targetLat)) {
                        soloDist += (R_EARTH * c1); // Return trip same distance
                    }

                    const contextLabel = neighborMap.get(dStr);

                    simulatedSuggestions.push({
                        date: d.toISOString(),
                        distance: soloDist,
                        status: 'GREEN',
                        existingClient: contextLabel || 'Nouveau Créneau',
                        type: type,
                        duration: Math.round((soloDist / AVG_SPEED_KMH + SERVICE_TIME_PER_STOP) * 60)
                    });
                    existingDates.add(dStr);
                }
            }

            // Sort by Date
            simulatedSuggestions.sort((a, b) => {
                const da = parseSafeDate(a.date)?.getTime() || 0;
                const db = parseSafeDate(b.date)?.getTime() || 0;
                return da - db;
            });

            setSuggestions(simulatedSuggestions);

        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'analyse");
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    if (compact) {
        return (
            <div className="space-y-4 h-full flex flex-col">
                {!hideInput && (
                    <div className="flex gap-2 shrink-0">
                        <Input
                            placeholder="Adresse pour optimisation"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="h-9 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={loading || !address}
                            size="sm"
                            className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Truck className="h-4 w-4" />}
                        </Button>
                    </div>
                )}

                {searched && suggestions.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground text-center italic py-2">Aucune date optimisée trouvée.</p>
                )}

                {suggestions.length > 0 && (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {suggestions.map((s, index) => (
                            <div
                                key={s.date}
                                className={`
                                     flex items-center justify-between p-3 rounded-lg border-l-[6px] cursor-pointer bg-white transition-all shadow-sm hover:shadow-md
                                     ${s.status === 'GREEN' ? 'border-l-emerald-500 hover:bg-emerald-50/50' : ''}
                                     ${s.status === 'ORANGE' ? 'border-l-amber-500 hover:bg-amber-50/50' : ''}
                                     ${s.status === 'RED' ? 'border-l-red-500 hover:bg-red-50/50' : ''}
                                 `}
                                onClick={() => onDateSelect && onDateSelect(s.date, s.eta)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`
                                         h-12 w-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs shadow-sm
                                         ${s.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800' : ''}
                                         ${s.status === 'ORANGE' ? 'bg-amber-100 text-amber-800' : ''}
                                         ${s.status === 'RED' ? 'bg-red-100 text-red-800' : ''}
                                     `}>
                                        <span className="text-lg leading-none">{format(new Date(s.date), 'dd')}</span>
                                        <span className="uppercase text-[10px]">{format(new Date(s.date), 'MMM', { locale: fr })}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-bold capitalize text-slate-800">
                                            {format(new Date(s.date), 'EEEE d MMMM', { locale: fr })}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                                {s.distance < 1 ? `${Math.round(s.distance * 1000)} m` : `${s.distance.toFixed(1)} km`}
                                            </span>
                                            <span>de {s.existingClient}</span>
                                            {s.duration !== undefined && s.duration > 0 && (
                                                <span className={`font-medium px-1.5 py-0.5 rounded ${s.isReal ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                                    {s.duration} min {s.isReal ? '🚗' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    {s.status === 'GREEN' && (
                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 shadow-sm">
                                            Optimisé
                                        </Badge>
                                    )}
                                    {/* Badge délai livraison → installation */}
                                    {type === 'INSTALLATION' && deliveryDate && (() => {
                                        const parsedDelivery = parseSafeDate(deliveryDate);
                                        const parsedSuggestion = parseSafeDate(s.date);
                                        if (!parsedDelivery || !parsedSuggestion) return null;

                                        const delivDate = new Date(parsedDelivery);
                                        delivDate.setHours(0, 0, 0, 0);
                                        const suggDate = new Date(parsedSuggestion);
                                        suggDate.setHours(0, 0, 0, 0);

                                        const diffDays = Math.ceil((suggDate.getTime() - delivDate.getTime()) / (1000 * 60 * 60 * 24));

                                        let badgeColor = "";
                                        let badgeText = "";

                                        if (diffDays === 0) {
                                            badgeColor = "bg-red-100 text-red-700 border-red-300";
                                            badgeText = `⚠️ Jour livraison`;
                                        } else if (diffDays < 0) {
                                            return null; // Ne pas afficher pour dates avant livraison
                                        } else if (diffDays === 1) {
                                            badgeColor = "bg-green-100 text-green-700 border-green-300";
                                            badgeText = `✓ J+1`;
                                        } else if (diffDays >= 2 && diffDays <= 3) {
                                            badgeColor = "bg-green-100 text-green-700 border-green-300";
                                            badgeText = `✓ J+${diffDays}`;
                                        } else if (diffDays >= 4 && diffDays <= 7) {
                                            badgeColor = "bg-orange-100 text-orange-700 border-orange-300";
                                            badgeText = `⚠ J+${diffDays}`;
                                        } else {
                                            badgeColor = "bg-red-100 text-red-700 border-red-300";
                                            badgeText = `❌ J+${diffDays}`;
                                        }

                                        return (
                                            <Badge className={`${badgeColor} border text-xs font-medium`}>
                                                {badgeText}
                                            </Badge>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <Card className="w-full max-w-3xl mx-auto shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <CardHeader className="bg-slate-900 text-white rounded-t-lg p-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                    <Truck className="h-6 w-6 text-emerald-400" />
                    <div>
                        Smart Scheduler
                        <span className="block text-sm font-normal text-slate-400 mt-1">Optimisation de tournées en temps réel</span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Entrez l'adresse du client (ex: 12 Rue de la Paix, Paris)"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="pl-9 h-11 text-lg"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading || !address}
                        className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-lg shadow-md transition-all active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Analyser'}
                    </Button>
                </div>

                {searched && suggestions.length === 0 && !loading && (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed text-muted-foreground animate-in fade-in zoom-in-95 duration-300">
                        <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">Aucun rendez-vous optimisé trouvé.</p>
                        <p className="text-sm mt-1">Aucun chauffeur n'est à proximité pour les dates futures à venir.</p>
                    </div>
                )}

                {suggestions.length > 0 && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                <Calendar className="h-5 w-5 text-blue-500" />
                                Dates Suggérées
                            </h3>
                            {targetCoords && <Badge variant="outline" className="text-xs font-mono">GPS: {targetCoords.lat.toFixed(4)}, {targetCoords.lon.toFixed(4)}</Badge>}
                        </div>

                        <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {suggestions.map((s, index) => (
                                <div
                                    key={s.date}
                                    className={`
                                        group flex items-center justify-between p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md hover:translate-x-1
                                        ${s.status === 'GREEN' ? 'border-l-emerald-500 bg-white hover:bg-emerald-50/30' : ''}
                                        ${s.status === 'ORANGE' ? 'border-l-amber-500 bg-white hover:bg-amber-50/30' : ''}
                                        ${s.status === 'RED' ? 'border-l-red-500 bg-white hover:bg-red-50/30' : ''}
                                    `}
                                    onClick={() => onDateSelect && onDateSelect(s.date, s.eta)}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`
                                            h-14 w-14 rounded-2xl flex flex-col items-center justify-center font-bold shadow-sm
                                            ${s.status === 'GREEN' ? 'bg-emerald-100 text-emerald-700' : ''}
                                            ${s.status === 'ORANGE' ? 'bg-amber-100 text-amber-700' : ''}
                                            ${s.status === 'RED' ? 'bg-red-100 text-red-700' : ''}
                                        `}>
                                            <span className="text-xl leading-none">{parseSafeDate(s.date) ? format(parseSafeDate(s.date)!, 'dd') : '--'}</span>
                                            <span className="text-[10px] uppercase tracking-wider">{parseSafeDate(s.date) ? format(parseSafeDate(s.date)!, 'MMM', { locale: fr }) : ''}</span>
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg text-slate-800 dark:text-slate-100 capitalize">
                                                {parseSafeDate(s.date) ? format(parseSafeDate(s.date)!, 'EEEE', { locale: fr }) : 'Date Invalide'}
                                            </div>
                                            <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-medium text-slate-700">
                                                    {s.distance < 1 ? `${Math.round(s.distance * 1000)} m` : `${s.distance.toFixed(1)} km`}
                                                </span>
                                                <span className="text-slate-400">de {s.existingClient}</span>
                                                {s.duration !== undefined && s.duration > 0 && (
                                                    <span className={`font-medium ml-1 ${s.isReal ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        ({s.duration} min)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <Badge className={`
                                            px-3 py-1 text-sm font-medium
                                            ${s.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}
                                            ${s.status === 'ORANGE' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : ''}
                                            ${s.status === 'RED' ? 'bg-red-100 text-red-800 hover:bg-red-200' : ''}
                                       `}>
                                            {s.status === 'GREEN' ? 'Optimisé' : s.status === 'ORANGE' ? 'Acceptable' : 'Coûteux'}
                                        </Badge>
                                        {s.positionInTour && (
                                            <Badge variant="outline" className="text-[10px] h-5 border-blue-200 bg-blue-50 text-blue-700">
                                                Position : {s.positionInTour} / {s.totalClients}
                                            </Badge>
                                        )}
                                    </div>
                                    {s.eta && (
                                        <div className="mt-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                                            🕓 Horaire estimé : {s.eta}
                                        </div>
                                    )}
                                    {targetCoords && s.sourceCoords && (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MapPin className="h-3 w-3 mr-1" />
                                                    Voir tournée
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                                                <DialogHeader className="p-4 bg-slate-50 border-b">
                                                    <DialogTitle className="flex items-center gap-2">
                                                        <Truck className="h-5 w-5 text-blue-600" />
                                                        Tournée du {format(new Date(s.date), 'EEEE d MMMM yyyy', { locale: fr })}
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="flex-1 relative bg-slate-100">
                                                    <MapContainer
                                                        center={[targetCoords.lat, targetCoords.lon]}
                                                        zoom={10}
                                                        style={{ height: '100%', width: '100%' }}
                                                    >
                                                        <TileLayer
                                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                        />

                                                        {/* Tour Markers (Green for New, Blue for Existing) */}
                                                        {s.tour?.map((pt, i) => (
                                                            <Marker
                                                                key={i}
                                                                position={[pt.lat, pt.lon]}
                                                                icon={new L.DivIcon({
                                                                    className: 'custom-div-icon',
                                                                    html: (pt as any).isNew
                                                                        ? `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`
                                                                        : `<div style="background-color: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
                                                                    iconSize: (pt as any).isNew ? [28, 28] : [24, 24],
                                                                    iconAnchor: (pt as any).isNew ? [14, 14] : [12, 12]
                                                                })}
                                                            >
                                                                <Popup>
                                                                    <div className="text-sm font-bold">{i + 1}. {pt.client}</div>
                                                                    {pt.time && <div className="text-xs font-semibold text-blue-600 mt-1">🕒 {pt.time}</div>}
                                                                    <div className="text-xs text-slate-500">{pt.type}</div>
                                                                </Popup>
                                                            </Marker>
                                                        ))}

                                                        {/* Route Line */}
                                                        <Polyline
                                                            positions={s.tour?.map(t => [t.lat, t.lon] as [number, number]) || []}
                                                            color="#3b82f6"
                                                            weight={4}
                                                            opacity={0.7}
                                                            dashArray="10, 10"
                                                        />
                                                    </MapContainer>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
