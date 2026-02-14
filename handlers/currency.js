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

module.exports = {
  handleSetCurrency,
  handleCurrencySelect
};
