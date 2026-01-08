
import { google } from 'googleapis';
import fs from 'fs';

async function listTabs() {
    const content = fs.readFileSync('./credentials.json');
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(content),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Read ID from file if possible, hardcoded here for speed if you want, or read env
    // I'll reuse the logic from before or assume env var is set if run with dotenv (but I'm manual parsing)
    // Quick hack: Read .env again
    const envContent = fs.readFileSync('.env', 'utf8');
    const sheetId = envContent.split('\n').find(l => l.startsWith('SPREADSHEET_ID='))?.split('=')[1]?.trim();

    const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    console.log("TABS FOUND:");
    res.data.sheets.forEach(s => {
        console.log(`- "${s.properties.title}" (ID: ${s.properties.sheetId})`);
    });
}
listTabs();
