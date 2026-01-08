
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
// Note: Normally DDL requires service_role key, but if RLS is permissive or user is owner, anon might work via RPC if exposed, 
// OR we rely on the fact that we might have the service key in process.env.SUPABASE_SERVICE_ROLE_KEY (from server usage).
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function initDB() {
    console.log("Initializing Messages Table...");

    // Quick check if we can run SQL via RPC (if installed)
    // If not, we iterate or assume. 
    // Actually, asking the user to run SQL in the dashboard SQL editor is standard if we don't have direct SQL access.
    // BUT we can try using the 'postgres' access via Supabase Management API if we had the access token, which we don't.
    // We only have the client keys.

    // However, if we use the MCP tool 'execute_sql', we can do it. The MCP failed earlier.
    // I will try to use the MCP tool AGAIN via the standard text response to the user if this script fails.

    // Let's try to create the table using a standard fetch to the specialized endpoint if it existed in server.js?
    // No.

    // I will simply output the SQL needed and tell the user I added the UI.
    // BUT, I can try to use the client to see if the table exists (select).

    const { error } = await supabase.from('messages').select('count').limit(1);

    if (error && error.code === '42P01') { // undefined_table
        console.log("⚠️ Table 'messages' does not exist.");
        console.log("Please run the following SQL in your Supabase SQL Editor:");
        console.log(`
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  driver_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('from_driver', 'to_driver')),
  content TEXT NOT NULL,
  sender_name TEXT,
  is_read BOOLEAN DEFAULT FALSE
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON messages FOR ALL USING (true) WITH CHECK (true);
        `);
    } else if (!error) {
        console.log("✅ Table 'messages' exists.");
    } else {
        console.error("Error checking table:", error);
    }
}

initDB();
