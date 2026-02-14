
async function validateProductPricing(ctx) {
  const adminId = ctx.from.id;
  const db = require('../utils/database');
  const { isOwnerOrAdmin } = require('./userManagement');

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const products = await db.getProducts();

  let message = '📊 *Pricing Validation Report*\n\n';

  // Group products by category to check consistency
  const productsByCategory = {};

  products.forEach(prod => {
    if (!productsByCategory[prod.categoryId]) {
      productsByCategory[prod.categoryId] = [];
    }
    productsByCategory[prod.categoryId].push(prod);
  });

  // Check for pricing inconsistencies
  let inconsistencies = 0;

  for (const categoryId in productsByCategory) {
    const categoryProducts = productsByCategory[categoryId];

    if (categoryProducts.length > 1) {
      // Sort by price to check ratios
      categoryProducts.sort((a, b) => a.price - b.price);

      for (let i = 0; i < categoryProducts.length - 1; i++) {
        const current = categoryProducts[i];
        const next = categoryProducts[i + 1];

        // Extract quantities from product names if possible
        const currentQty = extractQuantity(current.name.ms || current.name.en);
        const nextQty = extractQuantity(next.name.ms || next.name.en);

        if (currentQty && nextQty && currentQty < nextQty) {
          const expectedRatio = nextQty / currentQty;
          const actualRatio = next.price / current.price;

          if (Math.abs(expectedRatio - actualRatio) > 0.1) {
            inconsistencies++;
            message += `⚠️ Inconsistent pricing:\n`;
            message += `   ${current.name.ms} (${currentQty}): RM${current.price}\n`;
            message += `   ${next.name.ms} (${nextQty}): RM${next.price}\n`;
            message += `   Expected ratio: ${expectedRatio.toFixed(2)}x\n`;
            message += `   Actual ratio: ${actualRatio.toFixed(2)}x\n\n`;
          }
        }
      }
    }
  }

  if (inconsistencies === 0) {
    message += '✅ No pricing inconsistencies detected!';
  } else {
    message += `\n🔴 Found ${inconsistencies} pricing inconsistencies.\n`;
    message += `Please review and update product prices.`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

function extractQuantity(name) {
  // Extract numbers from product name (e.g., "160 Robux" -> 160)
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

async function fixCategoryPricing(ctx) {
  const adminId = ctx.from.id;
  const db = require('../utils/database');
  const { isOwnerOrAdmin } = require('./userManagement');

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const categories = await db.getCategories();
  const robuxCategory = categories.find(c =>
    c.name.ms.toUpperCase().includes('ROBUX') ||
    c.name.en.toUpperCase().includes('ROBUX')
  );

  if (!robuxCategory) {
    await ctx.reply('❌ Category ROBUX tidak dijumpai. Sila gunakan format:\n/fixpricing [CATEGORY_ID]');
    return;
  }

  const products = await db.getProducts();
  const categoryProducts = products.filter(p => p.categoryId === robuxCategory.id);

  if (categoryProducts.length === 0) {
    await ctx.reply(`❌ Tiada produk dalam category ${robuxCategory.name.ms}`);
    return;
  }

  // Sort by quantity
  categoryProducts.sort((a, b) => {
    const qtyA = extractQuantity(a.name.ms || a.name.en);
    const qtyB = extractQuantity(b.name.ms || b.name.en);
    return qtyA - qtyB;
  });

  // Use first product as base
  const baseProduct = categoryProducts[0];
  const baseQty = extractQuantity(baseProduct.name.ms || baseProduct.name.en);
  const basePrice = baseProduct.price;
  const pricePerUnit = basePrice / baseQty;

  let message = `🔧 *Fix Pricing - ${robuxCategory.name.ms}*\n\n`;
  message += `📊 Base: ${baseProduct.name.ms}\n`;
  message += `💰 Harga: RM${basePrice} (${baseQty} unit)\n`;
  message += `📈 Price per unit: RM${pricePerUnit.toFixed(4)}\n\n`;
  message += `*Cadangan harga baru:*\n\n`;

  const updates = [];

  for (let i = 0; i < categoryProducts.length; i++) {
    const product = categoryProducts[i];
    const qty = extractQuantity(product.name.ms || product.name.en);
    const expectedPrice = parseFloat((qty * pricePerUnit).toFixed(2));

    if (Math.abs(product.price - expectedPrice) > 0.01) {
      message += `${i + 1}. ${product.name.ms}\n`;
      message += `   Current: RM${product.price} ❌\n`;
      message += `   Expected: RM${expectedPrice} ✅\n\n`;

      updates.push({
        product: product,
        oldPrice: product.price,
        newPrice: expectedPrice
      });
    } else {
      message += `${i + 1}. ${product.name.ms}\n`;
      message += `   RM${product.price} ✅ (OK)\n\n`;
    }
  }

  if (updates.length === 0) {
    await ctx.reply(message + '\n✅ Semua harga sudah konsisten!', { parse_mode: 'Markdown' });
    return;
  }

  // Apply updates atomically per product
  for (const update of updates) {
    await db.updateProduct(update.product.id, { price: update.newPrice });
  }

  message += `\n✅ *${updates.length} harga telah dikemaskini!*\n\n`;
  message += `Total products: ${categoryProducts.length}\n`;
  message += `Updated: ${updates.length}\n`;
  message += `Already correct: ${categoryProducts.length - updates.length}`;

  await ctx.reply(message, { parse_mode: 'Markdown' });

  await logAdminAction(adminId, 'Fix Category Pricing', `${robuxCategory.name.ms}: ${updates.length} products updated`);
}

const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { logAdminAction } = require('../utils/adminLogger');
const { isAdmin } = require('./admin');

async function handleQuickActionsMenu(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const products = await db.getProducts();
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification');
  const lowStock = products.filter(p => p.stock < 5 && p.active);

  const text = lang === 'ms'
    ? `⚡ *Quick Actions*\n\nAkses pantas untuk tugas admin:\n\n📦 ${pendingOrders.length} order pending\n⚠️ ${lowStock.length} produk stok rendah`
    : `⚡ *Quick Actions*\n\nQuick access to admin tasks:\n\n📦 ${pendingOrders.length} pending orders\n⚠️ ${lowStock.length} low stock products`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? `✅ Quick Verify (${pendingOrders.length})` : `✅ Quick Verify (${pendingOrders.length})`, 'qa_quick_verify')],
    [Markup.button.callback(lang === 'ms' ? '📊 Quick Stock Update' : '📊 Quick Stock Update', 'qa_quick_stock')],
    [Markup.button.callback(lang === 'ms' ? '💰 Quick Price Update' : '💰 Quick Price Update', 'qa_quick_price')],
    [Markup.button.callback(lang === 'ms' ? '🔄 Quick Toggle Status' : '🔄 Quick Toggle Status', 'qa_quick_toggle')],
    [Markup.button.callback(lang === 'ms' ? '📢 Quick Broadcast' : '📢 Quick Broadcast', 'qa_quick_broadcast')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleQuickVerify(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification').slice(0, 5);

  if (pendingOrders.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? '✅ Tiada pending orders' : '✅ No pending orders');
    return;
  }

  let text = lang === 'ms'
    ? `✅ *Quick Verify*\n\n${pendingOrders.length} order pending:\n\n`
    : `✅ *Quick Verify*\n\n${pendingOrders.length} pending orders:\n\n`;

  const buttons = [];

  pendingOrders.forEach(order => {
    text += `🆔 \`${order.id}\`\n`;
    text += `👤 User: ${order.userId}\n`;
    text += `💰 RM${order.price}\n\n`;

    buttons.push([
      Markup.button.callback(`✅ ${order.id.substring(0, 10)}...`, `qa_verify_${order.id}`),
      Markup.button.callback(`❌`, `qa_reject_${order.id}`)
    ]);
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '✅ Verify Semua' : '✅ Verify All', 'qa_verify_all')]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'quick_actions')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleQuickVerifyOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const { handleVerifyOrder } = require('./admin');
  await handleVerifyOrder(ctx, orderId);

  await logAdminAction(userId, 'Quick Verify', `Order ${orderId}`);

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Order verified' : '✅ Order verified');
}

async function handleQuickRejectOrder(ctx, orderId) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const { handleRejectOrder } = require('./admin');
  await handleRejectOrder(ctx, orderId);

  await logAdminAction(userId, 'Quick Reject', `Order ${orderId}`);

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  await ctx.answerCbQuery(lang === 'ms' ? '❌ Order rejected' : '❌ Order rejected');
}

async function handleQuickVerifyAll(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const products = await db.getProducts();
  const pendingOrders = transactions.filter(t => t.status === 'awaiting_verification');

  let successCount = 0;
  let failCount = 0;

  for (const order of pendingOrders) {
    const product = products.find(p => p.id === order.productId);

    if (product && product.stock > 0) {
      // Layer 3: Block verify if no payment proof
      if (!order.paymentProof) {
        failCount++;
        continue;
      }

      // Atomic updates — no full table overwrite
      await db.updateProduct(product.id, { stock: product.stock - 1 });
      await db.updateTransaction(order.id, { status: 'completed' });
      product.stock -= 1; // update local copy for next iteration
      successCount++;

      // Notify user
      try {
        const customerLang = (await db.getUser(order.userId))?.language || 'ms';
        await ctx.telegram.sendMessage(
          order.userId,
          customerLang === 'ms'
            ? `✅ Pesanan ${order.id} anda telah disahkan! Admin akan hantar item anda tidak lama lagi.`
            : `✅ Your order ${order.id} has been verified! Admin will deliver your item shortly.`
        );
      } catch (error) {
        console.error('Failed to notify user:', error);
      }
    } else {
      failCount++;
    }
  }

  await logAdminAction(userId, 'Quick Verify All', `Verified ${successCount} orders, failed ${failCount}`);

  const message = lang === 'ms'
    ? `✅ *Selesai!*\n\n✓ ${successCount} order verified\n✗ ${failCount} gagal (stok habis)`
    : `✅ *Complete!*\n\n✓ ${successCount} orders verified\n✗ ${failCount} failed (out of stock)`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Selesai' : '✅ Complete');
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

const quickStockState = new Map();

async function handleQuickStock(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  quickStockState.set(userId, true);

  const message = lang === 'ms'
    ? '📊 *Quick Stock Update*\n\nHantar dalam format:\n`PRODUCT_ID +/-AMOUNT`\n\nContoh:\n• `PROD-ABC123 +50`\n• `PROD-XYZ789 -10`'
    : '📊 *Quick Stock Update*\n\nSend in format:\n`PRODUCT_ID +/-AMOUNT`\n\nExample:\n• `PROD-ABC123 +50`\n• `PROD-XYZ789 -10`';

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processQuickStock(ctx) {
  const userId = ctx.from.id;

  if (!quickStockState.has(userId)) {
    return false;
  }

  quickStockState.delete(userId);

  const input = ctx.message.text.trim();
  const parts = input.split(' ');

  if (parts.length < 2) {
    await ctx.reply('❌ Format salah. Contoh: PROD-ABC123 +50');
    return true;
  }

  const productId = parts[0];
  const adjustment = parseInt(parts[1]);

  if (isNaN(adjustment)) {
    await ctx.reply('❌ Jumlah tidak sah');
    return true;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.reply(`❌ Produk ${productId} tidak dijumpai`);
    return true;
  }

  const oldStock = product.stock;
  const newStock = Math.max(0, product.stock + adjustment);

  await db.updateProduct(product.id, { stock: newStock });
  product.stock = newStock;

  await logAdminAction(userId, 'Quick Stock Update', `${productId}: ${oldStock} → ${product.stock}`);

  await ctx.reply(
    `✅ *Stock Updated*\n\n` +
    `📦 ${product.name.ms}\n` +
    `📊 ${oldStock} → ${product.stock}`,
    { parse_mode: 'Markdown' }
  );

  return true;
}

const quickPriceState = new Map();

async function handleQuickPrice(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  quickPriceState.set(userId, true);

  const message = lang === 'ms'
    ? '💰 *Quick Price Update*\n\nHantar dalam format:\n`PRODUCT_ID PRICE`\n\nContoh:\n• `PROD-ABC123 15.00`\n• `PROD-XYZ789 25.50`'
    : '💰 *Quick Price Update*\n\nSend in format:\n`PRODUCT_ID PRICE`\n\nExample:\n• `PROD-ABC123 15.00`\n• `PROD-XYZ789 25.50`';

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processQuickPrice(ctx) {
  const userId = ctx.from.id;

  if (!quickPriceState.has(userId)) {
    return false;
  }

  quickPriceState.delete(userId);

  const input = ctx.message.text.trim();
  const parts = input.split(' ');

  if (parts.length < 2) {
    await ctx.reply('❌ Format salah. Contoh: PROD-ABC123 15.00');
    return true;
  }

  const productId = parts[0];
  const price = parseFloat(parts[1]);

  if (isNaN(price) || price < 0) {
    await ctx.reply('❌ Harga tidak sah');
    return true;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.reply(`❌ Produk ${productId} tidak dijumpai`);
    return true;
  }

  const oldPrice = product.price;

  await db.updateProduct(product.id, { price: price });

  await logAdminAction(userId, 'Quick Price Update', `${productId}: RM${oldPrice} → RM${price}`);

  await ctx.reply(
    `✅ *Price Updated*\n\n` +
    `📦 ${product.name.ms}\n` +
    `💰 RM${oldPrice} → RM${price}`,
    { parse_mode: 'Markdown' }
  );

  return true;
}

module.exports = {
  handleQuickActionsMenu,
  handleQuickVerify,
  handleQuickVerifyOrder,
  handleQuickRejectOrder,
  handleQuickVerifyAll,
  handleQuickStock,
  processQuickStock,
  handleQuickPrice,
  processQuickPrice,
  quickStockState,
  quickPriceState
};
