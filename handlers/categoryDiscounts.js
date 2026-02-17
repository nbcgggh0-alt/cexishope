const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const discountState = new Map();

// Helper: safely extract category name string
function getCatName(cat, lang = 'ms') {
  if (!cat || !cat.name) return 'Unknown';
  if (typeof cat.name === 'string') return cat.name;
  return cat.name[lang] || cat.name['ms'] || cat.name['en'] || 'Unknown';
}

// Helper: safely get icon
function getCatIcon(cat) {
  return cat?.icon || '📂';
}

async function handleCategoryDiscounts(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();
  const categoriesWithDiscounts = categories.filter(c => c.discount);

  const text = lang === 'ms'
    ? `🏷️ *Diskaun Kategori*\n\n` +
    `📊 Kategori dengan diskaun: ${categoriesWithDiscounts.length}/${categories.length}\n\n` +
    (categoriesWithDiscounts.length > 0
      ? categoriesWithDiscounts.map(c => {
        const discountText = c.discount.type === 'percentage'
          ? `${c.discount.value}%`
          : `RM${c.discount.value}`;
        return `${getCatIcon(c)} *${getCatName(c, 'ms')}*\n   💰 Diskaun: ${discountText}`;
      }).join('\n\n')
      : '📭 Tiada diskaun kategori aktif') +
    `\n\nPilih kategori untuk urus diskaun:`
    : `🏷️ *Category Discounts*\n\n` +
    `📊 Categories with discounts: ${categoriesWithDiscounts.length}/${categories.length}\n\n` +
    (categoriesWithDiscounts.length > 0
      ? categoriesWithDiscounts.map(c => {
        const discountText = c.discount.type === 'percentage'
          ? `${c.discount.value}%`
          : `RM${c.discount.value}`;
        return `${getCatIcon(c)} *${getCatName(c, 'en')}*\n   💰 Discount: ${discountText}`;
      }).join('\n\n')
      : '📭 No active category discounts') +
    `\n\nSelect category to manage discount:`;

  const buttons = categories.map(c => {
    const hasDiscount = c.discount ? '🏷️ ' : '';
    return [Markup.button.callback(
      `${hasDiscount}${getCatIcon(c)} ${getCatName(c, 'ms')}`,
      `cat_disc_${c.id}`
    )];
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'cat_management')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategoryDiscountDetail(ctx, categoryId) {
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
  const categoryProducts = products.filter(p => p.categoryId === categoryId && p.active);

  const text = lang === 'ms'
    ? `🏷️ *Diskaun: ${getCatIcon(category)} ${getCatName(category, 'ms')}*\n\n` +
    `📦 Produk dalam kategori: ${categoryProducts.length}\n\n` +
    (category.discount
      ? `✅ *Diskaun Aktif*\n` +
      `Jenis: ${category.discount.type === 'percentage' ? 'Peratusan' : 'Tetap'}\n` +
      `Nilai: ${category.discount.type === 'percentage' ? `${category.discount.value}%` : `RM${category.discount.value}`}\n\n` +
      `Semua ${categoryProducts.length} produk dalam kategori ini mendapat diskaun.`
      : `❌ *Tiada Diskaun*\n\nTambah diskaun untuk kategori ini.`) +
    `\n\nPilih tindakan:`
    : `🏷️ *Discount: ${getCatIcon(category)} ${getCatName(category, 'en')}*\n\n` +
    `📦 Products in category: ${categoryProducts.length}\n\n` +
    (category.discount
      ? `✅ *Active Discount*\n` +
      `Type: ${category.discount.type === 'percentage' ? 'Percentage' : 'Fixed'}\n` +
      `Value: ${category.discount.type === 'percentage' ? `${category.discount.value}%` : `RM${category.discount.value}`}\n\n` +
      `All ${categoryProducts.length} products in this category get discount.`
      : `❌ *No Discount*\n\nAdd discount for this category.`) +
    `\n\nChoose action:`;

  const buttons = [];

  if (category.discount) {
    buttons.push(
      [Markup.button.callback(lang === 'ms' ? '✏️ Edit Diskaun' : '✏️ Edit Discount', `cat_disc_edit_${categoryId}`)],
      [Markup.button.callback(lang === 'ms' ? '🗑️ Padam Diskaun' : '🗑️ Remove Discount', `cat_disc_remove_${categoryId}`)]
    );
  } else {
    buttons.push(
      [Markup.button.callback(lang === 'ms' ? '➕ Diskaun Peratusan' : '➕ Percentage Discount', `cat_disc_add_pct_${categoryId}`)],
      [Markup.button.callback(lang === 'ms' ? '➕ Diskaun Tetap' : '➕ Fixed Discount', `cat_disc_add_fix_${categoryId}`)]
    );
  }

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'category_discounts')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAddCategoryDiscount(ctx, categoryId, type) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  discountState.set(adminId, { categoryId, type });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `💰 *Tambah Diskaun ${type === 'percentage' ? 'Peratusan' : 'Tetap'}*\n\n` +
      (type === 'percentage'
        ? `Sila hantar peratusan diskaun (1-100)\nContoh: 10 untuk 10% off\nContoh: 25 untuk 25% off`
        : `Sila hantar nilai diskaun dalam RM\nContoh: 5 untuk RM5 off\nContoh: 10 untuk RM10 off`)
      : `💰 *Add ${type === 'percentage' ? 'Percentage' : 'Fixed'} Discount*\n\n` +
      (type === 'percentage'
        ? `Please send discount percentage (1-100)\nExample: 10 for 10% off\nExample: 25 for 25% off`
        : `Please send discount value in RM\nExample: 5 for RM5 off\nExample: 10 for RM10 off`),
    { parse_mode: 'Markdown' }
  );
}

async function processDiscountInput(ctx) {
  const userId = ctx.from.id;
  const state = discountState.get(userId);

  if (!state) return false;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const value = parseFloat(ctx.message.text.trim());

  if (isNaN(value) || value <= 0) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Nilai tidak sah! Sila masukkan nombor yang sah.'
        : '❌ Invalid value! Please enter a valid number.'
    );
    return true;
  }

  if (state.type === 'percentage' && value > 100) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Peratusan mesti antara 1-100!'
        : '❌ Percentage must be between 1-100!'
    );
    return true;
  }

  const categories = await db.getCategories();
  const categoryIdx = categories.findIndex(c => c.id === state.categoryId);

  if (categoryIdx === -1) {
    discountState.delete(userId);
    await ctx.reply(lang === 'ms' ? '❌ Kategori tidak dijumpai' : '❌ Category not found');
    return true;
  }

  categories[categoryIdx].discount = {
    type: state.type,
    value: value
  };

  await db.saveCategories(categories);
  discountState.delete(userId);

  const discountText = state.type === 'percentage' ? `${value}%` : `RM${value}`;

  await ctx.reply(
    lang === 'ms'
      ? `✅ *Diskaun berjaya ditambah!*\n\n` +
      `🏷️ Kategori: ${getCatName(categories[categoryIdx], 'ms')}\n` +
      `💰 Diskaun: ${discountText}\n\n` +
      `Semua produk dalam kategori ini kini mendapat diskaun ini.`
      : `✅ *Discount successfully added!*\n\n` +
      `🏷️ Category: ${getCatName(categories[categoryIdx], 'en')}\n` +
      `💰 Discount: ${discountText}\n\n` +
      `All products in this category now get this discount.`,
    { parse_mode: 'Markdown' }
  );
  return true;
}

async function handleRemoveCategoryDiscount(ctx, categoryId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();
  const categoryIdx = categories.findIndex(c => c.id === categoryId);

  if (categoryIdx === -1) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Kategori tidak dijumpai' : 'Category not found');
    return;
  }

  delete categories[categoryIdx].discount;
  await db.saveCategories(categories);

  await ctx.answerCbQuery(
    lang === 'ms'
      ? '✅ Diskaun dipadam'
      : '✅ Discount removed'
  );

  await handleCategoryDiscountDetail(ctx, categoryId);
}

function getDiscountedPrice(product, categories) {
  const category = categories.find(c => c.id === product.categoryId);

  if (!category || !category.discount) {
    return product.price;
  }

  if (category.discount.type === 'percentage') {
    return product.price * (1 - category.discount.value / 100);
  } else {
    return Math.max(0, product.price - category.discount.value);
  }
}

module.exports = {
  handleCategoryDiscounts,
  handleCategoryDiscountDetail,
  handleAddCategoryDiscount,
  processDiscountInput,
  handleRemoveCategoryDiscount,
  getDiscountedPrice
};
