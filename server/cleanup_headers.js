
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log("Cleaning up header rows...");
    const { error } = await supabase.from('clients').delete().ilike('nom', '%NOM%');
    if (error) console.error(error);
    else console.log("Header rows deleted.");

    const { error: error2 } = await supabase.from('clients').delete().ilike('nom', '%SIGNATURE%');
    if (error2) console.error(error2);
    else console.log("Signature header rows deleted.");
}
cleanup();
