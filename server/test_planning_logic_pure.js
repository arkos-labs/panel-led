// VERSION SANS DÉPENDANCE DATE-FNS

function format(date) {
    return date.toISOString().split('T')[0];
}

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

function runTest() {
    console.log("=== TEST DE LOGIQUE DE CONFLIT (JS Pur) ===");

    // CAS D'USAGE :
    // Client A (Existant) : 14/01/2026. 150 LEDs.
    // Client B (Tentative) : 12/01/2026. 150 LEDs.

    const clientA_Date = new Date('2026-01-14T09:00:00');
    const clientA_Leds = 150;

    const clientA_End = calculateEstimatedEnd(clientA_Date, clientA_Leds);
    console.log(`\nClient A (Existant) : 14 Janvier (150 LEDs)`);
    console.log(`Fin estimée : ${clientA_End.toISOString()}`);

    const blockedDates = new Set();
    let current = new Date(clientA_Date);
    current.setHours(0, 0, 0, 0);
    const endDayA = new Date(clientA_End);
    endDayA.setHours(0, 0, 0, 0);

    while (current <= endDayA) {
        blockedDates.add(format(current));
        current.setDate(current.getDate() + 1);
    }
    console.log(`Jours bloqués :`, Array.from(blockedDates));

    const clientB_TargetDate = new Date('2026-01-12T09:00:00');
    const clientB_Leds = 150;

    const clientB_End = calculateEstimatedEnd(clientB_TargetDate, clientB_Leds);
    console.log(`\nClient B (Tentative) : 12 Janvier (150 LEDs)`);
    console.log(`Fin estimée si commencé le 12 : ${clientB_End.toISOString()}`);

    let hasConflict = false;
    let checkCurrent = new Date(clientB_TargetDate);
    checkCurrent.setHours(0, 0, 0, 0);
    const endDayB = new Date(clientB_End);
    endDayB.setHours(0, 0, 0, 0);

    const neededDays = [];
    while (checkCurrent <= endDayB) {
        const dStr = format(checkCurrent);
        neededDays.push(dStr);
        if (blockedDates.has(dStr)) hasConflict = true;
        checkCurrent.setDate(checkCurrent.getDate() + 1);
    }

    console.log(`Jours nécessaires :`, neededDays);

    if (hasConflict) {
        console.log(`\n❌ RÉSULTAT : CONFLIT DÉTECTÉ ! (C'est ce qu'on veut)`);
    } else {
        console.log(`\n✅ RÉSULTAT : PAS DE CONFLIT.`);
    }
}

runTest();
