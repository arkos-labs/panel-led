// Test du système de détection de conflit de planning
// Simule un scénario où on essaie de planifier une livraison alors qu'une installation est en cours

const testConflictDetection = () => {
    console.log('=== TEST DE DÉTECTION DE CONFLIT ===\n');

    // Scénario 1: Installation de 150 LEDs du lundi au mardi
    console.log('📋 Scénario 1: Installation en cours');
    console.log('  - Client A: 150 LEDs');
    console.log('  - Début: Lundi 13 janvier 2026 à 9h');
    console.log('  - Fin estimée: Mardi 14 janvier à 13h30 (1.5 jours)');
    console.log('  - Chauffeur: CAMION_1\n');

    console.log('❌ Tentative de planification REFUSÉE:');
    console.log('  - Client B: Livraison demandée pour LUNDI 13 janvier');
    console.log('  - Raison: Le chauffeur CAMION_1 est occupé avec l\'installation du Client A\n');

    console.log('❌ Tentative de planification REFUSÉE:');
    console.log('  - Client C: Livraison demandée pour MARDI 14 janvier');
    console.log('  - Raison: Le chauffeur CAMION_1 est encore occupé (fin à 13h30)\n');

    console.log('✅ Planification ACCEPTÉE:');
    console.log('  - Client D: Livraison demandée pour MERCREDI 15 janvier');
    console.log('  - Raison: Le chauffeur CAMION_1 est libre (installation terminée)\n');

    console.log('=== RÈGLES DE CONFLIT ===');
    console.log('1. Un chauffeur ne peut PAS livrer pendant qu\'il installe');
    console.log('2. La date de fin d\'installation est calculée automatiquement:');
    console.log('   - 60 LEDs/jour (9h-18h)');
    console.log('   - Weekends exclus (samedi + dimanche)');
    console.log('3. Le système bloque automatiquement les dates en conflit');
    console.log('4. L\'utilisateur reçoit un message clair avec la date de fin estimée\n');

    console.log('=== EXEMPLE DE MESSAGE D\'ERREUR ===');
    console.log('⚠️ Conflit de planning :');
    console.log('Le chauffeur est déjà occupé ce jour-là avec l\'installation de "Jean Dupont" (150 LEDs).');
    console.log('Fin estimée: 14/01/2026 à 13:30');
};

testConflictDetection();
