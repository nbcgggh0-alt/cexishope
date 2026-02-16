const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const filterState = new Map();

async function handleAdvancedOrderFilters(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const text = lang === 'ms'
    ? `📅 *Tapis Pesanan Lanjutan*\n\n` +
      `Pilih julat tarikh untuk tapis pesanan:`
    : `📅 *Advanced Order Filters*\n\n` +
      `Select date range to filter orders:`;
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📅 Hari Ini' : '📅 Today', 'filter_date_today')],
    [Markup.button.callback(lang === 'ms' ? '📆 Semalam' : '📆 Yesterday', 'filter_date_yesterday')],
    [Markup.button.callback(lang === 'ms' ? '📅 Minggu Ini' : '📅 This Week', 'filter_date_week')],
    [Markup.button.callback(lang === 'ms' ? '📅 Bulan Ini' : '📅 This Month', 'filter_date_month')],
    [Markup.button.callback(lang === 'ms' ? '📅 7 Hari Lepas' : '📅 Last 7 Days', 'filter_date_7days')],
    [Markup.button.callback(lang === 'ms' ? '📅 30 Hari Lepas' : '📅 Last 30 Days', 'filter_date_30days')],
    [Markup.button.callback(lang === 'ms' ? '📅 Julat Tersuai' : '📅 Custom Range', 'filter_date_custom')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_orders')]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleDateFilter(ctx, filterType) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  if (filterType === 'custom') {
    filterState.set(adminId, { step: 'start_date' });
    
    await ctx.answerCbQuery();
    await ctx.reply(
      lang === 'ms'
        ? `📅 *Julat Tarikh Tersuai*\n\n` +
          `Sila hantar tarikh mula:\n\n` +
          `Format: DD/MM/YYYY\n` +
          `Contoh: 01/11/2025`
        : `📅 *Custom Date Range*\n\n` +
          `Please send start date:\n\n` +
          `Format: DD/MM/YYYY\n` +
          `Example: 01/11/2025`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const { startDate, endDate } = getDateRange(filterType);
  await showFilteredOrders(ctx, startDate, endDate, filterType);
}

function getDateRange(filterType) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate, endDate;
  
  switch (filterType) {
    case 'today':
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
      
    case 'yesterday':
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      endDate = today;
      break;
      
    case 'week':
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate = new Date(today.setDate(diff));
      endDate = new Date();
      break;
      
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
      break;
      
    case '7days':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = new Date();
      break;
      
    case '30days':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date();
      break;
      
    default:
      startDate = new Date(0);
      endDate = new Date();
  }
  
  return { startDate, endDate };
}

async function showFilteredOrders(ctx, startDate, endDate, filterType) {
  const adminId = ctx.from.id;
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const transactions = await db.getTransactions();
  const filteredOrders = transactions.filter(t => {
    const orderDate = new Date(t.createdAt);
    return orderDate >= startDate && orderDate <= endDate;
  });
  
  const pendingOrders = filteredOrders.filter(t => t.status === 'pending');
  const verifiedOrders = filteredOrders.filter(t => t.status === 'verified');
  const rejectedOrders = filteredOrders.filter(t => t.status === 'rejected');
  
  const totalRevenue = verifiedOrders.reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const filterLabel = {
    today: lang === 'ms' ? 'Hari Ini' : 'Today',
    yesterday: lang === 'ms' ? 'Semalam' : 'Yesterday',
    week: lang === 'ms' ? 'Minggu Ini' : 'This Week',
    month: lang === 'ms' ? 'Bulan Ini' : 'This Month',
    '7days': lang === 'ms' ? '7 Hari Lepas' : 'Last 7 Days',
    '30days': lang === 'ms' ? '30 Hari Lepas' : 'Last 30 Days',
    custom: lang === 'ms' ? 'Julat Tersuai' : 'Custom Range'
  }[filterType] || '';
  
  const text = lang === 'ms'
    ? `📊 *Laporan Pesanan: ${filterLabel}*\n\n` +
      `📅 Dari: ${startDate.toLocaleDateString('ms-MY')}\n` +
      `📅 Hingga: ${endDate.toLocaleDateString('ms-MY')}\n\n` +
      `📦 *Ringkasan:*\n` +
      `Jumlah Pesanan: ${filteredOrders.length}\n` +
      `⏳ Pending: ${pendingOrders.length}\n` +
      `✅ Disahkan: ${verifiedOrders.length}\n` +
      `❌ Ditolak: ${rejectedOrders.length}\n\n` +
      `💰 Jumlah Hasil: RM${totalRevenue.toFixed(2)}\n\n` +
      (filteredOrders.length > 0
        ? `📋 *Pesanan Terkini:*\n\n` +
          filteredOrders.slice(0, 10).map((order, i) => {
            const statusIcon = order.status === 'verified' ? '✅' : order.status === 'pending' ? '⏳' : '❌';
            const date = new Date(order.createdAt).toLocaleString('ms-MY');
            return `${i + 1}. ${statusIcon} \`${order.id}\`\n   💰 RM${order.amount} | ${date}`;
          }).join('\n\n')
        : '📭 Tiada pesanan dalam julat ini')
    : `📊 *Order Report: ${filterLabel}*\n\n` +
      `📅 From: ${startDate.toLocaleDateString('en-US')}\n` +
      `📅 To: ${endDate.toLocaleDateString('en-US')}\n\n` +
      `📦 *Summary:*\n` +
      `Total Orders: ${filteredOrders.length}\n` +
      `⏳ Pending: ${pendingOrders.length}\n` +
      `✅ Verified: ${verifiedOrders.length}\n` +
      `❌ Rejected: ${rejectedOrders.length}\n\n` +
      `💰 Total Revenue: RM${totalRevenue.toFixed(2)}\n\n` +
      (filteredOrders.length > 0
        ? `📋 *Recent Orders:*\n\n` +
          filteredOrders.slice(0, 10).map((order, i) => {
            const statusIcon = order.status === 'verified' ? '✅' : order.status === 'pending' ? '⏳' : '❌';
            const date = new Date(order.createdAt).toLocaleString('en-US');
            return `${i + 1}. ${statusIcon} \`${order.id}\`\n   💰 RM${order.amount} | ${date}`;
          }).join('\n\n')
        : '📭 No orders in this range');
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📊 Export Data' : '📊 Export Data', `export_orders_${filterType}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'adv_order_filters')]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function processCustomDateInput(ctx) {
  const userId = ctx.from.id;
  const state = filterState.get(userId);
  
  if (!state) return;
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const text = ctx.message.text.trim();
  
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = text.match(dateRegex);
  
  if (!match) {
    await ctx.reply(
      lang === 'ms'
        ? `❌ Format tarikh tidak sah!\n\nFormat: DD/MM/YYYY\nContoh: 01/11/2025`
        : `❌ Invalid date format!\n\nFormat: DD/MM/YYYY\nExample: 01/11/2025`
    );
    return;
  }
  
  const [, day, month, year] = match;
  const date = new Date(year, month - 1, day);
  
  if (isNaN(date.getTime())) {
    await ctx.reply(lang === 'ms' ? '❌ Tarikh tidak sah!' : '❌ Invalid date!');
    return;
  }
  
  if (state.step === 'start_date') {
    state.startDate = date;
    state.step = 'end_date';
    
    await ctx.reply(
      lang === 'ms'
        ? `✅ Tarikh mula: ${date.toLocaleDateString('ms-MY')}\n\n` +
          `Sila hantar tarikh akhir:\n\n` +
          `Format: DD/MM/YYYY\n` +
          `Contoh: 30/11/2025`
        : `✅ Start date: ${date.toLocaleDateString('en-US')}\n\n` +
          `Please send end date:\n\n` +
          `Format: DD/MM/YYYY\n` +
          `Example: 30/11/2025`
    );
    
  } else if (state.step === 'end_date') {
    if (date < state.startDate) {
      await ctx.reply(
        lang === 'ms'
          ? '❌ Tarikh akhir mestilah selepas tarikh mula!'
          : '❌ End date must be after start date!'
      );
      return;
    }
    
    const startDate = state.startDate;
    const endDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    
    filterState.delete(userId);
    
    await showFilteredOrders(ctx, startDate, endDate, 'custom');
  }
}

module.exports = {
  handleAdvancedOrderFilters,
  handleDateFilter,
  processCustomDateInput,
  showFilteredOrders,
  getDateRange
};
