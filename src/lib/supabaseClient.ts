
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

// Aggressive cleanup to handle copy-paste errors (newlines, extra text)
const cleanKey = (key: string | undefined) => {
    if (!key) return '';
    // Split by newline or whitespace and take the first part
    // This handles cases where user pasted "KEY=value\nANOTHER=value"
    return key.trim().split(/\s+/)[0];
};

export const supabase = createClient(
    cleanKey(supabaseUrl),
    cleanKey(supabaseAnonKey)
);
