const { Markup } = require('telegraf');
const db = require('../utils/database');
const queueManager = require('../utils/queueManager');
const { safeEditMessage } = require('../utils/messageHelper');

async function handleQueuePanel(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  await ctx.answerCbQuery();
  
  const stats = await queueManager.getQueueStats();
  const processingOrders = await queueManager.getProcessingOrders();
  const waitingOrders = await queueManager.getWaitingOrders();
  
  const text = lang === 'ms'
    ? `📋 *Panel Antrian Order*\n\n` +
      `📊 *Statistik:*\n` +
      `👥 Total dalam antrian: ${stats.total}\n` +
      `⏳ Menunggu: ${stats.waiting}\n` +
      `⚙️ Diproses: ${stats.processing}\n` +
      `🔴 Prioriti tinggi: ${stats.highPriority}\n\n` +
      `⏱️ Purata masa proses: ${Math.round(stats.averageProcessingTime / 60)} minit\n` +
      `🔢 Maks proses serentak: ${stats.maxConcurrentOrders}\n\n` +
      `_Pilih tindakan di bawah:_`
    : `📋 *Order Queue Panel*\n\n` +
      `📊 *Statistics:*\n` +
      `👥 Total in queue: ${stats.total}\n` +
      `⏳ Waiting: ${stats.waiting}\n` +
      `⚙️ Processing: ${stats.processing}\n` +
      `🔴 High priority: ${stats.highPriority}\n\n` +
      `⏱️ Average processing time: ${Math.round(stats.averageProcessingTime / 60)} minutes\n` +
      `🔢 Max concurrent orders: ${stats.maxConcurrentOrders}\n\n` +
      `_Choose an action below:_`;
  
  const buttons = [
    [Markup.button.callback(
      lang === 'ms' ? `📋 Lihat Antrian (${stats.waiting})` : `📋 View Queue (${stats.waiting})`,
      'queue_view_waiting'
    )],
    [Markup.button.callback(
      lang === 'ms' ? `⚙️ Sedang Diproses (${stats.processing})` : `⚙️ Processing (${stats.processing})`,
      'queue_view_processing'
    )],
    [Markup.button.callback(
      lang === 'ms' ? '⚙️ Tetapan Antrian' : '⚙️ Queue Settings',
      'queue_settings'
    )],
    [Markup.button.callback(
      lang === 'ms' ? '🔙 Kembali' : '🔙 Back',
      'admin_panel'
    )]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleViewWaitingQueue(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  await ctx.answerCbQuery();
  
  const waitingOrders = await queueManager.getWaitingOrders();
  
  if (waitingOrders.length === 0) {
    await safeEditMessage(ctx, 
      lang === 'ms' 
        ? '✅ *Tiada Order dalam Antrian*\n\nSemua order telah diproses.'
        : '✅ *No Orders in Queue*\n\nAll orders have been processed.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'queue_panel')]
        ])
      }
    );
    return;
  }
  
  let text = lang === 'ms'
    ? `📋 *Antrian Order (${waitingOrders.length})*\n\n`
    : `📋 *Order Queue (${waitingOrders.length})*\n\n`;
  
  const buttons = [];
  
  waitingOrders.slice(0, 10).forEach((item, index) => {
    const priorityIcon = item.priority === 'high' ? '🔴' : '⚪';
    const estimatedTime = queueManager.formatTimeRemaining(item.estimatedCompletion);
    
    text += `${priorityIcon} *#${item.position}* - \`${item.orderId}\`\n`;
    text += `   📦 ${item.productName}\n`;
    text += `   👤 User: ${item.userId}\n`;
    text += `   ⏰ ETA: ${estimatedTime}\n\n`;
    
    buttons.push([
      Markup.button.callback(`✅ Proses #${item.position}`, `queue_start_${item.orderId}`),
      Markup.button.callback(`🔴 Prioriti`, `queue_priority_${item.orderId}`)
    ]);
  });
  
  if (waitingOrders.length > 10) {
    text += lang === 'ms'
      ? `\n_Menunjukkan 10 order pertama sahaja._`
      : `\n_Showing first 10 orders only._`;
  }
  
  buttons.push([
    Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'queue_view_waiting'),
    Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'queue_panel')
  ]);
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleViewProcessingQueue(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  await ctx.answerCbQuery();
  
  const processingOrders = await queueManager.getProcessingOrders();
  
  if (processingOrders.length === 0) {
    await safeEditMessage(ctx,
      lang === 'ms'
        ? '✅ *Tiada Order Sedang Diproses*\n\nTiada order yang sedang diproses sekarang.'
        : '✅ *No Orders Processing*\n\nNo orders are currently being processed.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'queue_panel')]
        ])
      }
    );
    return;
  }
  
  let text = lang === 'ms'
    ? `⚙️ *Order Sedang Diproses (${processingOrders.length})*\n\n`
    : `⚙️ *Orders Being Processed (${processingOrders.length})*\n\n`;
  
  processingOrders.forEach((item, index) => {
    const timeRemaining = queueManager.formatTimeRemaining(item.estimatedCompletion);
    const processingTime = Math.round((new Date() - new Date(item.startedAt)) / 60000);
    
    text += `${index + 1}. \`${item.orderId}\`\n`;
    text += `   📦 ${item.productName}\n`;
    text += `   👤 User: ${item.userId}\n`;
    text += `   👨‍💼 Admin: ${item.adminId}\n`;
    text += `   ⏱️ Sudah: ${processingTime} minit\n`;
    text += `   ⏰ Sisa: ${timeRemaining}\n\n`;
  });
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'queue_view_processing'),
        Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'queue_panel')
      ]
    ])
  });
}

async function handleQueueSettings(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  await ctx.answerCbQuery();
  
  const settings = await queueManager.getSettings();
  
  const text = lang === 'ms'
    ? `⚙️ *Tetapan Antrian*\n\n` +
      `⏱️ Purata masa proses: ${Math.round(settings.averageProcessingTime / 60)} minit\n` +
      `📦 Anggaran masa per order: ${Math.round(settings.estimatedTimePerOrder / 60)} minit\n` +
      `🔢 Maks order serentak: ${settings.maxConcurrentOrders}\n\n` +
      `_Gunakan /setqueuemax [angka] untuk tukar maksimum order serentak_\n` +
      `_Gunakan /setqueuetime [minit] untuk tukar anggaran masa per order_`
    : `⚙️ *Queue Settings*\n\n` +
      `⏱️ Average processing time: ${Math.round(settings.averageProcessingTime / 60)} minutes\n` +
      `📦 Estimated time per order: ${Math.round(settings.estimatedTimePerOrder / 60)} minutes\n` +
      `🔢 Max concurrent orders: ${settings.maxConcurrentOrders}\n\n` +
      `_Use /setqueuemax [number] to change max concurrent orders_\n` +
      `_Use /setqueuetime [minutes] to change estimated time per order_`;
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'queue_panel')]
    ])
  });
}

async function handleStartProcessing(ctx, orderId) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const result = await queueManager.startProcessing(orderId, userId);
  
  if (!result.success) {
    await ctx.answerCbQuery(result.message, { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery('✅ Order sedang diproses');
  
  const user = await db.getUser(result.item.userId);
  const lang = user?.language || 'ms';
  
  try {
    await ctx.telegram.sendMessage(
      result.item.userId,
      lang === 'ms'
        ? `🎉 *Order Anda Sedang Diproses!*\n\n` +
          `🆔 Order ID: \`${orderId}\`\n` +
          `📦 Produk: ${result.item.productName}\n` +
          `👨‍💼 Admin: ${userId}\n\n` +
          `Admin sedang memproses order anda sekarang!\n` +
          `Anggaran masa: ${queueManager.formatTimeRemaining(result.item.estimatedCompletion)}`
        : `🎉 *Your Order Is Being Processed!*\n\n` +
          `🆔 Order ID: \`${orderId}\`\n` +
          `📦 Product: ${result.item.productName}\n` +
          `👨‍💼 Admin: ${userId}\n\n` +
          `Admin is now processing your order!\n` +
          `Estimated time: ${queueManager.formatTimeRemaining(result.item.estimatedCompletion)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to notify customer:', error.message);
  }
  
  await handleViewWaitingQueue(ctx);
}

async function handleSetPriority(ctx, orderId) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }
  
  const result = await queueManager.setPriority(orderId, 'high');
  
  if (!result.success) {
    await ctx.answerCbQuery(result.message, { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery('🔴 Prioriti ditetapkan');
  
  const user = await db.getUser(result.item.userId);
  const lang = user?.language || 'ms';
  
  try {
    await ctx.telegram.sendMessage(
      result.item.userId,
      lang === 'ms'
        ? `🔴 *Order Anda Diberi Prioriti!*\n\n` +
          `Order anda telah dinaikkan ke prioriti tinggi.\n` +
          `Posisi baru: #${result.item.position}\n\n` +
          `Anda akan dilayan lebih awal!`
        : `🔴 *Your Order Got Priority!*\n\n` +
          `Your order has been elevated to high priority.\n` +
          `New position: #${result.item.position}\n\n` +
          `You will be served earlier!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to notify customer:', error.message);
  }
  
  await handleViewWaitingQueue(ctx);
}

async function handleMyQueueStatus(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  const transactions = await db.getTransactions();
  const myOrders = transactions.filter(t => 
    t.userId === userId && 
    (t.status === 'pending' || t.status === 'awaiting_verification')
  );
  
  if (myOrders.length === 0) {
    await ctx.reply(
      lang === 'ms'
        ? '✅ Anda tiada order dalam antrian.'
        : '✅ You have no orders in queue.'
    );
    return;
  }
  
  let text = lang === 'ms'
    ? `📋 *Status Antrian Anda*\n\n`
    : `📋 *Your Queue Status*\n\n`;
  
  for (const order of myOrders) {
    const queuePos = await queueManager.getQueuePosition(order.id);
    
    if (queuePos) {
      const productName = typeof order.productName === 'object'
        ? (order.productName[lang] || order.productName.ms)
        : order.productName;
      
      const statusText = queuePos.status === 'processing'
        ? (lang === 'ms' ? '⚙️ Sedang Diproses' : '⚙️ Processing')
        : (lang === 'ms' ? '⏳ Menunggu' : '⏳ Waiting');
      
      const priorityText = queuePos.priority === 'high'
        ? (lang === 'ms' ? '🔴 Prioriti Tinggi' : '🔴 High Priority')
        : '';
      
      text += `🆔 \`${order.id}\`\n`;
      text += `📦 ${productName}\n`;
      text += `📊 Status: ${statusText} ${priorityText}\n`;
      text += `📋 Posisi: #${queuePos.position}\n`;
      text += `👥 Di hadapan: ${queuePos.waitingAhead}\n`;
      text += `⏰ Anggaran: ${queueManager.formatEstimatedTime(queuePos.estimatedCompletion)}\n\n`;
    }
  }
  
  text += lang === 'ms'
    ? `_Kami akan notify anda bila giliran anda tiba!_`
    : `_We will notify you when it's your turn!_`;
  
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleSetQueueMax(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  const maxConcurrent = parseInt(args[1]);
  
  if (!maxConcurrent || maxConcurrent < 1 || maxConcurrent > 10) {
    await ctx.reply('❌ Invalid number. Please use: /setqueuemax [1-10]');
    return;
  }
  
  const settings = await queueManager.getSettings();
  settings.maxConcurrentOrders = maxConcurrent;
  await queueManager.saveSettings(settings);
  await queueManager.updateEstimatedTimes();
  
  await ctx.reply(`✅ Maximum concurrent orders set to: ${maxConcurrent}`);
}

async function handleSetQueueTime(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');
  
  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  const timeInMinutes = parseInt(args[1]);
  
  if (!timeInMinutes || timeInMinutes < 1 || timeInMinutes > 120) {
    await ctx.reply('❌ Invalid time. Please use: /setqueuetime [1-120] (minutes)');
    return;
  }
  
  const settings = await queueManager.getSettings();
  settings.estimatedTimePerOrder = timeInMinutes * 60;
  await queueManager.saveSettings(settings);
  await queueManager.updateEstimatedTimes();
  
  await ctx.reply(`✅ Estimated time per order set to: ${timeInMinutes} minutes`);
}

module.exports = {
  handleQueuePanel,
  handleViewWaitingQueue,
  handleViewProcessingQueue,
  handleQueueSettings,
  handleStartProcessing,
  handleSetPriority,
  handleMyQueueStatus,
  handleSetQueueMax,
  handleSetQueueTime
};
