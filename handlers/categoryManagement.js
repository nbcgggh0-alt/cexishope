const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

async function handleCategoryManagement(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const categories = await db.getCategories();
  
  const text = lang === 'ms'
    ? `📂 *Pengurusan Kategori*\n\n📊 Jumlah Kategori: ${categories.length}\n\nPilih kategori untuk edit/delete atau tambah kategori baru:`
    : `📂 *Category Management*\n\n📊 Total Categories: ${categories.length}\n\nSelect a category to edit/delete or add new category:`;
  
  const buttons = [];
  
  categories.forEach(cat => {
    buttons.push([
      Markup.button.callback(`${cat.icon} ${cat.name.ms}`, `cat_manage_${cat.id}`)
    ]);
  });
  
  buttons.push([Markup.button.callback(lang === 'ms' ? '➕ Tambah Kategori' : '➕ Add Category', 'cat_add_new')]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🏷️ Diskaun Kategori' : '🏷️ Category Discounts', 'category_discounts')]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔄 Susun Kategori' : '🔄 Sort Categories', 'category_sort')]);
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategoryDetail(ctx, categoryId) {
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
  const categoryProducts = products.filter(p => p.categoryId === categoryId);
  
  const text = lang === 'ms'
    ? `${category.icon} *${category.name.ms}*\n\n` +
      `🆔 ID: \`${category.id}\`\n` +
      `📦 Produk: ${categoryProducts.length}\n` +
      `📅 Dibuat: ${new Date(category.createdAt).toLocaleDateString('ms-MY')}\n\n` +
      `Pilih tindakan:`
    : `${category.icon} *${category.name.en || category.name.ms}*\n\n` +
      `🆔 ID: \`${category.id}\`\n` +
      `📦 Products: ${categoryProducts.length}\n` +
      `📅 Created: ${new Date(category.createdAt).toLocaleDateString('en-MY')}\n\n` +
      `Choose action:`;
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '✏️ Edit Nama' : '✏️ Edit Name', `cat_edit_name_${categoryId}`)],
    [Markup.button.callback(lang === 'ms' ? '🎨 Edit Icon' : '🎨 Edit Icon', `cat_icon_select_${categoryId}`)],
    [Markup.button.callback(lang === 'ms' ? '📊 Analitik' : '📊 Analytics', `cat_analytics_${categoryId}`)],
    [Markup.button.callback(lang === 'ms' ? '🗑️ Padam Kategori' : '🗑️ Delete Category', `cat_delete_${categoryId}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'cat_management')]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleDeleteCategory(ctx, categoryId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const products = await db.getProducts();
  const categoryProducts = products.filter(p => p.categoryId === categoryId);
  
  if (categoryProducts.length > 0) {
    await ctx.answerCbQuery(
      lang === 'ms' 
        ? `❌ Tidak boleh padam! ${categoryProducts.length} produk dalam kategori ini.`
        : `❌ Cannot delete! ${categoryProducts.length} products in this category.`,
      { show_alert: true }
    );
    return;
  }
  
  const categories = await db.getCategories();
  const categoryIndex = categories.findIndex(c => c.id === categoryId);
  
  if (categoryIndex === -1) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Kategori tidak dijumpai' : 'Category not found');
    return;
  }
  
  const category = categories[categoryIndex];
  categories.splice(categoryIndex, 1);
  await db.saveCategories(categories);
  
  const message = lang === 'ms'
    ? `✅ *Kategori berjaya dipadam!*\n\n${category.icon} ${category.name.ms}`
    : `✅ *Category deleted successfully!*\n\n${category.icon} ${category.name.en || category.name.ms}`;
  
  await ctx.answerCbQuery(lang === 'ms' ? '✅ Kategori dipadam' : '✅ Category deleted');
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
  
  await handleCategoryManagement(ctx);
}

const categoryEditState = new Map();

async function handleEditCategoryName(ctx, categoryId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  categoryEditState.set(adminId, { type: 'name', categoryId });
  
  const message = lang === 'ms'
    ? `✏️ *Edit Nama Kategori*\n\nHantar nama baru untuk kategori ini.\n\nContoh: Streaming Premium`
    : `✏️ *Edit Category Name*\n\nSend the new name for this category.\n\nExample: Premium Streaming`;
  
  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleEditCategoryIcon(ctx, categoryId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  categoryEditState.set(adminId, { type: 'icon', categoryId });
  
  const message = lang === 'ms'
    ? `🎨 *Edit Icon Kategori*\n\nHantar emoji untuk icon kategori.\n\nContoh: 🎬 atau 📱 atau 🎮`
    : `🎨 *Edit Category Icon*\n\nSend an emoji for the category icon.\n\nExample: 🎬 or 📱 or 🎮`;
  
  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processCategoryEdit(ctx) {
  const adminId = ctx.from.id;
  
  if (!categoryEditState.has(adminId)) {
    return false;
  }
  
  const editData = categoryEditState.get(adminId);
  const newValue = ctx.message.text.trim();
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const categories = await db.getCategories();
  const category = categories.find(c => c.id === editData.categoryId);
  
  if (!category) {
    await ctx.reply(lang === 'ms' ? '❌ Kategori tidak dijumpai' : '❌ Category not found');
    categoryEditState.delete(adminId);
    return true;
  }
  
  if (editData.type === 'name') {
    category.name = { ms: newValue, en: newValue };
    await db.saveCategories(categories);
    
    const message = lang === 'ms'
      ? `✅ *Nama kategori dikemaskini!*\n\n${category.icon} ${category.name.ms}`
      : `✅ *Category name updated!*\n\n${category.icon} ${category.name.en || category.name.ms}`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } else if (editData.type === 'icon') {
    category.icon = newValue;
    await db.saveCategories(categories);
    
    const message = lang === 'ms'
      ? `✅ *Icon kategori dikemaskini!*\n\n${category.icon} ${category.name.ms}`
      : `✅ *Category icon updated!*\n\n${category.icon} ${category.name.en || category.name.ms}`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  categoryEditState.delete(adminId);
  return true;
}

module.exports = {
  handleCategoryManagement,
  handleCategoryDetail,
  handleDeleteCategory,
  handleEditCategoryName,
  handleEditCategoryIcon,
  processCategoryEdit,
  categoryEditState
};
