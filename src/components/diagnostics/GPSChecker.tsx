import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { MapPin, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

interface Client {
    id: string;
    nom: string;
    prenom: string;
    adresse: string;
    gps: any;
    statut: string;
}

interface GPSCheckResult {
    total: number;
    withGPS: number;
    missingGPS: number;
    percentage: number;
    clientsWithoutGPS: Client[];
    clientsWithGPS: Client[];
}

export default function GPSChecker() {
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [data, setData] = useState<GPSCheckResult | null>(null);
    const [scanResult, setScanResult] = useState<any>(null);

    const checkGPS = async () => {
        setLoading(true);
        try {
            // Direct Supabase calculation
            const { data: clients, error } = await supabase.from('clients').select('*');
            if (error) throw error;

            const total = clients.length;
            const withGPS = clients.filter((c: any) => {
                // Check if GPS field exists and is valid
                if (!c.gps) return false;
                // If string "lat,lon"
                if (typeof c.gps === 'string' && c.gps.includes(',')) return true;
                // If object {lat, lon}
                if (typeof c.gps === 'object' && c.gps.lat && c.gps.lon) return true;
                return false;
            }).length;

            const missingGPS = total - withGPS;
            const percentage = total > 0 ? Math.round((withGPS / total) * 100) : 0;
            const clientsWithoutGPS = clients.filter((c: any) => {
                if (!c.gps) return true;
                if (typeof c.gps === 'string' && !c.gps.includes(',')) return true;
                if (typeof c.gps === 'object' && (!c.gps.lat || !c.gps.lon)) return true;
                return false;
            });
            // Just assume all others have GPS for the list
            const clientsWithGPS = clients.filter((c: any) => !clientsWithoutGPS.includes(c));

            setData({
                total,
                withGPS,
                missingGPS,
                percentage,
                clientsWithoutGPS,
                clientsWithGPS
            } as any);

        } catch (error) {
            console.error('Erreur lors de la vérification GPS:', error);
        } finally {
            setLoading(false);
        }
    };

    const scanGPS = async () => {
        // Prevent on Vercel/Production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            alert("⚠️ Cette fonctionnalité nécessite le serveur Node.js backend pour appeler les API de géocodage en masse.\n\nElle n'est pas disponible sur la version de démonstration Vercel.");
            return;
        }

        if (!confirm(`Voulez-vous lancer le géocodage automatique pour ${data?.missingGPS || 0} clients ?\n\nCela peut prendre quelques minutes.`)) {
            return;
        }

        setScanning(true);
        setScanResult(null);
        try {
            const response = await fetch('/api/clients/scan-gps', {
                method: 'POST'
            });
            const result = await response.json();
            setScanResult(result);
            console.log('✅ Scan terminé:', result);

            // Rafraîchir les données après le scan
            setTimeout(() => checkGPS(), 2000);
        } catch (error) {
            console.error('Erreur lors du scan GPS:', error);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        checkGPS();
    }, []);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">Chargement des données GPS...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
            {/* En-tête */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MapPin className="w-8 h-8 text-blue-600" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Diagnostic GPS</h2>
                        <p className="text-sm text-gray-500">Vérification des coordonnées géographiques</p>
                    </div>
                </div>
                <button
                    onClick={checkGPS}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            {/* Statistiques */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium">Total Clients</div>
                        <div className="text-3xl font-bold text-blue-900 mt-1">{data.total}</div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <div className="text-sm text-green-600 font-medium">Avec GPS</div>
                        </div>
                        <div className="text-3xl font-bold text-green-900 mt-1">{data.withGPS}</div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <div className="text-sm text-orange-600 font-medium">Sans GPS</div>
                        </div>
                        <div className="text-3xl font-bold text-orange-900 mt-1">{data.missingGPS}</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium">Couverture</div>
                        <div className="text-3xl font-bold text-purple-900 mt-1">{data.percentage}%</div>
                    </div>
                </div>
            )}

            {/* Barre de progression */}
            {data && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Progression du géocodage</span>
                        <span className="font-medium">{data.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 rounded-full"
                            style={{ width: `${data.percentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Bouton de scan */}
            {data && data.missingGPS > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-orange-900">
                                {data.missingGPS} client{data.missingGPS > 1 ? 's' : ''} sans coordonnées GPS
                            </h3>
                            <p className="text-sm text-orange-700 mt-1">
                                Le géocodage automatique va rechercher les coordonnées GPS pour ces clients via LocationIQ.
                            </p>
                        </div>
                        <button
                            onClick={scanGPS}
                            disabled={scanning}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            {scanning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Scan en cours...
                                </>
                            ) : (
                                <>
                                    <MapPin className="w-4 h-4" />
                                    Lancer le scan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Résultat du scan */}
            {scanResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-green-900">Scan terminé !</h3>
                            <div className="text-sm text-green-700 mt-1 space-y-1">
                                <p>✅ {scanResult.fixed} client{scanResult.fixed > 1 ? 's géocodés' : ' géocodé'}</p>
                                {scanResult.failed > 0 && (
                                    <p>❌ {scanResult.failed} échec{scanResult.failed > 1 ? 's' : ''}</p>
                                )}
                                <p>📊 Total traité : {scanResult.total}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Liste des clients sans GPS */}
            {data && data.clientsWithoutGPS.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Clients sans coordonnées GPS ({data.clientsWithoutGPS.length})
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {data.clientsWithoutGPS.map((client) => (
                            <div
                                key={client.id}
                                className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">
                                            {client.prenom} {client.nom}
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            📍 {client.adresse || 'Adresse non renseignée'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Statut: {client.statut || 'Non défini'}
                                        </div>
                                    </div>
                                    <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                        Sans GPS
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Message de succès si tous les clients ont GPS */}
            {data && data.missingGPS === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-green-900 text-lg">Parfait !</h3>
                    <p className="text-green-700 mt-1">
                        Tous vos clients ont des coordonnées GPS valides.
                    </p>
                </div>
            )}
        </div>
    );
}
