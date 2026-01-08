const { format, addDays } = require('date-fns');

// --- FONCTIONS À TESTER (Copiées du composant) ---

function calculateEstimatedEnd(startDate, nbLed) {
    const ledsPerDay = 60;
    const startHour = 9;
    const endHour = 18;
    const workingHoursPerDay = endHour - startHour; // 9 heures
    const ledsPerHour = ledsPerDay / workingHoursPerDay; // 6.66 LED/heure

    let currentDate = new Date(startDate);
    let remainingLed = nbLed || 0;

    if (remainingLed <= 0) return currentDate;

    // Ajuster à l'heure de début
    if (currentDate.getHours() < startHour) currentDate.setHours(startHour, 0, 0, 0);
    else if (currentDate.getHours() >= endHour) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
    }

    // Sauter weekends initiaux
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
    }

    let iterations = 0;
    while (remainingLed > 0.1 && iterations < 100) {
        iterations++;
        // Sauter weekends
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(startHour, 0, 0, 0);
            continue;
        }

        const currentHour = currentDate.getHours() + (currentDate.getMinutes() / 60);
        const hoursLeftToday = Math.max(0, endHour - currentHour);
        const ledsPossibleToday = hoursLeftToday * ledsPerHour;

        if (ledsPossibleToday >= remainingLed) {
            const hoursNeeded = remainingLed / ledsPerHour;
            const totalMinutesNeeded = hoursNeeded * 60;
            currentDate.setMinutes(currentDate.getMinutes() + totalMinutesNeeded);
            remainingLed = 0;
        } else {
            remainingLed -= ledsPossibleToday;
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(startHour, 0, 0, 0);
        }
    }
    return currentDate;
}

// --- SCÉNARIO DE TEST ---

function runTest() {
    console.log("=== TEST DE LOGIQUE DE CONFLIT ===");

    // CAS D'USAGE :
    // Client A (Existant) : Prévu le Mercredi 14 Janvier 2026. 150 LEDs (3 jours).
    // Client B (Nouveau) : On veut le mettre le Lundi 12 Janvier 2026. 150 LEDs (3 jours).

    // 1. Calculer les jours bloqués par Client A
    const clientA_Date = new Date('2026-01-14T09:00:00'); // Mercredi
    const clientA_Leds = 150;

    const clientA_End = calculateEstimatedEnd(clientA_Date, clientA_Leds);
    console.log(`\n👷 Client A (Existant) : 150 LEDs`);
    console.log(`   Début : ${format(clientA_Date, 'EEEE dd/MM/yyyy HH:mm')}`);
    console.log(`   Fin   : ${format(clientA_End, 'EEEE dd/MM/yyyy HH:mm')}`);

    const blockedDates = new Set();
    let current = new Date(clientA_Date);
    current.setHours(0, 0, 0, 0);
    const endDayA = new Date(clientA_End);
    endDayA.setHours(0, 0, 0, 0);

    while (current <= endDayA) {
        if (current.getDay() !== 0 && current.getDay() !== 6) { // On ne bloque pas techniquement les weekends pour l'affichage mais bon
            blockedDates.add(format(current, 'yyyy-MM-dd'));
        }
        current.setDate(current.getDate() + 1);
    }
    console.log(`   📅 Jours bloqués :`, Array.from(blockedDates));

    // 2. Vérifier si on peut placer Client B le Lundi 12
    const clientB_TargetDate = new Date('2026-01-12T09:00:00'); // Lundi
    const clientB_Leds = 150;

    console.log(`\n🆕 Client B (Tentative) : 150 LEDs`);
    console.log(`   Cible : ${format(clientB_TargetDate, 'EEEE dd/MM/yyyy')}`);

    // Calcul de la période nécessaire pour Client B
    const clientB_End = calculateEstimatedEnd(clientB_TargetDate, clientB_Leds);
    console.log(`   Si on commence le 12, fin estimée : ${format(clientB_End, 'EEEE dd/MM/yyyy HH:mm')}`);

    let hasConflict = false;
    let conflictDate = null;

    let checkCurrent = new Date(clientB_TargetDate);
    checkCurrent.setHours(0, 0, 0, 0);
    const endDayB = new Date(clientB_End);
    endDayB.setHours(0, 0, 0, 0);

    const neededDays = [];

    while (checkCurrent <= endDayB) {
        const dateStr = format(checkCurrent, 'yyyy-MM-dd');
        neededDays.push(dateStr);
        if (blockedDates.has(dateStr)) {
            hasConflict = true;
            conflictDate = dateStr;
            // On ne break pas pour voir tous les conflits
        }
        checkCurrent.setDate(checkCurrent.getDate() + 1);
    }

    console.log(`   📅 Jours nécessaires :`, neededDays);

    if (hasConflict) {
        console.log(`\n❌ RÉSULTAT : CONFLIT DÉTECTÉ le ${conflictDate} !`);
        console.log(`   L'algorithme REFUSE correctement cette date.`);
    } else {
        console.log(`\n✅ RÉSULTAT : PAS DE CONFLIT (C'est un problème si ça devait bloquer)`);
        console.log(`   L'algorithme ACCEPTE cette date.`);
    }
}

runTest();
