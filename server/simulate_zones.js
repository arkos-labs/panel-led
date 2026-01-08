
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Hardcode path for stability test
dotenv.config({ path: './.env' }); // relative to CWD (root)

console.log("Checking ENV...");
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Use Anon key if service role is missing, though we might need service role for writes.
// bridge.js: const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
    console.error("❌ SUPABASE_URL missing (checked VITE_SUPABASE_URL too)");
    process.exit(1);
}
console.log("✅ SUPABASE_URL found");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ZONES = [
    { code: 'FR', tab: 'fr metropole ', id_prefix: 'fr_metropole_', row: 8000, name: 'TEST_FR_FULL_CYCLE' },
    { code: 'GP', tab: 'Guadeloupe', id_prefix: 'Guadeloupe_', row: 8000, name: 'TEST_GP_FULL_CYCLE' },
    { code: 'MQ', tab: 'Martinique', id_prefix: 'Martinique_', row: 8000, name: 'TEST_MQ_FULL_CYCLE' },
    { code: 'CORSE', tab: 'Corse', id_prefix: 'Corse_', row: 8000, name: 'TEST_CORSE_FULL_CYCLE' },
    { code: 'GF', tab: 'Guyane', id_prefix: 'Guyane_', row: 8000, name: 'TEST_GF_FULL_CYCLE' },
    { code: 'RE', tab: 'Reunion', id_prefix: 'Reunion_', row: 8000, name: 'TEST_RE_FULL_CYCLE' },
    { code: 'YT', tab: 'Mayotte', id_prefix: 'Mayotte_', row: 8000, name: 'TEST_YT_FULL_CYCLE' }
];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
    console.log("🚀 STARTING FULL CLIENT LIFECYCLE SIMULATION (4 ZONES)...");

    for (const zone of ZONES) {
        const clientId = `${zone.id_prefix}${zone.row}`;
        console.log(`\n\n🔵 [ZONE: ${zone.code}] Simulating Client: ${zone.name} (ID: ${clientId})`);

        // 1. DELETE EXISTING
        console.log(`   🔸 Cleaning up previous test data...`);
        const { error: delError } = await supabase.from('clients').delete().eq('id', clientId);
        if (delError) console.error("Del Error", delError);

        // 2. CREATE (Statut: A PLANIFIER)
        console.log(`   🔸 Creating Client (Step 1: Livraison à planifier)...`);
        const { error: createError } = await supabase.from('clients').insert({
            id: clientId,
            nom: zone.name,
            prenom: 'Simulation',
            adresse_brute: '123 Rue de Test, 75000 Paris',
            nb_led: 100,
            statut_client: '🔴 1. Livraison à planifier',
            updated_at: new Date().toISOString(),
            zone_pays: zone.code,
            google_row_index: zone.row,
            telephone: '0600000000',
            email: 'test@example.com'
        });

        if (createError) {
            console.error(`Error creating client: ${createError.message}`);
            continue;
        }
        console.log(`   ✅ Client created.`);
        await delay(3000);

        // 3. PLAN DELIVERY
        console.log(`   🔸 Planning Delivery (Step 2: Livraison confirmée)...`);
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await supabase.from('clients').update({
            date_livraison_prevue: nextWeek.toISOString().split('T')[0],
            statut_client: '🚚 2. Livraison confirmée',
            updated_at: new Date().toISOString()
        }).eq('id', clientId);
        console.log(`   ✅ Delivery Planned.`);
        await delay(3000);

        // 4. CONFIRM DELIVERY
        console.log(`   🔸 Confirming Delivery (Step 3: Matériel reçu)...`);
        const now = new Date();
        const nowStr = now.toISOString();
        await supabase.from('clients').update({
            date_livraison_reelle: nowStr,
            statut_livraison: 'LIVRÉ',
            updated_at: nowStr
        }).eq('id', clientId);
        console.log(`   ✅ Delivery Confirmed.`);
        await delay(3000);

        // 5. PLAN INSTALLATION
        console.log(`   🔸 Planning Installation (Step 4: Installation confirmée)...`);
        const installDate = new Date();
        installDate.setDate(installDate.getDate() + 10);
        await supabase.from('clients').update({
            date_install_debut: installDate.toISOString().split('T')[0],
            statut_installation: 'PLANIFIÉE',
            updated_at: new Date().toISOString()
        }).eq('id', clientId);
        console.log(`   ✅ Installation Planned.`);
        await delay(3000);

        // 6. FINISH INSTALLATION
        console.log(`   🔸 Finishing Installation (Step 6: Terminé)...`);
        await supabase.from('clients').update({
            statut_installation: 'TERMINÉE',
            date_install_fin: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        }).eq('id', clientId);
        console.log(`   ✅ Installation Finished.`);
        await delay(2000);

        console.log(`🟢 [ZONE: ${zone.code}] Cycle Complete.`);
    }

    console.log("\n🚀 ALL ZONES SIMULATED.");
}

runSimulation();
