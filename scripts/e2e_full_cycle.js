
import { googleManager } from '../server/google_manager.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SPREADSHEET_ID = '1pParE3lQ3SOo7mQ0WjhY0aLuXtQAGpVQ0qANYEBcpAI';
const TAB_NAME = 'fr metropole '; // Noté avec espace dans bridge.js fallback

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvqmwbhidmqnlmmejusk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runE2E() {
    console.log("🚀 DÉMARRAGE DU TEST E2E COMPLET...");

    await googleManager.connect();

    // 1. AJOUT D'UN CLIENT DANS GOOGLE SHEETS
    const timestamp = Date.now();
    const testNom = `E2E-TEST-${timestamp}`;
    const testPrenom = "Robot";
    const testAddress = "5 Avenue de l'Opéra, 75001 Paris";
    const testPhone = "0102030405";
    const testEmail = `e2e-${timestamp}@example.com`;
    const testNbLed = 250;

    // On cherche la première ligne vide après la ligne 4
    const rangeRead = `'${TAB_NAME}'!A4:A3000`;
    const resRead = await googleManager.sheetsGet({ spreadsheetId: SPREADSHEET_ID, range: rangeRead });
    const rows = resRead.data.values || [];
    const nextRowIndex = rows.length + 4;

    console.log(`📝 Ajout du client ${testNom} à la ligne ${nextRowIndex} de Google Sheets...`);

    const rangeWrite = `'${TAB_NAME}'!A${nextRowIndex}:G${nextRowIndex}`;
    await googleManager.sheetsUpdate({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeWrite,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[testNom, testPrenom, testAddress, testPhone, testEmail, testNbLed, 'SIGNÉ']]
        }
    });

    console.log("✅ Client ajouté dans Google Sheets.");

    // 2. ATTENTE DE LA SYNCHRO BRIDGE -> SUPABASE
    console.log("⏳ Attente de la synchronisation par le Bridge (max 90s)...");
    const idExpected = `${TAB_NAME.replace(/\s+/g, '_')}${nextRowIndex}`;
    let clientAppeared = false;
    for (let i = 0; i < 9; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const { data, error } = await supabase.from('clients').select('*').eq('id', idExpected).single();
        if (data) {
            console.log(`✅ Client ${idExpected} apparu dans Supabase !`);
            clientAppeared = true;
            break;
        }
        console.log(`... toujour rien (${(i + 1) * 10}s)`);
    }

    if (!clientAppeared) {
        console.error("❌ ÉCHEC : Le client n'est pas apparu dans Supabase. Vérifiez si le bridge.js tourne.");
        return;
    }

    // 3. PLANIFICATION VIA API
    console.log("🚚 Planification de la livraison via API...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const planRes = await fetch(`http://localhost:3001/api/livraisons/planifier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientId: idExpected,
            date: dateStr,
            camionId: 'camion-1'
        })
    });

    if (planRes.ok) {
        console.log("✅ Planification réussie via API.");
    } else {
        const err = await planRes.text();
        console.error("❌ ÉCHEC Planification :", err);
        return;
    }

    // 4. ATTENTE SYNCHRO SUPABASE -> SHEETS (PLANIFICATION)
    console.log("⏳ Attente synchro Supabase -> Sheets (Col H)...");
    let sheetPlanned = false;
    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const resCheck = await googleManager.sheetsGet({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${TAB_NAME}'!H${nextRowIndex}`
        });
        const val = resCheck.data.values?.[0]?.[0];
        if (val && val.includes('/')) {
            console.log(`✅ Date de livraison apparue dans Sheets : ${val}`);
            sheetPlanned = true;
            break;
        }
        console.log("... en attente de Col H");
    }

    // 5. VALIDATION DE LIVRAISON (Simulation PWA)
    console.log("📦 Validation de la livraison (Simulation chauffeur)...");
    const valRes = await fetch(`http://localhost:3001/api/valider/${idExpected}/livraison`);

    if (valRes.ok) {
        console.log("✅ Validation réussie.");
    } else {
        const err = await valRes.text();
        console.error("❌ ÉCHEC Validation :", err);
        return;
    }

    // 6. VÉRIFICATION FINALE DANS SHEETS (Col I & J)
    console.log("⏳ Vérification finale dans Sheets (Colonnes I & J)...");
    let complete = false;
    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const resCheck = await googleManager.sheetsGet({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${TAB_NAME}'!I${nextRowIndex}:J${nextRowIndex}`
        });
        const vals = resCheck.data.values?.[0] || [];
        if (vals[0] && vals[1]) {
            console.log(`✅ TEST RÉUSSI ! Signature: ${vals[0]}, Heure: ${vals[1]}`);
            complete = true;
            break;
        }
        console.log("... en attente de Col I & J");
    }

    if (complete) {
        console.log("\n🎉 PARCOURS E2E RÉUSSI AVEC SUCCÈS ! 🎉");
    } else {
        console.error("\n❌ ÉCHEC : Les colonnes I & J n'ont pas été remplies.");
    }
}

runE2E().catch(console.error);
