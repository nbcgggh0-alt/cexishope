const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeNum } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwner } = require('./owner');

async function handleOwnerDashboard(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  // Get all data
  const users = await db.getUsers();
  const products = await db.getProducts();
  const transactions = await db.getTransactions();
  const categories = await db.getCategories();

  // Calculate today stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = transactions.filter(t => new Date(t.createdAt) >= today);
  const todayCompleted = todayOrders.filter(t => t.status === 'completed');
  const todayRevenue = todayCompleted.reduce((sum, t) => sum + (t.price || 0), 0);

  // Calculate week stats
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekOrders = transactions.filter(t => new Date(t.createdAt) >= weekAgo);
  const weekCompleted = weekOrders.filter(t => t.status === 'completed');
  const weekRevenue = weekCompleted.reduce((sum, t) => sum + (t.price || 0), 0);

  // Calculate month stats
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthOrders = transactions.filter(t => new Date(t.createdAt) >= monthAgo);
  const monthCompleted = monthOrders.filter(t => t.status === 'completed');
  const monthRevenue = monthCompleted.reduce((sum, t) => sum + (t.price || 0), 0);

  // Calculate all time stats
  const allCompleted = transactions.filter(t => t.status === 'completed');
  const allRevenue = allCompleted.reduce((sum, t) => sum + (t.price || 0), 0);
  const avgOrderValue = allCompleted.length > 0 ? allRevenue / allCompleted.length : 0;

  // Conversion & cancellation rates
  const allCancelled = transactions.filter(t => t.status === 'rejected' || t.status === 'cancelled');
  const conversionRate = transactions.length > 0 ? (allCompleted.length / transactions.length * 100) : 0;
  const cancelRate = transactions.length > 0 ? (allCancelled.length / transactions.length * 100) : 0;

  // Product stats
  const activeProducts = products.filter(p => p.active);
  const lowStockProducts = products.filter(p => p.stock < 5 && p.active);
  const outOfStockProducts = products.filter(p => p.stock === 0 && p.active);

  // User stats
  const newUsersToday = users.filter(u => new Date(u.createdAt) >= today);
  const newUsersWeek = users.filter(u => new Date(u.createdAt) >= weekAgo);

  // Pending stats
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification');
  const pendingPayments = transactions.filter(t => t.status === 'pending');

  // Growth calculation
  const prevWeekStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const prevWeekEnd = weekAgo;
  const prevWeekOrders = transactions.filter(t => {
    const date = new Date(t.createdAt);
    return date >= prevWeekStart && date < prevWeekEnd && t.status === 'completed';
  });
  const prevWeekRevenue = prevWeekOrders.reduce((sum, t) => sum + (t.price || 0), 0);
  const weekGrowth = prevWeekRevenue > 0
    ? safeNum((weekRevenue - prevWeekRevenue) / prevWeekRevenue * 100).toFixed(1)
    : '0.0';

  const text = lang === 'ms'
    ? `📊 *Dashboard Owner*\n\n` +
    `═══════════════════\n` +
    `📈 *RINGKASAN HARI INI*\n` +
    `💰 Hasil: RM${safeNum(todayRevenue).toFixed(2)}\n` +
    `📦 Order: ${todayOrders.length} (${todayCompleted.length} selesai)\n` +
    `👥 Pengguna Baru: ${newUsersToday.length}\n\n` +
    `📊 *7 HARI LEPAS*\n` +
    `💰 Hasil: RM${safeNum(weekRevenue).toFixed(2)} ${weekGrowth > 0 ? '↑' : '↓'}${Math.abs(weekGrowth)}%\n` +
    `📦 Order: ${weekOrders.length} (${weekCompleted.length} selesai)\n` +
    `👥 Pengguna Baru: ${newUsersWeek.length}\n\n` +
    `📅 *30 HARI LEPAS*\n` +
    `💰 Hasil: RM${safeNum(monthRevenue).toFixed(2)}\n` +
    `📦 Order: ${monthOrders.length} (${monthCompleted.length} selesai)\n\n` +
    `💎 *STATISTIK KESELURUHAN*\n` +
    `💰 Jumlah Hasil: RM${safeNum(allRevenue).toFixed(2)}\n` +
    `📦 Jumlah Order: ${transactions.length} (${allCompleted.length} selesai)\n` +
    `💵 Avg Order Value: RM${safeNum(avgOrderValue).toFixed(2)}\n` +
    `✅ Kadar Penukaran: ${safeNum(conversionRate).toFixed(1)}%\n` +
    `❌ Kadar Batal: ${safeNum(cancelRate).toFixed(1)}%\n` +
    `👥 Jumlah Pengguna: ${users.length}\n` +
    `📦 Produk: ${products.length} (${activeProducts.length} aktif)\n` +
    `📂 Kategori: ${categories.length}\n\n` +
    `⚠️ *PERHATIAN DIPERLUKAN*\n` +
    `💳 Pending Verification: ${pendingOrders.length}\n` +
    `⏳ Pending Payment: ${pendingPayments.length}\n` +
    `⚠️ Stok Rendah: ${lowStockProducts.length}\n` +
    `📦 Stok Habis: ${outOfStockProducts.length}\n` +
    `═══════════════════`
    : `📊 *Owner Dashboard*\n\n` +
    `═══════════════════\n` +
    `📈 *TODAY'S SUMMARY*\n` +
    `💰 Revenue: RM${safeNum(todayRevenue).toFixed(2)}\n` +
    `📦 Orders: ${todayOrders.length} (${todayCompleted.length} completed)\n` +
    `👥 New Users: ${newUsersToday.length}\n\n` +
    `📊 *LAST 7 DAYS*\n` +
    `💰 Revenue: RM${safeNum(weekRevenue).toFixed(2)} ${weekGrowth > 0 ? '↑' : '↓'}${Math.abs(weekGrowth)}%\n` +
    `📦 Orders: ${weekOrders.length} (${weekCompleted.length} completed)\n` +
    `👥 New Users: ${newUsersWeek.length}\n\n` +
    `📅 *LAST 30 DAYS*\n` +
    `💰 Revenue: RM${safeNum(monthRevenue).toFixed(2)}\n` +
    `📦 Orders: ${monthOrders.length} (${monthCompleted.length} completed)\n\n` +
    `💎 *ALL TIME STATS*\n` +
    `💰 Total Revenue: RM${safeNum(allRevenue).toFixed(2)}\n` +
    `📦 Total Orders: ${transactions.length} (${allCompleted.length} completed)\n` +
    `💵 Avg Order Value: RM${safeNum(avgOrderValue).toFixed(2)}\n` +
    `✅ Conversion Rate: ${safeNum(conversionRate).toFixed(1)}%\n` +
    `❌ Cancel Rate: ${safeNum(cancelRate).toFixed(1)}%\n` +
    `👥 Total Users: ${users.length}\n` +
    `📦 Products: ${products.length} (${activeProducts.length} active)\n` +
    `📂 Categories: ${categories.length}\n\n` +
    `⚠️ *REQUIRES ATTENTION*\n` +
    `💳 Pending Verification: ${pendingOrders.length}\n` +
    `⏳ Pending Payment: ${pendingPayments.length}\n` +
    `⚠️ Low Stock: ${lowStockProducts.length}\n` +
    `📦 Out of Stock: ${outOfStockProducts.length}\n` +
    `═══════════════════`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'owner_dashboard')],
    [Markup.button.callback(lang === 'ms' ? '📊 Laporan Terperinci' : '📊 Detailed Report', 'owner_detailed_report')],
    [Markup.button.callback(lang === 'ms' ? '📈 Trend Analysis' : '📈 Trend Analysis', 'owner_trend_analysis')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Panel Owner' : '🔙 Owner Panel', 'owner_panel')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleDetailedReport(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const transactions = await db.getTransactions();
  const categories = await db.getCategories();
  const users = await db.getUsers();

  // Top products by revenue + sales count
  const productStats = {};
  transactions.filter(t => t.status === 'completed').forEach(t => {
    if (!productStats[t.productId]) productStats[t.productId] = { revenue: 0, count: 0 };
    productStats[t.productId].revenue += (t.price || 0);
    productStats[t.productId].count += 1;
  });

  const topProducts = Object.entries(productStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([productId, stats]) => {
      const prod = products.find(p => p.id === productId);
      return { product: prod, revenue: stats.revenue, count: stats.count };
    });

  // Top categories by revenue
  const categoryRevenue = {};
  transactions.filter(t => t.status === 'completed').forEach(t => {
    const prod = products.find(p => p.id === t.productId);
    if (prod) {
      categoryRevenue[prod.categoryId] = (categoryRevenue[prod.categoryId] || 0) + (t.price || 0);
    }
  });

  const topCategories = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, revenue]) => {
      const cat = categories.find(c => c.id === categoryId);
      return { category: cat, revenue };
    });

  // Top 5 customers by total spend
  const customerSpend = {};
  transactions.filter(t => t.status === 'completed').forEach(t => {
    if (!customerSpend[t.userId]) customerSpend[t.userId] = { total: 0, orders: 0 };
    customerSpend[t.userId].total += (t.price || 0);
    customerSpend[t.userId].orders += 1;
  });

  const topCustomers = Object.entries(customerSpend)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([custId, stats]) => {
      const u = users.find(usr => String(usr.id) === String(custId));
      return { user: u, total: stats.total, orders: stats.orders };
    });

  let text = lang === 'ms'
    ? `📊 *Laporan Terperinci*\n\n`
    : `📊 *Detailed Report*\n\n`;

  text += lang === 'ms' ? `🏆 *TOP 5 PRODUK*\n` : `🏆 *TOP 5 PRODUCTS*\n`;
  topProducts.forEach((item, index) => {
    if (item.product) {
      text += `${index + 1}. ${item.product.name.ms}\n   💰 RM${safeNum(item.revenue).toFixed(2)} • ${item.count} ${lang === 'ms' ? 'jualan' : 'sales'}\n`;
    }
  });

  text += lang === 'ms' ? `\n📂 *TOP 5 KATEGORI*\n` : `\n📂 *TOP 5 CATEGORIES*\n`;
  topCategories.forEach((item, index) => {
    if (item.category) {
      text += `${index + 1}. ${item.category.icon} ${item.category.name.ms}\n   💰 RM${safeNum(item.revenue).toFixed(2)}\n`;
    }
  });

  text += lang === 'ms' ? `\n👑 *TOP 5 PELANGGAN*\n` : `\n👑 *TOP 5 CUSTOMERS*\n`;
  topCustomers.forEach((item, index) => {
    const name = item.user ? (item.user.firstName || 'Unknown') : 'Unknown';
    text += `${index + 1}. ${name}\n   💰 RM${safeNum(item.total).toFixed(2)} • ${item.orders} ${lang === 'ms' ? 'pesanan' : 'orders'}\n`;
  });

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_dashboard')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleTrendAnalysis(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const users = await db.getUsers();

  // Last 7 days daily revenue
  const dailyRevenue = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayOrders = transactions.filter(t => {
      const orderDate = new Date(t.createdAt);
      return orderDate >= date && orderDate < nextDate && t.status === 'completed';
    });

    const dayRevenue = dayOrders.reduce((sum, t) => sum + (t.price || 0), 0);
    dailyRevenue.push({ date, revenue: dayRevenue, orders: dayOrders.length });
  }

  let text = lang === 'ms'
    ? `📈 *Analisis Trend*\n\n`
    : `📈 *Trend Analysis*\n\n`;

  text += lang === 'ms' ? `📊 *JUALAN 7 HARI LEPAS*\n` : `📊 *SALES LAST 7 DAYS*\n`;

  dailyRevenue.forEach((day, index) => {
    const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
    const bar = '█'.repeat(Math.min(10, Math.floor(day.revenue / 10)));
    text += `${dayName}: ${bar} RM${safeNum(day.revenue).toFixed(0)} (${day.orders})\n`;
  });

  const avgDailyRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0) / 7;
  const avgDailyOrders = dailyRevenue.reduce((sum, day) => sum + day.orders, 0) / 7;

  text += lang === 'ms'
    ? `\n📊 Avg Harian: RM${safeNum(avgDailyRevenue).toFixed(2)}\n📦 Avg Order: ${safeNum(avgDailyOrders).toFixed(1)}/hari`
    : `\n📊 Daily Avg: RM${safeNum(avgDailyRevenue).toFixed(2)}\n📦 Avg Orders: ${safeNum(avgDailyOrders).toFixed(1)}/day`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_dashboard')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  handleOwnerDashboard,
  handleDetailedReport,
  handleTrendAnalysis
};
