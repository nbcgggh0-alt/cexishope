const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { safeEditMessage } = require('../utils/messageHelper');
const { logAdminAction } = require('../utils/adminLogger');
const { safeNum } = require('../utils/helpers');

async function isOwner(userId) {
  const admins = await db.getAdmins();
  return admins.owner === userId;
}


async function handleOwnerPanel(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    await ctx.answerCbQuery(t('unauthorized', lang));
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📊 Dashboard' : '📊 Dashboard', 'owner_dashboard')],
    [Markup.button.callback(t('btnManageAdmins', lang), 'owner_admins')],
    [Markup.button.callback(lang === 'ms' ? '🔐 Admin Permissions' : '🔐 Admin Permissions', 'perm_management')],
    [Markup.button.callback(t('btnStoreSettings', lang), 'owner_settings')],
    [Markup.button.callback(t('btnBackup', lang), 'owner_backup')],
    [
      Markup.button.callback(lang === 'en' ? '📢 Auto Promote' : '📢 Auto Promosi', 'auto_promote_panel'),
      Markup.button.callback(lang === 'en' ? '⚙️ System Functions' : '⚙️ Fungsi Sistem', 'system_panel')
    ],
    [Markup.button.callback('📊 Analytics / Analitik', 'owner_analytics'), Markup.button.callback('🔧 Advanced Settings / Tetapan Lanjutan', 'owner_advanced')],
    [Markup.button.callback(lang === 'ms' ? '📥 Semak Kemas Kini' : '📥 Check Updates', 'check_update')],
    [Markup.button.callback(t('btnBack', lang), 'main_menu')]
  ];

  await safeEditMessage(ctx, t('ownerPanel', lang), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleOwnerAdmins(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const admins = await db.getAdmins();

  let text = '👥 *Admin Management*\n\n';
  text += `👑 Owner: ${admins.owner || 'Not set'}\n\n`;

  if (admins.admins.length > 0) {
    text += '👨‍💼 Admins:\n';
    admins.admins.forEach(adminId => {
      text += `• ${adminId}\n`;
    });
  } else {
    text += 'No admins added yet.\n';
  }

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '➕ Tambah Admin' : '➕ Add Admin', 'flow_add_admin')],
      [Markup.button.callback(lang === 'ms' ? '🗑️ Keluarkan Admin' : '🗑️ Remove Admin', 'flow_remove_admin')],
      [Markup.button.callback(lang === 'ms' ? '🔐 Permissions' : '🔐 Permissions', 'perm_management')],
      [Markup.button.callback(t('btnBack', lang), 'owner_panel')]
    ])
  });
}

async function handleSetOwner(ctx) {
  const userId = ctx.from.id;
  const admins = await db.getAdmins();

  if (admins.owner && admins.owner !== userId) {
    await ctx.reply('Owner already set. Only current owner can change this.');
    return;
  }

  admins.owner = userId;
  await db.saveAdmins(admins);

  await ctx.reply(`✅ You are now set as the owner!`);
}

async function handleAddAdmin(ctx, adminId) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const admins = await db.getAdmins();

  if (admins.admins.includes(parseInt(adminId))) {
    await ctx.reply('User is already an admin');
    return;
  }

  admins.admins.push(parseInt(adminId));
  await db.saveAdmins(admins);

  await logAdminAction(userId, 'Added Admin', `User ${adminId} was added as admin`);

  await ctx.reply(`✅ Admin ${adminId} added successfully!`);
}

async function handleRemoveAdmin(ctx, adminId) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const admins = await db.getAdmins();
  admins.admins = admins.admins.filter(id => id !== parseInt(adminId));
  await db.saveAdmins(admins);

  await logAdminAction(userId, 'Removed Admin', `User ${adminId} was removed as admin`);

  await ctx.reply(`✅ Admin ${adminId} removed successfully!`);
}

async function handleOwnerSettings(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();

  const welcomeMediaStatus = settings.welcomeMedia?.path ? '✅ Enabled' : '❌ Disabled';
  const qrPaymentStatus = settings.qrPayment?.path ? '✅ Enabled' : '❌ Disabled';
  const sessionTimeoutHours = safeNum(settings.sessionTimeout / 3600000).toFixed(1);

  const text = lang === 'en'
    ? `⚙️ *Store Settings*\n\n` +
    `🏪 Store Name: ${settings.storeName}\n\n` +
    `📸 Welcome Media: ${welcomeMediaStatus}\n` +
    `💳 QR Payment: ${qrPaymentStatus}\n` +
    `⏱️ Session Timeout: ${sessionTimeoutHours} hours\n` +
    `🌐 Default Language: ${settings.defaultLanguage.toUpperCase()}\n` +
    `🔧 Maintenance Mode: ${settings.maintenanceMode ? 'ON' : 'OFF'}`
    : `⚙️ *Tetapan Kedai*\n\n` +
    `🏪 Nama Kedai: ${settings.storeName}\n\n` +
    `📸 Media Alu-aluan: ${welcomeMediaStatus}\n` +
    `💳 Pembayaran QR: ${qrPaymentStatus}\n` +
    `⏱️ Tamat Sesi: ${sessionTimeoutHours} jam\n` +
    `🌐 Bahasa Lalai: ${settings.defaultLanguage.toUpperCase()}\n` +
    `🔧 Mod Penyelenggaraan: ${settings.maintenanceMode ? 'HIDUP' : 'MATI'}`;

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('btnBack', lang), 'owner_panel')]
    ])
  });
}

async function handleOwnerBackup(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = lang === 'en'
    ? '💾 *Backup & Restore*\n\n✅ Data is now securely stored in Supabase Cloud.\n\nAutomatic daily backups are handled by Supabase Platform.\n\nNo manual action required.'
    : '💾 *Backup & Pulih*\n\n✅ Data kini disimpan dengan selamat di Supabase Cloud.\n\nBackup harian automatik diuruskan oleh Platform Supabase.\n\nTiada tindakan manual diperlukan.';

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('btnBack', lang), 'owner_panel')]
    ])
  });
}




async function handleOwnerAnalytics(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const users = await db.getUsers();
  const transactions = await db.getTransactions();
  const products = await db.getProducts();

  const totalUsers = users.length;
  const totalOrders = transactions.length;
  const completedOrders = transactions.filter(t => t.status === 'completed').length;
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification').length;
  const totalRevenue = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.price, 0);
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.active).length;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? `📊 *Analitik Kedai*\n\n` +
    `👥 Jumlah Pengguna: ${totalUsers}\n` +
    `📦 Jumlah Produk: ${totalProducts} (${activeProducts} aktif)\n` +
    `📋 Jumlah Pesanan: ${totalOrders}\n` +
    `✅ Pesanan Selesai: ${completedOrders}\n` +
    `⏳ Pesanan Pending: ${pendingOrders}\n` +
    `💰 Jumlah Hasil: RM${safeNum(totalRevenue).toFixed(2)}\n` +
    `📈 Kadar Kejayaan: ${totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0}%`
    : `📊 *Store Analytics*\n\n` +
    `👥 Total Users: ${totalUsers}\n` +
    `📦 Total Products: ${totalProducts} (${activeProducts} active)\n` +
    `📋 Total Orders: ${totalOrders}\n` +
    `✅ Completed Orders: ${completedOrders}\n` +
    `⏳ Pending Orders: ${pendingOrders}\n` +
    `💰 Total Revenue: RM${safeNum(totalRevenue).toFixed(2)}\n` +
    `📈 Success Rate: ${totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0}%`;

  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'owner_panel')]])
  });
}

async function handleOwnerAdvanced(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? '🔧 *Tetapan Lanjutan*\n\n' +
    '*Pengurusan Produk Lanjutan:*\n' +
    '`/duplicate [product_id]` - Salin produk\n' +
    '`/inventory [product_id]` - Sejarah inventori\n' +
    '`/adjuststock [product_id] [+/-number] [note]` - Laraskan stok\n\n' +
    '*Pengurusan Mata Wang:*\n' +
    '`/currency` - Tukar mata wang kedai\n\n' +
    '*Maklum Balas Pelanggan:*\n' +
    '`/feedbacks` - Lihat semua maklum balas'
    : '🔧 *Advanced Settings*\n\n' +
    '*Advanced Product Management:*\n' +
    '`/duplicate [product_id]` - Duplicate product\n' +
    '`/inventory [product_id]` - Inventory history\n' +
    '`/adjuststock [product_id] [+/-number] [note]` - Adjust stock\n\n' +
    '*Currency Management:*\n' +
    '`/currency` - Change store currency\n\n' +
    '*Customer Feedback:*\n' +
    '`/feedbacks` - View all feedbacks';

  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'owner_panel')]])
  });
}

module.exports = {
  isOwner,
  handleOwnerPanel,
  handleOwnerAdmins,
  handleSetOwner,
  handleAddAdmin,
  handleRemoveAdmin,
  handleOwnerSettings,
  handleOwnerBackup,
  handleOwnerAnalytics,
  handleOwnerAdvanced
};
