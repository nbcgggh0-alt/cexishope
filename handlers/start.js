const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { safeEditMessage } = require('../utils/messageHelper');

async function handleStart(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  let user = await db.getUser(userId);

  if (!user) {
    user = await db.addUser({
      id: userId,
      username: username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name
    });
  }

  if (!user) {
    await ctx.reply('Error creating user account. Please try again.');
    return;
  }

  const lang = user.language || 'ms';
  const settings = await db.getSettings();
  const admins = await db.getAdmins();

  const isOwner = admins.owner === userId;
  const isAdmin = admins.admins.includes(userId);

  const welcomeText = settings?.welcomeMedia?.caption?.[lang] ||
    (lang === 'ms' ? 'Selamat datang ke CexiStore Ultimate Pro! 🛍️' : 'Welcome to CexiStore Ultimate Pro! 🛍️');

  const buttons = [
    [Markup.button.callback(t('btnBuyProducts', lang), 'buy_products')],
    [Markup.button.callback(t('btnMyOrders', lang), 'my_orders')],
    [Markup.button.callback(t('btnSupport', lang), 'support')],
    [Markup.button.callback('📋 Search Order / Cari Pesanan', 'search_orders'), Markup.button.callback('❓ FAQ', 'view_faq')],
    [Markup.button.callback('📖 Guide / Panduan', 'user_guide')],
    [Markup.button.callback(lang === 'ms' ? '⚙️ Tetapan / Settings' : '⚙️ Settings', 'settings_menu')]
  ];

  if (isAdmin || isOwner) {
    buttons.push([Markup.button.callback(t('btnAdminPanel', lang), 'admin_panel')]);
  }

  if (isOwner) {
    buttons.push([Markup.button.callback(t('btnOwnerPanel', lang), 'owner_panel')]);
  }

  try {
    const videoPath = './attached_assets/VID-20251016-WA0053_1760629558789.mp4';
    const fs = require('fs');

    if (fs.existsSync(videoPath)) {
      await ctx.replyWithVideo(
        { source: videoPath },
        {
          caption: welcomeText,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } else if (settings.welcomeMedia?.path && settings.welcomeMedia?.type === 'image') {
      await ctx.replyWithPhoto(
        { source: settings.welcomeMedia.path },
        {
          caption: welcomeText,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } else if (settings.welcomeMedia?.path && settings.welcomeMedia?.type === 'video') {
      await ctx.replyWithVideo(
        { source: settings.welcomeMedia.path },
        {
          caption: welcomeText,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } else {
      await ctx.reply(welcomeText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    }
  } catch (error) {
    console.error('Error sending welcome media:', error);
    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  }
}

async function handleMainMenu(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const admins = await db.getAdmins();

  const isOwner = admins.owner === userId;
  const isAdmin = admins.admins.includes(userId);

  const buttons = [
    [Markup.button.callback(t('btnBuyProducts', lang), 'buy_products')],
    [Markup.button.callback(t('btnMyOrders', lang), 'my_orders')],
    [Markup.button.callback(t('btnSupport', lang), 'support')],
    [Markup.button.callback('📋 Search Order / Cari Pesanan', 'search_orders'), Markup.button.callback('❓ FAQ', 'view_faq')],
    [Markup.button.callback('📖 Guide / Panduan', 'user_guide')],
    [Markup.button.callback(lang === 'ms' ? '⚙️ Tetapan / Settings' : '⚙️ Settings', 'settings_menu')]
  ];

  if (isAdmin || isOwner) {
    buttons.push([Markup.button.callback(t('btnAdminPanel', lang), 'admin_panel')]);
  }

  if (isOwner) {
    buttons.push([Markup.button.callback(t('btnOwnerPanel', lang), 'owner_panel')]);
  }

  await safeEditMessage(ctx, t('mainMenu', lang), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleSettingsMenu(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🌐 Bahasa / Language' : '🌐 Language', 'toggle_language')],
    [Markup.button.callback(lang === 'ms' ? '💱 Mata Wang / Currency' : '💱 Currency', 'set_currency')],
    [Markup.button.callback(t('btnBack', lang), 'main_menu')]
  ];

  const message = lang === 'ms'
    ? '⚙️ *Tetapan*\n\nSila pilih tetapan yang anda mahu ubah:'
    : '⚙️ *Settings*\n\nPlease select the setting you want to change:';

  await safeEditMessage(ctx, message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleLanguageToggle(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const currentLang = user?.language || 'ms';

  const buttons = [
    [Markup.button.callback('🇲🇾 Bahasa Melayu', 'lang_ms')],
    [Markup.button.callback('🇬🇧 English', 'lang_en')],
    [Markup.button.callback('🇨🇳 中文 (Mandarin)', 'lang_zh')],
    [Markup.button.callback('🇮🇳 தமிழ் (Tamil)', 'lang_ta')],
    [Markup.button.callback(t('btnBack', currentLang), 'settings_menu')]
  ];

  const message = {
    ms: '🌐 *Pilih Bahasa*\n\nSila pilih bahasa pilihan anda:',
    en: '🌐 *Select Language*\n\nPlease select your preferred language:',
    zh: '🌐 *选择语言*\n\n请选择您的首选语言：',
    ta: '🌐 *மொழியைத் தேர்ந்தெடுக்கவும்*\n\nஉங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும்:'
  }[currentLang] || '🌐 *Select Language*\n\nPlease select your preferred language:';

  await safeEditMessage(ctx, message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleLanguageSelect(ctx, lang) {
  const userId = ctx.from.id;
  await db.updateUser(userId, { language: lang });

  const message = {
    ms: '✅ Bahasa telah ditukar kepada Bahasa Melayu',
    en: '✅ Language changed to English',
    zh: '✅ 语言已更改为中文',
    ta: '✅ மொழி தமிழாக மாற்றப்பட்டது'
  }[lang];

  await ctx.answerCbQuery(message);
  await handleSettingsMenu(ctx);
}

module.exports = {
  handleStart,
  handleMainMenu,
  handleSettingsMenu,
  handleLanguageToggle,
  handleLanguageSelect
};
