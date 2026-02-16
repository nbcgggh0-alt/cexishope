const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');
const { safeNum } = require('../utils/helpers');

async function handleProductStats(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Produk tidak dijumpai' : 'Product not found');
    return;
  }

  const transactions = await db.getTransactions();
  const productOrders = transactions.filter(t => t.productId === productId);
  const completedOrders = productOrders.filter(t => t.status === 'completed');
  const pendingOrders = productOrders.filter(t => t.status === 'awaiting_verification');
  const rejectedOrders = productOrders.filter(t => t.status === 'rejected');

  const totalRevenue = completedOrders.reduce((sum, t) => sum + (t.price || 0), 0);
  const conversionRate = productOrders.length > 0
    ? safeNum(completedOrders.length / productOrders.length * 100).toFixed(1)
    : 0;

  // Calculate average rating if feedback exists
  const feedbacks = await db.getFeedbacks() || [];
  const productFeedbacks = feedbacks.filter(f => f.productId === productId && f.rating);
  const avgRating = productFeedbacks.length > 0
    ? safeNum(productFeedbacks.reduce((sum, f) => sum + f.rating, 0) / productFeedbacks.length).toFixed(1)
    : 0;

  // Get sales trend (last 7 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekSales = completedOrders.filter(t => new Date(t.createdAt) >= weekAgo).length;
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthSales = completedOrders.filter(t => new Date(t.createdAt) >= monthAgo).length;

  const text = lang === 'ms'
    ? `📊 * Statistik Produk *\n\n` +
    `📦 * ${product.name.ms}*\n` +
    `🆔 ${productId} \n\n` +
    `💰 * Jualan:*\n` +
    `  • Total Order: ${productOrders.length} \n` +
    `  • Selesai: ${completedOrders.length} \n` +
    `  • Pending: ${pendingOrders.length} \n` +
    `  • Ditolak: ${rejectedOrders.length} \n` +
    `  • Hasil: RM${safeNum(totalRevenue).toFixed(2)} \n` +
    `  • Conversion: ${conversionRate}%\n\n` +
    `📈 * Trend:*\n` +
    `  • 7 Hari: ${weekSales} jualan\n` +
    `  • 30 Hari: ${monthSales} jualan\n\n` +
    `⭐ * Rating:* ${avgRating > 0 ? `${avgRating}/5.0 (${productFeedbacks.length} reviews)` : 'Tiada rating'} \n\n` +
    `📊 * Inventori:*\n` +
    `  • Stok Semasa: ${product.stock} \n` +
    `  • Harga: RM${product.price} \n` +
    `  • Status: ${product.active ? '✅ Aktif' : '❌ Tidak Aktif'} `
    : `📊 * Product Statistics *\n\n` +
    `📦 * ${product.name.en || product.name.ms}*\n` +
    `🆔 ${productId} \n\n` +
    `💰 * Sales:*\n` +
    `  • Total Orders: ${productOrders.length} \n` +
    `  • Completed: ${completedOrders.length} \n` +
    `  • Pending: ${pendingOrders.length} \n` +
    `  • Rejected: ${rejectedOrders.length} \n` +
    `  • Revenue: RM${safeNum(totalRevenue).toFixed(2)} \n` +
    `  • Conversion: ${conversionRate}%\n\n` +
    `📈 * Trend:*\n` +
    `  • 7 Days: ${weekSales} sales\n` +
    `  • 30 Days: ${monthSales} sales\n\n` +
    `⭐ * Rating:* ${avgRating > 0 ? `${avgRating}/5.0 (${productFeedbacks.length} reviews)` : 'No ratings'} \n\n` +
    `📊 * Inventory:*\n` +
    `  • Current Stock: ${product.stock} \n` +
    `  • Price: RM${product.price} \n` +
    `  • Status: ${product.active ? '✅ Active' : '❌ Inactive'} `;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📊 Inventory History' : '📊 Inventory History', `prod_inventory_${productId} `)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_detail_${productId} `)]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAllProductsStats(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const transactions = await db.getTransactions();

  // Calculate stats for each product
  const productStats = products.map(prod => {
    const orders = transactions.filter(t => t.productId === prod.id && t.status === 'completed');
    const revenue = orders.reduce((sum, t) => sum + (t.price || 0), 0);
    return { product: prod, orders: orders.length, revenue };
  });

  // Sort by revenue
  productStats.sort((a, b) => b.revenue - a.revenue);

  let text = lang === 'ms'
    ? `📊 * Statistik Semua Produk *\n\nTop 10 produk mengikut hasil: \n\n`
    : `📊 * All Products Statistics *\n\nTop 10 products by revenue: \n\n`;

  const buttons = [];

  productStats.slice(0, 10).forEach((stat, index) => {
    text += `${index + 1}. ${stat.product.name.ms} \n`;
    text += `   💰 RM${safeNum(stat.revenue).toFixed(2)} (${stat.orders} orders) \n`;
    text += `   📊 Stock: ${stat.product.stock} \n\n`;

    buttons.push([
      Markup.button.callback(
        `${stat.product.name.ms.substring(0, 25)}...`,
        `prod_stats_${stat.product.id} `
      )
    ]);
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  handleProductStats,
  handleAllProductsStats
};
