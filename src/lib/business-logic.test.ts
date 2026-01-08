/**
 * Tests pour la logique métier
 */

import { describe, it, expect } from 'vitest';
import {
    getClientStatus,
    getDeliveryStatus,
    getInstallationStatus,
    calculateStockPercentage,
    isStockCritical
} from '@/lib/business-logic';

describe('Business Logic - getClientStatus', () => {
    it('retourne le bon statut pour un nouveau client', () => {
        const client = {
            statut_client: 'À contacter',
            statut_livraison: null,
            statut_installation: null
        };
        expect(getClientStatus(client)).toBe('À contacter');
    });

    it('retourne le bon statut pour un client livré', () => {
        const client = {
            statut_client: 'Signé',
            statut_livraison: 'Livré',
            statut_installation: null
        };
        expect(getClientStatus(client)).toBe('Livré');
    });
});

describe('Business Logic - Stock', () => {
    it('calcule le pourcentage de stock correctement', () => {
        expect(calculateStockPercentage(1000, 300)).toBe(70); // 700/1000 = 70%
        expect(calculateStockPercentage(1000, 500)).toBe(50);
        expect(calculateStockPercentage(1000, 0)).toBe(100);
    });

    it('détecte le stock critique (< 25%)', () => {
        expect(isStockCritical(1000, 800)).toBe(true);  // 20% restant
        expect(isStockCritical(1000, 760)).toBe(true);  // 24% restant
        expect(isStockCritical(1000, 500)).toBe(false); // 50% restant
        expect(isStockCritical(1000, 0)).toBe(false);   // 100% restant
    });

    it('gère les cas limites', () => {
        expect(calculateStockPercentage(0, 0)).toBe(0);
        expect(calculateStockPercentage(100, 100)).toBe(0);
        expect(isStockCritical(0, 0)).toBe(false);
    });
});

describe('Business Logic - Delivery Status', () => {
    it('retourne le bon statut de livraison', () => {
        expect(getDeliveryStatus({ statut_livraison: 'Planifiée' })).toBe('Planifiée');
        expect(getDeliveryStatus({ statut_livraison: 'En cours' })).toBe('En cours');
        expect(getDeliveryStatus({ statut_livraison: 'Livré' })).toBe('Livré');
    });

    it('gère les statuts manquants', () => {
        expect(getDeliveryStatus({ statut_livraison: null })).toBe('Non planifiée');
        expect(getDeliveryStatus({})).toBe('Non planifiée');
    });
});

describe('Business Logic - Installation Status', () => {
    it('retourne le bon statut d\'installation', () => {
        expect(getInstallationStatus({ statut_installation: 'Planifiée' })).toBe('Planifiée');
        expect(getInstallationStatus({ statut_installation: 'En cours' })).toBe('En cours');
        expect(getInstallationStatus({ statut_installation: 'Terminée' })).toBe('Terminée');
    });

    it('gère les statuts manquants', () => {
        expect(getInstallationStatus({ statut_installation: null })).toBe('À planifier');
        expect(getInstallationStatus({})).toBe('À planifier');
    });
});
