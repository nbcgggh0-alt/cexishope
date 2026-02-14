require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkColumn() {
  console.log('Checking database schema...');
  // We can't easily check schema via client without permissions on information_schema usually.
  // But we can try to select the column from a row.
  const { data, error } = await supabase.from('cexi_users').select('currency').limit(1);
  
  if (error) {
    console.error('❌ Error selecting currency column:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('⚠️ Column "currency" is MISSING.');
    }
  } else {
    console.log('✅ Column "currency" exists. Access successful.');
  }
}

checkColumn();
