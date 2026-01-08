
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testInsert() {
    console.log("--- TEST CALENDAR INSERT ---");

    // Check Env
    const CALENDAR_ID = process.env.CALENDAR_ID_LIVRAISONS;
    console.log("Calendar ID:", CALENDAR_ID);

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.error("❌ Missing Credentials in .env");
        return;
    }

    try {
        const jwtClient = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/calendar']
        );

        await jwtClient.authorize();
        console.log("✅ Auth Successful");

        const calendar = google.calendar({ version: 'v3', auth: jwtClient });

        const now = new Date();
        const end = new Date(now.getTime() + 30 * 60000);

        const event = {
            summary: "TEST DEBUG INSERT " + now.toISOString(),
            description: "If you see this, the API works.",
            start: { dateTime: now.toISOString() },
            end: { dateTime: end.toISOString() }
        };

        console.log("Attempting insert...");
        const res = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            requestBody: event
        });

        console.log("✅ Insert Success! Event ID:", res.data.id);
        console.log("Link:", res.data.htmlLink);

    } catch (e) {
        console.error("❌ INSERT FAILED:", e.message);
        if (e.response) {
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

testInsert();
