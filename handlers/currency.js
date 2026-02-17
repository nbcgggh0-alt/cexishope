const db = require('../utils/database');
const { Markup } = require('telegraf');
const { fetchExchangeRates, convertPrice } = require('../utils/currencyHelper');

async function handleSetCurrency(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  // Pre-fetch rates to ensure we have data
  await fetchExchangeRates();

  const buttons = [
    [Markup.button.callback('🇲🇾 MYR (Malaysian Ringgit)', 'currency_MYR')],
    [Markup.button.callback('🇮🇩 IDR (Indonesian Rupiah)', 'currency_IDR')],
    [Markup.button.callback('🇺🇸 USD (US Dollar)', 'currency_USD')],
    [Markup.button.callback('🇸🇬 SGD (Singapore Dollar)', 'currency_SGD')],
    [Markup.button.callback('🇨🇳 CNY (Chinese Yuan)', 'currency_CNY')]
  ];

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'main_menu')]);

  const messages = {
    ms: '💱 *Pilih Mata Wang*\n\nSila pilih mata wang pilihan anda. Harga produk akan dipaparkan mengikut mata wang ini.',
    en: '💱 *Select Currency*\n\nPlease select your preferred currency. Product prices will be displayed in this currency.',
    zh: '💱 *选择货币*\n\n请选择您的首选货币：',
    ta: '💱 *நாணயத்தை தேர்ந்தெடுக்கவும்*\n\nஉங்கள் விருப்ப நாணயத்தை தேர்ந்தெடுக்கவும்:'
  };

  await ctx.reply(messages[lang] || messages.en, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCurrencySelect(ctx, currency) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  await db.updateUser(userId, { currency: currency });

  // Calculate a sample conversion to show user
  const sampleRate = await convertPrice(1, currency);

  const messages = {
    ms: `✅ Mata wang ditukar kepada *${currency}*\n\n1 MYR ≈ ${sampleRate} ${currency}`,
    en: `✅ Currency changed to *${currency}*\n\n1 MYR ≈ ${sampleRate} ${currency}`,
  };

  await ctx.answerCbQuery(messages[lang] || messages.en);

  // Optionally edit the message to show confirmation
  try {
    await ctx.editMessageText(messages[lang] || messages.en, { parse_mode: 'Markdown' });
  } catch (e) {
    // Ignore if message too old
  }
}

const fs = require('fs');
const path = require('path');
const config = require('../config');
const CUSTOM_FILE = path.join(__dirname, '../currency_custom.json');

// ... existing user handlers ...

// --- ADMIN HANDLERS ---

async function handleAdminRates(ctx) {
  if (ctx.from.id.toString() !== config.ownerId) return;

  const CurrencyEngine = require('../utils/currency/CurrencyEngine');
  const rates = await CurrencyEngine.getRates('MYR');

  // Read Manual Overrides to highlight them
  let manuals = {};
  if (fs.existsSync(CUSTOM_FILE)) {
    try { manuals = JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf8')); } catch (e) { }
  }

  // Top currencies to display
  const display = ['USD', 'SGD', 'IDR', 'CNY', 'THB', 'VND', 'EUR', 'GBP', 'SAR', 'TRY', 'BTC', 'ETH', 'USDT'];

  let msg = `🦁 *Hydra Currency Engine Status*\n\n`;
  msg += `📡 *Active Providers:* ${CurrencyEngine.providers.length}\n`;
  msg += `🕰 *Last Update:* ${new Date(CurrencyEngine.cache.timestamp).toLocaleTimeString()}\n\n`;

  msg += `💱 *Current Rates (1 MYR = ?)*\n`;
  msg += `\`------------------\`\n`;

  display.forEach(c => {
    const isManual = manuals[c] !== undefined;
    const icon = isManual ? '🛠 ' : '  ';
    const rate = rates[c] ? rates[c] : 'N/A';
    msg += `${icon}*${c}:* \`${rate}\`\n`;
  });

  msg += `\`------------------\`\n\n`;
  msg += `*Commands:*\n`;
  msg += `• \`/setrate [CURR] [VAL]\` - Set manual rate\n`;
  msg += `• \`/resetrate [CURR]\` - Remove manual rate\n`;
  msg += `• \`/updaterates\` - Force refresh`;

  // Add Refresh Button
  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      Markup.button.callback('🔄 Force Refresh', 'force_update_rates')
    ])
  });
}

async function handleSetRate(ctx) {
  if (ctx.from.id.toString() !== config.ownerId) return;

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    return ctx.reply('⚠️ Usage: `/setrate [CURRENCY] [VALUE]`\nExample: `/setrate USD 0.25`', { parse_mode: 'Markdown' });
  }

  const currency = args[1].toUpperCase();
  const rate = parseFloat(args[2]);

  if (isNaN(rate)) return ctx.reply('⚠️ Invalid rate value.');

  try {
    let manuals = {};
    if (fs.existsSync(CUSTOM_FILE)) {
      manuals = JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf8'));
    }

    manuals[currency] = rate;
    fs.writeFileSync(CUSTOM_FILE, JSON.stringify(manuals, null, 2));

    // Force Clear Cache
    const CurrencyEngine = require('../utils/currency/CurrencyEngine');
    CurrencyEngine.cache.rates = null;

    ctx.reply(`✅ *Manual Rate Set!*\n\n1 MYR = ${rate} ${currency}\n(This will override all scrapers)`, { parse_mode: 'Markdown' });
  } catch (e) {
    ctx.reply(`❌ Error saving rate: ${e.message}`);
  }
}

async function handleResetRate(ctx) {
  if (ctx.from.id.toString() !== config.ownerId) return;

  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('⚠️ Usage: `/resetrate [CURRENCY]`', { parse_mode: 'Markdown' });
  }

  const currency = args[1].toUpperCase();

  try {
    let manuals = {};
    if (fs.existsSync(CUSTOM_FILE)) {
      manuals = JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf8'));
    }

    if (manuals[currency]) {
      delete manuals[currency];
      fs.writeFileSync(CUSTOM_FILE, JSON.stringify(manuals, null, 2));

      // Force Clear Cache
      const CurrencyEngine = require('../utils/currency/CurrencyEngine');
      CurrencyEngine.cache.rates = null;

      ctx.reply(`✅ *Manual Rate Removed!*\nReverting to scraped data for ${currency}.`, { parse_mode: 'Markdown' });
    } else {
      ctx.reply(`⚠️ No manual rate found for ${currency}.`);
    }
  } catch (e) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
}

async function handleForceUpdateRates(ctx) {
  if (ctx.from.id.toString() !== config.ownerId) return; // Security check

  const CurrencyEngine = require('../utils/currency/CurrencyEngine');
  CurrencyEngine.cache.rates = null; // Clear cache

  await ctx.reply('🔄 *Forcing Hydra Engine Update...*\nFetching from 100+ sources...', { parse_mode: 'Markdown' });

  try {
    await CurrencyEngine.getRates('MYR');
    await ctx.reply('✅ *Update Complete!*');
    // Redirect to dashboard
    handleAdminRates(ctx);
  } catch (e) {
    ctx.reply(`❌ Update Failed: ${e.message}`);
  }
}


module.exports = {
  handleSetCurrency,
  handleCurrencySelect,
  handleAdminRates,
  handleSetRate,
  handleResetRate,
  handleForceUpdateRates
};
