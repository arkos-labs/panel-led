
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

const SHEET_ID = envConfig.SPREADSHEET_ID;

async function diagnose() {
    console.log("🔍 DIAGNOSTIC TOOL v1.0");
    console.log(`📂 Target Sheet ID: ${SHEET_ID}`);

    const content = fs.readFileSync('./credentials.json');
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(content),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // 1. LIST TABS
    console.log("\n📑 LISTING TABS...");
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });

    let targetTab = "";

    meta.data.sheets.forEach(s => {
        const title = s.properties.title;
        console.log(`   - "${title}" (length: ${title.length})`);
        if (title.trim().toLowerCase().includes("metropole")) {
            targetTab = title;
            console.log("     🎯 FOUND TARGET TAB MATCH!");
        }
    });

    if (!targetTab) {
        console.error("❌ TAB NOT FOUND (fr metropole)!");
        return;
    }

    // 2. READ DATA
    console.log(`\n📖 READING DATA from "${targetTab}"...`);
    // Read A3:H10 (Headers + First few rows)
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${targetTab}'!A3:H10`
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log("❌ ZERO DATA FOUND.");
    } else {
        console.log(`✅ READ SUCCESS. ${rows.length} rows retrieved.`);
        rows.forEach((row, i) => {
            console.log(`   Row ${i + 3}: [${row.join(' | ')}]`);
        });
    }
}

diagnose();
