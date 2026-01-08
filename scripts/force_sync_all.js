
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// --- MANUAL ENV PARSING ---
const envContent = fs.readFileSync('.env', 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/"/g, '').replace(/'/g, '');
        envConfig[key] = val;
    }
});

console.log("DEBUG LOADED KEYS:", Object.keys(envConfig));

const url = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;
const spreadsheetId = envConfig.SPREADSHEET_ID;

if (!url || !key) {
    console.error("❌ CRITICAL: Missing Supabase URL or Key in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

const SHEET_SCHEMA = {
    // 0-based index matching user sheet
    COL_CODE_POSTAL: 3,   // D
    COL_NB_LED: 6,        // G
    COL_STATUT_GLOBAL: 7, // H
    COL_LIVRAISON_DATE: 8, // I
    COL_LIVRAISON_SIGNATURE: 9, // J (Date+Heure)
    COL_LIVRAISON_TIME: 10,     // K (Heure)
    COL_INSTALL_DATE_DEBUT: 11, // L
    COL_INSTALL_DATE_FIN: 12,   // M
};

function calculateStatus(client) {
    let state = 1;
    let text = "🔴 1. Livraison à planifier";

    const liv = (client.statut_livraison || '').toUpperCase();
    const inst = (client.statut_installation || '').toUpperCase();
    const glob = (client.statut_client || '').toUpperCase();

    if (inst.includes('TERMIN') || glob.includes('TERMIN')) {
        text = "✅ 6. Terminé";
    } else if (inst.includes('EN_COURS')) {
        text = "🚧 5. Installation en cours";
    } else if (inst.includes('PLANIFI') && !inst.includes('À PLANIFIER')) {
        text = "📅 4. Installation confirmée";
    } else if (liv.includes('LIVRÉ') || liv.includes('LIVREE') || glob.includes('MATÉRIEL REÇU')) {
        text = "📦 3. Matériel reçu";
    } else if (((liv.includes('PLANIFI') || glob.includes('PLANIFI')) && !liv.includes('À PLANIFIER')) || client.date_livraison_prevue) {
        text = "🚚 2. Livraison confirmée";
    }
    return text;
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('fr-FR');
    } catch { return ''; }
}

async function forceSync() {
    console.log("🚀 Starting Full Sync...");

    try {
        // 1. Fetch Supabase Data
        const { data: clients, error } = await supabase.from('clients').select('*');
        if (error) throw error;
        console.log(`📚 Found ${clients.length} clients in Supabase.`);

        // 2. Auth Google
        const content = fs.readFileSync('./credentials.json');
        const googleAuth = new google.auth.GoogleAuth({
            credentials: JSON.parse(content),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const sheets = google.sheets({ version: 'v4', auth: await googleAuth.getClient() });

        // 3. Prepare Valid Updates
        const updatesByTab = {};

        for (const c of clients) {
            // Check ID format
            if (!c.id || !c.id.includes('!')) continue;
            const [tabName, rowStr] = c.id.split('!');
            const rowIndex = parseInt(rowStr);
            if (isNaN(rowIndex)) continue;

            // Skip invalid names (Ghost check equivalent)
            const nom = c.nom || '';
            const addr = c.adresse_brute || c.adresse || '';
            if (!nom && !addr) continue;

            if (!updatesByTab[tabName]) updatesByTab[tabName] = [];

            const status = calculateStatus(c);
            const rangePrefix = `'${tabName}'!`;

            // H: Status
            updatesByTab[tabName].push({
                range: `${rangePrefix}H${rowIndex}`,
                values: [[status]]
            });

            // G: LED
            updatesByTab[tabName].push({
                range: `${rangePrefix}G${rowIndex}`,
                values: [[c.nb_led || c.nombreLED || 0]]
            });

            // I: Date Livraison
            if (c.date_livraison_prevue) {
                updatesByTab[tabName].push({
                    range: `${rangePrefix}I${rowIndex}`,
                    values: [[formatDate(c.date_livraison_prevue)]]
                });
            }
        }

        // 4. Execute
        for (const tabName of Object.keys(updatesByTab)) {
            const updates = updatesByTab[tabName];
            if (updates.length === 0) continue;

            console.log(`⚡ Updating ${updates.length} cells in ${tabName}...`);

            // Chunking
            const CHUNK_SIZE = 50;
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                const chunk = updates.slice(i, i + CHUNK_SIZE);
                try {
                    await sheets.spreadsheets.values.batchUpdate({
                        spreadsheetId: spreadsheetId,
                        resource: {
                            data: chunk,
                            valueInputOption: 'RAW'
                        }
                    });
                    console.log(`   - Chunk ${i} done.`);
                } catch (err) {
                    console.error(`   - Chunk ${i} failed:`, err.message);
                    if (err.message.includes('Quota')) {
                        console.log("   - Backing off...");
                        await new Promise(r => setTimeout(r, 10000));
                    }
                }
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        console.log("✅ Sync Done.");
    } catch (e) {
        console.error("Global Error:", e);
    }
}

forceSync();

