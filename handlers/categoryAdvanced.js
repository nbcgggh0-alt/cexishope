const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

async function handleCategorySort(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const text = lang === 'ms'
    ? '🔄 *Susun Kategori*\n\nPilih cara susun kategori:'
    : '🔄 *Sort Categories*\n\nSelect sorting method:';
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📝 Nama A-Z' : '📝 Name A-Z', 'sort_cat_name_asc')],
    [Markup.button.callback(lang === 'ms' ? '📝 Nama Z-A' : '📝 Name Z-A', 'sort_cat_name_desc')],
    [Markup.button.callback(lang === 'ms' ? '📦 Jumlah Produk ↑' : '📦 Product Count ↑', 'sort_cat_prod_asc')],
    [Markup.button.callback(lang === 'ms' ? '📦 Jumlah Produk ↓' : '📦 Product Count ↓', 'sort_cat_prod_desc')],
    [Markup.button.callback(lang === 'ms' ? '📅 Terbaru' : '📅 Newest First', 'sort_cat_newest')],
    [Markup.button.callback(lang === 'ms' ? '📅 Terlama' : '📅 Oldest First', 'sort_cat_oldest')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'cat_management')]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategorySortCallback(ctx, sortType) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  let categories = await db.getCategories();
  const products = await db.getProducts();
  
  switch(sortType) {
    case 'name_asc':
      categories.sort((a, b) => (a.name.ms || '').localeCompare(b.name.ms || ''));
      break;
    case 'name_desc':
      categories.sort((a, b) => (b.name.ms || '').localeCompare(a.name.ms || ''));
      break;
    case 'prod_asc':
      categories.sort((a, b) => {
        const aCount = products.filter(p => p.categoryId === a.id).length;
        const bCount = products.filter(p => p.categoryId === b.id).length;
        return aCount - bCount;
      });
      break;
    case 'prod_desc':
      categories.sort((a, b) => {
        const aCount = products.filter(p => p.categoryId === a.id).length;
        const bCount = products.filter(p => p.categoryId === b.id).length;
        return bCount - aCount;
      });
      break;
    case 'newest':
      categories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'oldest':
      categories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
  }
  
  await db.saveCategories(categories);
  
  let text = lang === 'ms'
    ? `✅ *Kategori Disusun*\n\n`
    : `✅ *Categories Sorted*\n\n`;
  
  const buttons = [];
  
  categories.forEach((cat, index) => {
    const prodCount = products.filter(p => p.categoryId === cat.id).length;
    text += `${index + 1}. ${cat.icon} ${cat.name.ms} (${prodCount} produk)\n`;
    buttons.push([
      Markup.button.callback(`${cat.icon} ${cat.name.ms}`, `cat_manage_${cat.id}`)
    ]);
  });
  
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'cat_management')]);
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategoryAnalytics(ctx, categoryId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const categories = await db.getCategories();
  const category = categories.find(c => c.id === categoryId);
  
  if (!category) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Kategori tidak dijumpai' : 'Category not found');
    return;
  }
  
  const products = await db.getProducts();
  const transactions = await db.getTransactions();
  
  const categoryProducts = products.filter(p => p.categoryId === categoryId);
  const activeProducts = categoryProducts.filter(p => p.active);
  const totalStock = categoryProducts.reduce((sum, p) => sum + p.stock, 0);
  const avgPrice = categoryProducts.length > 0 
    ? categoryProducts.reduce((sum, p) => sum + p.price, 0) / categoryProducts.length 
    : 0;
  
  const categoryOrders = transactions.filter(t => {
    const prod = products.find(p => p.id === t.productId);
    return prod && prod.categoryId === categoryId;
  });
  
  const completedOrders = categoryOrders.filter(t => t.status === 'completed');
  const revenue = completedOrders.reduce((sum, t) => sum + (t.price || 0), 0);
  
  const text = lang === 'ms'
    ? `📊 *Analitik Kategori*\n\n` +
      `${category.icon} *${category.name.ms}*\n\n` +
      `📦 *Produk:*\n` +
      `  • Total: ${categoryProducts.length}\n` +
      `  • Aktif: ${activeProducts.length}\n` +
      `  • Tidak Aktif: ${categoryProducts.length - activeProducts.length}\n\n` +
      `📊 *Inventori:*\n` +
      `  • Total Stok: ${totalStock} unit\n` +
      `  • Avg Harga: RM${avgPrice.toFixed(2)}\n\n` +
      `💰 *Jualan:*\n` +
      `  • Total Order: ${categoryOrders.length}\n` +
      `  • Selesai: ${completedOrders.length}\n` +
      `  • Hasil: RM${revenue.toFixed(2)}\n` +
      `  • Conversion: ${categoryOrders.length > 0 ? ((completedOrders.length/categoryOrders.length)*100).toFixed(1) : 0}%`
    : `📊 *Category Analytics*\n\n` +
      `${category.icon} *${category.name.en || category.name.ms}*\n\n` +
      `📦 *Products:*\n` +
      `  • Total: ${categoryProducts.length}\n` +
      `  • Active: ${activeProducts.length}\n` +
      `  • Inactive: ${categoryProducts.length - activeProducts.length}\n\n` +
      `📊 *Inventory:*\n` +
      `  • Total Stock: ${totalStock} units\n` +
      `  • Avg Price: RM${avgPrice.toFixed(2)}\n\n` +
      `💰 *Sales:*\n` +
      `  • Total Orders: ${categoryOrders.length}\n` +
      `  • Completed: ${completedOrders.length}\n` +
      `  • Revenue: RM${revenue.toFixed(2)}\n` +
      `  • Conversion: ${categoryOrders.length > 0 ? ((completedOrders.length/categoryOrders.length)*100).toFixed(1) : 0}%`;
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `cat_manage_${categoryId}`)]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategoryIconSelector(ctx, categoryId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const presetIcons = [
    '📦', '🎮', '🎬', '📱', '💻', '🎵', '📚', '🍔', '🏠', '🚗',
    '✈️', '🏖️', '💎', '👔', '👗', '👟', '⚽', '🎨', '🔧', '🔑',
    '💊', '🌟', '🔥', '⭐', '💰', '🎁', '🎯', '🎪', '🎭', '🎺'
  ];
  
  const buttons = [];
  const row = [];
  
  presetIcons.forEach((icon, index) => {
    row.push(Markup.button.callback(icon, `set_cat_icon_${categoryId}_${icon}`));
    if ((index + 1) % 5 === 0) {
      buttons.push([...row]);
      row.length = 0;
    }
  });
  
  if (row.length > 0) {
    buttons.push([...row]);
  }
  
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `cat_manage_${categoryId}`)]);
  
  const text = lang === 'ms'
    ? '🎨 *Pilih Icon Kategori*\n\nPilih icon dari senarai atau hantar emoji sendiri:'
    : '🎨 *Select Category Icon*\n\nSelect icon from list or send your own emoji:';
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleSetCategoryIcon(ctx, categoryId, icon) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const categories = await db.getCategories();
  const category = categories.find(c => c.id === categoryId);
  
  if (!category) {
    await ctx.answerCbQuery('Category not found');
    return;
  }
  
  category.icon = icon;
  await db.saveCategories(categories);
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  await ctx.answerCbQuery(lang === 'ms' ? '✅ Icon dikemaskini' : '✅ Icon updated');
  
  const { handleCategoryDetail } = require('./categoryManagement');
  await handleCategoryDetail(ctx, categoryId);
}

module.exports = {
  handleCategorySort,
  handleCategorySortCallback,
  handleCategoryAnalytics,
  handleCategoryIconSelector,
  handleSetCategoryIcon
};
