
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Helper to read .env
function getEnv() {
    try {
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
        return envConfig;
    } catch (e) {
        return process.env;
    }
}

const env = getEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    console.log("🔍 INSPECTING CLIENT TABLE COLUMNS...");
    const { data, error } = await supabase.from('clients').select('*').limit(1);

    if (error) {
        console.error("❌ ERROR:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("✅ COLUMNS FOUND:");
        console.log(Object.keys(data[0]).join('\n'));
    } else {
        console.log("⚠️ Table empty or no access.");
    }
}

inspect();
