const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { safeEditMessage } = require('../utils/messageHelper');
const { sendFeedbackRequest } = require('./feedback');
const { logAdminAction } = require('../utils/adminLogger');
const { escapeMarkdown } = require('../utils/security'); // Security Utils

const broadcastMode = new Map();

async function isAdmin(userId) {
  const admins = await db.getAdmins();
  return admins.owner === userId || admins.admins.includes(userId);
}

async function handleAdminPanel(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    await ctx.answerCbQuery(t('unauthorized', lang));
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification');
  const todayOrders = transactions.filter(t => {
    const today = new Date().toDateString();
    const orderDate = new Date(t.createdAt).toDateString();
    return today === orderDate;
  });
  const completedToday = todayOrders.filter(t => t.status === 'completed');

  const products = await db.getProducts();
  const lowStock = products.filter(p => p.stock < 5 && p.active);

  const statsText = lang === 'ms'
    ? `\n\n📊 *Statistik Hari Ini:*\n💳 Pending: ${pendingOrders.length}\n✅ Selesai: ${completedToday.length}\n⚠️ Stok Rendah: ${lowStock.length}`
    : `\n\n📊 *Today's Statistics:*\n💳 Pending: ${pendingOrders.length}\n✅ Completed: ${completedToday.length}\n⚠️ Low Stock: ${lowStock.length}`;

  const queueManager = require('../utils/queueManager');
  const queueStats = await queueManager.getQueueStats();

  const buttons = [
    [Markup.button.callback(
      lang === 'ms' ? `💳 Order Baru (${pendingOrders.length})` : `💳 New Orders (${pendingOrders.length})`,
      'admin_orders'
    )],
    [Markup.button.callback(
      lang === 'ms' ? `📋 Antrian Order (${queueStats.waiting})` : `📋 Order Queue (${queueStats.waiting})`,
      'queue_panel'
    )],
    [Markup.button.callback(t('btnManageProducts', lang), 'admin_products_menu')],
    [Markup.button.callback(lang === 'ms' ? '⚡ Quick Actions' : '⚡ Quick Actions', 'quick_actions')],
    [Markup.button.callback(t('btnActiveSessions', lang), 'admin_sessions')],
    [Markup.button.callback(t('btnBroadcast', lang), 'admin_broadcast')],
    [
      Markup.button.callback(lang === 'ms' ? '✅ Semua Order' : '✅ All Orders', 'all_orders'),
      Markup.button.callback(lang === 'ms' ? '🔍 Cari Order' : '🔍 Search', 'admin_search_orders')
    ],
    [
      Markup.button.callback(lang === 'ms' ? '👥 Urus User' : '👥 User Mgmt', 'admin_user_mgmt'),
      Markup.button.callback(lang === 'ms' ? '💬 Quick Reply' : '💬 Quick Reply', 'admin_quick_reply')
    ],
    [
      Markup.button.callback(lang === 'ms' ? '📊 Statistik' : '📊 Statistics', 'admin_statistics'),
      Markup.button.callback(lang === 'ms' ? '📥 Export' : '📥 Export', 'export_menu')
    ],
    [Markup.button.callback(t('btnBack', lang), 'main_menu')]
  ];

  await safeEditMessage(ctx, t('adminPanel', lang) + statsText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAdminStatistics(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const users = await db.getUsers();
  const products = await db.getProducts();

  const totalOrders = transactions.length;
  const completedOrders = transactions.filter(t => t.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, t) => sum + parseFloat(t.price || 0), 0);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayOrders = transactions.filter(t => new Date(t.createdAt) >= todayStart);
  const todayRevenue = todayOrders
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.price || 0), 0);

  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekOrders = transactions.filter(t => new Date(t.createdAt) >= lastWeek);
  const weekRevenue = weekOrders
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.price || 0), 0);

  const activeProducts = products.filter(p => p.active);
  const lowStockProducts = products.filter(p => p.stock < 5 && p.active);

  const text = lang === 'ms'
    ? `📊 *Statistik Kedai*\n\n` +
    `👥 *Pengguna:*\n` +
    `Total: ${users.length}\n\n` +
    `📦 *Produk:*\n` +
    `Total: ${products.length}\n` +
    `Aktif: ${activeProducts.length}\n` +
    `⚠️ Stok Rendah: ${lowStockProducts.length}\n\n` +
    `💰 *Jualan:*\n` +
    `Hari Ini: RM${todayRevenue.toFixed(2)} (${todayOrders.filter(t => t.status === 'completed').length} order)\n` +
    `7 Hari: RM${weekRevenue.toFixed(2)} (${weekOrders.filter(t => t.status === 'completed').length} order)\n` +
    `Semua: RM${totalRevenue.toFixed(2)} (${completedOrders.length} order)\n\n` +
    `📋 *Order:*\n` +
    `Total: ${totalOrders}\n` +
    `✅ Selesai: ${completedOrders.length}\n` +
    `💳 Pending Verification: ${transactions.filter(t => t.status === 'awaiting_verification').length}\n` +
    `⏳ Pending Payment: ${transactions.filter(t => t.status === 'pending').length}\n` +
    `❌ Ditolak: ${transactions.filter(t => t.status === 'rejected').length}`
    : `📊 *Store Statistics*\n\n` +
    `👥 *Users:*\n` +
    `Total: ${users.length}\n\n` +
    `📦 *Products:*\n` +
    `Total: ${products.length}\n` +
    `Active: ${activeProducts.length}\n` +
    `⚠️ Low Stock: ${lowStockProducts.length}\n\n` +
    `💰 *Sales:*\n` +
    `Today: RM${todayRevenue.toFixed(2)} (${todayOrders.filter(t => t.status === 'completed').length} orders)\n` +
    `7 Days: RM${weekRevenue.toFixed(2)} (${weekOrders.filter(t => t.status === 'completed').length} orders)\n` +
    `All Time: RM${totalRevenue.toFixed(2)} (${completedOrders.length} orders)\n\n` +
    `📋 *Orders:*\n` +
    `Total: ${totalOrders}\n` +
    `✅ Completed: ${completedOrders.length}\n` +
    `💳 Pending Verification: ${transactions.filter(t => t.status === 'awaiting_verification').length}\n` +
    `⏳ Pending Payment: ${transactions.filter(t => t.status === 'pending').length}\n` +
    `❌ Rejected: ${transactions.filter(t => t.status === 'rejected').length}`;

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'admin_statistics')],
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
    ])
  });
}

async function handleAdminOrders(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification');

  if (pendingOrders.length === 0) {
    const message = lang === 'ms'
      ? '✅ *Tiada Order Pending*\n\nSemua order telah diproses.'
      : '✅ *No Pending Orders*\n\nAll orders have been processed.';

    await safeEditMessage(ctx, message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'admin_panel')]
      ])
    });
    return;
  }

  const recentOrders = pendingOrders.slice(-5).reverse();

  let text = lang === 'ms'
    ? `📥 *Order Menunggu Pengesahan*\n\nJumlah: ${pendingOrders.length} order\n\n`
    : `📥 *Orders Pending Verification*\n\nTotal: ${pendingOrders.length} orders\n\n`;

  const buttons = [];

  recentOrders.forEach((order, index) => {
    const productName = typeof order.productName === 'object'
      ? (order.productName.ms || order.productName.en)
      : order.productName;

    const safeProductName = escapeMarkdown(productName);
    const safeOrderId = escapeMarkdown(order.id);
    const safeUserId = escapeMarkdown(String(order.userId));

    text += `${index + 1}. 🆔 \`${safeOrderId}\`\n`;
    text += `   📦 ${safeProductName}\n`;
    text += `   💰 RM${order.price}\n`;
    text += `   👤 User: ${safeUserId}\n\n`;

    buttons.push([
      Markup.button.callback(`✅ ${order.id}`, `verify_order_${order.id}`),
      Markup.button.callback(`❌`, `reject_order_${order.id}`)
    ]);
  });

  if (pendingOrders.length > 5) {
    text += lang === 'ms'
      ? `\n_Menunjukkan 5 order terkini. Gunakan /allorders untuk lihat semua._`
      : `\n_Showing 5 most recent orders. Use /allorders to see all._`;
  }

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'admin_orders')]);
  buttons.push([Markup.button.callback(t('btnBack', lang), 'admin_panel')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

const processingOrders = new Set();

async function handleVerifyOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }

  // Prevent double-clicking / race conditions
  if (processingOrders.has(orderId)) {
    console.warn(`Duplicate verification attempt prevented for order ${orderId}`);
    return;
  }

  // Lock the order immediately
  processingOrders.add(orderId);

  try {
    // FETCH FRESH DATA INSIDE THE LOCK
    // This ensures we see the latest status even if another admin just verified it
    const order = await db.getTransaction(orderId);

    if (!order) {
      await ctx.reply(`❌ Order not found / Pesanan tidak dijumpai!\n\n🆔 Order ID: \`${orderId}\`\n\n💡 Tip: Gunakan /checkallorderid untuk lihat semua order ID yang sah.`, { parse_mode: 'Markdown' });
      return;
    }

    // Check if already processed
    if (order.status === 'completed' || order.status === 'verified') {
      await ctx.reply(`⚠️ Order ${orderId} is already verified!`);
      return;
    }
    if (order.status === 'rejected') {
      await ctx.reply(`⚠️ Order ${orderId} was already rejected!`);
      return;
    }

    // Layer 3: Block verify if no payment proof attached
    if (!order.paymentProof) {
      await ctx.reply(
        `🚫 *Tidak Boleh Verify!*\n\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `❌ Customer belum hantar bukti pembayaran untuk order ini.\n\n` +
        `💡 Tunggu customer upload bukti sebelum verify.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    // Proceed with verification... logic continues below
    // We need to ensure we unlock in finally block.
    // Since I am replacing only the top part, I can't easily add try/finally block around the whole function body without replacing the whole function.
    // I will use a helper approach or just replace more content.
    // Let's replace the top part and then I'll wrap the bottom part in another edit? No, that's messy.
    // I'll replace the WHOLE function body to wrap it in try/finally.
    // But the function is long.

    // Alternative: just use the lock and release it before every return or at end.
    // But if it crashes, lock stays. That's bad.

    // I MUST use try/finally.
    // I will read the whole function first to replace it safely.


    const products = await db.getProducts();
    const product = products.find(p => p.id === order.productId);

    if (!product) {
      await ctx.reply('Product not found');
      return;
    }

    // Check delivery type
    if (product.deliveryType === 'auto') {
      // Auto delivery: pop item from product.items[] and send to customer
      if (!product.items || product.items.length === 0) {
        await ctx.reply(
          `❌ Cannot verify order ${orderId}!\n\n` +
          `⚠️ No items available for auto-delivery!\n` +
          `📦 Product: ${product.name.ms}\n\n` +
          `💡 Use \`/additem ${product.id} | [data]\` or \`/additems ${product.id}\` to add items first.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Pop the first item
      const deliveredItem = product.items.shift();
      product.stock = product.items.length;
      await db.updateProduct(product.id, { items: product.items, stock: product.stock });

      // Set delivered item on the order
      order.deliveredItem = deliveredItem;

      await ctx.reply(
        `✅ Order ${orderId} verified! (Auto Delivery)\n\n` +
        `📦 Product: ${product.name.ms}\n` +
        `🔑 Item delivered automatically to customer\n` +
        `📊 Remaining stock: ${product.stock} items`
      );
    } else {
      // Manual delivery - reduce stock
      if (product.stock > 0) {
        product.stock -= 1;
        await db.updateProduct(product.id, { stock: product.stock });
        await ctx.reply(
          `✅ Order ${orderId} verified!\n\n` +
          `📝 Manual delivery - Please deliver the item to the customer.\n` +
          `📦 Stock updated: ${product.stock} remaining`
        );
      } else {
        await ctx.reply(
          `❌ Cannot verify order ${orderId}!\n\n` +
          `⚠️ Product stock is 0!\n\n` +
          `Please update stock first or reject this order.`
        );
        return;
      }
    }

    order.status = 'completed';
    order.verifiedAt = new Date().toISOString();
    await db.updateTransaction(orderId, { status: 'completed', verifiedAt: order.verifiedAt, deliveredItem: order.deliveredItem });

    await logAdminAction(userId, 'Order Verified', `Order ${orderId} for user ${order.userId}`);

    const queueManager = require('../utils/queueManager');
    await queueManager.completeProcessing(orderId);

    const user = await db.getUser(order.userId);
    const lang = user?.language || 'ms';

    try {
      const productName = typeof order.productName === 'object'
        ? (order.productName[lang] || order.productName.ms)
        : order.productName;

      const safeProductName = escapeMarkdown(productName);
      const safeOrderId = escapeMarkdown(orderId);
      const safeDeliveredItem = escapeMarkdown(order.deliveredItem);

      const verifyDate = new Date(order.verifiedAt);
      const dateStr = verifyDate.toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      let verifyMsg;
      if (order.deliveredItem) {
        // Auto-delivery receipt with item
        verifyMsg = lang === 'ms'
          ? `═══════════════════\n` +
          `🧾 *RESIT PEMBELIAN*\n` +
          `═══════════════════\n\n` +
          `🆔 Order:    \`${safeOrderId}\`\n` +
          `📦 Produk:  ${safeProductName}\n` +
          `💰 Harga:    RM${order.price}\n` +
          `📅 Tarikh:   ${dateStr}\n` +
          `✅ Status:   DISAHKAN\n\n` +
          `═══════════════════\n` +
          `🔑 *Item Anda:*\n\`${safeDeliveredItem}\`\n` +
          `═══════════════════\n\n` +
          `⚠️ _Simpan maklumat ini! Ia tidak akan dihantar semula._\n` +
          `📋 Lihat semula di "My Items" dalam menu utama.`
          : `═══════════════════\n` +
          `🧾 *PURCHASE RECEIPT*\n` +
          `═══════════════════\n\n` +
          `🆔 Order:     \`${orderId}\`\n` +
          `📦 Product:  ${productName}\n` +
          `💰 Price:      RM${order.price}\n` +
          `📅 Date:       ${dateStr}\n` +
          `✅ Status:    VERIFIED\n\n` +
          `═══════════════════\n` +
          `🔑 *Your Item:*\n\`${order.deliveredItem}\`\n` +
          `═══════════════════\n\n` +
          `⚠️ _Save this information! It will not be sent again._\n` +
          `📋 View again in "My Items" from the main menu.`;
          : `═══════════════════\n` +
          `🧾 *PURCHASE RECEIPT*\n` +
          `═══════════════════\n\n` +
          `🆔 Order:     \`${safeOrderId}\`\n` +
          `📦 Product:  ${safeProductName}\n` +
          `💰 Price:      RM${order.price}\n` +
          `📅 Date:       ${dateStr}\n` +
          `✅ Status:    VERIFIED\n\n` +
          `═══════════════════\n\n` +
          `📝 Admin will deliver your item shortly.\n` +
          `Please wait a moment! 🙏`;
      }

      await ctx.telegram.sendMessage(
        order.userId,
        verifyMsg,
        { parse_mode: 'Markdown' }
      );

      setTimeout(() => {
        sendFeedbackRequest(ctx, orderId, order.userId);
      }, 5000);

    } catch (error) {
      console.error('Failed to notify customer:', error.message);
    }

    // New: Send Notification to Channel
    // Fetch setting from DB first, then fallback to env
    const settings = await db.getSettings();
    const channelId = settings.transaction_channel_id || process.env.TRANSACTION_CHANNEL_ID;

    // Helper to escape HTML characters (More robust than Markdown)
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    if (channelId) {
      try {
        const dateStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');

        // Escape all dynamic fields to prevent HTML injection/errors
        const cleanUserId = escapeHtml(order.userId);
        const cleanProductId = escapeHtml(order.productId);
        const cleanProductName = escapeHtml(order.productName?.ms || order.productName || 'Product');
        const cleanPrice = escapeHtml(order.price);
        const cleanMethod = escapeHtml(order.paymentMethod ? order.paymentMethod.toUpperCase() : 'QRIS');

        const channelMsg =
          `🔔 <b>TRANSAKSI SELESAI</b> 🔔
<b>Testimoni Otomatis</b> | <b>Dibuat Bot</b> 📢
━━━━━━━━━━━━━━━━━━
🗓️ <b>TANGGAL</b> : ${dateStr}
📝 <b>BUYER</b> : ${cleanUserId}
🧾 <b>ID PRODUK</b> : <code>${cleanProductId}</code>
🛍️ <b>NAMA PRODUK</b> : ${cleanProductName}
♻️ <b>JUMLAH</b> : 1
✅ <b>TOTAL</b> : RM ${cleanPrice}
🏦 <b>METODE PEMBAYARAN</b> : ${cleanMethod}
━━━━━━━━━━━━━━━━━━
<b>TERIMAKASIH SUDAH BERBELANJA</b> 😊
━━━━━━━━━━━━━━━━━━
<b>BUY MANUAL</b>: @colebrs
<b>TESTIMONI</b>: @cexistore_testi
━━━━━━━━━━━━━━━━━━`;

        // Inline Button "🛒 ORDER SEKARANG" linking to the bot
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.url('🛒 ORDER SEKARANG', `https://t.me/${ctx.botInfo.username}`)]
        ]);

        await ctx.telegram.sendMessage(channelId, channelMsg, { parse_mode: 'HTML', ...keyboard });
      } catch (e) {
        console.error('Failed to send channel notification:', e.message);
      }
    }

    await notifyNextInQueue(ctx);

    // Remove buttons from admin message to prevent confusion
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch (err) {
        console.warn('Failed to remove buttons:', err.message);
      }
    }
  } catch (error) {
    console.error(`Error verifying order ${orderId}:`, error);
    await ctx.reply(`❌ Verification error: ${error.message}`);
  } finally {
    processingOrders.delete(orderId);
  }
}

async function handleRejectOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }

  // Prevent double-clicking / race conditions
  if (processingOrders.has(orderId)) {
    console.warn(`Duplicate rejection attempt prevented for order ${orderId}`);
    return;
  }

  // Lock the order immediately
  processingOrders.add(orderId);

  try {
    // FETCH FRESH DATA INSIDE THE LOCK
    const order = await db.getTransaction(orderId);

    if (!order) {
      await ctx.reply(`❌ Order not found / Pesanan tidak dijumpai!\n\n🆔 Order ID: \`${orderId}\`\n\n💡 Tip: Gunakan /checkallorderid untuk lihat semua order ID yang sah.`, { parse_mode: 'Markdown' });
      return;
    }

    // Check if already processed
    if (order.status === 'completed' || order.status === 'verified') {
      await ctx.reply(`⚠️ Order ${orderId} was already verified!`);
      return;
    }
    if (order.status === 'rejected') {
      await ctx.reply(`⚠️ Order ${orderId} is already rejected!`);
      return;
    }

    const rejectedAt = new Date().toISOString();
    await db.updateTransaction(orderId, { status: 'rejected', rejectedAt: rejectedAt });

    await logAdminAction(userId, 'Order Rejected', `Order ${orderId} for user ${order.userId}`);

    const queueManager = require('../utils/queueManager');
    await queueManager.completeProcessing(orderId);

    await ctx.reply(`❌ Order ${orderId} rejected`);

    try {
      const user = await db.getUser(order.userId);
      const custLang = user?.language || 'ms';
      const productName = typeof order.productName === 'object'
        ? (order.productName[custLang] || order.productName.ms)
        : order.productName;

      const safeProductName = escapeMarkdown(productName);
      const safeOrderId = escapeMarkdown(orderId);

      const rejectMsg = custLang === 'ms'
        ? `❌ *Pesanan Ditolak*\n\n` +
        `🆔 Order: \`${safeOrderId}\`\n` +
        `📦 Produk: ${safeProductName}\n` +
        `💰 Harga: RM${order.price}\n\n` +
        `Sila hubungi support untuk maklumat lanjut.\n` +
        `Gunakan butang "💬 Support" di menu utama.`
        : `❌ *Order Rejected*\n\n` +
        `🆔 Order: \`${safeOrderId}\`\n` +
        `📦 Product: ${safeProductName}\n` +
        `💰 Price: RM${order.price}\n\n` +
        `Please contact support for more information.\n` +
        `Use the "💬 Support" button in the main menu.`;

      await ctx.telegram.sendMessage(
        order.userId,
        rejectMsg,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Failed to notify customer:', error.message);
    }

    await notifyNextInQueue(ctx);

    // Remove buttons from admin message to prevent confusion
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch (err) {
        console.warn('Failed to remove buttons:', err.message);
      }
    }
  } catch (error) {
    console.error(`Error rejecting order ${orderId}:`, error);
    await ctx.reply(`❌ Rejection error: ${error.message}`);
  } finally {
    processingOrders.delete(orderId);
  }
}

async function handleAdminProducts(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  await ctx.answerCbQuery();

  const { handleProductManagementMenu } = require('./productManagementImproved');
  await handleProductManagementMenu(ctx);
}

async function handleAdminSessions(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const sessions = await db.getSessions();
  const activeSessions = sessions.filter(s => s.status === 'active');

  if (activeSessions.length === 0) {
    await safeEditMessage(ctx, '💬 *Active Support Sessions*\n\nNo active sessions at the moment.', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'admin_panel')]
      ])
    });
    return;
  }

  let text = '💬 *Active Support Sessions*\n\n';

  const buttons = [];
  activeSessions.forEach((session, index) => {
    const adminStatus = session.adminId ? `👨‍💼 Admin: ${session.adminId}` : '⏳ Waiting for admin';
    text += `${index + 1}. 🎫 Token: \`${session.token}\`\n`;
    text += `   👤 User: ${session.userId}\n`;
    text += `   ${adminStatus}\n\n`;

    buttons.push([Markup.button.callback(`Join ${session.token}`, `join_session_${session.token}`)]);
  });

  text += '\nClick a button to join a session or use:\n/join [token]';

  buttons.push([Markup.button.callback(t('btnBack', lang), 'admin_panel')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAdminBroadcast(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  broadcastMode.set(userId, true);

  const text = lang === 'en'
    ? '📢 *Broadcast Mode*\n\nSend your next message and it will be broadcast to all users.\n\nThe message will be sent to all registered users in the system.'
    : '📢 *Mod Siar*\n\nHantar mesej seterusnya dan ia akan disiarkan kepada semua pengguna.\n\nMesej akan dihantar kepada semua pengguna berdaftar dalam sistem.';

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('btnBack', lang), 'admin_panel')]
    ])
  });
}

async function handleBroadcastMessage(ctx) {
  const userId = ctx.from.id;

  if (!broadcastMode.has(userId)) {
    return false;
  }

  broadcastMode.delete(userId);

  const message = ctx.message.text;
  const users = await db.getUsers();

  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    try {
      await ctx.telegram.sendMessage(user.id, `📢 *Broadcast Message*\n\n${message}`, { parse_mode: 'Markdown' });
      successCount++;
    } catch (error) {
      console.error(`Failed to send broadcast to ${user.id}:`, error.message);
      failCount++;
    }
  }

  await ctx.reply(`✅ Broadcast sent!\n\n✓ Success: ${successCount}\n✗ Failed: ${failCount}`);

  return true;
}

async function handleCheckAllOrderId(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const transactions = await db.getTransactions();
  const products = await db.getProducts();

  if (transactions.length === 0) {
    await ctx.reply('📭 No orders found in the system.');
    return;
  }

  const statusEmoji = {
    'pending': '⏳',
    'awaiting_verification': '💳',
    'completed': '✅',
    'rejected': '❌'
  };

  let text = '📋 *All Orders*\n\n';

  transactions.slice(-20).reverse().forEach(order => {
    const product = products.find(p => p.id === order.productId);
    const productName = product ? product.name.ms : 'Unknown Product';
    const status = statusEmoji[order.status] || '❓';

    text += `${status} \`${order.id}\`\n`;
    text += `📦 ${productName}\n`;
    text += `👤 User: ${order.userId}\n`;
    text += `💰 RM${order.price}\n`;
    text += `📅 ${new Date(order.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}\n\n`;
  });

  text += '\n*Commands:*\n';
  text += '`/verify [order_id]` - Approve order\n';
  text += '`/reject [order_id]` - Reject order\n\n';
  text += '_Showing last 20 orders_';

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

async function handleAllOrders(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const products = await db.getProducts();

  if (transactions.length === 0) {
    await safeEditMessage(ctx,
      lang === 'ms' ? '📭 *Tiada Order*\n\nTiada order dalam sistem.' : '📭 *No Orders*\n\nNo orders in the system.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
        ])
      }
    );
    return;
  }

  const statusEmoji = {
    'pending': '⏳',
    'awaiting_verification': '💳',
    'completed': '✅',
    'rejected': '❌'
  };

  const recentOrders = transactions.slice(-10).reverse();
  const completedOrders = transactions.filter(t => t.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, t) => sum + parseFloat(t.price || 0), 0);

  let text = lang === 'ms'
    ? `📋 *Semua Order History*\n\n` +
    `📊 Total: ${transactions.length} order\n` +
    `💰 Keuntungan: RM${totalRevenue.toFixed(2)}\n\n` +
    `🔽 *10 Order Terkini:*\n\n`
    : `📋 *All Order History*\n\n` +
    `📊 Total: ${transactions.length} orders\n` +
    `💰 Revenue: RM${totalRevenue.toFixed(2)}\n\n` +
    `🔽 *Recent 10 Orders:*\n\n`;

  const buttons = [];

  recentOrders.forEach((order, index) => {
    const product = products.find(p => p.id === order.productId);
    const productName = product ? (product.name.ms || product.name) : 'Unknown';
    const status = statusEmoji[order.status] || '❓';

    text += `${index + 1}. ${status} \`${order.id}\`\n`;
    text += `   📦 ${productName}\n`;
    text += `   💰 RM${order.price} | 👤 ${order.userId}\n`;
    text += `   📅 ${new Date(order.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}\n\n`;

    buttons.push([
      Markup.button.callback(`🔍 ${order.id}`, `view_order_${order.id}`),
      Markup.button.callback(`🗑️`, `delete_order_confirm_${order.id}`)
    ]);
  });

  if (transactions.length > 10) {
    text += lang === 'ms'
      ? `\n_Menunjukkan 10 order terkini sahaja._`
      : `\n_Showing only 10 most recent orders._`;
  }

  buttons.push([
    Markup.button.callback(lang === 'ms' ? '🔄 Refresh' : '🔄 Refresh', 'all_orders'),
    Markup.button.callback(lang === 'ms' ? '🔍 Cari' : '🔍 Search', 'admin_search_orders')
  ]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleViewOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const order = transactions.find(t => t.id === orderId);

  if (!order) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Order tidak dijumpai' : 'Order not found', { show_alert: true });
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === order.productId);
  const productName = product ? (product.name.ms || product.name) : 'Unknown Product';

  const statusEmoji = {
    'pending': '⏳',
    'awaiting_verification': '💳',
    'completed': '✅',
    'rejected': '❌'
  };

  const statusText = statusEmoji[order.status] || '❓';

  let text = lang === 'ms'
    ? `📦 *Butiran Order*\n\n` +
    `🆔 Order ID: \`${order.id}\`\n` +
    `📦 Produk: ${productName}\n` +
    `💰 Harga: RM${order.price}\n` +
    `👤 User ID: ${order.userId}\n` +
    `📊 Status: ${statusText} ${order.status}\n` +
    `📅 Tarikh: ${new Date(order.createdAt).toLocaleString('en-MY')}\n`
    : `📦 *Order Details*\n\n` +
    `🆔 Order ID: \`${order.id}\`\n` +
    `📦 Product: ${productName}\n` +
    `💰 Price: RM${order.price}\n` +
    `👤 User ID: ${order.userId}\n` +
    `📊 Status: ${statusText} ${order.status}\n` +
    `📅 Date: ${new Date(order.createdAt).toLocaleString('en-MY')}\n`;

  if (order.paymentProof) {
    text += lang === 'ms' ? `\n📸 Bukti Bayaran: Ada` : `\n📸 Payment Proof: Available`;
  }

  const buttons = [];

  if (order.status === 'awaiting_verification') {
    buttons.push([
      Markup.button.callback(lang === 'ms' ? '✅ Sahkan' : '✅ Verify', `verify_order_${orderId}`),
      Markup.button.callback(lang === 'ms' ? '❌ Tolak' : '❌ Reject', `reject_order_${orderId}`)
    ]);
  }

  buttons.push([Markup.button.callback(lang === 'ms' ? '🗑️ Padam Order' : '🗑️ Delete Order', `delete_order_confirm_${orderId}`)]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'all_orders')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleDeleteOrderConfirm(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const order = transactions.find(t => t.id === orderId);

  if (!order) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Order tidak dijumpai' : 'Order not found', { show_alert: true });
    return;
  }

  const text = lang === 'ms'
    ? `⚠️ *Pengesahan Padam*\n\n` +
    `Adakah anda pasti mahu padam order ini?\n\n` +
    `🆔 Order ID: \`${orderId}\`\n` +
    `💰 Nilai: RM${order.price}\n` +
    `📊 Status: ${order.status}\n\n` +
    `⚠️ Tindakan ini tidak boleh dibatalkan!`
    : `⚠️ *Delete Confirmation*\n\n` +
    `Are you sure you want to delete this order?\n\n` +
    `🆔 Order ID: \`${orderId}\`\n` +
    `💰 Value: RM${order.price}\n` +
    `📊 Status: ${order.status}\n\n` +
    `⚠️ This action cannot be undone!`;

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(lang === 'ms' ? '✅ Ya, Padam' : '✅ Yes, Delete', `delete_order_${orderId}`),
        Markup.button.callback(lang === 'ms' ? '❌ Batal' : '❌ Cancel', 'all_orders')
      ]
    ])
  });
}

async function handleDeleteOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const deletedOrder = await db.getTransaction(orderId);

  if (!deletedOrder) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Order tidak dijumpai' : 'Order not found', { show_alert: true });
    return;
  }

  await db.deleteTransaction(orderId);

  await logAdminAction(userId, 'Order Deleted', `Order ${orderId} deleted (Value: RM${deletedOrder.price}, Status: ${deletedOrder.status})`);

  await ctx.answerCbQuery(
    lang === 'ms' ? `✅ Order ${orderId} telah dipadam` : `✅ Order ${orderId} deleted`,
    { show_alert: true }
  );

  await handleAllOrders(ctx);
}

async function notifyNextInQueue(ctx) {
  const queueManager = require('../utils/queueManager');
  const waitingOrders = await queueManager.getWaitingOrders();

  if (waitingOrders.length === 0) {
    return;
  }

  const nextOrder = waitingOrders[0];
  const user = await db.getUser(nextOrder.userId);
  const lang = user?.language || 'ms';

  const queuePos = await queueManager.getQueuePosition(nextOrder.orderId);
  const estimatedTime = queueManager.formatEstimatedTime(queuePos.estimatedCompletion);

  const message = lang === 'ms'
    ? `🔔 *Update Antrian*\n\n` +
    `Giliran anda semakin hampir!\n\n` +
    `📋 Posisi sekarang: *${queuePos.position}*\n` +
    `⏰ Anggaran masa: ${estimatedTime}\n\n` +
    `🆔 Order ID: \`${nextOrder.orderId}\`\n` +
    `📦 Produk: ${nextOrder.productName}\n\n` +
    `Admin akan proses order anda tidak lama lagi. Terima kasih kerana menunggu!`
    : `🔔 *Queue Update*\n\n` +
    `Your turn is coming soon!\n\n` +
    `📋 Current position: *${queuePos.position}*\n` +
    `⏰ Estimated time: ${estimatedTime}\n\n` +
    `🆔 Order ID: \`${nextOrder.orderId}\`\n` +
    `📦 Product: ${nextOrder.productName}\n\n` +
    `Admin will process your order soon. Thank you for waiting!`;

  try {
    await ctx.telegram.sendMessage(
      nextOrder.userId,
      message,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to notify next customer in queue:', error.message);
  }
}

async function handleNoteCommand(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    return;
  }

  const args = ctx.message.text.split(' ');
  let targetUserId;
  let noteText;

  if (ctx.message.reply_to_message) {
    const text = ctx.message.reply_to_message.text || '';
    const match = text.match(/User ID: (\d+)/i) || text.match(/User (\d+)/i) || text.match(/ID: `(\d+)`/);
    if (match) {
      targetUserId = match[1];
    }
    noteText = args.slice(1).join(' ');
  } else {
    if (args.length < 3) {
      await ctx.reply('⚠️ Invalid format. Use:\n`/note [user_id] [text]`\nOR reply to a user message with `/note [text]`', { parse_mode: 'Markdown' });
      return;
    }
    targetUserId = args[1];
    noteText = args.slice(2).join(' ');
  }

  if (!targetUserId || !noteText) {
    await ctx.reply('❌ Could not identify User ID or Note text.');
    return;
  }

  try {
    const user = await db.getUser(targetUserId);
    if (!user) {
      await ctx.reply('❌ User not found in database.');
      return;
    }

    const newNote = `[${new Date().toLocaleDateString()} ${ctx.from.first_name}]: ${noteText}`;
    const currentNotes = user.notes ? user.notes + '\n' + newNote : newNote;

    await db.saveUsers([{ ...user, notes: currentNotes }]);
    await ctx.reply(`✅ Note added for User \`${targetUserId}\`:\n"${noteText}"`, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Failed to save note:', error);
    await ctx.reply('❌ Failed to save note.');
  }
}

module.exports = {
  isAdmin,
  handleAdminPanel,
  handleAdminOrders,
  handleVerifyOrder,
  handleRejectOrder,
  handleAdminProducts,
  handleAdminSessions,
  handleAdminBroadcast,
  handleBroadcastMessage,
  handleCheckAllOrderId,
  handleAdminStatistics,
  handleAllOrders,
  handleViewOrder,
  handleDeleteOrderConfirm,
  handleDeleteOrder,
  handleNoteCommand
};
