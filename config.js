require('dotenv').config();

// Validate required environment variables
const required = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY', 'OWNER_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    console.error('   Please set it in your .env file or environment.');
    process.exit(1);
  }
}

module.exports = {
  // All secrets from environment variables only
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,

  // Owner Telegram ID
  OWNER_ID: parseInt(process.env.OWNER_ID),
  ownerId: process.env.OWNER_ID, // Alias for backward compatibility

  // Channel ID for Transaction Notifications (Optional)
  TRANSACTION_CHANNEL_ID: process.env.TRANSACTION_CHANNEL_ID,

  // Web Server Port (Chat UI)
  WEB_PORT: process.env.WEB_PORT || 3000,
  WEB_URL: process.env.WEB_URL || `http://127.0.0.1:${process.env.WEB_PORT || 3000}`,

  store: {
    name: process.env.STORE_NAME || 'CexiStore Ultimate Pro',
    currency: process.env.STORE_CURRENCY || 'MYR',
    supportedCurrencies: ['MYR', 'USD', 'SGD', 'IDR', 'CNY'],
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '14400000')
  },

  // Optional: Exchange Rate API Key (if you have a paid plan)
  exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY || null,

  backup: {
    interval: 300000,
    enabled: true,
    maxBackupFiles: 50
  },

  autoPromote: {
    enabled: true,
    defaultInterval: 3600000
  },

  paths: {
    data: './data',
    media: './media',
    qr: './qr',
    logs: './logs'
  }
};
