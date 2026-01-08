/**
 * Service de base de données locale IndexedDB
 * Stocke les données localement pour le mode offline
 */

import Dexie, { Table } from 'dexie';

// Types
export interface Client {
    id: string;
    nom: string;
    prenom: string;
    adresse?: string;
    ville?: string;
    telephone?: string;
    nb_led?: number;
    zone_pays?: string;
    statut_client?: string;
    statut_livraison?: string;
    date_livraison_prevue?: string;
    updatedAt: number;
}

export interface OfflineAction {
    id?: number;
    type: string;
    payload: any;
    timestamp: number;
    synced: boolean;
    error?: string;
}

export interface CachedData {
    key: string;
    data: any;
    timestamp: number;
    expiresAt?: number;
}

// Base de données
class OfflineDatabase extends Dexie {
    clients!: Table<Client, string>;
    actions!: Table<OfflineAction, number>;
    cache!: Table<CachedData, string>;

    constructor() {
        super('ArkosOfflineDB');

        this.version(1).stores({
            clients: 'id, nom, zone_pays, statut_client, updatedAt',
            actions: '++id, type, timestamp, synced',
            cache: 'key, timestamp, expiresAt'
        });
    }
}

const db = new OfflineDatabase();

// ================================================
// GESTION DES CLIENTS
// ================================================

export const clientsDB = {
    /**
     * Sauvegarder les clients localement
     */
    async saveClients(clients: Client[]) {
        const now = Date.now();
        const clientsWithTimestamp = clients.map(c => ({
            ...c,
            updatedAt: now
        }));

        await db.clients.bulkPut(clientsWithTimestamp);
        console.log(`💾 ${clients.length} clients sauvegardés localement`);
    },

    /**
     * Récupérer tous les clients
     */
    async getAllClients(): Promise<Client[]> {
        return await db.clients.toArray();
    },

    /**
     * Récupérer un client par ID
     */
    async getClient(id: string): Promise<Client | undefined> {
        return await db.clients.get(id);
    },

    /**
     * Mettre à jour un client
     */
    async updateClient(id: string, updates: Partial<Client>) {
        await db.clients.update(id, {
            ...updates,
            updatedAt: Date.now()
        });
    },

    /**
     * Supprimer un client
     */
    async deleteClient(id: string) {
        await db.clients.delete(id);
    },

    /**
     * Rechercher des clients
     */
    async searchClients(query: string): Promise<Client[]> {
        const lowerQuery = query.toLowerCase();
        return await db.clients
            .filter(client =>
                client.nom.toLowerCase().includes(lowerQuery) ||
                client.prenom?.toLowerCase().includes(lowerQuery) ||
                client.ville?.toLowerCase().includes(lowerQuery)
            )
            .toArray();
    },

    /**
     * Filtrer par zone
     */
    async getClientsByZone(zone: string): Promise<Client[]> {
        return await db.clients
            .where('zone_pays')
            .equals(zone)
            .toArray();
    },

    /**
     * Nettoyer les vieux clients (> 7 jours)
     */
    async cleanOldClients() {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await db.clients
            .where('updatedAt')
            .below(sevenDaysAgo)
            .delete();
    }
};

// ================================================
// FILE D'ATTENTE D'ACTIONS OFFLINE
// ================================================

export const offlineQueue = {
    /**
     * Ajouter une action à la file d'attente
     */
    async add(type: string, payload: any): Promise<number> {
        const id = await db.actions.add({
            type,
            payload,
            timestamp: Date.now(),
            synced: false
        });

        console.log(`📋 Action ajoutée à la file d'attente: ${type}`, payload);
        return id;
    },

    /**
     * Récupérer toutes les actions non synchronisées
     */
    async getPending(): Promise<OfflineAction[]> {
        return await db.actions
            .where('synced')
            .equals(0)
            .sortBy('timestamp');
    },

    /**
     * Marquer une action comme synchronisée
     */
    async markSynced(id: number) {
        await db.actions.update(id, { synced: true });
    },

    /**
     * Marquer une action comme échouée
     */
    async markFailed(id: number, error: string) {
        await db.actions.update(id, { error });
    },

    /**
     * Supprimer les actions synchronisées
     */
    async cleanSynced() {
        await db.actions
            .where('synced')
            .equals(1)
            .delete();
    },

    /**
     * Compter les actions en attente
     */
    async countPending(): Promise<number> {
        return await db.actions
            .where('synced')
            .equals(0)
            .count();
    },

    /**
     * Supprimer toutes les actions
     */
    async clear() {
        await db.actions.clear();
    }
};

// ================================================
// CACHE GÉNÉRIQUE
// ================================================

export const cache = {
    /**
     * Sauvegarder des données en cache
     */
    async set(key: string, data: any, ttlMinutes: number = 60) {
        const now = Date.now();
        await db.cache.put({
            key,
            data,
            timestamp: now,
            expiresAt: now + (ttlMinutes * 60 * 1000)
        });
    },

    /**
     * Récupérer des données du cache
     */
    async get<T = any>(key: string): Promise<T | null> {
        const cached = await db.cache.get(key);

        if (!cached) return null;

        // Vérifier l'expiration
        if (cached.expiresAt && cached.expiresAt < Date.now()) {
            await db.cache.delete(key);
            return null;
        }

        return cached.data as T;
    },

    /**
     * Supprimer une entrée du cache
     */
    async delete(key: string) {
        await db.cache.delete(key);
    },

    /**
     * Nettoyer les entrées expirées
     */
    async cleanExpired() {
        const now = Date.now();
        await db.cache
            .where('expiresAt')
            .below(now)
            .delete();
    },

    /**
     * Vider tout le cache
     */
    async clear() {
        await db.cache.clear();
    }
};

// ================================================
// UTILITAIRES
// ================================================

export const offlineDB = {
    /**
     * Obtenir la taille de la base de données
     */
    async getSize(): Promise<{ clients: number; actions: number; cache: number }> {
        return {
            clients: await db.clients.count(),
            actions: await db.actions.count(),
            cache: await db.cache.count()
        };
    },

    /**
     * Nettoyer toute la base de données
     */
    async clearAll() {
        await db.clients.clear();
        await db.actions.clear();
        await db.cache.clear();
        console.log('🗑️ Base de données locale vidée');
    },

    /**
     * Exporter les données (pour debug)
     */
    async export() {
        return {
            clients: await db.clients.toArray(),
            actions: await db.actions.toArray(),
            cache: await db.cache.toArray()
        };
    },

    /**
     * Obtenir des statistiques
     */
    async getStats() {
        const size = await this.getSize();
        const pendingActions = await offlineQueue.countPending();

        return {
            ...size,
            pendingActions,
            lastUpdate: new Date().toISOString()
        };
    }
};

// Export de la base de données
export default db;
