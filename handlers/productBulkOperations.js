const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');
const { logInventoryMovement } = require('./productManagement');

const bulkEditState = new Map();

async function handleBulkOperations(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? `🔄 *Operasi Bulk*\n\nPilih tindakan untuk banyak produk sekaligus:`
    : `🔄 *Bulk Operations*\n\nSelect action for multiple products:`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '✅ Aktifkan Semua' : '✅ Activate All', 'bulk_activate_all')],
    [Markup.button.callback(lang === 'ms' ? '❌ Nyahaktif Semua' : '❌ Deactivate All', 'bulk_deactivate_all')],
    [Markup.button.callback(lang === 'ms' ? '🏷️ Bulk Edit Harga' : '🏷️ Bulk Edit Price', 'bulk_price_category')],
    [Markup.button.callback(lang === 'ms' ? '📊 Bulk Edit Stok' : '📊 Bulk Edit Stock', 'bulk_stock_category')],
    [Markup.button.callback(lang === 'ms' ? '🗑️ Bulk Delete' : '🗑️ Bulk Delete', 'bulk_delete_inactive')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleBulkActivateAll(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const products = await db.getProducts();
  const inactiveProducts = products.filter(p => !p.active);
  const inactiveCount = inactiveProducts.length;

  for (const p of inactiveProducts) {
    await db.updateProduct(p.id, { active: true });
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const message = lang === 'ms'
    ? `✅ *Operasi Selesai!*\n\n${inactiveCount} produk telah diaktifkan.`
    : `✅ *Operation Complete!*\n\n${inactiveCount} products activated.`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Selesai' : '✅ Complete');
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleBulkDeactivateAll(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const products = await db.getProducts();
  const activeProducts = products.filter(p => p.active);
  const activeCount = activeProducts.length;

  for (const p of activeProducts) {
    await db.updateProduct(p.id, { active: false });
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const message = lang === 'ms'
    ? `✅ *Operasi Selesai!*\n\n${activeCount} produk telah dinyahaktifkan.`
    : `✅ *Operation Complete!*\n\n${activeCount} products deactivated.`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Selesai' : '✅ Complete');
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleBulkPriceByCategory(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();

  if (categories.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Tiada kategori' : '❌ No categories');
    return;
  }

  const buttons = categories.map(cat => [
    Markup.button.callback(
      `${cat.icon} ${cat.name.ms}`,
      `bulk_price_cat_${cat.id}`
    )
  ]);

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'bulk_operations')]);

  const text = lang === 'ms'
    ? '🏷️ *Bulk Edit Harga*\n\nPilih kategori untuk edit harga:'
    : '🏷️ *Bulk Edit Price*\n\nSelect category to edit price:';

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleBulkPriceCategorySelect(ctx, categoryId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  bulkEditState.set(adminId, { type: 'price', categoryId });

  const message = lang === 'ms'
    ? '💰 *Bulk Edit Harga*\n\nHantar peratusan perubahan harga:\n\nContoh:\n• `+10` - Tambah 10%\n• `-20` - Kurang 20%\n• `15` - Set harga tetap RM15'
    : '💰 *Bulk Edit Price*\n\nSend price change percentage:\n\nExample:\n• `+10` - Increase 10%\n• `-20` - Decrease 20%\n• `15` - Set fixed price RM15';

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleBulkStockByCategory(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();

  if (categories.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Tiada kategori' : '❌ No categories');
    return;
  }

  const buttons = categories.map(cat => [
    Markup.button.callback(
      `${cat.icon} ${cat.name.ms}`,
      `bulk_stock_cat_${cat.id}`
    )
  ]);

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'bulk_operations')]);

  const text = lang === 'ms'
    ? '📊 *Bulk Edit Stok*\n\nPilih kategori untuk edit stok:'
    : '📊 *Bulk Edit Stock*\n\nSelect category to edit stock:';

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleBulkStockCategorySelect(ctx, categoryId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  bulkEditState.set(adminId, { type: 'stock', categoryId });

  const message = lang === 'ms'
    ? '📊 *Bulk Edit Stok*\n\nHantar perubahan stok:\n\nContoh:\n• `+50` - Tambah 50 unit ke semua produk\n• `-10` - Kurang 10 unit dari semua produk\n• `100` - Set stok tetap 100 untuk semua produk'
    : '📊 *Bulk Edit Stock*\n\nSend stock change:\n\nExample:\n• `+50` - Add 50 units to all products\n• `-10` - Remove 10 units from all products\n• `100` - Set fixed stock 100 for all products';

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processBulkEdit(ctx) {
  const adminId = ctx.from.id;

  if (!bulkEditState.has(adminId)) {
    return false;
  }

  const editData = bulkEditState.get(adminId);
  const input = ctx.message.text.trim();

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const categoryProducts = products.filter(p => p.categoryId === editData.categoryId);

  if (categoryProducts.length === 0) {
    await ctx.reply(lang === 'ms' ? '❌ Tiada produk dalam kategori' : '❌ No products in category');
    bulkEditState.delete(adminId);
    return true;
  }

  if (editData.type === 'price') {
    const isPercentage = input.includes('+') || input.includes('-');
    const value = parseFloat(input.replace(/[^0-9.-]/g, ''));

    if (isNaN(value)) {
      await ctx.reply(lang === 'ms' ? '❌ Nilai tidak sah' : '❌ Invalid value');
      bulkEditState.delete(adminId);
      return true;
    }

    for (const prod of categoryProducts) {
      let newPrice;
      if (isPercentage) {
        const change = prod.price * (value / 100);
        newPrice = Math.max(0.01, prod.price + change);
      } else {
        newPrice = Math.max(0.01, value);
      }
      newPrice = Math.round(newPrice * 100) / 100;
      await db.updateProduct(prod.id, { price: newPrice });
    }

    const message = lang === 'ms'
      ? `✅ *Harga dikemaskini!*\n\n${categoryProducts.length} produk telah dikemaskini.`
      : `✅ *Price updated!*\n\n${categoryProducts.length} products updated.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } else if (editData.type === 'stock') {
    const isRelative = input.includes('+') || input.includes('-');
    const value = parseInt(input);

    if (isNaN(value)) {
      await ctx.reply(lang === 'ms' ? '❌ Nilai tidak sah' : '❌ Invalid value');
      bulkEditState.delete(adminId);
      return true;
    }

    for (const prod of categoryProducts) {
      let newStock;
      if (isRelative) {
        newStock = Math.max(0, prod.stock + value);
      } else {
        newStock = Math.max(0, value);
      }
      await db.updateProduct(prod.id, { stock: newStock });

      // Log inventory movement
      logInventoryMovement({
        productId: prod.id,
        productName: prod.name.ms,
        type: 'manual_adjustment',
        quantity: isRelative ? value : (value - prod.stock),
        note: 'Bulk stock adjustment',
        adminId: adminId
      });
    }

    const message = lang === 'ms'
      ? `✅ *Stok dikemaskini!*\n\n${categoryProducts.length} produk telah dikemaskini.`
      : `✅ *Stock updated!*\n\n${categoryProducts.length} products updated.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  bulkEditState.delete(adminId);
  return true;
}

async function handleBulkDeleteInactive(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const inactiveProducts = products.filter(p => !p.active);

  if (inactiveProducts.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? '✅ Tiada produk tidak aktif' : '✅ No inactive products');
    return;
  }

  const text = lang === 'ms'
    ? `⚠️ *Padam Produk Tidak Aktif*\n\n${inactiveProducts.length} produk tidak aktif akan dipadam.\n\n*Tindakan ini tidak boleh dibatalkan!*\n\nTeruskan?`
    : `⚠️ *Delete Inactive Products*\n\n${inactiveProducts.length} inactive products will be deleted.\n\n*This action cannot be undone!*\n\nContinue?`;

  const buttons = [
    [
      Markup.button.callback(lang === 'ms' ? '❌ Batal' : '❌ Cancel', 'bulk_operations'),
      Markup.button.callback(lang === 'ms' ? '🗑️ Ya, Padam' : '🗑️ Yes, Delete', 'bulk_delete_confirm')
    ]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleBulkDeleteConfirm(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const inactiveProducts = products.filter(p => !p.active);
  const deletedCount = inactiveProducts.length;

  for (const p of inactiveProducts) {
    await db.deleteProduct(p.id);
  }

  const message = lang === 'ms'
    ? `✅ *Selesai!*\n\n${deletedCount} produk tidak aktif telah dipadam.`
    : `✅ *Complete!*\n\n${deletedCount} inactive products deleted.`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Selesai' : '✅ Complete');
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

module.exports = {
  handleBulkOperations,
  handleBulkActivateAll,
  handleBulkDeactivateAll,
  handleBulkPriceByCategory,
  handleBulkPriceCategorySelect,
  handleBulkStockByCategory,
  handleBulkStockCategorySelect,
  processBulkEdit,
  handleBulkDeleteInactive,
  handleBulkDeleteConfirm,
  bulkEditState
};
