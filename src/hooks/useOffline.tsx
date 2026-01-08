/**
 * Hook React pour le mode offline
 * Facilite l'utilisation du mode offline dans les composants
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueue, clientsDB, cache, offlineDB } from '@/services/offlineDB';
import { syncPendingActions, downloadClients, getSyncStatus, getPendingCount } from '@/services/offlineSync';
import { toast } from 'sonner';

// ================================================
// HOOK PRINCIPAL
// ================================================

export function useOffline() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Mettre à jour l'état de connexion
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Mettre à jour le nombre d'actions en attente
    useEffect(() => {
        const updatePendingCount = async () => {
            const count = await getPendingCount();
            setPendingCount(count);
        };

        updatePendingCount();
        const interval = setInterval(updatePendingCount, 10000); // Toutes les 10s

        return () => clearInterval(interval);
    }, []);

    // Synchroniser
    const sync = useCallback(async () => {
        setIsSyncing(true);
        try {
            await syncPendingActions();
            const count = await getPendingCount();
            setPendingCount(count);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return {
        isOnline,
        isSyncing,
        pendingCount,
        sync
    };
}

// ================================================
// HOOK POUR LES ACTIONS OFFLINE
// ================================================

export function useOfflineAction() {
    const { isOnline } = useOffline();

    /**
     * Exécuter une action (en ligne ou hors ligne)
     */
    const execute = useCallback(async <T = any>(
        actionType: string,
        payload: any,
        onlineHandler: () => Promise<T>
    ): Promise<T | null> => {
        if (isOnline) {
            // En ligne : exécution directe
            try {
                return await onlineHandler();
            } catch (error: any) {
                toast.error(`Erreur: ${error.message}`);
                throw error;
            }
        } else {
            // Hors ligne : ajouter à la file d'attente
            try {
                await offlineQueue.add(actionType, payload);
                toast.success('Action enregistrée (sera synchronisée)');
                return null;
            } catch (error: any) {
                toast.error(`Erreur: ${error.message}`);
                throw error;
            }
        }
    }, [isOnline]);

    return { execute, isOnline };
}

// ================================================
// HOOK POUR LES CLIENTS OFFLINE
// ================================================

export function useOfflineClients() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { isOnline } = useOffline();

    // Charger les clients (local ou serveur)
    const loadClients = useCallback(async () => {
        setLoading(true);
        try {
            if (isOnline) {
                // En ligne : télécharger depuis le serveur
                await downloadClients();
            }

            // Charger depuis IndexedDB
            const localClients = await clientsDB.getAllClients();
            setClients(localClients);
        } catch (error) {
            console.error('Erreur de chargement des clients:', error);
            toast.error('Erreur de chargement des clients');
        } finally {
            setLoading(false);
        }
    }, [isOnline]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    // Rechercher des clients
    const searchClients = useCallback(async (query: string) => {
        const results = await clientsDB.searchClients(query);
        setClients(results);
    }, []);

    // Filtrer par zone
    const filterByZone = useCallback(async (zone: string) => {
        const results = await clientsDB.getClientsByZone(zone);
        setClients(results);
    }, []);

    return {
        clients,
        loading,
        loadClients,
        searchClients,
        filterByZone
    };
}

// ================================================
// HOOK POUR LE CACHE
// ================================================

export function useOfflineCache<T = any>(key: string, ttlMinutes: number = 60) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);

    // Charger depuis le cache
    useEffect(() => {
        const loadCache = async () => {
            setLoading(true);
            try {
                const cached = await cache.get<T>(key);
                setData(cached);
            } finally {
                setLoading(false);
            }
        };

        loadCache();
    }, [key]);

    // Sauvegarder dans le cache
    const saveCache = useCallback(async (newData: T) => {
        await cache.set(key, newData, ttlMinutes);
        setData(newData);
    }, [key, ttlMinutes]);

    // Invalider le cache
    const invalidate = useCallback(async () => {
        await cache.delete(key);
        setData(null);
    }, [key]);

    return {
        data,
        loading,
        saveCache,
        invalidate
    };
}

// ================================================
// HOOK POUR LES STATISTIQUES
// ================================================

export function useOfflineStats() {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const loadStats = async () => {
            const dbStats = await offlineDB.getStats();
            const syncStatus = getSyncStatus();

            setStats({
                ...dbStats,
                ...syncStatus
            });
        };

        loadStats();
        const interval = setInterval(loadStats, 30000); // Toutes les 30s

        return () => clearInterval(interval);
    }, []);

    return stats;
}

// ================================================
// COMPOSANT D'INDICATEUR DE SYNCHRONISATION
// ================================================

export function SyncIndicator() {
    const { isSyncing, pendingCount } = useOffline();

    if (!isSyncing && pendingCount === 0) return null;

    return (
        <div className="fixed bottom-20 right-4 z-50 bg-white rounded-lg shadow-lg border border-border p-3">
            <div className="flex items-center gap-2">
                {isSyncing ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                        <span className="text-sm font-medium">Synchronisation...</span>
                    </>
                ) : (
                    <>
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span className="text-sm font-medium">
                            {pendingCount} action{pendingCount > 1 ? 's' : ''} en attente
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
