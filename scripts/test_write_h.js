
import { google } from 'googleapis';
import fs from 'fs';

const SERVICE_ACCOUNT_FILE = './credentials.json';
const SPREADSHEET_ID = '1234567890abcdef'; // Placeholder, will read from env or assume user knows
// I need the actual ID. I'll construct the manager style.

async function testWrite() {
    try {
        const content = fs.readFileSync(SERVICE_ACCOUNT_FILE);
        const credentials = JSON.parse(content);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        // Lire ID depuis bridge.js ou env si possible, sinon hardcode celui du user s'il est connu
        // Je vais lire le .env
        const envFile = fs.readFileSync('.env', 'utf8');
        const sheetIdLine = envFile.split('\n').find(l => l.startsWith('SPREADSHEET_ID='));
        const realSheetId = sheetIdLine.split('=')[1].trim();

        console.log(`Testing write on Sheet ID: ${realSheetId}`);

        // Target: 'fr metropole'!H5
        // J'essaie d'écrire "TEST SCRIPT"

        await sheets.spreadsheets.values.update({
            spreadsheetId: realSheetId,
            range: "'fr metropole'!H5",
            valueInputOption: 'RAW',
            requestBody: {
                values: [['🔴 TEST SCRIPT']]
            }
        });

        console.log("✅ Write success on H5!");

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

testWrite();
