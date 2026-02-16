const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { formatDate } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { formatPrice } = require('../utils/currencyHelper');

async function handleMyOrders(ctx, page = 0) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const userOrders = transactions.filter(t => t.userId === userId);

  if (userOrders.length === 0) {
    const noOrdersMsg = lang === 'ms'
      ? '📋 *Pesanan Saya*\n\n❌ Anda belum ada pesanan lagi.\n\n💡 Mulakan dengan klik butang "Beli Produk" di menu utama!'
      : '📋 *My Orders*\n\n❌ You don\'t have any orders yet.\n\n💡 Start by clicking "Buy Products" in the main menu!';

    await safeEditMessage(ctx, noOrdersMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'ms' ? '🛍️ Beli Produk' : '🛍️ Buy Products', 'buy_products')],
        [Markup.button.callback(t('btnBack', lang), 'main_menu')]
      ])
    });
    return;
  }

  // Sort newest first
  const sortedOrders = [...userOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const ORDERS_PER_PAGE = 5;
  const totalPages = Math.ceil(sortedOrders.length / ORDERS_PER_PAGE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = currentPage * ORDERS_PER_PAGE;
  const pageOrders = sortedOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);

  let orderText = lang === 'ms'
    ? `📋 *Pesanan Saya*\n\nJumlah: ${userOrders.length} | Halaman ${currentPage + 1}/${totalPages}\n\n`
    : `📋 *My Orders*\n\nTotal: ${userOrders.length} | Page ${currentPage + 1}/${totalPages}\n\n`;

  pageOrders.forEach(order => {
    const statusEmoji = {
      'pending': '⏳',
      'awaiting_verification': '💳',
      'completed': '✅',
      'rejected': '❌'
    };
    const statusText = t(`orderStatus.${order.status}`, lang) || order.status;

    // Use stored currency or default to MYR for legacy orders
    const orderCurrency = order.currency || 'MYR';
    const priceDisplay = formatPrice(order.price, orderCurrency);

    orderText += `${statusEmoji[order.status] || '📌'} \`${order.id}\`\n`;
    orderText += `📦 ${order.productName?.ms || order.productName}\n`;
    orderText += `💰 ${priceDisplay}\n`;
    orderText += `📅 ${formatDate(order.createdAt)}\n`;
    orderText += `📊 Status: ${statusText}`;
    if (order.paymentProof) {
      orderText += lang === 'ms' ? ' 📸' : ' 📸';
    }
    orderText += '\n\n';
  });

  // Build action buttons
  const buttons = [];

  // Upload proof buttons for pending orders without proof (current page only)
  const needsProof = pageOrders.filter(o =>
    (o.status === 'pending' || o.status === 'awaiting_verification') && !o.paymentProof
  );
  if (needsProof.length > 0) {
    const firstNeedsProof = needsProof[0];
    buttons.push([Markup.button.callback(
      lang === 'ms' ? `📸 Muat Naik Bukti (${firstNeedsProof.id})` : `📸 Upload Proof (${firstNeedsProof.id})`,
      `uploadproof_${firstNeedsProof.id}`
    )]);
  }

  // Reorder button for most recent completed order
  const completedOrders = sortedOrders.filter(o => o.status === 'completed');
  if (completedOrders.length > 0) {
    const lastCompleted = completedOrders[0];
    buttons.push([Markup.button.callback(
      lang === 'ms' ? `🔁 Pesan Semula (${lastCompleted.productName?.ms || lastCompleted.productName})` : `🔁 Reorder (${lastCompleted.productName?.en || lastCompleted.productName?.ms || lastCompleted.productName})`,
      `buy_${lastCompleted.productId}`
    )]);
  }

  // Pagination buttons
  const navButtons = [];
  if (currentPage > 0) {
    navButtons.push(Markup.button.callback('⬅️', `orderpage_${currentPage - 1}`));
  }
  if (currentPage < totalPages - 1) {
    navButtons.push(Markup.button.callback('➡️', `orderpage_${currentPage + 1}`));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([Markup.button.callback(t('btnBack', lang), 'main_menu')]);

  orderText += lang === 'ms'
    ? '💡 Gunakan `/searchorder [order_id]` untuk cari pesanan tertentu.'
    : '💡 Use `/searchorder [order_id]` to search for specific order.';

  await safeEditMessage(ctx, orderText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleMyItems(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const completedOrders = transactions.filter(t => t.userId === userId && t.status === 'completed' && t.deliveredItem);

  if (completedOrders.length === 0) {
    await safeEditMessage(ctx, '❌ No items yet.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'main_menu')]
      ])
    });
    return;
  }

  let itemsText = '🎁 *My Digital Items*\n\n';

  completedOrders.forEach(order => {
    itemsText += `📦 ${order.productName.ms || order.productName}\n`;
    itemsText += `🔑 ${order.deliveredItem}\n\n`;
  });

  await safeEditMessage(ctx, itemsText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('btnBack', lang), 'main_menu')]
    ])
  });
}

module.exports = {
  handleMyOrders,
  handleMyItems
};
