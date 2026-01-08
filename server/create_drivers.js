
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Fallback manual key entry if .env fails (but it should work)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvqmwbhidmqnlmmejusk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error("❌ Erreur: Clé Supabase manquante dans l'environnement.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const drivers = [
    {
        nom: 'Nicolas',
        type: 'LIVREUR',
        capacite: 1000,
        secteur: 'IDF',
        disponibilite: {},
        actif: true
    },
    {
        nom: 'David',
        type: 'LIVREUR',
        capacite: 500,
        secteur: 'IDF',
        disponibilite: {},
        actif: true
    }
];

async function createDrivers() {
    console.log("🚀 Création des chauffeurs de test...");

    // 1. Vérifier s'ils existent déjà pour éviter les doublons
    for (const driver of drivers) {
        const { data: existing } = await supabase
            .from('ressources')
            .select('*')
            .eq('nom', driver.nom)
            .eq('type', 'LIVREUR');

        if (existing && existing.length > 0) {
            console.log(`⚠️ ${driver.nom} existe déjà. Mise à jour de la capacité...`);
            const { error: updateError } = await supabase
                .from('ressources')
                .update({ capacite: driver.capacite })
                .eq('id', existing[0].id);

            if (updateError) console.error(`❌ Erreur update ${driver.nom}:`, updateError);
            else console.log(`✅ ${driver.nom} mis à jour (Capacité: ${driver.capacite}).`);
        } else {
            console.log(`✨ Création de ${driver.nom}...`);
            const { error: insertError } = await supabase
                .from('ressources')
                .insert([driver]);

            if (insertError) console.error(`❌ Erreur insert ${driver.nom}:`, insertError);
            else console.log(`✅ ${driver.nom} créé avec succès.`);
        }
    }
    console.log("🏁 Terminé.");
}

createDrivers();
