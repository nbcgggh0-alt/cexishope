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
  handleLanguageSelect,
  // New Guide Handlers
  handleGuideMenu,
  handleUserGuide,
  handleAdminGuide,
  handleOwnerGuide
};

async function handleGuideMenu(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const admins = await db.getAdmins();

  const isOwner = admins.owner === userId;
  const isAdmin = admins.admins.includes(userId);

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '👤 Panduan Pengguna' : '👤 User Guide', 'guide_user')]
  ];

  if (isAdmin || isOwner) {
    buttons.push([Markup.button.callback(lang === 'ms' ? '⚙️ Panduan Admin' : '⚙️ Admin Guide', 'guide_admin')]);
  }

  if (isOwner) {
    buttons.push([Markup.button.callback(lang === 'ms' ? '👑 Panduan Owner' : '👑 Owner Guide', 'guide_owner')]);
  }

  buttons.push([Markup.button.callback(t('btnBack', lang), 'main_menu')]);

  const message = lang === 'ms'
    ? '📚 *Pusat Bantuan*\n\nSila pilih panduan yang anda perlukan:'
    : '📚 *Help Center*\n\nPlease select the guide you need:';

  await safeEditMessage(ctx, message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleUserGuide(ctx) {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  const guideText = lang === 'ms'
    ? `📖 *PANDUAN PENGGUNAAN BOT*

🛍️ *Cara Membeli Produk:*
1. Klik butang "Beli Produk" di menu utama
2. Pilih kategori produk yang anda inginkan
3. Pilih produk yang anda mahu beli
4. Klik "Beli Sekarang"
5. Ikut arahan untuk membuat pembayaran

💳 *Cara Membuat Pembayaran:*
1. Selepas klik "Beli Sekarang", anda akan terima maklumat pembayaran
2. Buat pembayaran melalui online banking atau e-wallet
3. Ambil screenshot bukti pembayaran anda

📸 *Cara Hantar Bukti Pembayaran:*
1. Gunakan arahan: \`/send [order_id]\`
2. Contoh: \`/send ORD-ABC123\`
3. Attach gambar bukti pembayaran anda
4. Admin akan sahkan pembayaran anda

📋 *Cara Lihat Pesanan:*
• Klik "Pesanan Saya" di menu utama
• Atau gunakan \`/searchorder [order_id]\` untuk cari pesanan tertentu

💬 *Cara Hubungi Support:*
• Klik butang "Support" di menu utama
• Hantar mesej anda kepada admin
• Untuk keluar, klik "Keluar dari Sesi"

⚡ *Arahan Yang Ada Untuk Pengguna:*
• \`/start\` - Kembali ke menu utama
• \`/send [order_id]\` - Hantar bukti pembayaran
• \`/searchorder [order_id]\` - Cari pesanan
• \`/faq\` - Lihat soalan lazim
• \`/ping\` - Semak maklumat runtime sistem
• \`/list\` - Lihat semua arahan

❓ Jika ada masalah, sila hubungi admin melalui Support!`
    : `📖 *BOT USAGE GUIDE*

🛍️ *How to Buy Products:*
1. Click "Buy Products" button in main menu
2. Select the product category you want
3. Choose the product you want to buy
4. Click "Buy Now"
5. Follow the instructions to make payment

💳 *How to Make Payment:*
1. After clicking "Buy Now", you will receive payment information
2. Make payment via online banking or e-wallet
3. Take a screenshot of your payment proof

📸 *How to Send Payment Proof:*
1. Use command: \`/send [order_id]\`
2. Example: \`/send ORD-ABC123\`
3. Attach your payment proof image
4. Admin will verify your payment

📋 *How to View Orders:*
• Click "My Orders" in main menu
• Or use \`/searchorder [order_id]\` to search specific order

💬 *How to Contact Support:*
• Click "Support" button in main menu
• Send your message to admin
• To exit, click "Leave Session"

⚡ *Available Commands for Users:*
• \`/start\` - Return to main menu
• \`/send [order_id]\` - Send payment proof
• \`/searchorder [order_id]\` - Search order
• \`/faq\` - View FAQ
• \`/ping\` - Check system runtime info
• \`/list\` - View all commands

❓ If you have any issues, please contact admin via Support!`;

  await safeEditMessage(ctx, guideText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'user_guide')]
    ])
  });
}

async function handleAdminGuide(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? `⚙️ *PANDUAN ADMIN*

📦 *Urus Pesanan:*
• \`/verify [order_id]\` - Sahkan pesanan & tolak stok
• \`/reject [order_id]\` - Tolak pesanan
• \`/searchorder [query]\` - Cari pesanan
• \`/filterorders\` - Tapis pesanan (Pending/Completed)

🛍️ *Urus Produk:*
• \`/addproduct\` - Tambah produk baru
• \`/addcategory [nama]\` - Tambah kategori
• \`/additem [prod_id] | [data]\` - Tambah stok auto
• \`/duplicate [prod_id]\` - Duplicate produk
• \`/adjuststock [id] [qty]\` - Betulkan stok manual

👥 *Urus Pengguna:*
• \`/ban [user_id] [sebab]\` - Sekat pengguna
• \`/unban [user_id]\` - Nyahsekat
• \`/tag [user_id] [tag]\` - Tag pengguna (VIP/Reseller)
• \`/users\` - Cari pengguna

💬 *Support & Broadcast:*
• \`/join [token]\` - Masuk sesi support
• \`/broadcast\` - Hantar mesej ke semua user`
    : `⚙️ *ADMIN GUIDE*

📦 *Manage Orders:*
• \`/verify [order_id]\` - Verify order & deduct stock
• \`/reject [order_id]\` - Reject order
• \`/searchorder [query]\` - Search orders
• \`/filterorders\` - Filter orders (Pending/Completed)

🛍️ *Manage Products:*
• \`/addproduct\` - Add new product
• \`/addcategory [name]\` - Add category
• \`/additem [prod_id] | [data]\` - Add auto stock
• \`/duplicate [prod_id]\` - Duplicate product
• \`/adjuststock [id] [qty]\` - Adjust manual stock

👥 *Manage Users:*
• \`/ban [user_id] [reason]\` - Ban user
• \`/unban [user_id]\` - Unban
• \`/tag [user_id] [tag]\` - Tag user (VIP/Reseller)
• \`/users\` - Search users

💬 *Support & Broadcast:*
• \`/join [token]\` - Join support session
• \`/broadcast\` - Send message to all users`;

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'user_guide')]
    ])
  });
}

async function handleOwnerGuide(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? `👑 *PANDUAN OWNER*

🔐 *Akses Penuh:*
• \`/addadmin [user_id]\` - Lantik admin baru
• \`/removeadmin [user_id]\` - Buang admin
• \`/setowner\` - Pindah hak milik bot

⚙️ *Sistem & Tetapan:*
• Klik "System Panel" di menu utama
• \`/backupnow\` - Buat backup database segera
• \`/upserver\` - Tambah panel Pterodactyl
• \`/update\` - Update bot dari GitHub

📊 *Analitik:*
• Klik "Analytics" untuk lihat graf jualan
• \`/analytics\` - Ringkasan prestasi bisnes

💡 *Tips:*
Owner mempunyai akses penuh ke semua fungsi Admin + fungsi kritikal sistem.`
    : `👑 *OWNER GUIDE*

🔐 *Full Access:*
• \`/addadmin [user_id]\` - Appoint new admin
• \`/removeadmin [user_id]\` - Remove admin
• \`/setowner\` - Transfer bot ownership

⚙️ *System & Settings:*
• Click "System Panel" in main menu
• \`/backupnow\` - Create instant DB backup
• \`/upserver\` - Add Pterodactyl panel
• \`/update\` - Update bot from GitHub

📊 *Analytics:*
• Click "Analytics" to view sales graphs
• \`/analytics\` - Business performance summary

💡 *Tips:*
Owner has full access to all Admin functions + critical system functions.`;

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'user_guide')]
    ])
  });
}
