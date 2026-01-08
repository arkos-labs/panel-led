// Configuration globale de la flotte et de la logistique

export const LOGISTICS_CONFIG = {
    // Capacité standard d'un camion "Tour de France" (Type Caisse 20m3)
    // 1500 = Master L3H2 (Trop juste)
    // 2500 = Caisse 20m3 (Idéal)
    TRUCK_CAPACITY: 2500,

    // Vitesse moyenne estimée (km/h)
    AVERAGE_SPEED: 70,

    // Temps fixe par arrêt (minutes)
    STOP_DURATION: 30,

    // Horaires
    START_HOUR: 8,
    MAX_END_HOUR: 22,
};
