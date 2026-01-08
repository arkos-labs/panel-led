import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.log("❌ Credentials manquants");
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    // 1. Total Clients
    const { count: total, error } = await supabase.from('clients').select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Erreur:", error.message);
        return;
    }

    // 2. Clients with valid GPS
    const { data: clients } = await supabase.from('clients').select('gps, adresse_brute');

    let valid = 0;
    let missing = 0;

    clients.forEach(c => {
        let hasGps = false;
        if (c.gps) {
            if (typeof c.gps === 'object' && c.gps.lat) hasGps = true;
            if (typeof c.gps === 'string' && c.gps.length > 5) hasGps = true;
        }

        if (hasGps) valid++;
        else missing++;
    });

    console.log(`📊 BILAN ADRESSES :`);
    console.log(`-------------------`);
    console.log(`✅ Adresses trouvées : ${valid}`);
    console.log(`❌ Adresses introuvables : ${missing}`);
    console.log(`-------------------`);
    console.log(`TOTAL CLIENTS : ${total}`);
}

check();
