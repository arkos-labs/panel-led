/**
 * Service de synchronisation offline
 * Gère la synchronisation des données entre local et serveur
 */

import { offlineQueue, clientsDB, cache } from './offlineDB';
import { toast } from 'sonner';

// Types
interface SyncResult {
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
}

// État de synchronisation
let isSyncing = false;
let lastSyncTime: number | null = null;

// ================================================
// SYNCHRONISATION DES ACTIONS
// ================================================

/**
 * Synchroniser toutes les actions en attente
 */
export async function syncPendingActions(): Promise<SyncResult> {
    if (isSyncing) {
        console.log('⏳ Synchronisation déjà en cours...');
        return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    if (!navigator.onLine) {
        console.log('📡 Pas de connexion, synchronisation annulée');
        return { success: false, synced: 0, failed: 0, errors: ['No internet connection'] };
    }

    isSyncing = true;
    const result: SyncResult = {
        success: true,
        synced: 0,
        failed: 0,
        errors: []
    };

    try {
        const actions = await offlineQueue.getPending();

        if (actions.length === 0) {
            console.log('✅ Aucune action à synchroniser');
            return result;
        }

        console.log(`🔄 Synchronisation de ${actions.length} actions...`);

        for (const action of actions) {
            try {
                await processAction(action);
                await offlineQueue.markSynced(action.id!);
                result.synced++;
            } catch (error: any) {
                console.error(`❌ Erreur lors de la synchronisation de l'action ${action.id}:`, error);
                await offlineQueue.markFailed(action.id!, error.message);
                result.failed++;
                result.errors.push(error.message);
            }
        }

        // Nettoyer les actions synchronisées
        await offlineQueue.cleanSynced();

        lastSyncTime = Date.now();

        if (result.synced > 0) {
            toast.success(`✅ ${result.synced} action(s) synchronisée(s)`);
        }

        if (result.failed > 0) {
            toast.error(`❌ ${result.failed} action(s) échouée(s)`);
        }

    } catch (error: any) {
        console.error('❌ Erreur de synchronisation:', error);
        result.success = false;
        result.errors.push(error.message);
    } finally {
        isSyncing = false;
    }

    return result;
}

/**
 * Traiter une action spécifique
 */
async function processAction(action: any): Promise<void> {
    const { type, payload } = action;

    switch (type) {
        case 'CONFIRM_DELIVERY':
            await confirmDelivery(payload);
            break;

        case 'START_INSTALLATION':
            await startInstallation(payload);
            break;

        case 'COMPLETE_INSTALLATION':
            await completeInstallation(payload);
            break;

        case 'UPDATE_CLIENT':
            await updateClient(payload);
            break;

        case 'ADD_STOCK':
            await addStock(payload);
            break;

        default:
            throw new Error(`Type d'action inconnu: ${type}`);
    }
}

// ================================================
// ACTIONS SPÉCIFIQUES
// ================================================

async function confirmDelivery(payload: any) {
    // Dans notre backend, la validation se fait via GET /api/valider/:clientId/:type
    const response = await fetch(`/api/valider/${payload.clientId}/livraison`);

    if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Livraison confirmée:', payload.clientId);
}

async function startInstallation(payload: any) {
    const response = await fetch(`/api/valider/${payload.clientId}/chantier-debut`);

    if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Installation démarrée:', payload.clientId);
}

async function completeInstallation(payload: any) {
    const response = await fetch(`/api/valider/${payload.clientId}/chantier`);

    if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Installation terminée:', payload.clientId);
}

async function updateClient(payload: any) {
    const response = await fetch(`/api/clients/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.updates)
    });

    if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Client mis à jour:', payload.id);
}

async function addStock(payload: any) {
    const response = await fetch('/api/stock/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    console.log('✅ Stock ajouté:', payload.zone, payload.quantite);
}

// ================================================
// SYNCHRONISATION DES DONNÉES
// ================================================

/**
 * Télécharger les clients depuis le serveur
 */
export async function downloadClients(): Promise<void> {
    if (!navigator.onLine) {
        console.log('📡 Pas de connexion, téléchargement annulé');
        return;
    }

    try {
        const response = await fetch('/api/clients');

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
        }

        const clients = await response.json();
        await clientsDB.saveClients(clients);

        console.log(`📥 ${clients.length} clients téléchargés`);
        toast.success(`${clients.length} clients synchronisés`);
    } catch (error: any) {
        console.error('❌ Erreur de téléchargement:', error);
        toast.error('Erreur de synchronisation des clients');
    }
}

/**
 * Synchronisation complète
 */
export async function fullSync(): Promise<void> {
    if (!navigator.onLine) {
        toast.error('Pas de connexion internet');
        return;
    }

    toast.info('Synchronisation en cours...');

    try {
        // 1. Synchroniser les actions en attente
        await syncPendingActions();

        // 2. Télécharger les clients
        await downloadClients();

        // 3. Nettoyer le cache expiré
        await cache.cleanExpired();

        toast.success('Synchronisation terminée');
    } catch (error: any) {
        console.error('❌ Erreur de synchronisation complète:', error);
        toast.error('Erreur de synchronisation');
    }
}

// ================================================
// GESTION AUTOMATIQUE
// ================================================

/**
 * Initialiser la synchronisation automatique
 */
export function initAutoSync() {
    // Synchroniser quand la connexion revient
    window.addEventListener('online', () => {
        console.log('🌐 Connexion rétablie, synchronisation...');
        setTimeout(() => syncPendingActions(), 1000);
    });

    // Synchroniser périodiquement (toutes les 5 minutes)
    setInterval(() => {
        if (navigator.onLine) {
            syncPendingActions();
        }
    }, 5 * 60 * 1000);

    // Synchroniser au chargement si en ligne
    if (navigator.onLine) {
        setTimeout(() => syncPendingActions(), 2000);
    }

    console.log('✅ Synchronisation automatique initialisée');
}

// ================================================
// UTILITAIRES
// ================================================

/**
 * Obtenir l'état de synchronisation
 */
export function getSyncStatus() {
    return {
        isSyncing,
        lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : null,
        isOnline: navigator.onLine
    };
}

/**
 * Forcer une synchronisation
 */
export async function forceSync(): Promise<void> {
    await fullSync();
}

/**
 * Obtenir le nombre d'actions en attente
 */
export async function getPendingCount(): Promise<number> {
    return await offlineQueue.countPending();
}
