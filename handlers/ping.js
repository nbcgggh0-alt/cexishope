const db = require('../utils/database');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const { safeNum } = require('../utils/helpers');
const { isAdmin } = require('./admin');
const { isOwner } = require('./owner');

async function handlePing(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  // Only admin/owner can see system diagnostics
  if (!await isAdmin(userId) && !await isOwner(userId)) {
    const msg = lang === 'ms'
      ? '🚫 Hanya admin/owner boleh guna arahan ini.'
      : '🚫 Only admin/owner can use this command.';
    await ctx.reply(msg);
    return;
  }

  try {
    const startTime = Date.now();
    const now = new Date();
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const systemUptime = os.uptime();
    const sysHours = Math.floor(systemUptime / 3600);
    const sysMinutes = Math.floor((systemUptime % 3600) / 60);
    const sysDays = Math.floor(sysHours / 24);

    const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMemory = (totalMemory - freeMemory).toFixed(2);
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);

    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Unknown';
    const cpuSpeed = cpus[0]?.speed || 0;
    const cpuArch = os.arch();

    const platform = os.platform();
    const osType = os.type();
    const osRelease = os.release();
    const hostname = os.hostname();
    const nodeVersion = process.version;
    const v8Version = process.versions.v8;
    const opensslVersion = process.versions.openssl;
    const zlibVersion = process.versions.zlib;

    const processMemory = process.memoryUsage();
    const heapUsed = (processMemory.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (processMemory.heapTotal / 1024 / 1024).toFixed(2);
    const rss = (processMemory.rss / 1024 / 1024).toFixed(2);
    const external = (processMemory.external / 1024 / 1024).toFixed(2);
    const arrayBuffers = processMemory.arrayBuffers ? (processMemory.arrayBuffers / 1024 / 1024).toFixed(2) : 'N/A';

    const networkInterfaces = os.networkInterfaces();
    const networkCount = Object.keys(networkInterfaces).length;

    const primaryIP = '[REDACTED]';
    const ipv6Address = '[REDACTED]';

    let gpuInfo = 'N/A';
    try {
      const lspci = execSync('lspci | grep -i vga', { encoding: 'utf8', timeout: 1000 });
      gpuInfo = lspci.trim().split('\n')[0]?.split(': ')[1] || 'N/A';
    } catch (e) {
      gpuInfo = 'Not detected';
    }

    let diskTotal = 'N/A';
    let diskUsed = 'N/A';
    let diskFree = 'N/A';
    let diskPercent = 'N/A';
    let inodeUsed = 'N/A';
    let inodeTotal = 'N/A';
    try {
      const df = execSync('df -h / | tail -1', { encoding: 'utf8', timeout: 1000 });
      const parts = df.trim().split(/\s+/);
      diskTotal = parts[1];
      diskUsed = parts[2];
      diskFree = parts[3];
      diskPercent = parts[4];

      const dfInodes = execSync('df -i / | tail -1', { encoding: 'utf8', timeout: 1000 });
      const inodeParts = dfInodes.trim().split(/\s+/);
      inodeTotal = inodeParts[1];
      inodeUsed = inodeParts[2];
    } catch (e) { console.warn('disk info unavailable:', e.message); }

    const loadAvg = os.loadavg();
    const load1 = loadAvg[0].toFixed(2);
    const load5 = loadAvg[1].toFixed(2);
    const load15 = loadAvg[2].toFixed(2);

    const homedir = '[REDACTED]';
    const tmpdir = '[REDACTED]';
    const endianness = os.endianness();
    const pid = process.pid;
    const ppid = process.ppid;

    let users = [], products = [], categories = [], transactions = [], sessions = [];
    let admins = {}, settings = {}, templates = [], faqs = [], feedbacks = [], inventory = [];
    try { users = await db.getUsers() || []; } catch (e) { console.warn('ping: getUsers failed'); }
    try { products = await db.getProducts() || []; } catch (e) { console.warn('ping: getProducts failed'); }
    try { categories = await db.getCategories() || []; } catch (e) { console.warn('ping: getCategories failed'); }
    try { transactions = await db.getTransactions() || []; } catch (e) { console.warn('ping: getTransactions failed'); }
    try { sessions = await db.getSessions() || []; } catch (e) { console.warn('ping: getSessions failed'); }
    try { admins = await db.getAdmins() || {}; } catch (e) { console.warn('ping: getAdmins failed'); }
    try { settings = await db.getSettings() || {}; } catch (e) { console.warn('ping: getSettings failed'); }
    try { templates = await db.getTemplates() || []; } catch (e) { console.warn('ping: getTemplates failed'); }
    try { faqs = await db.getFAQs() || []; } catch (e) { console.warn('ping: getFAQs failed'); }
    try { feedbacks = await db.getFeedbacks() || []; } catch (e) { console.warn('ping: getFeedbacks failed'); }
    try { inventory = await db.getInventoryLogs() || []; } catch (e) { console.warn('ping: getInventoryLogs failed'); }

    // Safe defaults for settings
    if (!settings.currency) settings.currency = 'RM';
    if (!settings.storeName) settings.storeName = 'CexiStore';
    if (!settings.defaultLanguage) settings.defaultLanguage = 'ms';

    let cpuTempInfo = 'N/A';
    try {
      const temp = execSync('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1', { encoding: 'utf8', timeout: 1000 });
      const tempVal = parseInt(temp.trim()) / 1000;
      cpuTempInfo = `${tempVal.toFixed(1)}°C`;
    } catch (e) {
      cpuTempInfo = 'Not available';
    }

    const activeProducts = products.filter(p => p.active);
    const pendingOrders = transactions.filter(t => t.status === 'pending');
    const completedOrders = transactions.filter(t => t.status === 'completed');
    const activeSessions = sessions.filter(s => s.status === 'active');
    const bannedUsers = users.filter(u => u.banned);
    const totalRevenue = completedOrders.reduce((sum, t) => sum + (t.price || 0), 0);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayOrders = transactions.filter(t => new Date(t.createdAt) >= todayStart);
    const todayRevenue = todayOrders.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.price || 0), 0);

    const avgCpuSpeed = cpus.reduce((sum, cpu) => sum + cpu.speed, 0) / cpuCount;

    let fileDescriptors = 'N/A';
    try {
      const fdCount = execSync(`ls -la /proc/${pid}/fd | wc -l`, { encoding: 'utf8', timeout: 1000 });
      fileDescriptors = parseInt(fdCount.trim()) - 3;
    } catch (e) { console.warn('fd count unavailable:', e.message); }

    let threadCount = 'N/A';
    try {
      const threads = execSync(`ls /proc/${pid}/task | wc -l`, { encoding: 'utf8', timeout: 1000 });
      threadCount = threads.trim();
    } catch (e) { console.warn('thread count unavailable:', e.message); }

    const totalUsers = users.length;
    const totalProducts = products.length;
    const totalOrders = transactions.length;
    const totalCategories = categories.length;

    const avgRating = feedbacks.length > 0
      ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(2)
      : '0';

    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStockProducts = products.filter(p => p.stock <= 5).length;

    const responseTime = Date.now() - startTime;
    // Calculate network latency (Telegrams timestamp is in seconds)
    const messageTime = ctx.message?.date * 1000 || Date.now();
    const networkLatency = startTime - messageTime;
    const safeNetworkLatency = networkLatency > 0 ? networkLatency : 0;

    // ─── Build text with Telegram HTML blockquotes ───
    const isMalay = lang === 'ms';

    const header = isMalay
      ? `🏓 <b>PING — SISTEM RUNTIME</b>\n⚡ <b>Proses: ${responseTime}ms</b> · 🌐 <b>Network: ${safeNetworkLatency}ms</b>\n📅 ${now.toLocaleDateString('ms-MY')} · 🕐 ${now.toLocaleTimeString('ms-MY')}\n`
      : `🏓 <b>PING — SYSTEM RUNTIME</b>\n⚡ <b>Process: ${responseTime}ms</b> · 🌐 <b>Network: ${safeNetworkLatency}ms</b>\n📅 ${now.toLocaleDateString('en-US')} · 🕐 ${now.toLocaleTimeString('en-US')}\n`;

    const statusBar = `<blockquote>` +
      `✅ <b>${isMalay ? 'Status' : 'Status'}:</b> ${settings.maintenanceMode ? '🔴 Maintenance' : '🟢 Online'}\n` +
      `⏱ <b>Uptime:</b> ${hours}h ${minutes}m ${seconds}s\n` +
      `💰 <b>${isMalay ? 'Hasil Hari Ini' : 'Today Revenue'}:</b> ${settings.currency}${safeNum(todayRevenue).toFixed(2)}\n` +
      `📦 <b>${isMalay ? 'Pesanan Tertunggak' : 'Pending Orders'}:</b> ${pendingOrders.length}\n` +
      `👥 <b>${isMalay ? 'Jumlah Pengguna' : 'Total Users'}:</b> ${totalUsers}` +
      `</blockquote>\n`;

    const sectionOS = `<blockquote expandable>` +
      `🖥️ <b>${isMalay ? 'SISTEM OPERASI' : 'OPERATING SYSTEM'}</b>\n\n` +
      `OS: <code>${osType}</code>\n` +
      `Platform: <code>${platform}</code>\n` +
      `Kernel: <code>${osRelease}</code>\n` +
      `Host: <code>${hostname.substring(0, 4)}***</code>\n` +
      `Arch: <code>${cpuArch}</code> · Endian: <code>${endianness}</code>\n` +
      `${isMalay ? 'Uptime Sistem' : 'System Uptime'}: <code>${sysDays}d ${sysHours % 24}h ${sysMinutes}m</code>` +
      `</blockquote>\n`;

    const sectionCPU = `<blockquote expandable>` +
      `⚡ <b>${isMalay ? 'PROSESSOR' : 'PROCESSOR'} (CPU)</b>\n\n` +
      `Model: <code>${cpuModel}</code>\n` +
      `Cores: <code>${cpuCount}</code> · Speed: <code>${cpuSpeed} MHz</code>\n` +
      `${isMalay ? 'Purata' : 'Avg'}: <code>${avgCpuSpeed.toFixed(0)} MHz</code>\n` +
      `Load: <code>${load1}</code> / <code>${load5}</code> / <code>${load15}</code>\n` +
      `🌡 Temp: <code>${cpuTempInfo}</code>\n` +
      `🎮 GPU: <code>${gpuInfo}</code>` +
      `</blockquote>\n`;

    const sectionRAM = `<blockquote expandable>` +
      `💾 <b>${isMalay ? 'MEMORI' : 'MEMORY'} (RAM)</b>\n\n` +
      `Total: <code>${totalMemory} GB</code>\n` +
      `${isMalay ? 'Digunakan' : 'Used'}: <code>${usedMemory} GB</code> (${memoryUsagePercent}%)\n` +
      `${isMalay ? 'Bebas' : 'Free'}: <code>${freeMemory} GB</code>\n` +
      `Heap: <code>${heapUsed}/${heapTotal} MB</code>\n` +
      `RSS: <code>${rss} MB</code> · Ext: <code>${external} MB</code>` +
      `</blockquote>\n`;

    const sectionDisk = `<blockquote expandable>` +
      `💽 <b>STORAGE (DISK)</b>\n\n` +
      `Total: <code>${diskTotal}</code>\n` +
      `${isMalay ? 'Digunakan' : 'Used'}: <code>${diskUsed}</code> (${diskPercent})\n` +
      `${isMalay ? 'Tersedia' : 'Available'}: <code>${diskFree}</code>\n` +
      `Inodes: <code>${inodeUsed}/${inodeTotal}</code>` +
      `</blockquote>\n`;

    const sectionNet = `<blockquote expandable>` +
      `🌐 <b>NETWORK</b>\n\n` +
      `Interfaces: <code>${networkCount}</code>\n` +
      `IPv4: <code>${primaryIP}</code>\n` +
      `IPv6: <code>${ipv6Address}</code>` +
      `</blockquote>\n`;

    const sectionRuntime = `<blockquote expandable>` +
      `🔧 <b>NODE.JS &amp; RUNTIME</b>\n\n` +
      `Node: <code>${nodeVersion}</code>\n` +
      `V8: <code>${v8Version}</code>\n` +
      `OpenSSL: <code>${opensslVersion}</code>\n` +
      `PID: <code>${pid}</code> · PPID: <code>${ppid}</code>\n` +
      `FD: <code>${fileDescriptors}</code> · Threads: <code>${threadCount}</code>\n` +
      `Buffers: <code>${arrayBuffers} MB</code>` +
      `</blockquote>\n`;

    const sectionUsers = `<blockquote expandable>` +
      `👥 <b>${isMalay ? 'STATISTIK PENGGUNA' : 'USER STATISTICS'}</b>\n\n` +
      `${isMalay ? 'Jumlah' : 'Total'}: <code>${totalUsers}</code>\n` +
      `${isMalay ? 'Aktif' : 'Active'}: <code>${totalUsers - bannedUsers.length}</code> · Banned: <code>${bannedUsers.length}</code>\n` +
      `Admin: <code>${admins.admins?.length || 0}</code> · Owner: <code>${admins.owner ? '✓' : '✗'}</code>\n` +
      `VIP: <code>${users.filter(u => u.tags?.includes('vip')).length}</code> · ${isMalay ? 'Baru Hari Ini' : 'New Today'}: <code>${users.filter(u => new Date(u.createdAt) >= todayStart).length}</code>\n` +
      `${isMalay ? 'Jumlah Poin' : 'Total Points'}: <code>${users.reduce((sum, u) => sum + (u.points || 0), 0)}</code>` +
      `</blockquote>\n`;

    const sectionProducts = `<blockquote expandable>` +
      `📦 <b>${isMalay ? 'STATISTIK PRODUK' : 'PRODUCT STATISTICS'}</b>\n\n` +
      `${isMalay ? 'Jumlah' : 'Total'}: <code>${totalProducts}</code> · ${isMalay ? 'Aktif' : 'Active'}: <code>${activeProducts.length}</code>\n` +
      `${isMalay ? 'Kategori' : 'Categories'}: <code>${totalCategories}</code>\n` +
      `Stok: <code>${totalStock}</code> · Low (&lt;5): <code>${lowStockProducts}</code>\n` +
      `Auto: <code>${products.filter(p => p.deliveryType === 'auto').length}</code> · Manual: <code>${products.filter(p => p.deliveryType === 'manual').length}</code>\n` +
      `Items: <code>${products.reduce((sum, p) => sum + (p.items?.length || 0), 0)}</code> · ${isMalay ? 'Harga Purata' : 'Avg Price'}: <code>${settings.currency}${totalProducts > 0 ? (products.reduce((sum, p) => sum + p.price, 0) / totalProducts).toFixed(2) : '0.00'}</code>` +
      `</blockquote>\n`;

    const sectionOrders = `<blockquote expandable>` +
      `💰 <b>${isMalay ? 'STATISTIK PESANAN' : 'ORDER STATISTICS'}</b>\n\n` +
      `${isMalay ? 'Jumlah' : 'Total'}: <code>${totalOrders}</code>\n` +
      `Pending: <code>${pendingOrders.length}</code> · ${isMalay ? 'Menunggu' : 'Awaiting'}: <code>${transactions.filter(t => t.status === 'awaiting_verification').length}</code>\n` +
      `✅ ${isMalay ? 'Selesai' : 'Done'}: <code>${completedOrders.length}</code> · ❌ ${isMalay ? 'Ditolak' : 'Rejected'}: <code>${transactions.filter(t => t.status === 'rejected').length}</code>\n` +
      `${isMalay ? 'Hari Ini' : 'Today'}: <code>${todayOrders.length}</code>\n` +
      `${isMalay ? 'Hasil Total' : 'Total Revenue'}: <code>${settings.currency}${safeNum(totalRevenue).toFixed(2)}</code>\n` +
      `${isMalay ? 'Purata' : 'Avg Order'}: <code>${settings.currency}${completedOrders.length ? (totalRevenue / completedOrders.length).toFixed(2) : '0.00'}</code>\n` +
      `${isMalay ? 'Kadar Kejayaan' : 'Success Rate'}: <code>${totalOrders ? ((completedOrders.length / totalOrders) * 100).toFixed(1) : '0'}%</code>` +
      `</blockquote>\n`;

    const sectionSupport = `<blockquote expandable>` +
      `💬 <b>SUPPORT &amp; SESSIONS</b>\n\n` +
      `Sessions: <code>${sessions.length}</code> · ${isMalay ? 'Aktif' : 'Active'}: <code>${activeSessions.length}</code>\n` +
      `Templates: <code>${templates.length}</code> · FAQs: <code>${faqs.length}</code>\n` +
      `Feedbacks: <code>${feedbacks.length}</code> · ⭐ <code>${avgRating}</code>\n` +
      `5⭐: <code>${feedbacks.filter(f => f.rating === 5).length}</code> · Inventory: <code>${inventory.length}</code>` +
      `</blockquote>\n`;

    const sectionEnv = `<blockquote expandable>` +
      `⚙️ <b>${isMalay ? 'PERSEKITARAN' : 'ENVIRONMENT'}</b>\n\n` +
      `ENV: <code>${process.env.NODE_ENV || 'production'}</code>\n` +
      `${isMalay ? 'Matawang' : 'Currency'}: <code>${settings.currency || 'RM'}</code>\n` +
      `${isMalay ? 'Bahasa' : 'Language'}: <code>${settings.defaultLanguage || 'ms'}</code>\n` +
      `Store: <code>${settings.storeName}</code>` +
      `</blockquote>`;

    const text = header + statusBar + sectionOS + sectionCPU + sectionRAM + sectionDisk + sectionNet + sectionRuntime + sectionUsers + sectionProducts + sectionOrders + sectionSupport + sectionEnv;

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Ping command error:', error);
    await ctx.reply('❌ Error fetching system information');
  }
}

module.exports = { handlePing };
