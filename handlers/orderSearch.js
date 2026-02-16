const { Markup } = require('telegraf');
const db = require('../utils/database');
const { isOwnerOrAdmin } = require('./userManagement');

async function handleSearchOrders(ctx, searchQuery) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can search orders.');
    return;
  }

  if (!searchQuery) {
    await ctx.reply(
      '🔍 *Advanced Order Search*\n\n' +
      'Usage: /searchorder [query]\n\n' +
      '📝 Examples:\n' +
      '• /searchorder status:pending\n' +
      '• /searchorder user:123456\n' +
      '• /searchorder product:PROD-ABC\n' +
      '• /searchorder date:2025-10-10\n' +
      '• /searchorder completed\n' +
      '• /searchorder ORD-123\n\n' +
      '🏷️ Available status:\n' +
      'pending, awaiting_verification, completed, rejected',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const transactions = await db.getTransactions();

  if (!transactions || transactions.length === 0) {
    await ctx.reply('❌ No orders found in the system.');
    return;
  }

  let results = [...transactions];

  // Parse search query
  const query = searchQuery.toLowerCase().trim();

  // Search by status
  if (query.includes('status:')) {
    const status = query.split('status:')[1].split(' ')[0];
    results = results.filter(t => t.status === status);
  }
  // Search by user ID
  else if (query.includes('user:')) {
    const userId = query.split('user:')[1].split(' ')[0];
    results = results.filter(t => t.userId == userId);
  }
  // Search by product ID
  else if (query.includes('product:')) {
    const productId = query.split('product:')[1].split(' ')[0];
    results = results.filter(t => t.productId === productId);
  }
  // Search by date (YYYY-MM-DD)
  else if (query.includes('date:')) {
    const date = query.split('date:')[1].split(' ')[0];
    results = results.filter(t => t.createdAt.includes(date));
  }
  // Search by order ID
  else if (query.startsWith('ord-')) {
    results = results.filter(t => t.id.toLowerCase() === query);
  }
  // Search by status name directly
  else if (['pending', 'awaiting_verification', 'completed', 'rejected'].includes(query)) {
    results = results.filter(t => t.status === query);
  }
  // General search in product name
  else {
    results = results.filter(t => {
      const productName = (t.productName?.ms || t.productName || '').toLowerCase();
      return productName.includes(query) || t.id.toLowerCase().includes(query);
    });
  }

  if (results.length === 0) {
    await ctx.reply(`❌ No orders found for: "${searchQuery}"`);
    return;
  }

  // Sort by date (newest first)
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Limit to 20 results
  const displayResults = results.slice(0, 20);

  let message = `🔍 *Search Results* (${results.length} found)\n\n`;

  displayResults.forEach((order, index) => {
    const statusEmoji = {
      'pending': '⏳',
      'awaiting_verification': '⏱️',
      'completed': '✅',
      'rejected': '❌'
    }[order.status] || '📦';

    message += `${index + 1}. ${statusEmoji} *${order.id}*\n`;
    message += `   📦 ${order.productName?.ms || order.productName || 'N/A'}\n`;
    message += `   👤 User: ${order.userId}\n`;
    message += `   💰 RM${order.price}\n`;
    message += `   📅 ${new Date(order.createdAt).toLocaleDateString()}\n`;
    message += `   📊 Status: ${order.status}\n\n`;
  });

  if (results.length > 20) {
    message += `\n... and ${results.length - 20} more results.\n`;
  }

  message += '\n💡 Use /verify [order_id] or /reject [order_id]';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleFilterOrders(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can filter orders.');
    return;
  }

  const buttons = [
    [
      Markup.button.callback('⏳ Pending', 'filter_pending'),
      Markup.button.callback('⏱️ Awaiting', 'filter_awaiting_verification')
    ],
    [
      Markup.button.callback('✅ Completed', 'filter_completed'),
      Markup.button.callback('❌ Rejected', 'filter_rejected')
    ],
    [
      Markup.button.callback('📅 Today', 'filter_today'),
      Markup.button.callback('📅 This Week', 'filter_week')
    ],
    [Markup.button.callback('🔙 Back', 'admin_panel')]
  ];

  await ctx.reply(
    '🔍 *Filter Orders*\n\nSelect a filter option:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
}

async function handleFilterCallback(ctx, filter) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const transactions = await db.getTransactions();
  let results = [...transactions];
  let filterName = filter;

  // Apply filter
  if (filter === 'pending' || filter === 'awaiting_verification' || filter === 'completed' || filter === 'rejected') {
    results = results.filter(t => t.status === filter);
  } else if (filter === 'today') {
    const today = new Date().toISOString().split('T')[0];
    results = results.filter(t => t.createdAt.includes(today));
    filterName = 'Today';
  } else if (filter === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    results = results.filter(t => new Date(t.createdAt) >= weekAgo);
    filterName = 'This Week';
  }

  if (results.length === 0) {
    await ctx.answerCbQuery(`No orders found for: ${filterName}`);
    return;
  }

  // Sort by date (newest first)
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const displayResults = results.slice(0, 15);

  let message = `🔍 *Filter: ${filterName}* (${results.length} orders)\n\n`;

  displayResults.forEach((order, index) => {
    const statusEmoji = {
      'pending': '⏳',
      'awaiting_verification': '⏱️',
      'completed': '✅',
      'rejected': '❌'
    }[order.status] || '📦';

    message += `${index + 1}. ${statusEmoji} *${order.id}*\n`;
    message += `   📦 ${order.productName?.ms || order.productName || 'N/A'}\n`;
    message += `   💰 RM${order.price} | 👤 ${order.userId}\n\n`;
  });

  if (results.length > 15) {
    message += `... and ${results.length - 15} more\n`;
  }

  await ctx.editMessageText(message, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery();
}

module.exports = {
  handleSearchOrders,
  handleFilterOrders,
  handleFilterCallback
};
