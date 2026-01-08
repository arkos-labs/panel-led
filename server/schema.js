export const SHEET_SCHEMA = {
    // Colonnes (0-index based)
    // A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
    COL_NOM: 0,           // A
    COL_PRENOM: 1,        // B
    COL_ADRESSE: 2,       // C
    // COL_CODE_POSTAL removed or not present in D. D is Tel.
    COL_TELEPHONE: 3,     // D
    COL_EMAIL: 4,         // E
    COL_NB_LED: 5,        // F
    COL_STATUT_GLOBAL: 6, // G

    // --- ZONE LOGISTIQUE (LIVRAISON) ---
    COL_LIVRAISON_DATE: 7,      // H
    COL_LIVRAISON_SIGNATURE: 8, // I
    COL_LIVRAISON_TIME: 9,      // J

    // --- ZONE CHANTIER (INSTALLATION) ---
    COL_INSTALL_DATE_DEBUT: 10, // K
    COL_INSTALL_DATE_FIN: 11,   // L - DATE FIN PLANIFIEE
    COL_INSTALL_STATUT: 12,     // M
    COL_INSTALL_DATE_FIN_REELLE: 13, // N - DATE/HEURE FIN REELLE

    // Autres
    COL_CAMION_ID: 14,          // O (Used for Dispatch/Driver ID) (Previously Info Divers)
    COL_INFO_DIVERS: 15,        // P (Swapped with Camion ID)
    COL_INSTALL_POSEUR_ID: 16,  // Q
    COL_LAT: 17,                // R
    COL_LON: 18,                // S
};

export const STATUS = {
    GLOBAL: {
        SIGNE: 'SIGNÉ',
        EN_COURS: 'EN_COURS',
        TERMINE: 'TERMINÉ',
        A_RAPPELER: 'A_RAPPELER'
    },
    LIVRAISON: {
        PLANIFIEE: 'PLANIFIÉE',
        LIVREE: 'LIVRÉE',
        NON_LIVRE: 'NON_LIVRÉ'
    },
    INSTALLATION: {
        PLANIFIEE: 'PLANIFIÉE',
        EN_COURS: 'EN_COURS',
        TERMINE: 'TERMINÉE'
    }
};
