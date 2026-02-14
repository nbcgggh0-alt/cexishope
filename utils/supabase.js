const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
    console.error('⚠️ Missing Supabase URL or Key in config.js');
}

const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_KEY,
    {
        auth: {
            persistSession: false
        }
    }
);

module.exports = supabase;
