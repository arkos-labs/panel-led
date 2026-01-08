// Test de la fonction calculateEstimatedEnd avec weekends exclus
// Pour vérifier que les samedis et dimanches sont bien sautés

function calculateEstimatedEnd(startDate, nbLed, ledsPerDay = 60, startHour = 9, endHour = 18) {
    const workingHoursPerDay = endHour - startHour;
    const ledsPerHour = ledsPerDay / workingHoursPerDay;

    let currentDate = new Date(startDate);
    let remainingLed = parseFloat(nbLed) || 0;

    if (remainingLed <= 0) return currentDate;

    if (currentDate.getHours() < startHour) {
        currentDate.setHours(startHour, 0, 0, 0);
    } else if (currentDate.getHours() >= endHour) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
    }

    // Sauter les weekends (samedi=6, dimanche=0)
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
    }

    while (remainingLed > 0.1) {
        // Sauter weekends (samedi=6, dimanche=0)
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

// Test 1: Démarrage un vendredi à 9h, 60 LEDs (1 jour de travail)
// Devrait finir le vendredi à 18h
const test1Start = new Date('2026-01-09T09:00:00'); // Vendredi 9 janvier 2026
const test1End = calculateEstimatedEnd(test1Start, 60);
console.log('Test 1 - Vendredi 9h, 60 LEDs:');
console.log('  Début:', test1Start.toLocaleString('fr-FR'));
console.log('  Fin:', test1End.toLocaleString('fr-FR'));
console.log('  Attendu: Vendredi 18h');
console.log('');

// Test 2: Démarrage un vendredi à 9h, 120 LEDs (2 jours de travail)
// Devrait sauter le weekend et finir le lundi à 18h
const test2Start = new Date('2026-01-09T09:00:00'); // Vendredi 9 janvier 2026
const test2End = calculateEstimatedEnd(test2Start, 120);
console.log('Test 2 - Vendredi 9h, 120 LEDs:');
console.log('  Début:', test2Start.toLocaleString('fr-FR'));
console.log('  Fin:', test2End.toLocaleString('fr-FR'));
console.log('  Attendu: Lundi 12 janvier 18h (saute sam 10 et dim 11)');
console.log('');

// Test 3: Démarrage un vendredi à 14h, 90 LEDs (1.5 jours)
// Devrait finir vendredi 18h (30 LEDs) + lundi 9h-13h30 (60 LEDs)
const test3Start = new Date('2026-01-09T14:00:00'); // Vendredi 9 janvier 2026 à 14h
const test3End = calculateEstimatedEnd(test3Start, 90);
console.log('Test 3 - Vendredi 14h, 90 LEDs:');
console.log('  Début:', test3Start.toLocaleString('fr-FR'));
console.log('  Fin:', test3End.toLocaleString('fr-FR'));
console.log('  Attendu: Lundi 12 janvier ~13h30');
console.log('');

// Test 4: Démarrage un samedi (devrait commencer lundi)
const test4Start = new Date('2026-01-10T09:00:00'); // Samedi 10 janvier 2026
const test4End = calculateEstimatedEnd(test4Start, 60);
console.log('Test 4 - Samedi 9h, 60 LEDs:');
console.log('  Début:', test4Start.toLocaleString('fr-FR'));
console.log('  Fin:', test4End.toLocaleString('fr-FR'));
console.log('  Attendu: Lundi 12 janvier 18h (démarre lundi car weekend)');
