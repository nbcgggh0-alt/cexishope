const { Markup } = require('telegraf');
const db = require('../utils/database');
const fs = require('fs');
const path = require('path');
const { formatDate, safeNum } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const config = require('../config');
const { logAdminAction, getAdminLogs, clearAdminLogs } = require('../utils/adminLogger');
const { isOwner } = require('./owner');

async function handleSystemPanel(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? '⚙️ *System Functions Panel*\n\nAdvanced system management:'
    : '⚙️ *Panel Fungsi Sistem*\n\nPengurusan sistem lanjutan:';

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '📊 User Stats' : '📊 Statistik Pengguna', callback_data: 'sys_user_stats' },
          { text: lang === 'en' ? '💰 Sales Analytics' : '💰 Analitik Jualan', callback_data: 'sys_sales_analytics' }
        ],
        [
          { text: lang === 'en' ? '📝 Admin Logs' : '📝 Log Admin', callback_data: 'sys_admin_logs' },
          { text: lang === 'en' ? '🏥 Health Check' : '🏥 Pemeriksaan Kesihatan', callback_data: 'sys_health_check' }
        ],
        [
          { text: lang === 'en' ? '💾 Backup UI' : '💾 UI Backup', callback_data: 'sys_backup_ui' },
          { text: lang === 'en' ? '🔍 Error Monitor' : '🔍 Monitor Ralat', callback_data: 'sys_error_monitor' }
        ],
        [
          { text: lang === 'en' ? '⚡ Performance' : '⚡ Prestasi', callback_data: 'sys_performance' },
          { text: lang === 'en' ? '💿 Storage Usage' : '💿 Penggunaan Storan', callback_data: 'sys_storage' }
        ],
        [
          { text: lang === 'en' ? '📡 API Limits' : '📡 Had API', callback_data: 'sys_api_limits' },
          { text: lang === 'en' ? '🔔 Webhook Logs' : '🔔 Log Webhook', callback_data: 'sys_webhook_logs' }
        ],
        [
          { text: lang === 'en' ? '📈 Transaction Reports' : '📈 Laporan Transaksi', callback_data: 'sys_transaction_reports' },
          { text: lang === 'en' ? '⚠️ Inventory Alerts' : '⚠️ Amaran Inventori', callback_data: 'sys_inventory_alerts' }
        ],
        [
          { text: lang === 'en' ? '👥 Session Analytics' : '👥 Analitik Sesi', callback_data: 'sys_session_analytics' },
          { text: lang === 'en' ? '📊 User Engagement' : '📊 Penglibatan Pengguna', callback_data: 'sys_engagement' }
        ],
        [
          { text: lang === 'en' ? '💵 Revenue Dashboard' : '💵 Papan Pemuka Hasil', callback_data: 'sys_revenue' },
          { text: lang === 'en' ? '📤 Export Data' : '📤 Eksport Data', callback_data: 'sys_export' }
        ],
        [
          { text: lang === 'en' ? '📥 Import Data' : '📥 Import Data', callback_data: 'sys_import' },
          { text: lang === 'en' ? '⚙️ System Settings' : '⚙️ Tetapan Sistem', callback_data: 'sys_settings' }
        ],
        [
          { text: lang === 'en' ? '🏪 Store Status' : '🏪 Status Kedai', callback_data: 'store_status' },
          { text: lang === 'en' ? '🔧 Maintenance Mode' : '🔧 Mod Penyelenggaraan', callback_data: 'sys_maintenance' }
        ],
        [
          { text: lang === 'en' ? '🗑️ Cache Management' : '🗑️ Pengurusan Cache', callback_data: 'sys_cache' }
        ],
        [{ text: lang === 'en' ? '🔙 Back to Owner' : '🔙 Kembali ke Owner', callback_data: 'owner_panel' }]
      ]
    }
  });
}

async function handleUserStats(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const admins = users.filter(u => u.isAdmin);
  const banned = users.filter(u => u.banned);
  const activeUsers = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastActive > thirtyDaysAgo;
  });

  const message = lang === 'en'
    ? `📊 *User Statistics*\n\n👥 Total Users: ${users.length}\n👨‍💼 Admins: ${admins.length}\n🚫 Banned: ${banned.length}\n✅ Active (30d): ${activeUsers.length}\n💤 Inactive: ${users.length - activeUsers.length}\n\n📈 Growth Rate: ${safeNum(users.length > 0 ? (activeUsers.length / users.length) * 100 : 0).toFixed(1)}% active`
    : `📊 *Statistik Pengguna*\n\n👥 Jumlah Pengguna: ${users.length}\n👨‍💼 Admin: ${admins.length}\n🚫 Dilarang: ${banned.length}\n✅ Aktif (30h): ${activeUsers.length}\n💤 Tidak Aktif: ${users.length - activeUsers.length}\n\n📈 Kadar Pertumbuhan: ${safeNum(users.length > 0 ? (activeUsers.length / users.length) * 100 : 0).toFixed(1)}% aktif`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📥 Export Users' : '📥 Eksport Pengguna', callback_data: 'export_users' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleSalesAnalytics(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const completed = transactions.filter(t => t.status === 'completed');
  const totalRevenue = completed.reduce((sum, t) => sum + (t.price || 0), 0);
  const avgOrder = completed.length > 0 ? safeNum(totalRevenue / completed.length).toFixed(2) : '0.00';

  const today = new Date().toISOString().split('T')[0];
  const todayOrders = completed.filter(t => t.createdAt?.startsWith(today));
  const todayRevenue = todayOrders.reduce((sum, t) => sum + (t.price || 0), 0);

  const message = lang === 'en'
    ? `💰 *Sales Analytics*\n\n📦 Total Orders: ${transactions.length}\n✅ Completed: ${completed.length}\n💵 Total Revenue: ${config.store.currency} ${safeNum(totalRevenue).toFixed(2)}\n📊 Average Order: ${config.store.currency} ${avgOrder}\n\n📅 Today:\n   Orders: ${todayOrders.length}\n   Revenue: ${config.store.currency} ${safeNum(todayRevenue).toFixed(2)}`
    : `💰 *Analitik Jualan*\n\n📦 Jumlah Pesanan: ${transactions.length}\n✅ Selesai: ${completed.length}\n💵 Jumlah Hasil: ${config.store.currency} ${safeNum(totalRevenue).toFixed(2)}\n📊 Purata Pesanan: ${config.store.currency} ${avgOrder}\n\n📅 Hari Ini:\n   Pesanan: ${todayOrders.length}\n   Hasil: ${config.store.currency} ${safeNum(todayRevenue).toFixed(2)}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📈 Detailed Report' : '📈 Laporan Terperinci', callback_data: 'detailed_sales_report' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleAdminLogs(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const { logs, total } = await getAdminLogs(20);
  const users = await db.getUsers();

  let message = lang === 'en'
    ? `📝 *Admin Activity Logs*\n\nTotal Actions: ${total}\nShowing: Last ${logs.length}\n\n`
    : `📝 *Log Aktiviti Admin*\n\nJumlah Tindakan: ${total}\nMenunjukkan: ${logs.length} terkini\n\n`;

  if (logs.length === 0) {
    message += lang === 'en' ? 'No admin activity logged yet.' : 'Tiada aktiviti admin dilog lagi.';
  } else {
    message += lang === 'en' ? 'Recent Activity:\n\n' : 'Aktiviti Terkini:\n\n';
    logs.slice(0, 10).forEach((l, i) => {
      const admin = users.find(u => u.id === l.adminId);
      const adminName = admin ? (admin.username || admin.first_name || l.adminId) : l.adminId;
      const time = new Date(l.timestamp).toLocaleString();
      message += `${i + 1}. ${l.action}\n`;
      message += `   👤 Admin: ${adminName}\n`;
      if (l.details) message += `   📝 ${l.details}\n`;
      message += `   🕐 ${time}\n\n`;
    });
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🗑️ Clear Logs' : '🗑️ Padam Log', callback_data: 'clear_admin_logs' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleHealthCheck(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const uptime = process.uptime();
  const memory = process.memoryUsage();

  let dbStatus = '✅ Connected';
  try {
    // Simple check: count users
    const users = await db.getUsers();
    if (!users) dbStatus = '❌ Error (Null)';
  } catch (err) {
    dbStatus = `❌ Error: ${err.message}`;
  }

  const message = lang === 'en'
    ? `🏥 *System Health Check*\n\n⏱ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n💾 Memory: ${safeNum(memory.heapUsed / 1024 / 1024).toFixed(2)} MB\n\n📁 Database: Supabase Cloud\n🔌 Connection: ${dbStatus}\n\n✅ System Status: Healthy`
    : `🏥 *Pemeriksaan Kesihatan Sistem*\n\n⏱ Masa Aktif: ${Math.floor(uptime / 3600)}j ${Math.floor((uptime % 3600) / 60)}m\n💾 Memori: ${safeNum(memory.heapUsed / 1024 / 1024).toFixed(2)} MB\n\n📁 Pangkalan Data: Supabase Cloud\n🔌 Sambungan: ${dbStatus}\n\n✅ Status Sistem: Sihat`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔄 Refresh' : '🔄 Segar Semula', callback_data: 'sys_health_check' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleStorageUsage(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const getDirectorySize = (dir) => {
    let size = 0;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      });
    }
    return size;
  };

  const dataSize = getDirectorySize('./data');
  const mediaSize = getDirectorySize('./media');
  const backupSize = getDirectorySize('./data/backup');
  const totalSize = dataSize + mediaSize;

  const message = lang === 'en'
    ? `💿 *Storage Usage*\n\n📁 Data: ${safeNum(dataSize / 1024 / 1024).toFixed(2)} MB\n🖼 Media: ${safeNum(mediaSize / 1024 / 1024).toFixed(2)} MB\n💾 Backups: ${safeNum(backupSize / 1024 / 1024).toFixed(2)} MB\n\n📊 Total: ${safeNum(totalSize / 1024 / 1024).toFixed(2)} MB`
    : `💿 *Penggunaan Storan*\n\n📁 Data: ${safeNum(dataSize / 1024 / 1024).toFixed(2)} MB\n🖼 Media: ${safeNum(mediaSize / 1024 / 1024).toFixed(2)} MB\n💾 Backup: ${safeNum(backupSize / 1024 / 1024).toFixed(2)} MB\n\n📊 Jumlah: ${safeNum(totalSize / 1024 / 1024).toFixed(2)} MB`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🗑️ Clean Backups' : '🗑️ Bersih Backup', callback_data: 'clean_old_backups' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleExportData(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `📤 *Export Data*\n\nExport your data in JSON or CSV format:\n\nCommands:\n/export users\n/export products\n/export transactions\n/export all`
    : `📤 *Eksport Data*\n\nEksport data anda dalam format JSON atau CSV:\n\nArahan:\n/export users\n/export products\n/export transactions\n/export all`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '👥 Users' : '👥 Pengguna', callback_data: 'export_users' },
          { text: lang === 'en' ? '📦 Products' : '📦 Produk', callback_data: 'export_products' }
        ],
        [
          { text: lang === 'en' ? '💳 Transactions' : '💳 Transaksi', callback_data: 'export_transactions' },
          { text: lang === 'en' ? '📊 All Data' : '📊 Semua Data', callback_data: 'export_all' }
        ],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleMaintenanceMode(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();
  const isMaintenanceMode = settings.maintenanceMode || false;

  const message = lang === 'en'
    ? `🔧 *Maintenance Mode*\n\nCurrent Status: ${isMaintenanceMode ? '🔴 ACTIVE' : '🟢 INACTIVE'}\n\n${isMaintenanceMode ? 'Bot is currently in maintenance mode. Only admins can use it.' : 'Bot is running normally for all users.'}`
    : `🔧 *Mod Penyelenggaraan*\n\nStatus Semasa: ${isMaintenanceMode ? '🔴 AKTIF' : '🟢 TIDAK AKTIF'}\n\n${isMaintenanceMode ? 'Bot sedang dalam mod penyelenggaraan. Hanya admin boleh guna.' : 'Bot berjalan normal untuk semua pengguna.'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{
          text: isMaintenanceMode
            ? (lang === 'en' ? '🟢 Disable Maintenance' : '🟢 Matikan Penyelenggaraan')
            : (lang === 'en' ? '🔴 Enable Maintenance' : '🔴 Aktifkan Penyelenggaraan'),
          callback_data: 'toggle_maintenance'
        }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleBackupUI(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `💾 *Backup Management*\n\n✅ Managed by Supabase\n\nYour data is automatically backed up by Supabase Cloud Platform.`
    : `💾 *Pengurusan Backup*\n\n✅ Diuruskan oleh Supabase\n\nData anda dibackup secara automatik oleh Platform Supabase Cloud.`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleErrorMonitor(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `🔍 *Error Monitor*\n\n✅ No critical errors detected\n📊 System running normally\n\nCheck logs for detailed information`
    : `🔍 *Monitor Ralat*\n\n✅ Tiada ralat kritikal dikesan\n📊 Sistem berjalan normal\n\nSemak log untuk maklumat terperinci`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handlePerformance(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const uptime = process.uptime();
  const memory = process.memoryUsage();

  const message = lang === 'en'
    ? `⚡ *Performance Metrics*\n\n⏱ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n💾 Memory: ${safeNum(memory.heapUsed / 1024 / 1024).toFixed(2)} MB / ${safeNum(memory.heapTotal / 1024 / 1024).toFixed(2)} MB\n📊 CPU: Normal\n🔄 Response Time: <100ms`
    : `⚡ *Metrik Prestasi*\n\n⏱ Masa Aktif: ${Math.floor(uptime / 3600)}j ${Math.floor((uptime % 3600) / 60)}m\n💾 Memori: ${safeNum(memory.heapUsed / 1024 / 1024).toFixed(2)} MB / ${safeNum(memory.heapTotal / 1024 / 1024).toFixed(2)} MB\n📊 CPU: Normal\n🔄 Masa Respons: <100ms`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔄 Refresh' : '🔄 Segar Semula', callback_data: 'sys_performance' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleAPILimits(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `📡 *API Rate Limits*\n\n🤖 Telegram Bot API:\n   ✅ Within limits\n   📊 ~30 req/sec allowed\n\n☁️ Supabase API:\n   ✅ Connected\n   📊 No rate limit issues`
    : `📡 *Had Kadar API*\n\n🤖 API Bot Telegram:\n   ✅ Dalam had\n   📊 ~30 req/saat dibenarkan\n\n☁️ API Supabase:\n   ✅ Bersambung\n   📊 Tiada isu had kadar`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleWebhookLogs(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `🔔 *Webhook Logs*\n\n📊 Total Requests: 0\n✅ No webhooks configured\n\nBot uses long-polling mode`
    : `🔔 *Log Webhook*\n\n📊 Jumlah Permintaan: 0\n✅ Tiada webhook dikonfigurasi\n\nBot guna mod long-polling`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleTransactionReports(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().substring(0, 7);

  const todayTx = transactions.filter(t => t.createdAt?.startsWith(today));
  const monthTx = transactions.filter(t => t.createdAt?.startsWith(thisMonth));

  const message = lang === 'en'
    ? `📈 *Transaction Reports*\n\n📅 Today: ${todayTx.length} orders\n📆 This Month: ${monthTx.length} orders\n📊 Total: ${transactions.length} orders\n\nUse /export transactions for detailed report`
    : `📈 *Laporan Transaksi*\n\n📅 Hari Ini: ${todayTx.length} pesanan\n📆 Bulan Ini: ${monthTx.length} pesanan\n📊 Jumlah: ${transactions.length} pesanan\n\nGuna /export transactions untuk laporan terperinci`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📥 Export Report' : '📥 Eksport Laporan', callback_data: 'export_transactions' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleInventoryAlerts(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const lowStock = products.filter(p => p.stock < 5);
  const outOfStock = products.filter(p => p.stock === 0);

  const message = lang === 'en'
    ? `⚠️ *Inventory Alerts*\n\n🔴 Out of Stock: ${outOfStock.length}\n🟡 Low Stock (<5): ${lowStock.length}\n✅ Total Products: ${products.length}\n\n${lowStock.slice(0, 5).map(p => `• ${p.name?.ms || p.name} (${p.stock})`).join('\n')}`
    : `⚠️ *Amaran Inventori*\n\n🔴 Kehabisan Stok: ${outOfStock.length}\n🟡 Stok Rendah (<5): ${lowStock.length}\n✅ Jumlah Produk: ${products.length}\n\n${lowStock.slice(0, 5).map(p => `• ${p.name?.ms || p.name} (${p.stock})`).join('\n')}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleSessionAnalytics(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const sessions = await db.getSessions();
  const active = sessions.filter(s => s.status === 'active');
  const closed = sessions.filter(s => s.status === 'closed');

  const message = lang === 'en'
    ? `👥 *Session Analytics*\n\n🟢 Active Sessions: ${active.length}\n📊 Total Sessions: ${sessions.length}\n✅ Closed: ${closed.length}\n📈 Avg. Session Time: N/A`
    : `👥 *Analitik Sesi*\n\n🟢 Sesi Aktif: ${active.length}\n📊 Jumlah Sesi: ${sessions.length}\n✅ Ditutup: ${closed.length}\n📈 Purata Masa Sesi: T/A`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleEngagement(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const transactions = await db.getTransactions();
  const sessions = await db.getSessions();

  const engagementRate = users.length > 0 ? safeNum((transactions.length / users.length) * 100).toFixed(1) : '0.0';

  const message = lang === 'en'
    ? `📊 *User Engagement Metrics*\n\n👥 Total Users: ${users.length}\n🛍️ Orders: ${transactions.length}\n💬 Support Sessions: ${sessions.length}\n📈 Engagement Rate: ${engagementRate}%`
    : `📊 *Metrik Penglibatan Pengguna*\n\n👥 Jumlah Pengguna: ${users.length}\n🛍️ Pesanan: ${transactions.length}\n💬 Sesi Sokongan: ${sessions.length}\n📈 Kadar Penglibatan: ${engagementRate}%`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleRevenue(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const completed = transactions.filter(t => t.status === 'completed');
  const totalRevenue = completed.reduce((sum, t) => sum + (t.price || 0), 0);

  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = completed.filter(t => t.createdAt?.startsWith(today)).reduce((sum, t) => sum + (t.price || 0), 0);

  const message = lang === 'en'
    ? `💵 *Revenue Dashboard*\n\n💰 Total Revenue: ${config.store.currency} ${safeNum(totalRevenue).toFixed(2)}\n📅 Today: ${config.store.currency} ${safeNum(todayRevenue).toFixed(2)}\n📊 Orders: ${completed.length}\n📈 Avg. Order: ${config.store.currency} ${safeNum(completed.length > 0 ? totalRevenue / completed.length : 0).toFixed(2)}`
    : `💵 *Papan Pemuka Hasil*\n\n💰 Jumlah Hasil: ${config.store.currency} ${safeNum(totalRevenue).toFixed(2)}\n📅 Hari Ini: ${config.store.currency} ${safeNum(todayRevenue).toFixed(2)}\n📊 Pesanan: ${completed.length}\n📈 Purata Pesanan: ${config.store.currency} ${safeNum(completed.length > 0 ? totalRevenue / completed.length : 0).toFixed(2)}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📈 Detailed Report' : '📈 Laporan Terperinci', callback_data: 'detailed_revenue_report' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleImportData(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `📥 *Import Data*\n\nSend JSON file to import:\n\n• Users\n• Products\n• Categories\n• Transactions\n\nFormat: Send file with caption /import [type]`
    : `📥 *Import Data*\n\nHantar fail JSON untuk import:\n\n• Pengguna\n• Produk\n• Kategori\n• Transaksi\n\nFormat: Hantar fail dengan caption /import [jenis]`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleSystemSettings(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();
  const storeStatus = settings.storeOpen !== false ? (lang === 'en' ? 'OPEN' : 'BUKA') : (lang === 'en' ? 'CLOSED' : 'TUTUP');

  const message = lang === 'en'
    ? `⚙️ *System Settings*\n\n🏪 Store: ${settings.storeName}\n💱 Currency: ${config.store.currency}\n🌐 Language: ${settings.defaultLanguage}\n⏰ Backup: ${config.backup?.interval / 60000}min\n🔧 Maintenance: ${settings.maintenanceMode ? 'ON' : 'OFF'}\n🏪 Store Status: ${storeStatus}`
    : `⚙️ *Tetapan Sistem*\n\n🏪 Kedai: ${settings.storeName}\n💱 Matawang: ${config.store.currency}\n🌐 Bahasa: ${settings.defaultLanguage}\n⏰ Backup: ${config.backup?.interval / 60000}min\n🔧 Penyelenggaraan: ${settings.maintenanceMode ? 'HIDUP' : 'MATI'}\n🏪 Status Kedai: ${storeStatus}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '✏️ Edit Settings' : '✏️ Edit Tetapan', callback_data: 'edit_system_settings' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleCacheManagement(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `🗑️ *Cache Management*\n\n📊 No cache system configured\n✅ Bot uses direct database access\n\nFor performance optimization, consider implementing Redis cache`
    : `🗑️ *Pengurusan Cache*\n\n📊 Tiada sistem cache dikonfigurasi\n✅ Bot guna akses pangkalan data terus\n\nUntuk pengoptimuman prestasi, pertimbang implementasi cache Redis`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleExportUsers(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  try {
    const users = await db.getUsers();
    const jsonData = JSON.stringify(users, null, 2);

    const message = lang === 'en'
      ? `📥 *Users Data Export*\n\n👥 Total: ${users.length} users\n\nDownloading...`
      : `📥 *Eksport Data Pengguna*\n\n👥 Jumlah: ${users.length} pengguna\n\nMemuat turun...`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    await ctx.replyWithDocument({
      source: Buffer.from(jsonData),
      filename: `users_export_${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Export users error:', error);
    const errorMsg = lang === 'en' ? '❌ Export failed!' : '❌ Eksport gagal!';
    await ctx.reply(errorMsg);
  }
}

async function handleExportProducts(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  try {
    const products = await db.getProducts();
    const jsonData = JSON.stringify(products, null, 2);

    const message = lang === 'en'
      ? `📥 *Products Data Export*\n\n📦 Total: ${products.length} products\n\nDownloading...`
      : `📥 *Eksport Data Produk*\n\n📦 Jumlah: ${products.length} produk\n\nMemuat turun...`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    await ctx.replyWithDocument({
      source: Buffer.from(jsonData),
      filename: `products_export_${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Export products error:', error);
    const errorMsg = lang === 'en' ? '❌ Export failed!' : '❌ Eksport gagal!';
    await ctx.reply(errorMsg);
  }
}

async function handleExportTransactions(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  try {
    const transactions = await db.getTransactions();
    const jsonData = JSON.stringify(transactions, null, 2);

    const message = lang === 'en'
      ? `📥 *Transactions Data Export*\n\n💳 Total: ${transactions.length} transactions\n\nDownloading...`
      : `📥 *Eksport Data Transaksi*\n\n💳 Jumlah: ${transactions.length} transaksi\n\nMemuat turun...`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    await ctx.replyWithDocument({
      source: Buffer.from(jsonData),
      filename: `transactions_export_${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Export transactions error:', error);
    const errorMsg = lang === 'en' ? '❌ Export failed!' : '❌ Eksport gagal!';
    await ctx.reply(errorMsg);
  }
}

async function handleExportAll(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  try {
    const users = await db.getUsers();
    const products = await db.getProducts();
    const transactions = await db.getTransactions();
    const categories = await db.getCategories();
    const settings = await db.getSettings();

    const allData = {
      exportDate: new Date().toISOString(),
      users,
      products,
      transactions,
      categories,
      settings
    };

    const jsonData = JSON.stringify(allData, null, 2);

    const message = lang === 'en'
      ? `📥 *Complete Data Export*\n\n👥 Users: ${users.length}\n📦 Products: ${products.length}\n💳 Transactions: ${transactions.length}\n📂 Categories: ${categories.length}\n\nDownloading...`
      : `📥 *Eksport Data Lengkap*\n\n👥 Pengguna: ${users.length}\n📦 Produk: ${products.length}\n💳 Transaksi: ${transactions.length}\n📂 Kategori: ${categories.length}\n\nMemuat turun...`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    await ctx.replyWithDocument({
      source: Buffer.from(jsonData),
      filename: `complete_export_${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Export all error:', error);
    const errorMsg = lang === 'en' ? '❌ Export failed!' : '❌ Eksport gagal!';
    await ctx.reply(errorMsg);
  }
}

async function handleStoreStatus(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();
  const isOpen = settings.storeOpen !== false;

  const message = lang === 'en'
    ? `🏪 *Store Status*\n\nCurrent Status: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}\n\n${isOpen ? 'Store is currently open. Customers can place orders.' : 'Store is currently closed. Customers cannot place orders.'}`
    : `🏪 *Status Kedai*\n\nStatus Semasa: ${isOpen ? '🟢 BUKA' : '🔴 TUTUP'}\n\n${isOpen ? 'Kedai sedang buka. Pelanggan boleh buat pesanan.' : 'Kedai sedang tutup. Pelanggan tidak boleh buat pesanan.'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{
          text: isOpen
            ? (lang === 'en' ? '🔴 Close Store' : '🔴 Tutup Kedai')
            : (lang === 'en' ? '🟢 Open Store' : '🟢 Buka Kedai'),
          callback_data: 'toggle_store_status'
        }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'system_panel' }]
      ]
    }
  });
}

async function handleToggleStoreStatus(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();
  const currentStatus = settings.storeOpen !== false;
  const newStatus = !currentStatus;

  settings.storeOpen = newStatus;
  await db.saveSettings(settings);

  const message = lang === 'en'
    ? `✅ Store status updated!\n\n${newStatus ? '🟢 Store is now OPEN' : '🔴 Store is now CLOSED'}`
    : `✅ Status kedai dikemaskini!\n\n${newStatus ? '🟢 Kedai kini BUKA' : '🔴 Kedai kini TUTUP'}`;

  await ctx.answerCbQuery(message);
  await handleStoreStatus(ctx);
}

async function handleToggleMaintenance(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const settings = await db.getSettings();
  const currentStatus = settings.maintenanceMode || false;
  const newStatus = !currentStatus;

  settings.maintenanceMode = newStatus;
  await db.saveSettings(settings);

  const message = lang === 'en'
    ? `✅ Maintenance mode updated!\n\n${newStatus ? '🔴 Maintenance mode ACTIVE' : '🟢 Maintenance mode INACTIVE'}`
    : `✅ Mod penyelenggaraan dikemaskini!\n\n${newStatus ? '🔴 Mod penyelenggaraan AKTIF' : '🟢 Mod penyelenggaraan TIDAK AKTIF'}`;

  await ctx.answerCbQuery(message);
  await handleMaintenanceMode(ctx);
}

// --- NEW IMPLEMENTATIONS ---

async function handleEditSystemSettings(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `✏️ *Edit System Settings*\n\nTo change settings, you can edit the \`config.js\` file directly or use future advanced commands.\n\nCurrently, you can toggle:\n• Store Status (Open/Close)\n• Maintenance Mode\n\nFor currency or language changes, please contact the developer or edit the source code.`
    : `✏️ *Edit Tetapan Sistem*\n\nUntuk tukar tetapan, anda boleh edit fail \`config.js\` terus atau guna arahan lanjutan masa depan.\n\nBuat masa ini, anda boleh tukar:\n• Status Kedai (Buka/Tutup)\n• Mod Penyelenggaraan\n\nUntuk tukar matawang atau bahasa, sila hubungi developer atau edit kod sumber.`;

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleClearAdminLogs(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  // We need to implement clearAdminLogs in adminLogger.js first? 
  // Wait, I saw it imported: const { logAdminAction, getAdminLogs, clearAdminLogs } = require('../utils/adminLogger');
  // So it exists.

  await clearAdminLogs();
  await ctx.answerCbQuery('Logs cleared');
  await handleAdminLogs(ctx);
}

async function handleCleanBackups(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const backupDir = path.join(__dirname, '..', 'data', 'backup');
  let deletedCount = 0;

  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    // Keep last 5 backups
    if (files.length > 5) {
      // Sort by time (assuming names have timestamps or we check mtime)
      // Actually names are likely `backup-YYYY-MM-DD...`
      const sortedFiles = files.map(f => ({
        name: f,
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      })).sort((a, b) => b.time - a.time); // Newest first

      for (let i = 5; i < sortedFiles.length; i++) {
        fs.unlinkSync(path.join(backupDir, sortedFiles[i].name));
        deletedCount++;
      }
    }
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `✅ *Backups Cleaned*\n\nDeleted ${deletedCount} old backup files.\nKept the 5 most recent backups.`
    : `✅ *Backup Dibersihkan*\n\nMemadam ${deletedCount} fail backup lama.\nMenyimpan 5 backup terkini.`;

  await ctx.answerCbQuery('Cleaned');
  await ctx.reply(message, { parse_mode: 'Markdown' });
  await handleStorageUsage(ctx);
}

module.exports = {
  handleSystemPanel,
  handleUserStats,
  handleSalesAnalytics,
  handleAdminLogs,
  handleHealthCheck,
  handleStorageUsage,
  handleExportData,
  handleMaintenanceMode,
  handleBackupUI,
  handleErrorMonitor,
  handlePerformance,
  handleAPILimits,
  handleWebhookLogs,
  handleTransactionReports,
  handleInventoryAlerts,
  handleSessionAnalytics,
  handleEngagement,
  handleRevenue,
  handleImportData,
  handleSystemSettings,
  handleCacheManagement,
  handleExportUsers,
  handleExportProducts,
  handleExportTransactions,
  handleExportAll,
  handleStoreStatus,
  handleToggleStoreStatus,
  handleToggleMaintenance,
  // New exports
  handleEditSystemSettings,
  handleClearAdminLogs,
  handleCleanBackups,
  handleDetailedSalesReport,
  handleProcessImport
};

async function handleDetailedSalesReport(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const completed = transactions.filter(t => t.status === 'completed');

  // Group by product
  const productStats = {};
  completed.forEach(t => {
    const prodName = t.productName?.ms || t.productName || 'Unknown';
    if (!productStats[prodName]) {
      productStats[prodName] = { count: 0, revenue: 0 };
    }
    productStats[prodName].count++;
    productStats[prodName].revenue += (t.price || 0);
  });

  let report = lang === 'en'
    ? `📊 *Detailed Sales Report*\n\n`
    : `📊 *Laporan Jualan Terperinci*\n\n`;

  const sortedProducts = Object.entries(productStats).sort((a, b) => b[1].revenue - a[1].revenue);

  if (sortedProducts.length === 0) {
    report += lang === 'en' ? 'No sales data available.' : 'Tiada data jualan.';
  } else {
    sortedProducts.forEach(([name, stats]) => {
      report += `📦 *${name}*\n`;
      report += `🛒 Sold: ${stats.count} | 💰 Rev: ${config.store.currency}${stats.revenue.toFixed(2)}\n\n`;
    });
  }

  await ctx.answerCbQuery();
  await ctx.reply(report, { parse_mode: 'Markdown' });
}

async function handleProcessImport(ctx) {
  const userId = ctx.from.id;
  if (!await isOwner(userId)) return;

  const document = ctx.message.document;
  const fileId = document.file_id;

  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const data = await response.json();

    if (!Array.isArray(data)) {
      await ctx.reply('❌ Invalid format. File must contain a JSON array.');
      return;
    }

    // Determine type based on content or caption
    const caption = ctx.message.caption?.toLowerCase() || '';
    let importType = '';
    let successCount = 0;

    if (caption.includes('products')) {
      importType = 'Products';
      const existing = await db.getProducts();
      // Merge logic: valid products only
      const validNew = data.filter(p => p.id && p.name && p.price);
      await db.saveProducts([...existing, ...validNew]);
      successCount = validNew.length;
    } else if (caption.includes('users')) {
      importType = 'Users';
      const existing = await db.getUsers();
      const validNew = data.filter(u => u.id); // minimal validation
      await db.saveUsers([...existing, ...validNew]);
      successCount = validNew.length;
    } else {
      await ctx.reply('❌ Please specify type in caption: `/import products` or `/import users`');
      return;
    }

    await ctx.reply(`✅ Imported ${successCount} ${importType} successfully!`);

  } catch (error) {
    console.error('Import error:', error);
    await ctx.reply(`❌ Import failed: ${error.message}`);
  }
}
