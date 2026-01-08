/**
 * Tests pour les utilitaires
 */

import { describe, it, expect } from 'vitest';
import { formatDate, calculateDistance, isValidEmail, isValidPhone } from '@/lib/utils';

describe('Utils - formatDate', () => {
    it('formate une date correctement', () => {
        const date = new Date('2026-01-04T12:00:00');
        const formatted = formatDate(date);
        expect(formatted).toMatch(/04\/01\/2026/);
    });

    it('gère les dates invalides', () => {
        const result = formatDate(null as any);
        expect(result).toBe('');
    });
});

describe('Utils - calculateDistance', () => {
    it('calcule la distance entre deux points', () => {
        // Paris à Lyon (environ 400km)
        const distance = calculateDistance(
            { lat: 48.8566, lng: 2.3522 },
            { lat: 45.7640, lng: 4.8357 }
        );
        expect(distance).toBeGreaterThan(390);
        expect(distance).toBeLessThan(410);
    });

    it('retourne 0 pour le même point', () => {
        const distance = calculateDistance(
            { lat: 48.8566, lng: 2.3522 },
            { lat: 48.8566, lng: 2.3522 }
        );
        expect(distance).toBe(0);
    });
});

describe('Utils - isValidEmail', () => {
    it('valide un email correct', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('rejette un email invalide', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
    });
});

describe('Utils - isValidPhone', () => {
    it('valide un numéro français', () => {
        expect(isValidPhone('0612345678')).toBe(true);
        expect(isValidPhone('+33612345678')).toBe(true);
    });

    it('rejette un numéro invalide', () => {
        expect(isValidPhone('123')).toBe(false);
        expect(isValidPhone('abcdefghij')).toBe(false);
    });
});
